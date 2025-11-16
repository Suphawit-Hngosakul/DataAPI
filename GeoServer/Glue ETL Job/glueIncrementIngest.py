from awsglue.context import GlueContext
from pyspark.context import SparkContext
from awsglue.dynamicframe import DynamicFrame
from pyspark.sql.functions import (
    split, trim, col, concat, lit, coalesce,
    to_timestamp, regexp_replace
)
from awsglue.job import Job
from awsglue.utils import getResolvedOptions
from datetime import datetime, timedelta
import sys

# EDIT THIS LINE LATER IF NEEDED
layerid = "<ENTER layer_id FOR BIRD MIC IOT>"

# Initialize contexts
args = getResolvedOptions(sys.argv, ['JOB_NAME'])
sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session
job = Job(glueContext)
job.init(args['JOB_NAME'], args)


# ------------------------------------------------------------------------------
# Read JSON.GZ from S3 
# ------------------------------------------------------------------------------


yesterday = datetime.now() - timedelta(days=1)
s3_path = f"s3://birdmiciot-export/incremental-export/{yesterday.strftime('%Y-%m-%d')}/AWSDynamoDB/data/"

print(f"Reading DynamoDB incremental export from: {s3_path}")
print(f"Job Bookmark will skip already processed .json.gz files")

try:
    # Read compressed JSON files
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
    print(f"Successfully read {record_count} DynamoDB stream records")
    
    if record_count == 0:
        print("No data found. Exiting.")
        job.commit()
        sys.exit(0)
    
except Exception as e:
    print(f"Error reading from S3: {str(e)}")
    raise

df = dyf.toDF()

print("\n Sample raw DynamoDB stream data:")
df.printSchema()
df.show(2, truncate=False)

# ------------------------------------------------------------------------------
# Parse DynamoDB Streams format (NewImage)
# ------------------------------------------------------------------------------
print("\n Parsing DynamoDB NewImage structure...")

# Filter only records with NewImage (skip DELETE events)
df = df.filter(col("NewImage").isNotNull())


# - DATE (timestamp): "2025-11-16T08:04:00+07:00"
# - DEVICE: "ESP32-01"
# - temperature_c: 24
# - humidity: 94.24
# - light: 1822
# - location: "12.799547488250914, 99.4542731051524"
# - species: [{"S": "Asian Emerald Dove"}]
# - files: (ignore)

df_parsed = df.select(
    col("NewImage.DATE.S").alias("timestamp_str"),
    col("NewImage.DEVICE.S").alias("DEVICE"),
    col("NewImage.temperature_c.N").cast("double").alias("temperature_c"),
    col("NewImage.humidity.N").cast("double").alias("humidity_percent"),
    col("NewImage.light.N").cast("integer").alias("light_adc"),
    col("NewImage.location.S").alias("location"),
    col("NewImage.species.L").alias("species_list")
)

print("\n Parsed DynamoDB fields:")
df_parsed.printSchema()
df_parsed.show(5, truncate=False)

# Filter out records without required fields
df_parsed = df_parsed.filter(
    col("DEVICE").isNotNull() & 
    col("location").isNotNull()
)

parsed_count = df_parsed.count()
print(f" Parsed {parsed_count} valid records with NewImage")

if parsed_count == 0:
    print("No valid records after parsing. Exiting.")
    job.commit()
    sys.exit(0)


print("\n Parsing timestamp...")

# Convert ISO 8601 timestamp to PostgreSQL timestamp
df_parsed = df_parsed.withColumn(
    "record_timestamp",
    to_timestamp(col("timestamp_str"), "yyyy-MM-dd'T'HH:mm:ssXXX")
)

print("\n Sample timestamps:")
df_parsed.select("timestamp_str", "record_timestamp").show(3, truncate=False)

# ------------------------------------------------------------------------------
# Extract species 
# ------------------------------------------------------------------------------
print("\n Extracting species as JSON array...")

# species.L : [{"S": "Asian Emerald Dove"}, {"S": "Oriental Magpie Robin"}]
# Convert to JSON array: ["Asian Emerald Dove", "Oriental Magpie Robin"]
from pyspark.sql.functions import size, when, concat_ws, transform

df_parsed = df_parsed.withColumn(
    "species_array",
    when(size(col("species_list")) > 0,
         transform(col("species_list"), lambda x: x.S))  # Extract all species
    .otherwise(lit(None))  # If empty list
)

# Convert array to JSON string format
df_parsed = df_parsed.withColumn(
    "species_json",
    concat(
        lit('['),
        concat_ws(',', transform(col("species_array"), lambda x: concat(lit('"'), x, lit('"')))),
        lit(']')
    )
)

print("\n Sample species arrays:")
df_parsed.select("DEVICE", "species_array", "species_json").show(3, truncate=False)

# ------------------------------------------------------------------------------
# 5) Extract lat lon from location
# ------------------------------------------------------------------------------
print("\n Processing location data...")

# Remove extra spaces and split
df_parsed = (
    df_parsed
    .withColumn("location_clean", regexp_replace(trim(col("location")), " +", ""))
    .withColumn("latitude", split(col("location_clean"), ",").getItem(0).cast("double"))
    .withColumn("longitude", split(col("location_clean"), ",").getItem(1).cast("double"))
    .drop("location_clean", "location")
)

# Validate coordinates
df_parsed = df_parsed.filter(
    (col("latitude").isNotNull()) & 
    (col("longitude").isNotNull()) &
    (col("latitude").between(-90, 90)) &
    (col("longitude").between(-180, 180))
)

valid_count = df_parsed.count()
print(f" Valid coordinates: {valid_count} records")

if valid_count == 0:
    print("No valid coordinates found. Exiting.")
    job.commit()
    sys.exit(0)

# ------------------------------------------------------------------------------
# 6) Handle missing fields and set defaults
# ------------------------------------------------------------------------------
print("\n Checking data completeness...")

# All fields should exist now, just handle nulls
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

print("\n Data summary:")
df_parsed.select("DEVICE", "temperature_c", "humidity_percent", "light_adc", "species_json").show(5, truncate=False)

# ------------------------------------------------------------------------------
# Create "attributes" JSON 
# ------------------------------------------------------------------------------
print("\n Creating attributes JSON (clean format with species array)...")


df_parsed = df_parsed.withColumn(
    "attributes",
    concat(
        lit('{"temperature_c":'), coalesce(col("temperature_c").cast("string"), lit("null")),
        lit(',"humidity_percent":'), coalesce(col("humidity_percent").cast("string"), lit("null")),
        lit(',"light_adc":'), coalesce(col("light_adc").cast("string"), lit("null")),
        lit(',"DEVICE":"'), col("DEVICE"),
        lit('","species":'), col("species_json"),  
        lit(',"timestamp":"'), col("timestamp_str"), lit('"}')
    )
)

# Show sample attributes
print("\n Sample attributes JSON:")
df_parsed.select("DEVICE", "attributes").show(3, truncate=False)

# ------------------------------------------------------------------------------
# Create geom_wkt for PostGIS
# ------------------------------------------------------------------------------
print("\n Creating WKT geometry...")

df_parsed = df_parsed.withColumn(
    "geom_wkt",
    concat(lit("POINT("), col("longitude"), lit(" "), col("latitude"), lit(")"))
)

# ------------------------------------------------------------------------------
# 9) Add layer_id + created_by
# ------------------------------------------------------------------------------
df_parsed = df_parsed.withColumn("layer_id", lit(layerid)) \
                     .withColumn("created_by", lit(2)) # Don't fucking forget to change this na อิอิ

# Select only columns needed for insert
df_final = df_parsed.select("layer_id", "attributes", "geom_wkt", "created_by")

print("\n Final data structure:")
df_final.show(5, truncate=False)
df_final.printSchema()

# ------------------------------------------------------------------------------
# Write to PostgreSQL 
# ------------------------------------------------------------------------------
print(f"\n Writing to PostgreSQL using Spark JDBC...")

# Database configuration
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
    # Write DataFrame to temp table in PostgreSQL
    print(f" Step 1: Writing to temp table '{TEMP_TABLE}'...")
    
    df_final.write \
        .mode("overwrite") \
        .jdbc(
            url=jdbc_url,
            table=TEMP_TABLE,
            properties=db_properties
        )
    
    print(f" Successfully wrote {valid_count} records to temp table")
    
    # Execute transformation SQL using JDBC
    print(f"Transforming and inserting into measurements table...")
    

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
    
    print(f" Using ON CONFLICT DO NOTHING to prevent duplicates")
    
    # Execute INSERT using JDBC connection
    from py4j.java_gateway import java_import
    
    java_import(spark._jvm, "java.sql.DriverManager")
    
    # Create JDBC connection
    conn = spark._jvm.DriverManager.getConnection(
        jdbc_url,
        db_properties["user"],
        db_properties["password"]
    )
    
    # Execute INSERT
    stmt = conn.createStatement()
    inserted_count = stmt.executeUpdate(transform_sql)
    stmt.close()
    
    print(f" Successfully inserted {inserted_count} new records into measurements table")
    print(f" Duplicates were skipped automatically")
    
    # Drop temp table
    print(f"Cleaning up temp table...")
    
    cleanup_sql = f"DROP TABLE IF EXISTS {TEMP_TABLE}"
    stmt2 = conn.createStatement()
    stmt2.execute(cleanup_sql)
    stmt2.close()
    conn.close()
    
    print(f" Cleanup completed")
    
except Exception as e:
    print(f" Error: {str(e)}")
    raise

# ------------------------------------------------------------------------------
# 11) Job completion
# ------------------------------------------------------------------------------
print("\n Job completed successfully!")
print(f" Total records processed: {valid_count}")
print(f" New records inserted: {inserted_count}")
print(f" Species detected and stored in attributes")
print(f" ob Bookmark saved - next run will skip these .json.gz files")
job.commit()