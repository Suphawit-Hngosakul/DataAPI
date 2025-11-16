import os
import json
import psycopg2
import requests

RDS_HOST = os.environ.get("RDS_HOST")
RDS_PORT = os.environ.get("RDS_PORT", 5432)
RDS_DB = os.environ.get("RDS_DB")
RDS_USER = os.environ.get("RDS_USER")
RDS_PASS = os.environ.get("RDS_PASS")

GEOSERVER_URL = os.environ.get("GEOSERVER_URL")

# === MAIN HANDLER ===
def lambda_handler(event, context):
    try:
        # Extract path and query parameters
        path_params = event.get("pathParameters") or {}
        query_params = event.get("queryStringParameters") or {}

        dataset_id = path_params.get("dataset_id")
        layer_id = path_params.get("layer_id")
        cql_filter = query_params.get("CQL_FILTER")
        outputFormat = query_params.get("outputFormat", 'application/json')

        if not dataset_id or not layer_id:
            return {"statusCode": 400, "body": "Missing dataset_id or layer_id"}

        # Connect to RDS 
        with psycopg2.connect(
            host=RDS_HOST, port=RDS_PORT, database=RDS_DB,
            user=RDS_USER, password=RDS_PASS
        ) as conn:
            with conn.cursor() as cur:
                # Get dataset name 
                cur.execute("SELECT name FROM datasets WHERE dataset_id = %s;", (dataset_id,))
                dataset_row = cur.fetchone()
                if not dataset_row:
                    return {"statusCode": 404, "body": f"Dataset {dataset_id} not found"}
                dataset_name = dataset_row[0]

                # Get layer name 
                cur.execute("SELECT name FROM layers WHERE layer_id = %s;", (layer_id,))
                layer_row = cur.fetchone()
                if not layer_row:
                    return {"statusCode": 404, "body": f"Layer {layer_id} not found"}
                layer_name = layer_row[0]

        # Normalize names 
        workspace = dataset_name.lower().replace(" ", "_")
        layer = layer_name.lower().replace(" ", "_")

        # Construct GeoServer WFS URL 
        wfs_url = (
            f"{GEOSERVER_URL}/{workspace}/ows?service=WFS&version=1.0.0&request=GetFeature&typeName={workspace}:{layer}_view&outputFormat={outputFormat}")
        print(f"Constructed WFS URL: {wfs_url}")

        # Add CQL_FILTER if provided 
        params = {}
        if cql_filter:
            params["CQL_FILTER"] = cql_filter

        # Send request to GeoServer 
        response = requests.get(wfs_url, params=params, timeout=10)
        response.raise_for_status()  # raise error if not 2xx

       
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": response.text
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }
