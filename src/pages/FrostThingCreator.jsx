import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle, Copy, Code, MapPin, Wifi, Server, Download, RefreshCw, ArrowLeft } from 'lucide-react';

const API_URL = 'https://dikn83u8md.execute-api.us-east-1.amazonaws.com/frost/create';

const FrostThingCreator = ({ idToken, onBack }) => {
  const [thingName, setThingName] = useState('');
  const [thingDescription, setThingDescription] = useState('');
  const [location, setLocation] = useState({
    name: '',
    description: '',
    lat: '13.7563',
    lon: '100.5018'
  });
  const [sensors, setSensors] = useState([
    {
      id: Date.now(),
      name: '',
      description: '',
      propertyName: '',
      propertyDescription: '',
      propertyDefinition: '',
      unit: '',
      symbol: '',
      unitDefinition: 'http://unitsofmeasure.org/ucum.html',
      sensorName: '',
      sensorDescription: '',
      metadata: {}
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showCode, setShowCode] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const addSensor = () => {
    setSensors(prev => [
      ...prev,
      {
        id: Date.now(),
        name: '',
        description: '',
        propertyName: '',
        propertyDescription: '',
        propertyDefinition: '',
        unit: '',
        symbol: '',
        unitDefinition: 'http://unitsofmeasure.org/ucum.html',
        sensorName: '',
        sensorDescription: '',
        metadata: {}
      }
    ]);
  };

  const removeSensor = (id) => {
    setSensors(prev => prev.filter(s => s.id !== id));
  };

  const handleSensorChange = (id, field, value) => {
    setSensors(prev =>
      prev.map(s => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const copyToClipboard = (text, id = null) => {
    navigator.clipboard.writeText(text);
    if (id) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const resetForm = () => {
    setThingName('');
    setThingDescription('');
    setLocation({
      name: '',
      description: '',
      lat: '13.7563',
      lon: '100.5018'
    });
    setSensors([
      {
        id: Date.now(),
        name: '',
        description: '',
        propertyName: '',
        propertyDescription: '',
        propertyDefinition: '',
        unit: '',
        symbol: '',
        unitDefinition: 'http://unitsofmeasure.org/ucum.html',
        sensorName: '',
        sensorDescription: '',
        metadata: {}
      }
    ]);
    setResult(null);
    setError(null);
    setShowCode(false);
  };

  const downloadCode = (code, filename) => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const extractIds = (data) => {
    const ids = {
      thingId: null,
      locationIds: [],
      datastreamIds: []
    };

    if (data.thing) {
      if (data.thing['@iot.id']) {
        ids.thingId = data.thing['@iot.id'];
      }

      if (data.thing.Locations && Array.isArray(data.thing.Locations)) {
        ids.locationIds = data.thing.Locations.map(loc => loc['@iot.id']).filter(id => id);
      }

      if (data.thing.Datastreams && Array.isArray(data.thing.Datastreams)) {
        ids.datastreamIds = data.thing.Datastreams.map(ds => ({
          id: ds['@iot.id'],
          name: ds.name,
          sensorId: ds.Sensor ? ds.Sensor['@iot.id'] : null,
          observedPropertyId: ds.ObservedProperty ? ds.ObservedProperty['@iot.id'] : null
        })).filter(ds => ds.id);
      }
    }

    return ids;
  };

  const generateMQTTCode = (ids) => {
    if (!ids || !ids.datastreamIds || ids.datastreamIds.length === 0) {
      return '';
    }

    const datastreamExamples = ids.datastreamIds.map((ds, idx) => 
      `    # ${ds.name}\n    publish_observation(client, "${ds.id}", sensor_value_${idx + 1})`
    ).join('\n\n');

    const sensorReadExamples = ids.datastreamIds.map((ds, idx) => 
      `    sensor_value_${idx + 1} = read_sensor_${idx + 1}()  # อ่านค่าจาก ${ds.name}`
    ).join('\n');

    return `# MicroPython MQTT Client for FROST-Server
# สำหรับ ESP32/ESP8266 ใช้กับ Thonny IDE
# Thing: ${thingName}
# Generated: ${new Date().toLocaleString('th-TH')}

import time
import ujson
from umqtt.simple import MQTTClient
import network

# =============== การตั้งค่า WiFi ===============
WIFI_SSID = "YOUR_WIFI_SSID"
WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"

# =============== การตั้งค่า MQTT ===============
MQTT_BROKER = "YOUR_MQTT_BROKER_IP"  # เช่น "192.168.1.100"
MQTT_PORT = 1883
MQTT_CLIENT_ID = "esp32_${ids.thingId || 'thing'}"
MQTT_USER = None  # ถ้ามี authentication
MQTT_PASSWORD = None  # ถ้ามี authentication

# =============== Datastream IDs ===============
${ids.datastreamIds.map(ds => `DATASTREAM_${ds.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')} = "${ds.id}"  # ${ds.name}`).join('\n')}

# =============== ฟังก์ชันเชื่อมต่อ WiFi ===============
def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if not wlan.isconnected():
        print('กำลังเชื่อมต่อ WiFi...')
        wlan.connect(WIFI_SSID, WIFI_PASSWORD)
        timeout = 0
        while not wlan.isconnected() and timeout < 30:
            time.sleep(1)
            print('.', end='')
            timeout += 1
        
        if not wlan.isconnected():
            print('\\nไม่สามารถเชื่อมต่อ WiFi ได้')
            return False
    
    print('\\nเชื่อมต่อ WiFi สำเร็จ!')
    print('IP Address:', wlan.ifconfig()[0])
    return True

# =============== ฟังก์ชันส่งข้อมูล Observation ===============
def publish_observation(client, datastream_id, value):
    """
    ส่งค่า Observation ไปยัง FROST-Server ผ่าน MQTT
    
    Parameters:
    - client: MQTT client object
    - datastream_id: ID ของ Datastream
    - value: ค่าที่วัดได้
    """
    topic = f"v1.1/Datastreams({datastream_id})/Observations"
    
    # สร้าง payload ตามมาตรฐาน SensorThings API
    payload = {
        "phenomenonTime": time_now_iso(),
        "result": value,
        "resultTime": time_now_iso()
    }
    
    message = ujson.dumps(payload)
    
    try:
        client.publish(topic, message)
        print(f"✓ ส่งข้อมูลสำเร็จ: {datastream_id} = {value}")
        return True
    except Exception as e:
        print(f"✗ ส่งข้อมูลล้มเหลว: {e}")
        return False

# =============== ฟังก์ชันสร้าง ISO 8601 timestamp ===============
def time_now_iso():
    """สร้าง timestamp ในรูปแบบ ISO 8601"""
    # ถ้ามี RTC ให้ใช้เวลาจริง
    # ตัวอย่างนี้ใช้ตัวนับเวลาแบบง่าย
    current_time = time.localtime()
    return "{:04d}-{:02d}-{:02d}T{:02d}:{:02d}:{:02d}Z".format(
        current_time[0], current_time[1], current_time[2],
        current_time[3], current_time[4], current_time[5]
    )

# =============== ฟังก์ชันอ่านค่าเซนเซอร์ (ตัวอย่าง) ===============
${ids.datastreamIds.map((ds, idx) => `
def read_sensor_${idx + 1}():
    """อ่านค่า ${ds.name}"""
    # TODO: เพิ่มโค้ดอ่านค่าจากเซนเซอร์จริง
    # ตัวอย่าง: 
    # - DHT: return dht.temperature()
    # - ADC: return adc.read()
    # - BMP280: return bmp.temperature
    import random
    return round(random.uniform(20.0, 30.0), 2)  # ค่าทดสอบ`).join('\n')}

# =============== ฟังก์ชันหลัก ===============
def main():
    # เชื่อมต่อ WiFi
    if not connect_wifi():
        print('กรุณาตรวจสอบการตั้งค่า WiFi')
        return
    
    # สร้าง MQTT Client
    print('กำลังเชื่อมต่อ MQTT Broker...')
    client = MQTTClient(
        client_id=MQTT_CLIENT_ID,
        server=MQTT_BROKER,
        port=MQTT_PORT,
        user=MQTT_USER,
        password=MQTT_PASSWORD
    )
    
    try:
        client.connect()
        print('เชื่อมต่อ MQTT สำเร็จ!')
        print(f'Thing ID: ${ids.thingId}')
        print(f'Datastreams: ${ids.datastreamIds.length} รายการ')
        print('\\nเริ่มส่งข้อมูล...')
        
        # Loop ส่งข้อมูล
        count = 0
        while True:
            count += 1
            print(f'\\n=== รอบที่ {count} - {time_now_iso()} ===')
            
${sensorReadExamples}
            
            # ส่งค่าแต่ละ Datastream
${datastreamExamples}
            
            print('\\nรอ 10 วินาที...')
            time.sleep(10)  # ส่งข้อมูลทุก 10 วินาที
            
    except KeyboardInterrupt:
        print('\\nหยุดการทำงานโดยผู้ใช้')
    except OSError as e:
        print(f'\\nเกิดข้อผิดพลาดการเชื่อมต่อ: {e}')
        print('กรุณาตรวจสอบ MQTT Broker และเครือข่าย')
    except Exception as e:
        print(f'\\nเกิดข้อผิดพลาด: {e}')
    finally:
        try:
            client.disconnect()
            print('ตัดการเชื่อมต่อ MQTT')
        except:
            pass

# =============== เริ่มโปรแกรม ===============
if __name__ == '__main__':
    print('=' * 50)
    print('FROST-Server MQTT Client')
    print(f'Thing: ${thingName}')
    print('=' * 50)
    main()
`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!idToken) {
      setError({ message: 'ไม่มี token จากการล็อกอิน' });
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setShowCode(false);

    const payload = {
      thingName,
      thingDescription,
      location,
      sensors: sensors.map(({ id, ...rest }) => rest),
      properties: {
        source: "react-form",
        board: "esp32"
      }
    };

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data);
      } else {
        setResult(data);
        setShowCode(true);
      }
    } catch (err) {
      setError({ message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const ids = result ? extractIds(result) : null;
  const mqttCode = ids ? generateMQTTCode(ids) : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50">
      {/* 🔥 Header with Back Button */}
      <div className="bg-white shadow-md border-b border-blue-100">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {onBack && (
                <button
                  onClick={onBack}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-4 py-2 rounded-lg transition-all font-medium"
                >
                  <ArrowLeft size={20} />
                  กลับ
                </button>
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                  <Server className="text-blue-600" size={28} />
                  FROST Thing Creator
                </h1>
                <p className="text-gray-600 text-sm mt-1">สร้างและจัดการ IoT Things ผ่าน SensorThings API</p>
              </div>
            </div>
            {result && (
              <button
                onClick={resetForm}
                className="flex items-center gap-2 bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-lg transition-colors font-medium"
              >
                <RefreshCw size={16} />
                สร้างใหม่
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {!result ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Thing info */}
            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow border border-blue-100">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Server className="text-blue-600" size={20} />
                </div>
                <h2 className="text-xl font-semibold text-gray-800">ข้อมูล Thing</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ชื่อ Thing <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="border border-blue-200 rounded-lg w-full p-3 focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                    placeholder="เช่น ESP32 Weather Station"
                    value={thingName}
                    onChange={e => setThingName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    คำอธิบาย
                  </label>
                  <textarea
                    className="border border-blue-200 rounded-lg w-full p-3 focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                    placeholder="อธิบายรายละเอียดของอุปกรณ์"
                    rows="3"
                    value={thingDescription}
                    onChange={e => setThingDescription(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow border border-blue-100">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <MapPin className="text-green-600" size={20} />
                </div>
                <h2 className="text-xl font-semibold text-gray-800">ตำแหน่ง (Location)</h2>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ชื่อสถานที่
                    </label>
                    <input
                      className="border border-blue-200 rounded-lg w-full p-3 focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                      placeholder="เช่น Building A, Floor 3"
                      value={location.name}
                      onChange={e => setLocation({ ...location, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      คำอธิบายสถานที่
                    </label>
                    <input
                      className="border border-blue-200 rounded-lg w-full p-3 focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                      placeholder="รายละเอียดเพิ่มเติม"
                      value={location.description}
                      onChange={e => setLocation({ ...location, description: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ละติจูด (Latitude)
                    </label>
                    <input
                      type="number"
                      step="any"
                      className="border border-blue-200 rounded-lg w-full p-3 focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                      placeholder="13.7563"
                      value={location.lat}
                      onChange={e => setLocation({ ...location, lat: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ลองจิจูด (Longitude)
                    </label>
                    <input
                      type="number"
                      step="any"
                      className="border border-blue-200 rounded-lg w-full p-3 focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                      placeholder="100.5018"
                      value={location.lon}
                      onChange={e => setLocation({ ...location, lon: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sensors / Datastreams */}
            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow border border-blue-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Wifi className="text-purple-600" size={20} />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-800">เซนเซอร์ / Datastreams</h2>
                </div>
                <button
                  type="button"
                  onClick={addSensor}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors shadow-md"
                >
                  <Plus size={18} />
                  เพิ่มเซนเซอร์
                </button>
              </div>

              <div className="space-y-4">
                {sensors.map((sensor, idx) => (
                  <div key={sensor.id} className="border-2 border-blue-100 rounded-xl p-5 hover:border-blue-300 transition-all bg-gradient-to-br from-white to-blue-50">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                          {idx + 1}
                        </div>
                        <span className="font-semibold text-gray-700">
                          เซนเซอร์ที่ {idx + 1}
                        </span>
                      </div>
                      {sensors.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSensor(sensor.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>

                    <div className="space-y-4">
                      {/* Datastream Info */}
                      <div className="bg-white rounded-lg p-4 border border-blue-200">
                        <h3 className="text-sm font-semibold text-blue-700 mb-3">📊 ข้อมูล Datastream</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input
                            className="border border-blue-200 rounded-lg w-full p-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                            placeholder="ชื่อ Datastream (เช่น Temperature)"
                            value={sensor.name}
                            onChange={e => handleSensorChange(sensor.id, 'name', e.target.value)}
                          />
                          <input
                            className="border border-blue-200 rounded-lg w-full p-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                            placeholder="คำอธิบาย Datastream"
                            value={sensor.description}
                            onChange={e => handleSensorChange(sensor.id, 'description', e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Observed Property */}
                      <div className="bg-white rounded-lg p-4 border border-cyan-200">
                        <h3 className="text-sm font-semibold text-cyan-700 mb-3">🔬 Observed Property</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input
                            className="border border-blue-200 rounded-lg w-full p-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                            placeholder="ชื่อ Property (เช่น Air Temperature)"
                            value={sensor.propertyName}
                            onChange={e => handleSensorChange(sensor.id, 'propertyName', e.target.value)}
                          />
                          <input
                            className="border border-blue-200 rounded-lg w-full p-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                            placeholder="Definition URL"
                            value={sensor.propertyDefinition}
                            onChange={e => handleSensorChange(sensor.id, 'propertyDefinition', e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Unit of Measurement */}
                      <div className="bg-white rounded-lg p-4 border border-green-200">
                        <h3 className="text-sm font-semibold text-green-700 mb-3">📏 หน่วยการวัด</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <input
                            className="border border-blue-200 rounded-lg w-full p-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                            placeholder="หน่วย (degree Celsius)"
                            value={sensor.unit}
                            onChange={e => handleSensorChange(sensor.id, 'unit', e.target.value)}
                          />
                          <input
                            className="border border-blue-200 rounded-lg w-full p-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                            placeholder="สัญลักษณ์ (°C)"
                            value={sensor.symbol}
                            onChange={e => handleSensorChange(sensor.id, 'symbol', e.target.value)}
                          />
                          <input
                            className="border border-blue-200 rounded-lg w-full p-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                            placeholder="Definition URL"
                            value={sensor.unitDefinition}
                            onChange={e => handleSensorChange(sensor.id, 'unitDefinition', e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Sensor Info */}
                      <div className="bg-white rounded-lg p-4 border border-orange-200">
                        <h3 className="text-sm font-semibold text-orange-700 mb-3">🔌 ข้อมูลเซนเซอร์</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input
                            className="border border-blue-200 rounded-lg w-full p-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                            placeholder="ชื่อเซนเซอร์ (DHT22, BMP280)"
                            value={sensor.sensorName}
                            onChange={e => handleSensorChange(sensor.id, 'sensorName', e.target.value)}
                          />
                          <input
                            className="border border-blue-200 rounded-lg w-full p-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                            placeholder="คำอธิบายเซนเซอร์"
                            value={sensor.sensorDescription}
                            onChange={e => handleSensorChange(sensor.id, 'sensorDescription', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-6 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin" size={20} />
                  กำลังสร้าง Thing...
                </>
              ) : (
                <>
                  <CheckCircle size={20} />
                  สร้าง Thing
                </>
              )}
            </button>
          </form>
        ) : null}

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-6 shadow-md animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-sm font-bold">!</span>
              </div>
              <div className="flex-1">
                <h3 className="text-red-800 font-semibold text-lg mb-2">เกิดข้อผิดพลาด</h3>
                <pre className="text-sm text-red-700 overflow-auto bg-white rounded p-3 border border-red-200">
                  {JSON.stringify(error, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}

        {result && ids && (
          <div className="space-y-6 animate-fade-in">
            {/* Success Message */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 rounded-xl p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="text-white" size={24} />
                </div>
                <div>
                  <h3 className="text-green-800 font-bold text-xl">สร้าง Thing สำเร็จ!</h3>
                  <p className="text-green-600 text-sm">Thing และ Datastreams ทั้งหมดถูกสร้างเรียบร้อยแล้ว</p>
                </div>
              </div>

              {/* Thing ID */}
              {ids.thingId && (
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-700 flex items-center gap-2">
                      <Server size={18} className="text-blue-600" />
                      Thing ID:
                    </span>
                    <button
                      onClick={() => copyToClipboard(ids.thingId, `thing-${ids.thingId}`)}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1 rounded-lg transition-all text-sm"
                    >
                      {copiedId === `thing-${ids.thingId}` ? (
                        <>
                          <CheckCircle size={14} />
                          คัดลอกแล้ว!
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          คัดลอก
                        </>
                      )}
                    </button>
                  </div>
                  <code className="text-sm bg-gradient-to-r from-blue-50 to-cyan-50 px-3 py-2 rounded-lg block font-mono border border-blue-200">
                    {ids.thingId}
                  </code>
                </div>
              )}

              {/* Location IDs */}
              {ids.locationIds.length > 0 && (
                <div className="bg-white rounded-lg p-4 shadow-sm mt-3">
                  <span className="font-semibold text-gray-700 flex items-center gap-2 mb-3">
                    <MapPin size={18} className="text-green-600" />
                    Location IDs:
                  </span>
                  <div className="space-y-2">
                    {ids.locationIds.map((locId, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 p-2 rounded-lg border border-green-200">
                        <code className="text-sm font-mono flex-1">{locId}</code>
                        <button
                          onClick={() => copyToClipboard(locId, `loc-${locId}`)}
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1 rounded transition-all ml-2"
                        >
                          {copiedId === `loc-${locId}` ? (
                            <CheckCircle size={14} />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Datastream IDs */}
              {ids.datastreamIds.length > 0 && (
                <div className="bg-white rounded-lg p-4 shadow-sm mt-3">
                  <span className="font-semibold text-gray-700 flex items-center gap-2 mb-3">
                    <Wifi size={18} className="text-purple-600" />
                    Datastreams ({ids.datastreamIds.length} รายการ):
                  </span>
                  <div className="space-y-3">
                    {ids.datastreamIds.map((ds, idx) => (
                      <div key={idx} className="border-l-4 border-purple-400 bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg shadow-sm">
                        <div className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
                          <div className="w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                            {idx + 1}
                          </div>
                          {ds.name}
                        </div>
                        
                        <div className="space-y-2">
                          {/* Datastream ID */}
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 font-medium">Datastream ID:</span>
                            <div className="flex items-center gap-2">
                              <code className="bg-white px-2 py-1 rounded border border-blue-200 text-xs font-mono">
                                {ds.id}
                              </code>
                              <button
                                onClick={() => copyToClipboard(ds.id, `ds-${ds.id}`)}
                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1 rounded transition-all"
                              >
                                {copiedId === `ds-${ds.id}` ? (
                                  <CheckCircle size={14} />
                                ) : (
                                  <Copy size={14} />
                                )}
                              </button>
                            </div>
                          </div>
                          
                          {/* Sensor ID */}
                          {ds.sensorId && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600 font-medium">Sensor ID:</span>
                              <div className="flex items-center gap-2">
                                <code className="bg-white px-2 py-1 rounded border border-blue-200 text-xs font-mono">
                                  {ds.sensorId}
                                </code>
                                <button
                                  onClick={() => copyToClipboard(ds.sensorId, `sensor-${ds.sensorId}`)}
                                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1 rounded transition-all"
                                >
                                  {copiedId === `sensor-${ds.sensorId}` ? (
                                    <CheckCircle size={14} />
                                  ) : (
                                    <Copy size={14} />
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                          
                          {/* ObservedProperty ID */}
                          {ds.observedPropertyId && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600 font-medium">ObservedProperty ID:</span>
                              <div className="flex items-center gap-2">
                                <code className="bg-white px-2 py-1 rounded border border-blue-200 text-xs font-mono">
                                  {ds.observedPropertyId}
                                </code>
                                <button
                                  onClick={() => copyToClipboard(ds.observedPropertyId, `prop-${ds.observedPropertyId}`)}
                                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1 rounded transition-all"
                                >
                                  {copiedId === `prop-${ds.observedPropertyId}` ? (
                                    <CheckCircle size={14} />
                                  ) : (
                                    <Copy size={14} />
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Response */}
              <details className="bg-white rounded-lg p-4 shadow-sm mt-3">
                <summary className="font-semibold text-gray-700 cursor-pointer hover:text-blue-600 transition-colors">
                  📄 ดู Response แบบเต็ม (JSON)
                </summary>
                <pre className="text-xs text-gray-600 mt-3 overflow-auto max-h-96 bg-blue-50 p-3 rounded border border-blue-200 font-mono">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div>

            {/* MQTT Code Section */}
            {showCode && mqttCode && (
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl shadow-2xl overflow-hidden border border-slate-700">
                <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 border-b border-slate-600">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                        <Code size={20} className="text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-lg">
                          โค้ด MicroPython (Thonny IDE)
                        </h3>
                        <p className="text-slate-300 text-sm">สำหรับ ESP32/ESP8266</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => downloadCode(mqttCode, `${thingName.replace(/\s+/g, '_')}_mqtt.py`)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all shadow-lg text-sm font-semibold"
                      >
                        <Download size={16} />
                        ดาวน์โหลด .py
                      </button>
                      <button
                        onClick={() => copyToClipboard(mqttCode, 'mqtt-code')}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-all shadow-lg text-sm font-semibold"
                      >
                        {copiedId === 'mqtt-code' ? (
                          <>
                            <CheckCircle size={16} />
                            คัดลอกแล้ว!
                          </>
                        ) : (
                          <>
                            <Copy size={16} />
                            คัดลอกโค้ด
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-6 overflow-auto max-h-[600px] custom-scrollbar">
                  <pre className="text-sm text-green-400 font-mono leading-relaxed">
                    {mqttCode}
                  </pre>
                </div>

                <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 border-t border-slate-600">
                  <div className="space-y-3">
                    <p className="font-semibold text-white flex items-center gap-2">
                      <span className="text-yellow-400">⚡</span>
                      วิธีใช้งาน:
                    </p>
                    <ol className="space-y-2 text-slate-300 text-sm ml-6">
                      <li className="flex gap-2">
                        <span className="font-bold text-blue-400">1.</span>
                        <span>แก้ไข <code className="bg-slate-900 px-2 py-0.5 rounded text-green-400">WIFI_SSID</code> และ <code className="bg-slate-900 px-2 py-0.5 rounded text-green-400">WIFI_PASSWORD</code></span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold text-blue-400">2.</span>
                        <span>แก้ไข <code className="bg-slate-900 px-2 py-0.5 rounded text-green-400">MQTT_BROKER</code> เป็น IP ของ FROST-Server</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold text-blue-400">3.</span>
                        <span>แก้ไขฟังก์ชัน <code className="bg-slate-900 px-2 py-0.5 rounded text-green-400">read_sensor_X()</code> เพื่ออ่านค่าจากเซนเซอร์จริง</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold text-blue-400">4.</span>
                        <span>ติดตั้ง library <code className="bg-slate-900 px-2 py-0.5 rounded text-green-400">umqtt.simple</code> ผ่าน Tools → Manage packages</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold text-blue-400">5.</span>
                        <span>Upload โค้ดไปยัง ESP32/ESP8266 ผ่าน Thonny IDE</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold text-blue-400">6.</span>
                        <span>กด Run หรือ F5 เพื่อเริ่มส่งข้อมูล</span>
                      </li>
                    </ol>
                    
                    <div className="mt-4 p-3 bg-slate-900 rounded-lg border border-slate-600">
                      <p className="text-yellow-400 text-sm font-semibold mb-1">💡 เคล็ดลับ:</p>
                      <p className="text-slate-300 text-xs">
                        ตรวจสอบให้แน่ใจว่า FROST-Server เปิดใช้งาน MQTT และอนุญาตการเชื่อมต่อจาก ESP32
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1e293b;
          border-radius: 4px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #475569;
          border-radius: 4px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }
      `}</style>
    </div>
  );
};

export default FrostThingCreator;