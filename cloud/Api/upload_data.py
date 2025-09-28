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

    try:
        body = json.loads(event['body'])
        datastream = requests.get(url + f"Datastreams{body['datastream_id']}").json()
    except Exception:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Invalid JSON body"})
        }

    # ตรวจสอบ required fields
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

    # สร้าง observation object
    observation = {
        "result": body["result"],
        "Datastream": { "@iot.id": body["datastream_id"] },
        "phenomenonTime": body.get("phenomenonTime", datetime.utcnow().isoformat() + "Z")
    }

    # Optional: FeatureOfInterest
    if "foi_id" in body:
        observation["FeatureOfInterest"] = { "@iot.id": body["foi_id"] }

    try:
        resp = requests.post(
            url + "Observations",
            json=observation,
            timeout=10
        )
        if resp.status_code in (200, 201):
            return {
                "statusCode": 201,
                "body": resp.text  # return response จาก FROST
            }
        else:
            return {
                "statusCode": resp.status_code,
                "body": resp.text
            }
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }

# TODO : Optimize upload feature