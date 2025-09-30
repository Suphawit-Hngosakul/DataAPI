import json
import urllib.request

FrostEndpoint = "http://34.207.129.165:8080/FROST-Server/v1.1/"
def filter_Project(item):
    return {
        "ProjectID": item.get("@iot.id"),
        "name": item.get("name"),
        "description": item.get("description")
    }

def lambda_handler(event, context):
    query_params = event.get("queryStringParameters", {}) or {}
    ProjectID = query_params.get("ProjectID")
    Lat = query_params.get("Latitude")
    Lon = query_params.get("Longitude")
    Radius = query_params.get("Radius")
    if Radius != None:
        R = int(Radius)/11132
        print(f"{R:.6f}")

    if ((ProjectID==None) and (Lat==None) and (Lon==None) and (Radius==None)):          # หา project ทั้งหมด
        url = f"{FrostEndpoint}Things"
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode("utf-8"))
        data = [filter_Project(item) for item in data["value"]]

    elif ((ProjectID==None) and (Lat!=None) and (Lon!=None) and (Radius!=None)):        # หา data ทั้งหมดทุกโปรเจค ณ ตำแหน่ง  และรัศมี
        url = f"{FrostEndpoint}Observations?$expand=FeatureOfInterest&$filter=geo.distance(FeatureOfInterest/feature, geography'POINT({Lat} {Lon})') lt {R:.6f}"
        print(url)
        encoded_url = urllib.parse.quote(url, safe=':/()?&=,\'')
        with urllib.request.urlopen(encoded_url) as response:
            data = json.loads(response.read().decode("utf-8"))

    elif((Lat==None) and (Lon==None)) :                                                 # หา data ในโปรเจค
        url = f"{FrostEndpoint}Things({ProjectID})?$expand=Datastreams/Observations"
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode("utf-8"))
        data = data['Datastreams'][0]['Observations']
        data = [obs['result'] for obs in data]
    
    elif((ProjectID!=None) and (Lat!=None) and (Lon!=None) and (Radius!=None)):         # หา data ในโปรเจค ณ ตำแหน่ง  และรัศมี
        url = f"{FrostEndpoint}Things({ProjectID}})/Datastreams"
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode("utf-8"))
        datasteam = data["value"][0]["@iot.id"]
    
    elif():                 # หา โปรเจคที่มีข้อมูล ในตำแหน่งที่เกี่ยวข้อง
        print("1")

    return {
        "statusCode": 200,
        "body": json.dumps(data)  
    }
