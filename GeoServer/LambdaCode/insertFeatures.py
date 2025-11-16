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
    'boolean': bool,
    # Array types
    'integer[]': list,
    'bigint[]': list,
    'numeric[]': list,
    'real[]': list,
    'double precision[]': list,
    'text[]': list,
    'varchar[]': list,
    'character varying[]': list,
    '_int4': list,  
    '_int8': list,
    '_text': list,
    '_varchar': list,
}

# Map array types to element types
ARRAY_ELEMENT_TYPE_MAP = {
    'integer[]': int,
    'bigint[]': int,
    'numeric[]': float,
    'real[]': float,
    'double precision[]': float,
    'text[]': str,
    'varchar[]': str,
    'character varying[]': str,
    '_int4': int,
    '_int8': int,
    '_text': str,
    '_varchar': str,
}

VALID_GEOM_TYPES = ['POINT', 'LINESTRING', 'POLYGON', 
                    'MULTIPOINT', 'MULTILINESTRING', 'MULTIPOLYGON']

def to_pascal_case(s):
    # แปลง string เป็น PascalCase สำหรับ GML element
    return "".join(word.capitalize() for word in s.lower().split("_"))

def is_array_type(data_type):
    """Check if data_type is an array type"""
    data_type_lower = data_type.lower()
    return data_type_lower.endswith('[]') or data_type_lower.startswith('_')

def validate_array_elements(array_value, element_type, field_name):
    """Validate all elements in array match expected type"""
    errors = []
    if not isinstance(array_value, list):
        errors.append(f"Field '{field_name}' expects array (list), got {type(array_value).__name__}")
        return errors
    
    for idx, elem in enumerate(array_value):
        if elem is None:
            continue  # NULL values allowed in arrays
        
        if element_type == int:
            if not isinstance(elem, int):
                # Allow float 
                if isinstance(elem, float) and elem.is_integer():
                    continue
                errors.append(f"Field '{field_name}[{idx}]' expects int, got {type(elem).__name__}: {elem}")
        elif element_type == float:
            if not isinstance(elem, (int, float)):
                errors.append(f"Field '{field_name}[{idx}]' expects number, got {type(elem).__name__}: {elem}")
        elif element_type == str:
            if not isinstance(elem, str):
                errors.append(f"Field '{field_name}[{idx}]' expects string, got {type(elem).__name__}: {elem}")
        else:
            if not isinstance(elem, element_type):
                errors.append(f"Field '{field_name}[{idx}]' expects {element_type.__name__}, got {type(elem).__name__}: {elem}")
    
    return errors

def serialize_coords(geom_type, coords):
    geom_type = geom_type.upper()
    print("Geom Type from serialize function", geom_type)

    if geom_type == "POINT":
        # [x, y]
        return f"{coords[0]},{coords[1]}"

    elif geom_type == "LINESTRING":
        return " ".join(f"{x},{y}" for x, y in coords)

    elif geom_type == "POLYGON":
        rings = []
        
        for ring in coords:
            rings.append(" ".join(f"{x} {y}" for x, y in ring))
        return rings[0]

    elif geom_type == "MULTIPOINT":
        # coords = [[x1, y1], [x2, y2], ...]
        return " ".join(f"{x} {y}" for x, y in coords)


    elif geom_type == "MULTILINESTRING":
        lines = []
        for line in coords:
            lines.append(" ".join(f"{x} {y}" for x, y in line))
        return " ".join(lines)


    else:
        raise ValueError(f"Unsupported geometry type: {geom_type}")

def generate_gml(geom_type, coords, srid):
    print("Geom Type from generate function", geom_type)
    
    
    if geom_type == "POINT":
        return f"""
    <gml:Point srsName="EPSG:{srid}">
        <gml:coordinates>{serialize_coords(geom_type, coords)}</gml:coordinates>
    </gml:Point>
    """
    
    elif geom_type == "LINESTRING":
        return f"""
    <gml:LineString srsName="EPSG:{srid}">
        <gml:coordinates decimal="." cs="," ts=" ">{serialize_coords(geom_type, coords)}</gml:coordinates>
    </gml:LineString>
        """
        
    elif geom_type == "POLYGON":
        return f"""
    <gml:Polygon srsName="EPSG:{srid}">
        <gml:exterior>
            <gml:LinearRing>
                <gml:posList>
                    {serialize_coords(geom_type, coords)}
                </gml:posList>
            </gml:LinearRing>
        </gml:exterior>
    </gml:Polygon>
    """
    elif geom_type == "MULTIPOINT":
        gml_data = f'<gml:MultiPoint srsName="EPSG:{srid}">\n'
        
        for point in coords:
            gml_data += f"""
                <gml:pointMember>
                    <gml:Point>
                    <gml:pos>{point[0]} {point[1]}</gml:pos>
                    </gml:Point>
                </gml:pointMember>\n"""
        gml_data += "</gml:MultiPoint>"
        return gml_data
        
    elif geom_type == 'MULTILINESTRING':
        # coordinates = [
        #     [[170.0, 45.0], [180.0, 45.0]],
        #     [[-180.0, 45.0], [-170.0, 45.0]]
        # ]
        
        gml_data = f"""
            <gml:MultiLineString srsName="EPSG:{srid}">\n   
        """
        for elm in coords:
            line = ""
            for x, y in elm:
                line += f"{x} {y} "
                print("line", line.strip())
            gml_data += f"""
                <gml:lineStringMember>
                    <gml:LineString>
                        <gml:posList>
                        {line.strip()}
                        </gml:posList>
                    </gml:LineString>
                </gml:lineStringMember>\n
            """
        gml_data += "</gml:MultiLineString>"
        return gml_data
    
    elif geom_type == 'MULTIPOLYGON':
        
        
        gml_data = f'<gml:MultiPolygon srsName="EPSG:{srid}">\n'

        for polygon in coords:               
            for ring in polygon:             
                coord_str = ""
                for x, y in ring:           
                    coord_str += f"{x},{y} "

                gml_data += f"""
                <gml:polygonMember>
                    <gml:Polygon>
                        <gml:outerBoundaryIs>
                            <gml:LinearRing>
                                <gml:coordinates>{coord_str.strip()}</gml:coordinates>
                            </gml:LinearRing>
                        </gml:outerBoundaryIs>
                    </gml:Polygon>
                </gml:polygonMember>
                """

        gml_data += "</gml:MultiPolygon>"
        return gml_data


def lambda_handler(event, context):
    try:
        path_params = event.get('pathParameters') or {}
        layer_id = path_params.get("layer_id")

        body = event.get('body')
        if body:
            body = json.loads(body)
        print("body", body)

        data = body.get('data', {})
        print("data", data)
        geom = body.get('geom')  # {"type":"POINT","coordinates":[lon,lat]}
        print("geom", geom)
        
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
            
            # Check if it an array type
            if is_array_type(expected_type):
                py_type = DATA_TYPE_MAP.get(expected_type)
                if not py_type:
                    errors.append(f"Unknown array type '{expected_type}' for field '{key}'")
                    continue
                
                # Validateb list
                if not isinstance(value, list):
                    errors.append(f"Field '{key}' expects array (list), got {type(value).__name__}")
                    continue
                
                # Validate array elements
                element_type = ARRAY_ELEMENT_TYPE_MAP.get(expected_type)
                if element_type:
                    element_errors = validate_array_elements(value, element_type, key)
                    errors.extend(element_errors)
            else:
                # Non-array type validation 
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
        layer_name_xml = layer_name_db.lower().replace(" ", "_")  

        # สร้าง XML WFS-T Insert
        geom_type_gml = to_pascal_case(geom["type"])
        attributes_json = json.dumps(data)

        geom_gml_xml = generate_gml(geom["type"], geom.get("coordinates"), srid_db)
        print(geom_gml_xml)

        xml_data = f"""<?xml version="1.0" encoding="UTF-8"?>
<wfs:Transaction service="WFS" version="1.0.0"
    xmlns:wfs="http://www.opengis.net/wfs"
    xmlns:gml="http://www.opengis.net/gml"
    xmlns:{workspace_name}="http://{workspace_name}"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.opengis.net/wfs
        http://schemas.opengis.net/wfs/1.0.0/wfs.xsd
        http://www.opengis.net/gml
        http://schemas.opengis.net/gml/3.1.1/base/gml.xsd
        {GEOSERVER_URL}/wfs/DescribeFeatureType?typename={workspace_name}:{layer_name_xml}">

  <wfs:Insert>
    <{workspace_name}:{layer_name_xml}>
      <{workspace_name}:layer_id>{layer_id}</{workspace_name}:layer_id>
      <{workspace_name}:attributes>{escape(attributes_json)}</{workspace_name}:attributes>
      <{workspace_name}:geom>
        {geom_gml_xml}
      </{workspace_name}:geom>
    </{workspace_name}:{layer_name_xml}>
  </wfs:Insert>
</wfs:Transaction>"""

        cur.close()
        conn.close()
        print(workspace_name, layer_name_xml)

        # ส่งไป GeoServer
        response = requests.post(
            f'{GEOSERVER_URL}/wfs',
            data=xml_data,
            headers={"Content-Type": "text/xml"},
            auth=(GEOSERVER_USER, GEOSERVER_PASSWORD)
        )
        
        root = ET.fromstring(response.text)
        ns = {
            "wfs": "http://www.opengis.net/wfs",
            "ogc": "http://www.opengis.net/ogc"
        }

        feature_id_elem = root.find(".//wfs:InsertResult/ogc:FeatureId", ns)

        if feature_id_elem is not None:
            fid = feature_id_elem.get("fid")
            success = True
            message = f"Feature inserted successfully"
        else:
            success = False
            message = f"Insert failed: {response.text}"

        result = {
            "success": success,
            "message": message
        }

        return {
            "statusCode": 200 if result["success"] else 500,
            "body": json.dumps(result)
        }

    except Exception as e:
        import traceback
        print(f"Error: {str(e)}")
        print(traceback.format_exc())
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}