import json
import boto3
import urllib.request
from datetime import datetime

s3 = boto3.client("s3")

BUCKET = "dataapics361"
ORG = "acme"
PROJECT = "Bird_MIc_IOT"
ENV = "dev"
PROJECTFULL = f"{ORG}-{PROJECT}-{ENV}-raw"

API_URL = "https://wy0vrlpu67.execute-api.us-east-1.amazonaws.com/data?mode=latest"
DOWNLOAD_API = "https://97bywd0nf6.execute-api.us-east-1.amazonaws.com/download"

def lambda_handler(event, context):
    # --- ดึงข้อมูลจาก API ---
    with urllib.request.urlopen(API_URL) as response:
        data = json.loads(response.read().decode("utf-8"))

    print(f"Fetched {len(data)} records from API")

    results = []
    sett = 1
    for record in data:

        # --- ตรวจสอบค่า sensor ---
        sensor_values = [
            record.get("temperature_c", 0),
            record.get("humidity", 0),
            record.get("light", 0)
        ]
        zero_count = sum(1 for v in sensor_values if v == 0)
        species = record.get("species", [])

        # --- ทำ path S3 ---
        date_str = record["DATE"]  # เช่น "20250830_2355"
        dt = datetime.strptime(date_str, "%Y%m%d_%H%M")
        year, month, day = dt.strftime("%Y"), dt.strftime("%m"), dt.strftime("%d")

        source_system = "iot"
        entity = "device_readings"

        base_path = (
            f"{PROJECTFULL}/"
            f"source_system={source_system}/"
            f"entity={entity}/"
            f"year={year}/month={month}/day={day}/"
        )

        # --- Upload JSON ---
        filename_json = f"set {sett}.json"
        sett+=1

        s3_key_json = base_path + filename_json
        body = json.dumps(record, ensure_ascii=False, indent=2).encode("utf-8")
        s3.put_object(Bucket=BUCKET, Key=s3_key_json, Body=body)
        print(f"Uploaded JSON: s3://{BUCKET}/{s3_key_json}")
        results.append(f"s3://{BUCKET}/{s3_key_json}")

        # --- ถ้ามีไฟล์ใน record["files"] ให้โหลดด้วย ---
        for f in record.get("files", []):
            try:
                # ส่งรีเควสไปหา Download API
                req_body = json.dumps({"files": f}).encode("utf-8")
                req = urllib.request.Request(
                    DOWNLOAD_API,
                    data=req_body,
                    headers={"Content-Type": "application/json"},
                    method="POST"
                )
                with urllib.request.urlopen(req) as resp:
                    download_resp = json.loads(resp.read().decode("utf-8"))

                download_url = download_resp.get("download_url")
                if not download_url:
                    print(f"⚠️ No download_url for file {f}")
                    continue

                # โหลดไฟล์จาก download_url
                with urllib.request.urlopen(download_url) as file_resp:
                    file_data = file_resp.read()

                # บันทึกลง S3 (ชื่อไฟล์ตามเดิม)
                s3_key_file = base_path + f
                s3.put_object(Bucket=BUCKET, Key=s3_key_file, Body=file_data)
                print(f"Uploaded File: s3://{BUCKET}/{s3_key_file}")
                results.append(f"s3://{BUCKET}/{s3_key_file}")

            except Exception as e:
                print(f"❌ Error downloading {f}: {e}")

    return {
        "statusCode": 200,
        "saved": results
    }
