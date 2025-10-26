import os
import psycopg2
import requests

# Config
RDS_HOST = os.environ['RDS_HOST']
RDS_PORT = int(os.environ.get('RDS_PORT', 5432))
RDS_DB = os.environ['RDS_DB']
RDS_USER = os.environ['RDS_USER']
RDS_PASS = os.environ['RDS_PASS']

GEOSERVER_URL = os.environ['GEOSERVER_URL']
GEOSERVER_USER = os.environ['GEOSERVER_USER']
GEOSERVER_PASS = os.environ['GEOSERVER_PASS']


def lambda_handler(event, context):
    """
    Example Event JSON:
    {
        "dataset_id": 2,
        "layer_name": "noise_measurements",
        "title": "Noise Measurements",
        "srid": 4326,
        "fields": [
            {"field_name": "noise_level", "data_type": "numeric", "unit" : "String", "description" : "String"},
            {"field_name": "duration", "data_type": "numeric", "unit" : "String", "description" : "String"}
        ]
    }
    """
    dataset_id = event.get("dataset_id")
    layer_name = event.get("layer_name")
    title = event.get("title", layer_name)
    srid = event.get("srid", 4326)
    fields = event.get("fields", [])
    geom_type = "POINT"


    # Get workspace name from datasets table

    try:
        with psycopg2.connect(
            host=RDS_HOST, port=RDS_PORT, database=RDS_DB,
            user=RDS_USER, password=RDS_PASS
        ) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT name FROM datasets WHERE dataset_id=%s;", (dataset_id,))
                row = cur.fetchone()
                if not row:
                    return {"statusCode": 404, "body": f"Dataset ID {dataset_id} not found"}
                workspace = row[0].lower().replace(" ", "_")
    except Exception as e:
        return {"statusCode": 500, "body": f"DB error: {e}"}


    # Insert new layer record
    try:
        with psycopg2.connect(
            host=RDS_HOST, port=RDS_PORT, database=RDS_DB,
            user=RDS_USER, password=RDS_PASS
        ) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO layers (dataset_id, name, geom_type, srid, description)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING layer_id;
                """, (dataset_id, layer_name, geom_type, srid, title))
                layer_id = cur.fetchone()[0]
                conn.commit()
    except Exception as e:
        return {"statusCode": 500, "body": f"Insert layer error: {e}"}


    # TODO: First, check that is this layer already exist? 
    # Insert field schema records
    if fields:
        try:
            with psycopg2.connect(
                host=RDS_HOST, port=RDS_PORT, database=RDS_DB,
                user=RDS_USER, password=RDS_PASS
            ) as conn:
                with conn.cursor() as cur:
                    insert_field_sql = """
                        INSERT INTO fields (layer_id, field_name, data_type, unit, description)
                        VALUES (%s, %s, %s, %s, %s)
                    """
                    for f in fields:
                        cur.execute(insert_field_sql, (layer_id, f["field_name"], f["data_type"], f.get("unit", "NULL"), f.get("description", "NULL")))
                    conn.commit()
        except Exception as e:
            return {"statusCode": 500, "body": f"Insert fields error: {e}"}

    # ──────────────────────────────────────────────
    # Create FeatureType XML (master layer)
    # ──────────────────────────────────────────────
    xml_master = f"""<?xml version="1.0" encoding="UTF-8"?>
<featureType>
    <name>{layer_name}</name>
    <nativeName>measurements</nativeName>
    <title>{title}</title>
    <srs>EPSG:{srid}</srs>
    <enabled>true</enabled>
</featureType>
"""

    datastore_name = f"{workspace}_store"  

    try:
        url = f"{GEOSERVER_URL}/rest/workspaces/{workspace}/datastores/{datastore_name}/featuretypes"
        headers = {"Content-Type": "application/xml"}
        r = requests.post(url, data=xml_master, headers=headers,
                          auth=(GEOSERVER_USER, GEOSERVER_PASS), timeout=30)
        if r.status_code not in [200, 201, 202]:
            return {"statusCode": 500, "body": f"GeoServer master layer error: {r.text}"}
    except Exception as e:
        return {"statusCode": 500, "body": f"GeoServer request error: {e}"}

    # ──────────────────────────────────────────────
    # Build & Create Virtual View Layer
    # ──────────────────────────────────────────────
    try:
        with psycopg2.connect(
            host=RDS_HOST, port=RDS_PORT, database=RDS_DB,
            user=RDS_USER, password=RDS_PASS
        ) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT field_name FROM fields WHERE layer_id=%s;", (layer_id,))
                field_names = [r[0] for r in cur.fetchall()]
    except Exception as e:
        return {"statusCode": 500, "body": f"Query fields error: {e}"}

    if not field_names:
        return {"statusCode": 400, "body": "No fields defined for this layer"}

    
    field_sql = ",\n       ".join([f"attributes->>'{f}' AS {f}" for f in field_names])

    xml_view = f"""<?xml version="1.0" encoding="UTF-8"?>
<featureType>
    <name>{layer_name}_view</name>
    <title>{title} (View)</title>
    <srs>EPSG:{srid}</srs>
    <enabled>true</enabled>
    <metadata>
        <entry key="JDBC_VIRTUAL_TABLE">
            <virtualTable>
                <name>{layer_name}_view</name>
                <sql>
                    SELECT measure_id,
                           {field_sql},
                           geom,
                           timestamp
                    FROM measurements
                    WHERE layer_id = {layer_id}
                </sql>
                <geometry>
                    <name>geom</name>
                    <type>{geom_type.capitalize()}</type>
                    <srid>{srid}</srid>
                </geometry>
            </virtualTable>
        </entry>
    </metadata>
</featureType>
"""

    try:
        url = f"{GEOSERVER_URL}/rest/workspaces/{workspace}/datastores/{datastore_name}/featuretypes"
        headers = {"Content-Type": "application/xml"}
        r = requests.post(url, data=xml_view, headers=headers,
                          auth=(GEOSERVER_USER, GEOSERVER_PASS), timeout=30)
        if r.status_code not in [200, 201, 202]:
            return {"statusCode": 500, "body": f"GeoServer view layer error: {r.text}"}
    except Exception as e:
        return {"statusCode": 500, "body": f"GeoServer view request error: {e}"}

    # ──────────────────────────────────────────────
    # Done
    # ──────────────────────────────────────────────
    return {
        "statusCode": 201,
        "body": {
            "layer_id": layer_id,
            "dataset_id": dataset_id,
            "workspace": workspace,
            "fields": field_names,
            "message": f"Layer '{layer_name}' created with {len(field_names)} field(s) and published to GeoServer"
        }
    }
