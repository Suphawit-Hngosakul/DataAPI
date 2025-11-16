

--  1. Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

--  2. Users Table 
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'contributor',
    created_at TIMESTAMP DEFAULT NOW()
);

--  3. Datasets Table (หมวดใหญ่ของข้อมูล)
CREATE TABLE datasets (
    dataset_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    owner_id INTEGER REFERENCES users(user_id),
    source TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

--  4. Layers Table (layer ย่อยใน dataset)
CREATE TABLE layers (
    layer_id SERIAL PRIMARY KEY,
    dataset_id INTEGER REFERENCES datasets(dataset_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    geom_type TEXT CHECK (geom_type IN ('POINT','LINESTRING','POLYGON','MULTIPOINT','MULTILINESTRING','MULTIPOLYGON')),
    srid INTEGER DEFAULT 4326,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

--  5. Fields Table (อธิบาย schema ของ layer)
CREATE TABLE fields (
    field_id SERIAL PRIMARY KEY,
    layer_id INTEGER REFERENCES layers(layer_id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    data_type TEXT,
    unit TEXT,
    description TEXT
);

--  6. Measurements Table (เก็บข้อมูลจริง)
CREATE TABLE measurements (
    measure_id BIGSERIAL PRIMARY KEY,
    layer_id INTEGER REFERENCES layers(layer_id) ON DELETE CASCADE,
    attributes JSONB,  -- flexible schema per dataset
    geom GEOMETRY,
    timestamp TIMESTAMP DEFAULT NOW(),
    created_by INTEGER REFERENCES users(user_id)
);

--  7. Metadata Records (รายละเอียดเสริม)
CREATE TABLE metadata_records (
    meta_id SERIAL PRIMARY KEY,
    dataset_id INTEGER REFERENCES datasets(dataset_id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT
);

--  8. Useful Indexes
CREATE INDEX idx_measurements_geom ON measurements USING GIST (geom);
CREATE INDEX idx_measurements_layer ON measurements (layer_id);
CREATE INDEX idx_measurements_time ON measurements (timestamp);

--  Example Data (Optional Seed)
INSERT INTO users (username, email) VALUES ('admin', 'admin@example.com');

INSERT INTO datasets (name, description, owner_id)
VALUES ('Noise Measurements', 'Crowdsourced environmental noise data', 1);

INSERT INTO layers (dataset_id, name, geom_type, srid, description)
VALUES (1, 'noise_points', 'POINT', 4326, 'Noise measurement points from mobile app');

INSERT INTO fields (layer_id, field_name, data_type, unit, description)
VALUES 
  (1, 'noise_level', 'numeric', 'dB', 'Sound level in decibels'),
  (1, 'duration', 'numeric', 'seconds', 'Recording duration'),
  (1, 'device_model', 'text', NULL, 'Smartphone model');

--  Example Measurement
INSERT INTO measurements (layer_id, attributes, geom)
VALUES (
  1,
  '{"noise_level": 68.5, "duration": 15, "device_model": "Pixel 6"}',
  ST_SetSRID(ST_Point(100.5018, 13.7563), 4326)
);
