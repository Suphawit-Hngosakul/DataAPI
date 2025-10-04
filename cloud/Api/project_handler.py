import json
import os
import requests

def lambda_handler(event, context):
    url = os.environ.get("FROST_SERVER_URL")
    method = event['requestContext']['http']['method']

    if method == "POST":
        return handle_post(event, url)
    
    if method == "DELETE":
        return handle_delete(event, url)


# Handle POST requests
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
        "description": f"Data schema for {Thing['name']}",
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
        location = response.headers.get("Location")
        datastream_id = location.split("(")[-1].replace(")", "")
        print("Created datastream with @iot.id =", datastream_id)

        thing_id = None
        thing_res = requests.get(url+f"({datastream_id})/Thing", timeout=10)

        if thing_res.status_code == 200:
            thing = thing_res.json()
            thing_id = thing["@iot.id"]
            print("Created thing with @iot.id =", thing_id)

        return {
            "statusCode": 201,
            "body": json.dumps({
                "message": "Datastream created successfully",
                "datastream_id": int(datastream_id),
                "project_id" : thing_id
            }, indent=2)
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }


# Handle DELETE request
def handle_delete(event, url):
    project_id = event.get("pathParameters", {}).get("id")
    print(project_id)
    if not project_id:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Project ID is required in path"}, indent=2)
        }
    
    try:
        # Find datastream 
        resp = requests.get(f"{url}Things({project_id})/Datastreams")
        if resp.status_code != 200:
            return {
                "statusCode": resp.status_code,
                "body": resp.text
            }
        dt_resp = resp.json()
        dt = dt_resp["value"][0]
        dt_id = dt.get("@iot.id", None)

        # Find related sensor
        resp = requests.get(f"{url}Datastreams({dt_id})/Sensor")      
        if resp.status_code != 200:
            return {
                "statusCode": resp.status_code,
                "body": resp.text
            } 
        sensor = resp.json()
        sensor_id = sensor.get("@iot.id", None)

        # Find related observed prop
        resp = requests.get(f"{url}Datastreams({dt_id})/ObservedProperty")
        if resp.status_code != 200:
            return {
                "statusCode": resp.status_code,
                "body": resp.text
            }
        observ_prop = resp.json()
        observ_prop_id = observ_prop.get("@iot.id", None)

        # Delete sensor
        if sensor_id:
            resp = requests.delete(f"{url}Sensors({sensor_id})")
            print("Deleted sensor with @iot.id =", sensor_id)
        # Delete observed prpp
        if observ_prop_id:
            resp = requests.delete(f"{url}ObservedProperties({observ_prop_id})")
            print("Deleted observed property with @iot.id =", observ_prop_id)

        # Delete thing (will cascade delete the rest)
        delete_url = f"{url}Things({project_id})"
        resp = requests.delete(delete_url, timeout=10)
        
        if resp.status_code in (200, 204):
            print("Deleted thing with @iot.id =", project_id)
            return {
                "statusCode": 204
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
    

