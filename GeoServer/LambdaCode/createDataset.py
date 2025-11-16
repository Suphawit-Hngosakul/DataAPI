import os
import json
import psycopg2
import requests

# --- Config --- #
RDS_HOST = os.environ['RDS_HOST']
RDS_PORT = os.environ.get('RDS_PORT', 5432)
RDS_DB = os.environ['RDS_DB']
RDS_USER = os.environ['RDS_USER']
RDS_PASS = os.environ['RDS_PASS']

GEOSERVER_URL = os.environ['GEOSERVER_URL']  
GEOSERVER_USER = os.environ['GEOSERVER_USER']
GEOSERVER_PASS = os.environ['GEOSERVER_PASS']


def lambda_handler(event, context):
    """
    event example:
    {
        "name": "Noise 2025",
        "description": "Crowdsourced noise measurements",
        "owner_id": 1
    }
    """
    event = json.loads(event.get("body", event))

    dataset_name = event.get("name")
    dataset_desc = event.get("description", "")
    owner_id = event.get("owner_id")

    if not dataset_name or not owner_id:
        return {"statusCode": 400, "body": json.dumps({"message" : "Missing required fields"})}

    # Insert dataset into RDS
    try:
        conn = psycopg2.connect(
            host=RDS_HOST,
            port=RDS_PORT,
            database=RDS_DB,
            user=RDS_USER,
            password=RDS_PASS
        )
        cur = conn.cursor()
        insert_sql = """
        INSERT INTO datasets (name, description, owner_id, is_active)
        VALUES (%s, %s, %s, TRUE)
        RETURNING dataset_id;
        """
        cur.execute(insert_sql, (dataset_name, dataset_desc, owner_id))
        dataset_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        print(f"Inserted dataset_id={dataset_id}")
    except Exception as e:
        print("Error inserting dataset:", e)
        return {
            "statusCode" : 500,
            "body" : json.dumps({
                "message" : f"DB insert error {e}"
            })
        }

    # Create workspace in GeoServer
    workspace_name = dataset_name.lower().replace(" ", "_")
    workspace_payload = {
        "workspace": {"name": workspace_name}
    }

    try:
        url_workspace = f"{GEOSERVER_URL}/rest/workspaces"
        headers = {"Content-Type": "application/json"}
        response = requests.post(
            url_workspace,
            auth=(GEOSERVER_USER, GEOSERVER_PASS),
            headers=headers,
            json=workspace_payload,
            timeout=30
        )
        if response.status_code in [200, 201]:
            print(f"Workspace '{workspace_name}' created successfully in GeoServer")
        elif response.status_code == 409:
            print(f"Workspace '{workspace_name}' already exists")
            return {
                "statusCode" : 400,
                "body" : json.dumps({
                    "message" : f"Project '{dataset_name}' already exist" 
                })
            }
        else:
            print("GeoServer response:", response.status_code, response.text)
            return {"statusCode": 500, "body": json.dumps({"message" : f"GeoServer error: {response.text}"})}
    except Exception as e:
        print("Error creating GeoServer workspace:", e)
        return {"statusCode": 500, "body": json.dumps({"message" : f"GeoServer request error: {e}"})}

    # Create datastore in GeoServer
    store_name = f"{workspace_name}_store"
    store_payload = {
        "dataStore": {
            "name": store_name,
            "connectionParameters": {
                "entry": [
                    {"@key": "host", "$": RDS_HOST},
                    {"@key": "port", "$": str(RDS_PORT)},
                    {"@key": "database", "$": RDS_DB},
                    {"@key": "user", "$": RDS_USER},
                    {"@key": "passwd", "$": RDS_PASS},
                    {"@key": "dbtype", "$": "postgis"}
                ]
            }
        }
    }

    try:
        url_store = f"{GEOSERVER_URL}/rest/workspaces/{workspace_name}/datastores"
        headers = {"Content-Type": "application/json"}
        response_store = requests.post(
            url_store,
            auth=(GEOSERVER_USER, GEOSERVER_PASS),
            headers=headers,
            json=store_payload,
            timeout=30
        )

        if response_store.status_code in [200, 201]:
            print(f"Datastore '{store_name}' created successfully in workspace '{workspace_name}'")
        elif response_store.status_code == 409:
            print(f"Datastore '{store_name}' already exists")
        else:
            print("GeoServer datastore response:", response_store.status_code, response_store.text)
            return {"statusCode": 500, "body": json.dumps({"message" : f"GeoServer datastore error: {response_store.text}"})}

    except Exception as e:
        print("Error creating GeoServer datastore:", e)
        return {"statusCode": 500, "body": json.dumps({"message" : f"GeoServer datastore request error: {e}"})}

    return {
        "statusCode": 201,
        "body": json.dumps({
            "dataset_id": dataset_id,
            "workspace": workspace_name,
            "datastore": store_name,
            "message": f"Workspace and datastore created successfully for {dataset_name}"
        })
    }
