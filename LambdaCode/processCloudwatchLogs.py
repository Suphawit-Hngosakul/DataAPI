import json
import gzip
import base64
import re
from datetime import datetime
from elasticsearch import Elasticsearch, helpers

# Elasticsearch setup (EC2 host)
ES_HOST = 'ES_HOST' 
ES_INDEX = 'geoserver-logs'

es = Elasticsearch(
    ES_HOST
)

if not es.ping():
    print("Cannot connect to Elasticsearch")


# Regex patterns for WFS and WMS
WFS_PATTERN = re.compile(
    r'"GET /+geoserver/(?P<workspace>[^/]+)/ows\?service=WFS&version=(?P<version>[\d\.]+)&request=(?P<request>\w+)&typeName=(?P<layer>[^&]+).*?(?:&bbox=(?P<bbox>[^&]+))?'
)
WMS_PATTERN = re.compile(
    r'"GET /geoserver/(?P<workspace>[^/]+)/ows\?service=WMS&version=(?P<version>[\d\.]+)&request=(?P<request>\w+)&layers=(?P<layer>[^&]+).*?(&bbox=(?P<bbox>[^&]+))?'
)

def parse_log_line(message):
    """Try WFS first, then WMS."""
    match = WFS_PATTERN.search(message)
    print("match", match)
    if not match:
        match = WMS_PATTERN.search(message)
    if not match:
        return None

    data = match.groupdict()
    # decode URL-encoded layer
    data['layer'] = data['layer'].replace('%3A', ':')

    # parse bbox into dict
    if data.get('bbox'):
        try:
            bbox_vals = list(map(float, data['bbox'].split(',')))
            data['bbox'] = {
                "minx": bbox_vals[0],
                "miny": bbox_vals[1],
                "maxx": bbox_vals[2],
                "maxy": bbox_vals[3],
                "crs": bbox_vals[4] if len(bbox_vals) > 4 else 'EPSG:4326'
            }
        except:
            data['bbox'] = None
    return data

def lambda_handler(event, context):
    try:
        # CloudWatch logs come compressed
        cw_data = event['awslogs']['data']
        compressed_payload = base64.b64decode(cw_data)
        decompressed_payload = gzip.decompress(compressed_payload)
        log_event = json.loads(decompressed_payload)
        print("log_event", log_event)

        actions = []
        for log in log_event['logEvents']:
            message = log['message']
            print("message", message)
            parsed = parse_log_line(message)
            if parsed:
                parsed['timestamp'] = datetime.utcfromtimestamp(log['timestamp']/1000).isoformat()
                actions.append({
                    "_index": ES_INDEX,
                    "_source": parsed
                })

        # Bulk insert to Elasticsearch
        if actions:
            helpers.bulk(es, actions)

        return {
            'statusCode': 200,
            'body': json.dumps(f"Processed {len(actions)} log events")
        }

    except Exception as e:
        print(f"Error processing logs: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps(f"Error: {e}")
        }
