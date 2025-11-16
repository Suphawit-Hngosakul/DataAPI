from awsglue.context import GlueContext
from pyspark.context import SparkContext
from awsglue.dynamicframe import DynamicFrame
from pyspark.sql.functions import (
    split, trim, col, concat, lit, coalesce,
    to_timestamp, regexp_replace, size, when, concat_ws, transform
)
from awsglue.job import Job
from awsglue.utils import getResolvedOptions
from datetime import datetime
import sys
import json
import urllib.request
import urllib.parse
from cryptography.fernet import Fernet

# Initialize contexts
args = getResolvedOptions(sys.argv, ['JOB_NAME'])
sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session
job = Job(glueContext)
job.init(args['JOB_NAME'], args)

# API Configuration
API_BASE_URL = "https://mhi9gvthfj.execute-api.us-east-1.amazonaws.com"
OWNER_ID = 2  # Fixed owner_id
cipher = Fernet("<REPLACE THIS WITH ACTUAL KEY>")



USE_EXISTING = False  # Change this to True if bridmic มีอยู่แล้วใน geo

print("=" * 80)
print("Starting Glue Job: Full Export to GeoServer + RDS")
print("=" * 80)
if USE_EXISTING:
    print(" Using existing dataset/layer (skipping API calls)")
else:
    print(" Will create new dataset and layer via API")

# ------------------------------------------------------------------------------
# Create Dataset via API 
# ------------------------------------------------------------------------------

if USE_EXISTING:
    print("\n Using existing dataset...")
    dataset_id = EXISTING_DATASET_ID # Change this ด้วยถ้า birdmic มีอยู่แล้วใน geo
    workspace = "birdmiciot"  
    datastore = "birdmiciot_store"
    print(f"   - Dataset ID: {dataset_id}")
    print(f"   - Workspace: {workspace}")
else:
    print("\n Creating Dataset in GeoServer...")

    dataset_payload = {
        "name": "BirdMicIoT",
        "description": "Observation from BirdMic Devices",
        "owner_id": OWNER_ID
    }

    print(f" Request URL: {API_BASE_URL}/datasets")
    print(f" Request Body: {json.dumps(dataset_payload, indent=2)}")

    try:
        req = urllib.request.Request(
            f"{API_BASE_URL}/datasets",
            data=json.dumps(dataset_payload).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            method='POST'
        )
        
        with urllib.request.urlopen(req, timeout=30) as response:
            response_body = response.read().decode('utf-8')
            dataset_response = json.loads(response_body)
        
        dataset_id = dataset_response['dataset_id']
        workspace = dataset_response['workspace']
        datastore = dataset_response['datastore']
        
        print(f" Dataset created successfully!")
        print(f"   - Dataset ID: {dataset_id}")
        print(f"   - Workspace: {workspace}")
        print(f"   - Datastore: {datastore}")
        
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8') if e.fp else 'No error body'
        print(f" HTTP Error {e.code}: {e.reason}")
        print(f" Response Body: {error_body}")
        print(f" Possible issues:")
        print(f"   Dataset 'BirdMicIoT' may already exist")
        print(f"   owner_id={OWNER_ID} may not exist")
        print(f"   API may require authentication")
        print(f"\  To use existing dataset, set:")
        print(f"   USE_EXISTING = True")
        print(f"   EXISTING_DATASET_ID = <your_dataset_id>")
        raise
        
    except urllib.error.URLError as e:
        print(f" URL Error: {str(e.reason)}")
        print(f" Check network connectivity and API URL")
        raise
        
    except Exception as e:
        print(f" Unexpected error: {str(e)}")
        raise

# ------------------------------------------------------------------------------
# Create Layer via API 
# ------------------------------------------------------------------------------

if USE_EXISTING:
    print("\n Using existing layer...")
    layer_id = EXISTING_LAYER_ID # Change this ด้วยนะถ้ามี project birdmic ใน geo แล้ว
    layer_name = "bird_observations"
    view_name = "bird_observations_view"
    print(f"   - Layer ID: {layer_id}")
    print(f"   - Layer Name: {layer_name}")
else:
    print("\n Creating Layer in GeoServer...")

    layer_payload = {
        "layer_name": "bird_observations",
        "title": "Bird Observation Points",
        "srid": 4326,
        "geom_type": "POINT",
        "fields": [
            {
                "field_name": "light_adc",
                "data_type": "integer",
                "unit": None,
                "description": "Light readings"
            },
            {
                "field_name": "species",
                "data_type": "text[]",
                "unit": None,
                "description": "Detected bird species"
            },
            {
                "field_name": "temperature_c",
                "data_type": "double precision",
                "unit": "°C",
                "description": "Temperature readings"
            },
            {
                "field_name": "board_id",
                "data_type": "text",
                "unit": None,
                "description": "Recording devices"
            },
            {
                "field_name": "DATE",
                "data_type": "text",
                "unit": None,
                "description": "Time stamp"
            },
            {
                "field_name": "humidity_percent",
                "data_type": "double precision",
                "unit": "Percent",
                "description": "Humidity readings"
            }
        ]
    }

    print(f" Request URL: {API_BASE_URL}/datasets/{dataset_id}/layers")
    print(f" Fields count: {len(layer_payload['fields'])}")

    try:
        req = urllib.request.Request(
            f"{API_BASE_URL}/datasets/{dataset_id}/layers",
            data=json.dumps(layer_payload).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            method='POST'
        )
        
        with urllib.request.urlopen(req, timeout=60) as response:
            response_body = response.read().decode('utf-8')
            layer_response = json.loads(response_body)
        
        layer_id = layer_response['layer_id']
        layer_name = layer_response['layer_name']
        view_name = layer_response['view_name']
        field_count = len(layer_response['fields'])
        
        print(f" Layer created successfully!")
        print(f"   - Layer ID: {layer_id}")
        print(f"   - Layer Name: {layer_name}")
        print(f"   - View Name: {view_name}")
        print(f"   - Fields: {field_count}")
        
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8') if e.fp else 'No error body'
        print(f" HTTP Error {e.code}: {e.reason}")
        print(f"Response Body: {error_body}")

        raise
        
    except urllib.error.URLError as e:
        print(f" URL Error: {str(e.reason)}")
        raise
        
    except Exception as e:
        print(f" Unexpected error: {str(e)}")
        import traceback
        print(traceback.format_exc())
        raise

# ------------------------------------------------------------------------------
# Read JSON.GZ from S3 
# ------------------------------------------------------------------------------
print("\n Reading DynamoDB Full Export from S3...")

# Full export path (not incremental)
s3_path = "s3://birdmiciot-export/full-export/AWSDynamoDB/01763266305387-99220094/data/"

print(f" S3 Path: {s3_path}")
print(f" Job Bookmark enabled - will track processed files")

try:
    dyf = glueContext.create_dynamic_frame.from_options(
        connection_type="s3",
        connection_options={
            "paths": [s3_path],
            "recurse": True,
            "compressionType": "gzip"
        },
        format="json",
        transformation_ctx="read_from_s3_dynamodb"
    )
    
    record_count = dyf.count()
    print(f" Successfully read {record_count} DynamoDB records")
    
    if record_count == 0:
        print(" No data found. Exiting.")
        job.commit()
        sys.exit(0)
    
except Exception as e:
    print(f" Error reading from S3: {str(e)}")
    raise

df = dyf.toDF()

print("\n Sample raw DynamoDB data:")
df.printSchema()
df.show(2, truncate=False)

# ------------------------------------------------------------------------------
# Parse DynamoDB Format
# ------------------------------------------------------------------------------
print("\n Parsing DynamoDB data...")

# Filter records with NewImage (for incremental) or Item (for full export)
if "NewImage" in df.columns:
    print("   Format: Incremental Export (NewImage)")
    df = df.filter(col("NewImage").isNotNull())
    df_parsed = df.select(
        col("NewImage.DATE.S").alias("timestamp_str"),
        col("NewImage.DEVICE.S").alias("board_id"),
        col("NewImage.temperature_c.N").cast("double").alias("temperature_c"),
        col("NewImage.humidity.N").cast("double").alias("humidity_percent"),
        col("NewImage.light.N").cast("integer").alias("light_adc"),
        col("NewImage.location.S").alias("location"),
        col("NewImage.species.L").alias("species_list")
    )
elif "Item" in df.columns:
    print("   Format: Full Export (Item)")
    df = df.filter(col("Item").isNotNull())
    df_parsed = df.select(
        col("Item.DATE.S").alias("timestamp_str"),
        col("Item.DEVICE.S").alias("board_id"),
        col("Item.temperature_c.N").cast("double").alias("temperature_c"),
        col("Item.humidity.N").cast("double").alias("humidity_percent"),
        col("Item.light.N").cast("integer").alias("light_adc"),
        col("Item.location.S").alias("location"),
        col("Item.species.L").alias("species_list")
    )
else:
    print(" Unknown DynamoDB format")
    raise ValueError("Neither 'Item' nor 'NewImage' found in data")

print("\n Parsed fields:")
df_parsed.printSchema()
df_parsed.show(5, truncate=False)

# Filter valid records
df_parsed = df_parsed.filter(
    col("board_id").isNotNull() & 
    col("location").isNotNull()
)

parsed_count = df_parsed.count()
print(f" Parsed {parsed_count} valid records")

if parsed_count == 0:
    print(" No valid records after parsing. Exiting.")
    job.commit()
    sys.exit(0)

# ------------------------------------------------------------------------------
# Parse Timestamp
# ------------------------------------------------------------------------------
print("\n Parsing timestamps...")

# Fix malformed dates like "2025-011-16" → "2025-11-16"
from pyspark.sql.functions import regexp_replace as regex

df_parsed = df_parsed.withColumn(
    "timestamp_clean",
    regex(
        regex(col("timestamp_str"), r"-0(\d{2})-", "-$1-"),  # Fix month
        r"-0(\d{2})T", "-$1T"  # Fix day
    )
)

df_parsed = df_parsed.withColumn(
    "record_timestamp",
    to_timestamp(col("timestamp_clean"), "yyyy-MM-dd'T'HH:mm:ssXXX")
)

print(" Sample timestamps:")
df_parsed.select("timestamp_str", "timestamp_clean", "record_timestamp").show(3, truncate=False)

# ------------------------------------------------------------------------------
# Extract Species as JSON Array
# ------------------------------------------------------------------------------
print("\n Extracting species...")

df_parsed = df_parsed.withColumn(
    "species_array",
    when(size(col("species_list")) > 0,
         transform(col("species_list"), lambda x: x.S))
    .otherwise(lit(None))
)

df_parsed = df_parsed.withColumn(
    "species_json",
    concat(
        lit('['),
        concat_ws(',', transform(col("species_array"), lambda x: concat(lit('"'), x, lit('"')))),
        lit(']')
    )
)

print("Sample species:")
df_parsed.select("board_id", "species_json").show(3, truncate=False)

# ------------------------------------------------------------------------------
# Extract Coordinates
# ------------------------------------------------------------------------------
print("\n Processing location data...") 

df_parsed = (
    df_parsed
    .withColumn("location_clean", regexp_replace(trim(col("location")), " +", ""))
    .withColumn("latitude", split(col("location_clean"), ",").getItem(0).cast("double"))
    .withColumn("longitude", split(col("location_clean"), ",").getItem(1).cast("double"))
    .drop("location_clean", "location")
)

df_parsed = df_parsed.filter(
    (col("latitude").isNotNull()) & 
    (col("longitude").isNotNull()) &
    (col("latitude").between(-90, 90)) &
    (col("longitude").between(-180, 180))
)

valid_count = df_parsed.count()
print(f" Valid coordinates: {valid_count} records")

if valid_count == 0:
    print(" No valid coordinates. Exiting.")
    job.commit()
    sys.exit(0)

# ------------------------------------------------------------------------------
# Handle Missing Values
# ------------------------------------------------------------------------------
print("\n Handling missing values...")

df_parsed = df_parsed.withColumn(
    "temperature_c", 
    coalesce(col("temperature_c"), lit(None))
).withColumn(
    "humidity_percent", 
    coalesce(col("humidity_percent"), lit(0.0))
).withColumn(
    "light_adc", 
    coalesce(col("light_adc"), lit(0))
)

print(" Data summary:")
df_parsed.select("board_id", "temperature_c", "humidity_percent", "light_adc").show(5)

# ------------------------------------------------------------------------------
# Create Attributes JSON
# ------------------------------------------------------------------------------
print("\n Creating attributes JSON...")

df_parsed = df_parsed.withColumn(
    "attributes",
    concat(
        lit('{"temperature_c":'), col("temperature_c").cast("string"),
        lit(',"humidity_percent":'), col("humidity_percent").cast("string"),
        lit(',"light_adc":'), col("light_adc").cast("string"),
        lit(',"board_id":"'), col("board_id"),
        lit('","species":'), col("species_json"),
        lit(',"DATE":"'), col("timestamp_str"), lit('"}')
    )
)

print(" Sample attributes:")
df_parsed.select("attributes").show(3, truncate=False)

# ------------------------------------------------------------------------------
# Create WKT Geometry
# ------------------------------------------------------------------------------
print("\n Creating WKT geometry...")

df_parsed = df_parsed.withColumn(
    "geom_wkt",
    concat(lit("POINT("), col("longitude"), lit(" "), col("latitude"), lit(")"))
)

# ------------------------------------------------------------------------------
# Prepare for Insert
# ------------------------------------------------------------------------------
print(f"\n Preparing data for RDS insert...")
print(f"   - Layer ID: {layer_id}")
print(f"   - Created By: {OWNER_ID}")

decrypted_layer_id = cipher.decrypt(layer_id.encode()).decode()
decrypted_layer_id = int(decrypted_layer_id)

df_parsed = df_parsed.withColumn("layer_id", lit(decrypted_layer_id)) \
                     .withColumn("created_by", lit(OWNER_ID))

df_final = df_parsed.select("layer_id", "attributes", "geom_wkt", "created_by")

print(" Final data structure:")
df_final.show(5, truncate=False)
df_final.printSchema()

# ------------------------------------------------------------------------------
# Write to PostgreSQL
# ------------------------------------------------------------------------------
print(f"\n  Writing to PostgreSQL...")

jdbc_url = "jdbc:postgresql://dataapi.ch02qykmqei7.us-east-1.rds.amazonaws.com:5432/postgres"
db_properties = {
    "user": "postgres",
    "password": "datahubadmin",
    "driver": "org.postgresql.Driver",
    "batchsize": "1000",
    "isolationLevel": "READ_COMMITTED"
}

TEMP_TABLE = "temp_measurements_glue"

try:
    # Write to temp table
    print(f" Writing to temp table '{TEMP_TABLE}'...")
    
    df_final.write \
        .mode("overwrite") \
        .jdbc(
            url=jdbc_url,
            table=TEMP_TABLE,
            properties=db_properties
        )
    
    print(f" Wrote {valid_count} records to temp table")
    
    # Transform and insert
    print(f" Inserting into measurements table...")
    
    transform_sql = f"""
    INSERT INTO measurements (layer_id, attributes, geom, created_by)
    SELECT 
        layer_id,
        attributes::jsonb,
        ST_SetSRID(ST_GeomFromText(geom_wkt), 4326),
        created_by
    FROM {TEMP_TABLE}
    WHERE geom_wkt IS NOT NULL 
      AND attributes IS NOT NULL
    ON CONFLICT DO NOTHING
    """
    
    from py4j.java_gateway import java_import
    java_import(spark._jvm, "java.sql.DriverManager")
    
    conn = spark._jvm.DriverManager.getConnection(
        jdbc_url,
        db_properties["user"],
        db_properties["password"]
    )
    
    stmt = conn.createStatement()
    inserted_count = stmt.executeUpdate(transform_sql)
    stmt.close()
    
    print(f" Inserted {inserted_count} records into measurements table")
    
    # Cleanup
    print(f" Cleaning up temp table...")
    cleanup_sql = f"DROP TABLE IF EXISTS {TEMP_TABLE}"
    stmt2 = conn.createStatement()
    stmt2.execute(cleanup_sql)
    stmt2.close()
    conn.close()
    
    print(f" Cleanup completed")
    
except Exception as e:
    print(f"Error: {str(e)}")
    raise

# ------------------------------------------------------------------------------
# Job Completion
# ------------------------------------------------------------------------------
print("\n" + "=" * 80)
print(" JOB COMPLETED SUCCESSFULLY!")
print("=" * 80)
print(f" Summary:")
print(f"   - Dataset ID: {dataset_id}")
print(f"   - Workspace: {workspace}")
print(f"   - Layer ID: {decrypted_layer_id}")
print(f"   - Layer Name: {layer_name}")
print(f"   - Records Processed: {valid_count}")
print(f"   - Records Inserted: {inserted_count}")
print(f"   - Created By: {OWNER_ID}")
print("=" * 80)

job.commit()
