const FROST_BASE_URL = process.env.FROST_BASE_URL;

export const handler = async (event) => {
  try {
    // รองรับ CORS preflight ก่อน
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "POST,OPTIONS"
        },
        body: ""
      };
    }

    // ถ้าไม่มี body ให้เป็น {} จะได้ไม่แตก
    const rawBody = typeof event.body === 'string' && event.body.trim() !== ''
      ? JSON.parse(event.body)
      : (typeof event.body === 'object' && event.body !== null ? event.body : {});

    const {
      thingName,
      thingDescription,
      location,
      sensors = [],
      properties = {}
    } = rawBody;

    if (!FROST_BASE_URL) {
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "FROST_BASE_URL is not set" })
      };
    }

    // ถ้ายังไม่ส่งชื่อมาก็แจ้งเลย
    if (!thingName) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "thingName is required" })
      };
    }

    const payload = {
      name: thingName,
      description: thingDescription || "",
      properties,
      Locations: [
        {
          name: location?.name || "Device Location",
          description: location?.description || "WGS84 Point",
          encodingType: "application/vnd.geo+json",
          location: {
            type: "Point",
            coordinates: [
              Number(location?.lon) || 100.4920,
              Number(location?.lat) || 13.7560
            ]
          }
        }
      ],
      Datastreams: sensors.map((s) => ({
        name: s.name,
        description: s.description || s.name,
        observationType:
          "http://www.opengis.net/def/observationType/OGC-OM/2.0/OM_Measurement",
        unitOfMeasurement: {
          name: s.unit || "unit",
          symbol: s.symbol || s.unit || "",
          definition: s.unitDefinition || "http://unitsofmeasure.org/ucum.html"
        },
        Sensor: {
          name: s.sensorName || s.name,
          description: s.sensorDescription || "sensor",
          encodingType: "application/json",
          metadata: s.metadata ? JSON.stringify(s.metadata) : "{}"
        },
        ObservedProperty: {
          name: s.propertyName || s.name,
          description: s.propertyDescription || s.name,
          definition: s.propertyDefinition || "http://example.org/def"
        }
      }))
    };

    const res = await fetch(`${FROST_BASE_URL}/Things`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    // เช็คว่ามี response body หรือไม่ก่อน parse JSON
    const responseText = await res.text();
    let data = null;
    
    if (responseText && responseText.trim() !== '') {
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        // ถ้า parse ไม่ได้ แสดงว่าไม่ใช่ JSON
        return {
          statusCode: 500,
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({
            message: "FROST response is not valid JSON",
            responseText: responseText.substring(0, 500)
          })
        };
      }
    }

    if (!res.ok) {
      return {
        statusCode: res.status,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          message: "FROST error",
          status: res.status,
          statusText: res.statusText,
          frost: data,
          responseText: responseText.substring(0, 500)
        })
      };
    }

    // ดึง Thing ID จาก Location header
    const locationHeader = res.headers.get('location');
    let thingId = null;
    if (locationHeader) {
      const match = locationHeader.match(/Things\(([^)]+)\)/);
      if (match) {
        thingId = match[1];
      }
    }

    // ถ้ามี Thing ID ให้ไปดึงข้อมูลเต็มมา (รวม Datastreams, Locations, Sensors, ObservedProperties)
    let fullThingData = data;
    if (thingId) {
      try {
        const thingRes = await fetch(
          `${FROST_BASE_URL}/Things(${thingId})?$expand=Locations,Datastreams($expand=Sensor,ObservedProperty)`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json"
            }
          }
        );
        
        if (thingRes.ok) {
          const thingText = await thingRes.text();
          if (thingText && thingText.trim() !== '') {
            fullThingData = JSON.parse(thingText);
          }
        }
      } catch (e) {
        console.error("Error fetching full thing data:", e);
        // ถ้าดึงไม่ได้ก็ใช้ data เดิม
      }
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        message: "Thing created successfully",
        thingId: thingId,
        locationHeader: locationHeader,
        thing: fullThingData
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        message: "internal error",
        error: err.message,
        stack: err.stack
      })
    };
  }
};