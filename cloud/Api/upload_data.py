import json
import os
import requests
from datetime import datetime, timezone

def lambda_handler(event, context):
    url = os.environ.get("FROST_SERVER_URL")
    if not url:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": "FROST_SERVER_URL not set"})
        }

    # parse body
    try:
        body = json.loads(event["body"])
    except Exception:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Invalid JSON body"})
        }

    # validate required fields
    if "datastream_id" not in body:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "'datastream_id' is required"})
        }
    if "result" not in body:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "'result' is required"})
        }
    if "location" not in body['result'] or "lat" not in body['result']["location"] or "long" not in body['result']["location"]:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "'location' with 'lat' and 'long' is required"})
        }


    datastream_id = body["datastream_id"]
    lat, lon = body['result']["location"]["lat"], body['result']["location"]["long"]

    # Find if there is existing datastream
    try:
        resp = requests.get(f"{url}Datastreams({datastream_id})", timeout=10)
        if resp.status_code != 200:
            return {
                "statusCode": resp.status_code,
                "body": resp.text
            }
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": f"Failed to get Datastream: {str(e)}"})
        }

    # Validate columns
    try:
        Sensor = requests.get(f"{url}Datastreams({datastream_id})/Sensor", timeout=10)
        if Sensor.status_code != 200:
            return {
                "statusCode": Sensor.status_code,
                "body": Sensor.text
            }
        resp_json = Sensor.json()
        data_columns = resp_json.get('properties', {})    
        date_col = data_columns.get("DATE")
        result_columns = body.get('result', {})

        expected_cols = set(data_columns.values())  # Allowed columns
        provided_cols = set(result_columns.keys())  # Request's columns
        missing_cols = expected_cols - provided_cols   # Missing columns
        extra_cols = provided_cols - expected_cols    # Invalid columns


        if missing_cols or extra_cols:
            return {
                "statusCode": 400,
                "body": json.dumps({
                    "error": "Column validation failed",
                    "missing_columns": list(missing_cols),
                    "invalid_columns": list(extra_cols)
                })
            }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": f"Failed to validate columns: {str(e)}"}, indent=2)
        }


    # Find existing FOI
    foi_id = None
    try:
        foi_query = f"{url}FeaturesOfInterest?$filter=st_equals(feature, geography'POINT({lon} {lat})')"
        foi_resp = requests.get(foi_query, timeout=10)
        if foi_resp.status_code == 200:
            data = foi_resp.json().get("value", [])
            if data:
                foi_id = data[0]["@iot.id"]
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": f"Failed to query FOI: {str(e)}"}, indent=2)
        }

    # If not create one
    if not foi_id:
        foi_payload = {
            "name": f"FOI at ({lat},{lon})",
            "description": "Auto-created by Lambda",
            "encodingType": "application/vnd.geo+json",
            "feature": {
                "type": "Point",
                "coordinates": [lon, lat]
            }
        }
        try:
            create_resp = requests.post(f"{url}FeaturesOfInterest", json=foi_payload, timeout=10)
            if create_resp.status_code == 201:
                foi_query = f"{url}FeaturesOfInterest?$filter=st_equals(feature, geography'POINT({lon} {lat})')"
                foi_resp = requests.get(foi_query, timeout=10)
                data = foi_resp.json().get("value", [])
                foi_id = data[0]["@iot.id"]
            else:
                return {
                    "statusCode": create_resp.status_code,
                    "body": create_resp.text
                }
        except Exception as e:
            return {
                "statusCode": 500,
                "body": json.dumps({"error": f"Failed to create FOI: {str(e)}"})
            }

    # Create new observation
    result = body['result'].copy()
    result.pop(date_col, None)
    observation = {
        "result": result,
        "phenomenonTime": body['result'].get(date_col, datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")),
        "resultTime" : datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "FeatureOfInterest": {"@iot.id": foi_id}
    }

    # POST to FROST-Server
    try:
        post_resp = requests.post(
            f"{url}Datastreams({datastream_id})/Observations",
            json=observation,
            timeout=10
        )
        return {
            "statusCode": post_resp.status_code,
            "body": post_resp.text
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }
