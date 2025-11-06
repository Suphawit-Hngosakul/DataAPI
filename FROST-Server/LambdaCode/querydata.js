const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const RAW = (process.env.FROST_URL || "").replace(/\/+$/, "");
const FROST_URL = RAW.startsWith("http") ? RAW : `http://${RAW}`;
const EXPAND_BASE = encodeURIComponent(
  "Locations,Datastreams($expand=Sensor,ObservedProperty,Observations($top=1;$orderby=phenomenonTime desc))"
);

async function fetchWithTimeout(url, ms = 10000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, { signal: ac.signal });
    clearTimeout(t);
    return res;
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

export const handler = async (event) => {
  try {
    const method = event?.requestContext?.http?.method || "GET";
    if (method === "OPTIONS")
      return { statusCode: 204, headers: CORS, body: "" };

    const q = event?.queryStringParameters || {};
    const thingId = q.thingId ? parseInt(q.thingId) : null;
    const bbox = q.bbox ? q.bbox.split(",").map(Number) : null;
    const top = q.top ? parseInt(q.top) : 1;

    if (thingId) {
      const limit = q.limit ? parseInt(q.limit) : 200;
      const obsUrl = `${FROST_URL}/Things(${thingId})?$expand=Locations,Datastreams($expand=ObservedProperty,Sensor,Observations($top=${limit};$orderby=phenomenonTime desc))`;

      const r = await fetchWithTimeout(obsUrl, 15000);
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        return {
          statusCode: r.status,
          headers: { ...CORS, "Content-Type": "text/plain" },
          body: `FROST error ${r.status}: ${t}`,
        };
      }

      const data = await r.json();
      if (!data.Datastreams?.length)
        return { statusCode: 404, headers: CORS, body: "No datastreams found" };

      const ds = data.Datastreams[0];
      const loc = data.Locations?.[0]?.location;
      const coords = loc?.coordinates || [0, 0];

      const features = (ds.Observations || []).map((o) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: coords },
        properties: {
          thingId,
          thingName: data.name,
          datastreamId: ds["@iot.id"],
          datastreamName: ds.name,
          result: o.result,
          phenomenonTime: o.phenomenonTime,
          resultTime: o.resultTime,
          sensor: ds.Sensor?.name ?? null,
        },
      }));

      return {
        statusCode: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "FeatureCollection", features }),
      };
    }

    let url = `${FROST_URL}/Things?$expand=${EXPAND_BASE}`;
    if (bbox?.length === 4) {
      const [minX, minY, maxX, maxY] = bbox;
      const poly = `POLYGON((${minX} ${minY},${maxX} ${minY},${maxX} ${maxY},${minX} ${maxY},${minX} ${minY}))`;
      const filter = encodeURIComponent(
        `st_within(Locations/location, geography'SRID=4326;${poly}')`
      );
      url += `&$filter=${filter}`;
    }

    const r = await fetchWithTimeout(url, 15000);
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return {
        statusCode: r.status,
        headers: { ...CORS, "Content-Type": "text/plain" },
        body: `FROST error ${r.status}: ${text}`.slice(0, 2000),
      };
    }

    const data = await r.json();
    const features = (data.value || [])
      .map((t) => {
        const loc = t?.Locations?.[0]?.location;
        const coords = loc?.coordinates;
        if (!coords) return null;
        const ds = (t.Datastreams || [])[0];
        const obs = ds?.Observations?.[0];
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: coords },
          properties: {
            thingId: t["@iot.id"],
            thingName: t.name,
            datastreamId: ds?.["@iot.id"] ?? null,
            datastreamName: ds?.name ?? null,
            value: obs?.result ?? null,
            time: obs?.phenomenonTime ?? null,
          },
        };
      })
      .filter(Boolean);

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "FeatureCollection", features }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: CORS,
      body: `Lambda error: ${String(e).slice(0, 1500)}`,
    };
  }
};
