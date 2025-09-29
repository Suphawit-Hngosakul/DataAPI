import json
import os
import requests
from datetime import datetime

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
    if "FeatureOfInterest" not in body:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "'FeatureOfInterest' is required"})
        }

    datastream_id = body["datastream_id"]

    # Check Datastream 
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

    # TODO: Validate body['result] before POST to FROST
    # TODO: Make it easy for front end to use

    # build observation
    observation = {
        "result": body["result"],
        "phenomenonTime": body.get("phenomenonTime", datetime.utcnow().isoformat() + "Z"),
        "FeatureOfInterest": body["FeatureOfInterest"]
    }

    # POST observation
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
