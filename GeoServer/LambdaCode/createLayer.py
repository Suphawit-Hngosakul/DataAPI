import os
import psycopg2
import requests
import json

# Config
RDS_HOST = os.environ['RDS_HOST']
RDS_PORT = int(os.environ.get('RDS_PORT', 5432))
RDS_DB = os.environ['RDS_DB']
RDS_USER = os.environ['RDS_USER']
RDS_PASS = os.environ['RDS_PASS']

GEOSERVER_URL = os.environ['GEOSERVER_URL']
GEOSERVER_USER = os.environ['GEOSERVER_USER']
GEOSERVER_PASS = os.environ['GEOSERVER_PASS']


def is_array_type(data_type):
    """Check if data_type is an array type"""
    data_type_lower = data_type.lower()
    return data_type_lower.endswith('[]') or data_type_lower.startswith('_')


def get_array_element_type(data_type):
    """Get the element type from array type"""
    data_type_lower = data_type.lower()
    
    # Handle [] notation
    if data_type_lower.endswith('[]'):
        return data_type_lower[:-2]  # Remove []
    
    # Handle internal PostgreSQL array types
    if data_type_lower.startswith('_'):
        mapping = {
            '_text': 'text',
            '_varchar': 'varchar',
            '_int4': 'integer',
            '_int8': 'bigint',
            '_float4': 'real',
            '_float8': 'double precision',
            '_numeric': 'numeric',
            '_bool': 'boolean'
        }
        return mapping.get(data_type_lower, 'text')
    
    return 'text'


def generate_field_sql(field_name, data_type):
    """Generate SQL for extracting field from JSONB attributes"""
    data_type_lower = data_type.lower()
    
    if is_array_type(data_type_lower):
        # For array types, GeoServer doesn't natively support PostgreSQL arrays
        # Convert array to comma-separated string for better compatibility
        element_type = get_array_element_type(data_type_lower)
        
        # Option 1: Convert array to comma-separated string (RECOMMENDED for GeoServer)
        # This makes the field readable as TEXT in GeoServer
        sql = f"""array_to_string(
                ARRAY(
                    SELECT jsonb_array_elements_text(attributes->'{field_name}')
                ), ', ') AS {field_name}"""
        
        # Option 2: Keep as array but cast to text for GeoServer compatibility
        # Uncomment below if you want to keep array notation like {{val1,val2}}
        # sql = f"""ARRAY(
        #     SELECT jsonb_array_elements_text(attributes->'{field_name}')
        # )::{data_type}::text AS {field_name}"""
        
    else:
        # Non-array types (original logic)
        sql = f"(attributes->>'{field_name}')::{data_type} AS {field_name}"
    
    return sql


def lambda_handler(event, context):
    """
    Example Event JSON:
    {
        "layer_name": "noise_measurements",
        "title": "Noise Measurements",
        "srid": 4326,
        "geom_type": "POINT",
        "fields": [
            {"field_name": "noise_level", "data_type": "numeric", "unit": "dB", "description": "Noise level"},
            {"field_name": "species", "data_type": "text[]", "unit": null, "description": "Detected species"},
            {"field_name": "temperatures", "data_type": "numeric[]", "unit": "°C", "description": "Temperature readings"}
        ]
    }
    """
    path_params = event.get('pathParameters') or {}
    dataset_id = path_params.get("dataset_id")

    body = event.get("body")
    if isinstance(body, str):
        body = json.loads(body)
    elif not body:
        body = {}

    layer_name = body.get("layer_name")
    title = body.get("title", layer_name)
    srid = body.get("srid", 4326)
    fields = body.get("fields", [])
    geom_type = body.get("geom_type", "POINT")

    if not layer_name:
        return {"statusCode": 400, "body": "layer_name is required"}

    # Validate fields
    if fields:
        for f in fields:
            if "field_name" not in f or "data_type" not in f:
                return {
                    "statusCode": 400,
                    "body": "Each field must have 'field_name' and 'data_type'"
                }

    # Get workspace name 
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
    layer_name_normalized = layer_name.lower().replace(" ", "_")
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
                """, (dataset_id, layer_name_normalized, geom_type, srid, title))
                layer_id = cur.fetchone()[0]
                conn.commit()
                print(f"Layer created: layer_id={layer_id}")
    except Exception as e:
        return {"statusCode": 500, "body": f"Insert layer error: {e}"}

    # Insert field schema 
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
                        data_type = f["data_type"]
                        field_name = f["field_name"]
                        unit = f.get("unit")
                        description = f.get("description")
                        
                        cur.execute(
                            insert_field_sql, 
                            (layer_id, field_name, data_type, unit, description)
                        )
                        
                        is_array = is_array_type(data_type)
                        print(f'Field: {field_name}, Type: {data_type}, IsArray: {is_array}')
                    
                    conn.commit()
                    print(f"Inserted {len(fields)} fields")
        except Exception as e:
            return {"statusCode": 500, "body": f"Insert fields error: {e}"}

    # Create FeatureType XML (master layer)
    xml_master = f"""<?xml version="1.0" encoding="UTF-8"?>
<featureType>
    <name>{layer_name_normalized}</name>
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
        print(f"Master layer published: {layer_name_normalized}")
    except Exception as e:
        return {"statusCode": 500, "body": f"GeoServer request error: {e}"}

    # Build & Create Virtual View Layer
    try:
        with psycopg2.connect(
            host=RDS_HOST, port=RDS_PORT, database=RDS_DB,
            user=RDS_USER, password=RDS_PASS
        ) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT field_name, data_type FROM fields WHERE layer_id=%s;", (layer_id,))
                field_rows = cur.fetchall()
                print(f"Retrieved {len(field_rows)} fields for view")
    except Exception as e:
        return {"statusCode": 500, "body": f"Query fields error: {e}"}

    if not field_rows:
        return {"statusCode": 400, "body": "No fields defined for this layer"}

    # Generate SQL for each field 
    field_sql_parts = []
    for field_name, data_type in field_rows:
        field_sql = generate_field_sql(field_name, data_type)
        field_sql_parts.append(field_sql)
        print(f"Generated SQL for {field_name}: {field_sql[:100]}...")

    field_sql_complete = ",\n           ".join(field_sql_parts)

    # Build Virtual View XML
    xml_view = f"""<?xml version="1.0" encoding="UTF-8"?>
<featureType>
    <name>{layer_name_normalized}_view</name>
    <title>{title} (View)</title>
    <srs>EPSG:{srid}</srs>
    <enabled>true</enabled>
    <metadata>
        <entry key="JDBC_VIRTUAL_TABLE">
            <virtualTable>
                <name>{layer_name_normalized}_view</name>
                <sql>
                    SELECT measure_id AS id,
                           {field_sql_complete},
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

    # Debug 
    print("=" * 80)
    print("Generated Virtual View SQL:")
    print("=" * 80)
    print(f"""
    SELECT measure_id AS id,
           {field_sql_complete},
           geom,
           timestamp
    FROM measurements
    WHERE layer_id = {layer_id}
    """)
    print("=" * 80)

    try:
        url = f"{GEOSERVER_URL}/rest/workspaces/{workspace}/datastores/{datastore_name}/featuretypes"
        headers = {"Content-Type": "application/xml"}
        r = requests.post(url, data=xml_view, headers=headers,
                          auth=(GEOSERVER_USER, GEOSERVER_PASS), timeout=30)
        if r.status_code not in [200, 201, 202]:
            return {"statusCode": r.status_code, "body": f"GeoServer view layer error: {r.text}"}
        print(f"View layer published: {layer_name_normalized}_view")
    except Exception as e:
        return {"statusCode": 500, "body": f"GeoServer view request error: {e}"}

    print("Layer creation completed:", {
        "layer_id": layer_id,
        "dataset_id": dataset_id,
        "workspace": workspace,
        "fields": len(field_rows)
    })

    return {
        "statusCode": 201,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({
            "layer_id": layer_id,
            "dataset_id": int(dataset_id),
            "workspace": workspace,
            "layer_name": layer_name_normalized,
            "view_name": f"{layer_name_normalized}_view",
            "fields": [
                {
                    "name": f[0], 
                    "type": f[1],
                    "is_array": is_array_type(f[1])
                } 
                for f in field_rows
            ],
            "message": f"Layer '{layer_name}' created with {len(field_rows)} field(s) and published to GeoServer"
        })
    }