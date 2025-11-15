const FROST_BASE_URL = process.env.FROST_BASE_URL;

export const handler = async (event) => {
  try {
    // 1) CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type,Authorization",
          "Access-Control-Allow-Methods": "POST,OPTIONS"
        },
        body: ""
      };
    }

    // 2) ดึง user จาก JWT ที่ถูก authorize แล้ว
    const claims = event.requestContext?.authorizer?.jwt?.claims;
    const userId =
      claims?.sub ||
      claims?.['cognito:username'] ||
      null;

    // ถ้าไม่มี user แปลว่าไม่ได้ส่ง token หรือ authorizer ไม่ถูกต้อง
    if (!userId) {
      return {
        statusCode: 401,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "Unauthorized: no user in token" })
      };
    }

    // 3) parse body ให้ชัวร์
    const rawBody =
      typeof event.body === 'string' && event.body.trim() !== ''
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

    if (!thingName) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "thingName is required" })
      };
    }

    // 4) บังคับใส่ UserID ลง properties เสมอ
    const finalProperties = {
      ...properties,
      UserID: userId
    };

    const payload = {
      name: thingName,
      description: thingDescription || "",
      properties: finalProperties,
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

    // 5) ยิงเข้า FROST
    const res = await fetch(`${FROST_BASE_URL}/Things`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const responseText = await res.text();
    let data = null;

    if (responseText && responseText.trim() !== '') {
      try {
        data = JSON.parse(responseText);
      } catch (e) {
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

    // 6) ดึง Thing ที่สร้างจริง
    const locationHeader = res.headers.get('location');
    let thingId = null;
    if (locationHeader) {
      const match = locationHeader.match(/Things\(([^)]+)\)/);
      if (match) {
        thingId = match[1];
      }
    }

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
        // ignore
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
        error: err.message
      })
    };
  }
};
