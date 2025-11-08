import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor

# RDS config 
RDS_HOST = os.environ['RDS_HOST']
RDS_PORT = os.environ.get('RDS_PORT', 5432)
RDS_DB = os.environ['RDS_DB']
RDS_USER = os.environ['RDS_USER']
RDS_PASS = os.environ['RDS_PASS']

def lambda_handler(event, context):
    try:
        # รับ dataset_id จาก path param
        dataset_id = event.get('pathParameters', {}).get('dataset_id')
        if not dataset_id:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "dataset_id path parameter is required"})
            }

        # Connect to RDS Postgres 
        conn = psycopg2.connect(
            host=RDS_HOST,
            port=RDS_PORT,
            database=RDS_DB,
            user=RDS_USER,
            password=RDS_PASS
        )

        
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # Query layers 
        cursor.execute("""
            SELECT layer_id, name, geom_type, srid, description, created_at
            FROM layers
            WHERE dataset_id = %s
            ORDER BY layer_id
        """, (dataset_id,))
        layers_rows = cursor.fetchall()

        layers = []

        for layer in layers_rows:
            layer_id = layer['layer_id']

            # Query fields 
            cursor.execute("""
                SELECT field_name, data_type, unit, description
                FROM fields
                WHERE layer_id = %s
                ORDER BY field_id
            """, (layer_id,))
            fields_rows = cursor.fetchall()

            layer_dict = {
                "layer_id": layer['layer_id'],
                "name": layer['name'],
                "geom": {
                    "type": layer['geom_type'],
                    "srid": layer['srid']
                },
                "description": layer['description'],
                "timestamp": layer['created_at'].isoformat(),
                "schema": fields_rows  # list ของ dict จาก RealDictCursor
            }

            layers.append(layer_dict)

        cursor.close()
        conn.close()

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"count" : len(layers),"layers": layers})
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }
