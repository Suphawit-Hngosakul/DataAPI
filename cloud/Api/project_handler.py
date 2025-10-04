import json
import os
import requests

def lambda_handler(event, context):
    url = os.environ.get("FROST_SERVER_URL")
    method = event['requestContext']['http']['method']
    if method == "POST":
        return handle_post(event, url)

def handle_post(event, url):
    url = url + "Datastreams"

    try:
        body = json.loads(event['body'])
    except Exception:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Invalid JSON body"}, indent=2)
        }

    # check project
    if not body.get('project'):
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "'project' field is required"}, indent=2)
        }

    # check columns
    if not body.get('columns') or not isinstance(body['columns'], dict):
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "'columns' field must be a JSON and is required"}, indent=2)
        }
    
    
    try:
        date = body['columns']['DATE']
        location = body['columns']['location']
        
    except Exception :
        return {
            "statusCode" : 400,
            "body" : json.dumps({
                "error" : "'DATE' and 'location' are required"
            }, indent=2)
        }

    # check columnsDesc
    if not body.get('columnsDesc') or not isinstance(body['columnsDesc'], dict):
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "'columnsDesc' field must be a JSON and is required"}, indent=2)
        }

    columns = set(body.get('columns', {}))  # Allowed columns
    col_descri = set(body.get('columnsDesc', {}))  # Request's columns

    missing_cols = columns - col_descri  # Missing columns
    extra_cols = col_descri - columns    # Invalid columns

    if missing_cols or extra_cols:
         return {
            "statusCode": 400,
             "body": json.dumps({
                "error": "Column mismatch",
                "missing_columns": list(missing_cols),
                "invalid_columns": list(extra_cols)
            }, indent=2)
        }


    # build FROST entities
    Thing = {
        "name": body['project']['name'],
        "description": body['project']['description']
    }

    Sensor = {
        "name": Thing['name'] + " Columns",
        "description": f"All columns for {Thing['name']}",
        "encodingType": "text/plain",   
        "metadata": "Data schema",
        "properties": {k: v for k, v in body['columns'].items()}
    }

    ObservedProperty = {
        "name": f"{Thing['name']} column details",
        "description": f"Detail for each column in {Thing['name']}",
        "definition": "",
        "properties": {k: v for k, v in body['columnsDesc'].items()}
    }

    Datastream = {
        "name": Thing['name'] + " Datastream",
        "description": f"Datastream for {Thing['name']}",
        "observationType": "",
        "unitOfMeasurement": {},
        "ObservedProperty": ObservedProperty,
        "Sensor": Sensor,
        "Thing": Thing
    }

    try:
        response = requests.post(url, json=Datastream)
        response.raise_for_status()
        return {
            "statusCode": 201,
            "body": json.dumps({"message": "Datastream created successfully"}, indent=2)
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }


    
