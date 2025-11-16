import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor

RDS_HOST = os.environ['RDS_HOST']
RDS_PORT = int(os.environ.get('RDS_PORT', 5432))
RDS_DB = os.environ['RDS_DB']
RDS_USER = os.environ['RDS_USER']
RDS_PASS = os.environ['RDS_PASS']

def lambda_handler(event, context):
    try:
        query_params = event.get('queryStringParameters') or {}
        path_params = event.get('pathParameters') or {}

        user_id = query_params.get('user_id', None)
        dataset_id = path_params.get('dataset_id', None)

        conn = psycopg2.connect(
            host=RDS_HOST,
            port=RDS_PORT,
            database=RDS_DB,
            user=RDS_USER,
            password=RDS_PASS
        )
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        sql = """
            SELECT d.dataset_id, d.name, d.description, 
                   u.username AS owner, d.source, d.created_at 
            FROM datasets d 
            JOIN users u ON u.user_id = d.owner_id
            WHERE d.is_active = true
        """

        params = []
        if user_id:
            sql += " AND d.owner_id = %s"
            params.append(user_id)
        if dataset_id:
            sql += " AND d.dataset_id = %s"
            params.append(dataset_id)

        cursor.execute(sql, tuple(params))
        dataset_rows = cursor.fetchall()

        cursor.close()
        conn.close()

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({
                "count": len(dataset_rows),
                "datasets": dataset_rows
            }, default=str)
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": str(e)})
        }
