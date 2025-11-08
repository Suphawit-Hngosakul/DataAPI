import json
import os
import psycopg2
import requests
from xml.sax.saxutils import escape
import xml.etree.ElementTree as ET

# RDS connection
DB_HOST = os.environ['DB_HOST']
DB_NAME = os.environ['DB_NAME']
DB_USER = os.environ['DB_USER']
DB_PASSWORD = os.environ['DB_PASSWORD']
DB_PORT = os.environ.get('DB_PORT', 5432)

# GeoServer connection
GEOSERVER_URL = os.environ['GEOSERVER_URL']
GEOSERVER_USER = os.environ['GEOSERVER_USER']
GEOSERVER_PASSWORD = os.environ['GEOSERVER_PASSWORD']

DATA_TYPE_MAP = {
    'integer': int,
    'bigint': int,
    'numeric': float,
    'real': float,
    'double precision': float,
    'text': str,
    'varchar': str,
    'timestamp': str,
    'boolean': bool
}

VALID_GEOM_TYPES = ['POINT', 'LINESTRING', 'POLYGON', 
                    'MULTIPOINT', 'MULTILINESTRING', 'MULTIPOLYGON']

def to_pascal_case(s):
    """แปลง string เป็น PascalCase สำหรับ GML element"""
    return "".join(word.capitalize() for word in s.lower().split("_"))

def serialize_coords(geom_type, coords):
    """Serialize coordinates สำหรับ GML (simple version)"""
    geom_type = geom_type.upper()
    if geom_type == "POINT":
        return f"{coords[0]},{coords[1]}"
    elif geom_type in ["LINESTRING", "MULTIPOINT"]:
        return " ".join([f"{c[0]},{c[1]}" for c in coords])
    elif geom_type == "POLYGON":
        return " ".join([f"{c[0]},{c[1]}" for c in coords[0]])  # assume first ring
    elif geom_type == "MULTILINESTRING":
        return " ".join([f"{pt[0]},{pt[1]}" for line in coords for pt in line])
    elif geom_type == "MULTIPOLYGON":
        return " ".join([f"{pt[0]},{pt[1]}" for poly in coords for ring in poly for pt in ring])
    else:
        raise ValueError(f"Unsupported geometry type: {geom_type}")

def lambda_handler(event, context):
    try:
        path_params = event.get('pathParameters') or {}
        layer_id = path_params.get("layer_id")

        body = event.get('body')
        if body:
            body = json.loads(body)

        data = body.get('data', {})
        geom = body.get('geom')  # {"type":"POINT","coordinates":[lon,lat]}
        
        if not layer_id or not data or not geom:
            return {"statusCode": 400, "body": json.dumps({"error": "layer_id, data, and geom are required"})}

        # Connect to RDS
        conn = psycopg2.connect(
            host=DB_HOST, database=DB_NAME, user=DB_USER, password=DB_PASSWORD, port=DB_PORT
        )
        cur = conn.cursor()

        # Validate fields
        cur.execute("SELECT field_name, data_type FROM fields WHERE layer_id = %s", (layer_id,))
        rows = cur.fetchall()
        db_fields = {row[0]: row[1] for row in rows}

        errors = []
        for key, value in data.items():
            if key not in db_fields:
                errors.append(f"Field '{key}' not defined for layer {layer_id}")
                continue
            expected_type = db_fields[key].lower()
            py_type = DATA_TYPE_MAP.get(expected_type)
            if not py_type:
                errors.append(f"Unknown DB type '{expected_type}' for field '{key}'")
                continue
            # numeric accept int or float
            if expected_type == "numeric":
                if not isinstance(value, (int, float)):
                    errors.append(f"Field '{key}' expects {expected_type}, got {type(value).__name__}")
            elif not isinstance(value, py_type):
                # allow float with integer value for int fields
                if py_type == int and isinstance(value, float) and value.is_integer():
                    continue
                errors.append(f"Field '{key}' expects {expected_type}, got {type(value).__name__}")


        # Validate geom
        cur.execute("SELECT name, geom_type, srid, dataset_id FROM layers WHERE layer_id = %s", (layer_id,))
        layer_row = cur.fetchone()
        if not layer_row:
            errors.append(f"Layer {layer_id} not found")
        else:
            layer_name_db, geom_type_db, srid_db, dataset_id = layer_row
            if geom_type_db.upper() not in VALID_GEOM_TYPES:
                errors.append(f"Layer geom_type '{geom_type_db}' not supported")
            if geom.get("type", "").upper() != geom_type_db.upper():
                errors.append(f"Geometry type mismatch: expected '{geom_type_db}', got '{geom.get('type')}'")
            if "srid" in geom and geom["srid"] != srid_db:
                errors.append(f"SRID mismatch: expected {srid_db}, got {geom['srid']}")

        if errors:
            cur.close()
            conn.close()
            return {"statusCode": 400, "body": json.dumps({"valid": False, "errors": errors})}

        # query dataset name
        cur.execute("SELECT name FROM datasets WHERE dataset_id = %s", (dataset_id,))
        dataset_row = cur.fetchone()
        if not dataset_row:
            cur.close()
            conn.close()
            return {"statusCode": 400, "body": json.dumps({"error": f"Dataset {dataset_id} not found"})}

        dataset_name = dataset_row[0]
        workspace_name = dataset_name.lower().replace(" ", "_")
        layer_name_xml = layer_name_db #.lower().replace(" ", "_")  # dynamic layer name

        # XML Insert
        geom_type_gml = to_pascal_case(geom["type"])
        coord_str = serialize_coords(geom_type_gml, geom.get("coordinates"))
        attributes_json = json.dumps(data)

        xml_data = f"""<?xml version="1.0" encoding="UTF-8"?>
<wfs:Transaction service="WFS" version="1.1.0"
    xmlns:wfs="http://www.opengis.net/wfs"
    xmlns:gml="http://www.opengis.net/gml"
    xmlns:{workspace_name}="http://{workspace_name}"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.opengis.net/wfs
        http://schemas.opengis.net/wfs/1.1.0/wfs.xsd
        http://www.opengis.net/gml
        http://schemas.opengis.net/gml/3.1.1/base/gml.xsd
        {GEOSERVER_URL}/geoserver/wfs/DescribeFeatureType?typename={workspace_name}:{layer_name_xml}">

  <wfs:Insert>
    <{workspace_name}:{layer_name_xml}>
      <{workspace_name}:layer_id>{layer_id}</{workspace_name}:layer_id>
      <{workspace_name}:attributes>{escape(attributes_json)}</{workspace_name}:attributes>
      <{workspace_name}:geom>
        <gml:{geom_type_gml} srsName="EPSG:{srid_db}">
          <gml:coordinates>{coord_str}</gml:coordinates>
        </gml:{geom_type_gml}>
      </{workspace_name}:geom>
    </{workspace_name}:{layer_name_xml}>
  </wfs:Insert>
</wfs:Transaction>"""

        cur.close()
        conn.close()
        print(workspace_name, layer_name_xml)

        # Send to GeoServer
        response = requests.post(
            f'{GEOSERVER_URL}/geoserver/wfs',
            data=xml_data,
            headers={"Content-Type": "text/xml"},
            auth=(GEOSERVER_USER, GEOSERVER_PASSWORD)
        )
        
        print(response.text)


        root = ET.fromstring(response.text)
        ns = {"wfs": "http://www.opengis.net/wfs"}
        total_inserted = root.find(".//wfs:totalInserted", ns) 


        if response.status_code == 200 and total_inserted.text == "1":
            result = {"success": True, "message": "Feature inserted successfully"}
        else:
            print("status code", response.status_code)
            result = {
                "success": False,
                "message": f"Insert failed"
            }

        return {
            "statusCode": 200 if result["success"] else 500,
            "body": json.dumps(result)
        }

    except Exception as e:
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}
