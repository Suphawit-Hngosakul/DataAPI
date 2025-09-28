import json
from datetime import datetime

def lambda_handler(event, context):
    print("Event received:", json.dumps(event, indent=2))

    latlonColumn = "location"
    Datecolumn = "DATE"

    BASE_URL = "http://34.201.15.159:8080/FROST-Server/v1.1"
    project_name = "Bird_Mic_IOT"
    description = "This project collects sound data, measures temperature, humidity and light levels, and analyzes the recorded sounds to identify bird sounds."


    Ob_def = [
        "https://en.wikipedia.org/wiki/Bird",
        "https://en.wikipedia.org/wiki/Time",
        "https://en.wikipedia.org/wiki/Location",
        "https://en.wikipedia.org/wiki/Device",
        "https://en.wikipedia.org/wiki/File",
        "https://dbpedia.org/page/Temperature",
        "https://dbpedia.org/page/Humidity",
        "https://dbpedia.org/page/Light"
    ]
    Ob_des = [
        "Bird species",
        "Date and time",
        "Location in latitude and longitude",
        "Device",
        "Related files",
        "Temperature (C) from SHTC3",
        "Humidity (%) from SHTC3",
        "Light level from MH sensor"
    ]


    x= {
        "name": project_name,
        "description": description,
        "Datastreams": [
            {
                "name": f"{project_name} Stream",
                "description": f"DataStream for {project_name}",
                "observationType": "http://www.opengis.net/def/observationType/OGC-OM/2.0/OM_Measurement",
                "unitOfMeasurement": {
                    "name": "number or string"
                },
                "Sensor": {
                    "name": f"{project_name} columns",
                        "description": "The column name will be in properties",
                        "encodingType": "application/pdf",
                        "metadata": "",
                        "properties": {
                            "col1": "species",
                            "col2": "DATE",
                            "col3": "location",
                            "col4": "DEVICE",
                            "col5": "files",
                            "col6": "humidity",
                            "col6": "humidity",
                            "col6": "light"
                        }
                },
                "ObservedProperty": {
                    "name": f"{project_name} ObservedProperties",
                    "definition": "|".join(Ob_def),
                    "description": "|".join(Ob_des)
                }
            }
            ]
        }
    print(f"post {BASE_URL}/Things")
    print(x)


    #อัปโหลด metadata
    print(f"get {BASE_URL}/Datastreams?$orderby=@iot.id desc&$top=1") # รับ id datastream
    """
    # --- Loop ผ่านทุก sample ---
    for idx, sample in enumerate(event, start=1):
        foi_id = None
        # เช็คว่ามี location
        if Havelatlon and "location" in sample and sample["location"]:
            loc = sample["location"].strip()
            # เช็คว่า location นี้เคยสร้าง FoI แล้วหรือไม่
            if loc in existing_foi:
                foi_id = existing_foi[loc]
                print(f"\n--- FeatureOfInterest for location {loc} already exists with ID {foi_id} ---")
            else:
                # สร้าง FoI ใหม่
                lat, lon = map(float, loc.split(","))
                foi_json = {
                    "name": f"{project_name} FoI {len(existing_foi)+1}",
                    "description": "Location of bird mic",
                    "encodingType": "application/vnd.geo+json",
                    "feature": {
                        "type": "Point",
                        "coordinates": [lon, lat]  # GeoJSON ใช้ [lon, lat]
                    }
                }
            print(f"\n--- FeatureOfInterest {len(existing_foi)+1} ---")
            print("POST:", f"{BASE_URL}/FeaturesOfInterest")
            print(json.dumps(foi_json, indent=2))
            
            foi_id = len(existing_foi) + 1
            existing_foi[loc] = foi_id

        # --- Observation ---
        observation_json = {
            "result": {
                "species": sample.get("species", []),
                "temperature_c": sample.get("temperature_c"),
                "humidity": sample.get("humidity"),
                "light": sample.get("light"),
                "files": sample.get("files", []),
                "DEVICE": sample.get("DEVICE")
            },
            "Datastream": {"@iot.id": 1},
            "FeatureOfInterest": {"@iot.id": foi_id} if foi_id else None
        }
        if foi_id:
            observation_json["FeatureOfInterest"] = {"@iot.id": foi_id}

        print(f"\n--- Observation {idx} ---")
        print("POST:", f"{BASE_URL}/Observations")
        print(json.dumps(observation_json, indent=2))
    """
    return {
        "statusCode": 200,
        "body": json.dumps({"message": f"Mock print complete for {len(event)} samples"})
    }
