import React, { useEffect, useState, useRef } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Upload as UploadIcon } from 'lucide-react';

const API_URL = "<api_url>";
const REFRESH_MS = 5000;
const OFFLINE_MS = 15000;

export default function SoundMap({ onNavigateToNewDevice, onNavigateToUpload }) {
  const mapRef = useRef(null);
  const markers = useRef(new Map());
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentSensor, setCurrentSensor] = useState(null);
  const [dataType, setDataType] = useState("sensor");
  const [showDetailView, setShowDetailView] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // === Initialize map ===
  useEffect(() => {
    const map = L.map("map", {
      zoomAnimation: true,
      fadeAnimation: true,
      markerZoomAnimation: true,
    }).setView([13.7563, 100.5018], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 200);
    return () => map.remove();
  }, []);

  // === Utility ===
  const isoToMs = (iso) => (iso ? Date.parse(iso) : 0);
  const colorByDb = (db) => {
    if (db == null) return "#777";
    if (db < 55) return "#2ecc71";
    if (db < 70) return "#f1c40f";
    if (db < 85) return "#e67e22";
    return "#e74c3c";
  };
  const styleByValue = (val, updatedAt) => {
    const age = Date.now() - updatedAt;
    const offline = age > OFFLINE_MS;
    const color = offline ? "#9e9e9e" : colorByDb(val);
    return { color, fillColor: color, fillOpacity: offline ? 0.4 : 0.8, weight: 1 };
  };
  const isOnline = (t) => {
    const ts = isoToMs(t);
    return ts && Date.now() - ts <= OFFLINE_MS;
  };
  const formatTime = (iso) => {
    if (!iso) return "-";
    const d = new Date(iso);
    const diff = (Date.now() - d) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString("th-TH");
  };

  // === Fetch data & markers ===
  useEffect(() => {
    const fetchData = async () => {
      try {
        const r = await fetch(API_URL);
        const data = await r.json();
        setLoading(false);
        const features = data.features ?? [];
        
        // จัดกลุ่มข้อมูลตาม thingId
        const thingsMap = new Map();
        
        features.forEach((f) => {
          const id = f.properties?.thingId;
          if (!id) return;
          
          const [lon, lat] = f.geometry.coordinates;
          const props = f.properties;
          
          if (!thingsMap.has(id)) {
            thingsMap.set(id, {
              thingId: id,
              thingName: props.thingName,
              location: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
              coordinates: [lat, lon],
              datastreams: [],
              primaryValue: null,
              primaryTime: null,
              isOnline: false
            });
          }
          
          const thing = thingsMap.get(id);
          
          // เพิ่ม datastream
          thing.datastreams.push({
            datastreamId: props.datastreamId,
            datastreamName: props.datastreamName,
            value: props.value,
            time: props.time
          });
          
          // ใช้ Sound Level เป็นค่าหลักสำหรับแสดงบน map
          if (props.datastreamName?.toLowerCase().includes('sound') || 
              props.datastreamName?.toLowerCase().includes('level')) {
            thing.primaryValue = props.value;
            thing.primaryTime = props.time;
            thing.isOnline = isOnline(props.time);
          }
          
          // ถ้าไม่มี sound level ให้ใช้ datastream แรกที่มีค่า
          if (thing.primaryValue === null && props.value !== null) {
            thing.primaryValue = props.value;
            thing.primaryTime = props.time;
            thing.isOnline = isOnline(props.time);
          }
        });
        
        const ids = new Set();
        
        // สร้าง/อัพเดท markers
        thingsMap.forEach((thing) => {
          const id = thing.thingId;
          ids.add(id);
          
          const [lat, lon] = thing.coordinates;
          const updatedAt = isoToMs(thing.primaryTime);
          const style = styleByValue(thing.primaryValue, updatedAt);
          
          // หา datastreams ที่มีข้อมูล
          const datastreamsInfo = thing.datastreams
            .filter(ds => ds.value !== null)
            .map(ds => `<b>${ds.datastreamName}:</b> ${ds.value}${ds.datastreamName?.toLowerCase().includes('sound') ? ' dB' : '°C'}<br/>`)
            .join('');
          
          const html = `
            <div class='font-sans'>
              <b>${thing.thingName ?? "Thing"}</b><br/>
              ${datastreamsInfo || '<span class="text-gray-500">No data available</span>'}
              <span class='text-xs text-gray-500'>
                ${formatTime(thing.primaryTime)}<br/>
                Status: <b>${thing.isOnline ? "online" : "offline"}</b>
              </span>
            </div>`;

          if (markers.current.has(id)) {
            const m = markers.current.get(id);
            m.setLatLng([lat, lon]);
            m.setStyle(style);
            if (m.isPopupOpen()) m.setPopupContent(html);
          } else {
            const m = L.circleMarker([lat, lon], { radius: 10, ...style })
              .bindPopup(html)
              .on("click", () => setCurrentSensor(thing))
              .addTo(mapRef.current);
            markers.current.set(id, m);
          }
        });
        
        // Remove deleted sensors
        for (const [id, m] of markers.current.entries()) {
          if (!ids.has(id)) {
            mapRef.current.removeLayer(m);
            markers.current.delete(id);
          }
        }
        
        // Update sensors state
        setSensors(prevSensors => {
          const newSensors = Array.from(thingsMap.values());
          if (showDetailView) {
            return prevSensors;
          }
          return newSensors;
        });
      } catch (e) {
        console.error("Error fetching:", e);
        setLoading(false);
      }
    };

    fetchData();
    const i1 = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(i1);
  }, [showDetailView]);

  // ฟังก์ชันสำหรับดึงข้อมูลกราฟจาก historical data
  const getChartDataFromHistory = (historicalData, datastreamName) => {
    if (!historicalData || !historicalData.features) {
      return null;
    }
    
    // หา datastream ที่ตรงกับชื่อที่ต้องการ
    const matchingFeatures = historicalData.features.filter(f => {
      const props = f.properties;
      // ตรวจสอบทั้ง datastreamName และมีค่า (ใช้ result หรือ value)
      return props?.datastreamName === datastreamName && 
             (props?.result !== null && props?.result !== undefined || 
              props?.value !== null && props?.value !== undefined);
    });
    
    if (matchingFeatures.length === 0) {
      return null;
    }
    
    // เรียงตาม timestamp และเอาค่าล่าสุด 20 จุด
    const sortedData = matchingFeatures
      .map(f => {
        const props = f.properties;
        return {
          value: props.result ?? props.value, // ลองใช้ result ก่อน ถ้าไม่มีใช้ value
          time: props.phenomenonTime ?? props.time // ลองใช้ phenomenonTime ก่อน ถ้าไม่มีใช้ time
        };
      })
      .filter(d => d.value !== null && d.value !== undefined)
      .sort((a, b) => new Date(a.time) - new Date(b.time))
      .slice(-500); // เอา 20 จุดล่าสุด
    
    return sortedData.map(d => d.value);
  };

  // === Detail View Component (Slide-in Panel) ===
  const DetailPanel = ({ sensor, onClose }) => {
    const [historicalData, setHistoricalData] = useState(null);
    const [loadingHistory, setLoadingHistory] = useState(true);
    
    // Fetch historical data เมื่อเปิด panel
    useEffect(() => {
      const fetchHistoricalData = async () => {
        try {
          setLoadingHistory(true);
          // ใช้ limit=100 เหมือนใน HTML example เพื่อได้ข้อมูลมากขึ้น
          const response = await fetch(`${API_URL}?thingId=${sensor.thingId}&limit=300`);
          const data = await response.json();
          console.log('Historical data:', data); // Debug
          setHistoricalData(data);
        } catch (error) {
          console.error('Error fetching historical data:', error);
        } finally {
          setLoadingHistory(false);
        }
      };
      
      if (sensor.thingId) {
        fetchHistoricalData();
      }
    }, [sensor.thingId]);
    
    // หา datastreams แต่ละประเภท
    const soundDatastream = sensor.datastreams.find(ds => 
      ds.datastreamName?.toLowerCase().includes('sound') || 
      ds.datastreamName?.toLowerCase().includes('level')
    );
    
    const tempDatastream = sensor.datastreams.find(ds => 
      ds.datastreamName?.toLowerCase().includes('temp')
    );
    
    return (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/30 z-[9998] transition-opacity"
          onClick={onClose}
        />
        
        {/* Slide-in Panel */}
        <div className="fixed top-0 right-0 h-full w-[500px] bg-white shadow-2xl z-[9999] overflow-y-auto animate-slide-in">
          {/* Header */}
          <div className="bg-blue-900 text-white px-6 py-4 flex items-center justify-between sticky top-0">
            <h1 className="text-xl font-semibold">{sensor.thingName || "Unknown Device"}</h1>
            <button
              onClick={onClose}
              className="text-3xl hover:bg-white/20 w-10 h-10 rounded-lg transition flex items-center justify-center leading-none"
            >
              ‹
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {loadingHistory ? (
              <div className="text-center text-gray-400 py-8">
                <div className="animate-spin border-t-2 border-blue-500 border-solid rounded-full w-8 h-8 mx-auto mb-4" />
                Loading sensor data...
              </div>
            ) : (
              <>
                {/* Project Info */}
                <div>
                  <p className="text-blue-900 text-base font-medium">
                    By Project : <span className="font-semibold">Project1</span>
                  </p>
                  <p className="text-blue-900 text-base font-medium mt-2">
                    Location : <span className="font-semibold">{sensor.location || "N/A"}</span>
                  </p>
                </div>

                {/* Sound Level Section */}
                {soundDatastream && soundDatastream.value !== null && (
                  <div className="border-t-2 border-gray-200 pt-6">
                    <h2 className="text-blue-900 text-lg font-semibold mb-3">
                      Sensor : {soundDatastream.datastreamName}
                    </h2>
                    {(() => {
                      const chartData = getChartDataFromHistory(historicalData, soundDatastream.datastreamName);
                      
                      if (!chartData || chartData.length === 0) {
                        return (
                          <div className="text-center text-gray-500 py-8 bg-gray-50 rounded-lg">
                            No historical data available for this sensor
                          </div>
                        );
                      }
                      
                      const avg = chartData.reduce((a, b) => a + b, 0) / chartData.length;
                      const low = Math.min(...chartData);
                      const high = Math.max(...chartData);
                      
                      return (
                        <>
                          <div className="flex gap-4 mb-4 text-sm">
                            <span className="text-gray-700">
                              Average : <strong className="text-base">{avg.toFixed(1)} dB</strong>
                            </span>
                            <span className="text-gray-700">
                              Low : <strong className="text-base">{low.toFixed(1)} dB</strong>
                            </span>
                            <span className="text-gray-700">
                              High : <strong className="text-base">{high.toFixed(1)} dB</strong>
                            </span>
                          </div>
                          
                          {/* Chart */}
                          <SensorChart data={chartData} unit="dB" />
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Temperature Section */}
                {tempDatastream && tempDatastream.value !== null && (
                  <div className="border-t-2 border-gray-200 pt-6">
                    <h2 className="text-blue-900 text-lg font-semibold mb-3">
                      Sensor : {tempDatastream.datastreamName}
                    </h2>
                    {(() => {
                      const chartData = getChartDataFromHistory(historicalData, tempDatastream.datastreamName);
                      
                      if (!chartData || chartData.length === 0) {
                        return (
                          <div className="text-center text-gray-500 py-8 bg-gray-50 rounded-lg">
                            No historical data available for this sensor
                          </div>
                        );
                      }
                      
                      const avg = chartData.reduce((a, b) => a + b, 0) / chartData.length;
                      const low = Math.min(...chartData);
                      const high = Math.max(...chartData);
                      
                      return (
                        <>
                          <div className="flex gap-4 mb-4 text-sm">
                            <span className="text-gray-700">
                              Average : <strong className="text-base">{avg.toFixed(1)}°C</strong>
                            </span>
                            <span className="text-gray-700">
                              Low : <strong className="text-base">{low.toFixed(1)}°C</strong>
                            </span>
                            <span className="text-gray-700">
                              High : <strong className="text-base">{high.toFixed(1)}°C</strong>
                            </span>
                          </div>
                          
                          {/* Chart */}
                          <SensorChart data={chartData} unit="°C" />
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Other Datastreams */}
                {sensor.datastreams
                  .filter(ds => ds.value !== null)
                  .filter(ds => 
                    !ds.datastreamName?.toLowerCase().includes('sound') && 
                    !ds.datastreamName?.toLowerCase().includes('level') &&
                    !ds.datastreamName?.toLowerCase().includes('temp')
                  )
                  .map((ds, idx) => {
                    const chartData = getChartDataFromHistory(historicalData, ds.datastreamName);
                    
                    if (!chartData || chartData.length === 0) {
                      return (
                        <div key={idx} className="border-t-2 border-gray-200 pt-6">
                          <h2 className="text-blue-900 text-lg font-semibold mb-3">
                            Sensor : {ds.datastreamName}
                          </h2>
                          <div className="text-center text-gray-500 py-8 bg-gray-50 rounded-lg">
                            No historical data available for this sensor
                          </div>
                        </div>
                      );
                    }
                    
                    const avg = chartData.reduce((a, b) => a + b, 0) / chartData.length;
                    const low = Math.min(...chartData);
                    const high = Math.max(...chartData);
                    
                    return (
                      <div key={idx} className="border-t-2 border-gray-200 pt-6">
                        <h2 className="text-blue-900 text-lg font-semibold mb-3">
                          Sensor : {ds.datastreamName}
                        </h2>
                        <div className="flex gap-4 mb-4 text-sm">
                          <span className="text-gray-700">
                            Average : <strong className="text-base">{avg.toFixed(1)}</strong>
                          </span>
                          <span className="text-gray-700">
                            Low : <strong className="text-base">{low.toFixed(1)}</strong>
                          </span>
                          <span className="text-gray-700">
                            High : <strong className="text-base">{high.toFixed(1)}</strong>
                          </span>
                        </div>
                        
                        {/* Chart */}
                        <SensorChart data={chartData} />
                      </div>
                    );
                  })
                }
                
                {sensor.datastreams.filter(ds => ds.value !== null).length === 0 && (
                  <div className="border-t-2 border-gray-200 pt-6 text-center text-gray-500">
                    No sensor data available
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <style jsx>{`
          @keyframes slide-in {
            from {
              transform: translateX(100%);
            }
            to {
              transform: translateX(0);
            }
          }
          .animate-slide-in {
            animation: slide-in 0.3s ease-out;
          }
        `}</style>
      </>
    );
  };

  // Component สำหรับกราฟ
  const SensorChart = ({ data, unit = '' }) => {
    const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, value: 0, index: 0 });
    const chartRef = useRef(null);
    
    const maxVal = Math.max(...data);
    const minVal = Math.min(...data);
    const range = maxVal - minVal || 1;
    
    // ฟังก์ชันสร้าง smooth curve path ด้วย Cardinal Spline
    const createSmoothPath = (points, tension = 0.8) => {
      if (points.length < 2) return '';
      
      let path = `M ${points[0].x},${points[0].y}`;
      
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];
        
        // Calculate control points
        const cp1x = p1.x + (p2.x - p0.x) / 6 * tension;
        const cp1y = p1.y + (p2.y - p0.y) / 6 * tension;
        const cp2x = p2.x - (p3.x - p1.x) / 6 * tension;
        const cp2y = p2.y - (p3.y - p1.y) / 6 * tension;
        
        path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
      }
      
      return path;
    };
    
    // แปลงข้อมูลเป็นจุดพิกัด
    const points = data.map((val, idx) => ({
      x: (idx / (data.length - 1)) * 400,
      y: 100 - ((val - minVal) / range) * 80 - 10
    }));
    
    const smoothPath = createSmoothPath(points);
    
    const handleMouseMove = (e) => {
      if (!chartRef.current) return;
      
      const rect = chartRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const chartWidth = rect.width;
      
      // หาจุดข้อมูลที่ใกล้ที่สุด
      const index = Math.round((x / chartWidth) * (data.length - 1));
      const clampedIndex = Math.max(0, Math.min(data.length - 1, index));
      
      const value = data[clampedIndex];
      const pointX = (clampedIndex / (data.length - 1)) * chartWidth;
      const pointY = rect.height - ((value - minVal) / range) * (rect.height * 0.8) - (rect.height * 0.1);
      
      setTooltip({
        show: true,
        x: pointX,
        y: pointY,
        value: value,
        index: clampedIndex
      });
    };
    
    const handleMouseLeave = () => {
      setTooltip({ ...tooltip, show: false });
    };
    
    return (
      <div 
        ref={chartRef}
        className="relative h-32 border-l-2 border-b-2 border-gray-400 bg-gray-50 overflow-visible cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <svg className="w-full h-full pointer-events-none" viewBox="0 0 400 100" preserveAspectRatio="none">
          {/* Smooth curve path */}
          <path
            d={smoothPath}
            fill="none"
            stroke="#3B82F6"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* จุดข้อมูล */}
          
        </svg>
        
        {/* Tooltip */}
        {tooltip.show && (
          <>
            {/* Highlight point */}
            <div
              className="absolute w-3 h-3 bg-red-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 ring-2 ring-red-300"
              style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
            />
            
            {/* Vertical line */}
            <div
              className="absolute top-0 bottom-0 w-px bg-gray-300 pointer-events-none"
              style={{ left: `${tooltip.x}px` }}
            />
            
            {/* Tooltip box */}
            <div
              className="absolute bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-semibold shadow-lg pointer-events-none whitespace-nowrap z-20"
              style={{
                left: `${tooltip.x}px`,
                top: `${tooltip.y - 45}px`,
                transform: tooltip.x > chartRef.current?.offsetWidth / 2 ? 'translateX(-100%) translateX(-8px)' : 'translateX(8px)'
              }}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-gray-300">Point {tooltip.index + 1}</span>
                <span className="text-base font-bold">{tooltip.value.toFixed(1)}{unit}</span>
              </div>
              {/* Arrow */}
              <div
                className="absolute w-0 h-0 border-t-[6px] border-t-gray-900 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent"
                style={{
                  bottom: '-6px',
                  left: tooltip.x > chartRef.current?.offsetWidth / 2 ? 'auto' : '8px',
                  right: tooltip.x > chartRef.current?.offsetWidth / 2 ? '8px' : 'auto'
                }}
              />
            </div>
          </>
        )}
        
        <div className="absolute bottom-1 left-1 text-xs text-gray-500">
          {minVal.toFixed(1)}{unit}
        </div>
        <div className="absolute top-1 left-1 text-xs text-gray-500">
          {maxVal.toFixed(1)}{unit}
        </div>
      </div>
    );
  };

  // === UI ===
  return (
    <div className="w-full h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex justify-between items-center bg-blue-900 text-white px-6 py-3 shadow-md">
        <h1
          onClick={() => window.location.reload()}
          className="font-semibold text-lg cursor-pointer"
        >
          DataAPI
        </h1>
        <div className="flex gap-2 items-center">
          <div className="relative">
            {/* Custom Dropdown Button */}
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="appearance-none bg-white/20 text-white px-4 py-2 rounded-md text-sm font-semibold cursor-pointer hover:bg-white/30 transition flex items-center justify-between gap-3"
            >
              {dataType === 'sensor' ? 'Sensor' : 'General'}
              <svg 
                width="12" 
                height="8" 
                viewBox="0 0 12 8" 
                fill="none"
                className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
              >
                <path d="M1 1.5L6 6.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            
            {/* Custom Dropdown Menu */}
            {dropdownOpen && (
              <>
                {/* Backdrop to close dropdown */}
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setDropdownOpen(false)}
                />
                
                {/* Dropdown Options */}
                <div className="absolute top-full mt-1 left-0 w-full bg-[#F1F5F9] rounded-lg shadow-lg z-20 overflow-hidden">
                  <button
                    onClick={() => {
                      setDataType('sensor');
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm font-medium transition ${
                      dataType === 'sensor' 
                        ? 'bg-blue-100 text-blue-900' 
                        : 'text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    Sensor
                  </button>
                  <button
                    onClick={() => {
                      setDataType('general');
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm font-medium transition ${
                      dataType === 'general' 
                        ? 'bg-blue-100 text-blue-900' 
                        : 'text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    General
                  </button>
                </div>
              </>
            )}
          </div>
          
          <button
            onClick={() => alert("API Modal")}
            className="bg-white/20 px-4 py-2 rounded-md text-sm font-semibold hover:bg-white/30 transition"
          >
            GetAPI
          </button>
          
          {/* ปุ่มเปลี่ยนตาม dataType */}
          {dataType === 'general' ? (
            <button
              onClick={onNavigateToUpload}
              className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-md text-sm font-semibold hover:bg-white/30 transition"
            >
              <UploadIcon size={16} />
              Upload
            </button>
          ) : (
            <button
              onClick={onNavigateToNewDevice}
              className="bg-white/20 px-4 py-2 rounded-md text-sm font-semibold hover:bg-white/30 transition"
            >
              + New Device
            </button>
          )}
        </div>
      </div>

      {/* Container */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* Map */}
        <div id="map" className="flex-1 h-full z-0" />

        {/* Sidebar */}
        <div
          className={`absolute top-4 right-4 bg-white rounded-xl shadow-xl transition-all overflow-hidden ${
            sidebarCollapsed ? "w-auto" : "w-80 max-h-[calc(100vh-6rem)]"
          }`}
          style={{ zIndex: showDetailView ? 9997 : 1000 }}
        >
          <div className={`flex justify-between items-center bg-blue-900 text-white px-4 py-3 ${sidebarCollapsed ? 'rounded-xl' : 'rounded-t-xl'}`}>
            <h2 className="font-semibold text-sm">Sensor</h2>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="bg-white/20 px-3 py-2 rounded-md hover:bg-white/30 transition text-sm font-bold ml-2"
            >
              {sidebarCollapsed ? "☰" : "✕"}
            </button>
          </div>
          {!sidebarCollapsed && (
            <div className="overflow-y-auto max-h-[calc(100vh-8rem)]">
              {loading ? (
                <div className="text-center text-gray-400 py-8">
                  <div className="animate-spin border-t-2 border-blue-500 border-solid rounded-full w-8 h-8 mx-auto mb-4" />
                  Loading sensors...
                </div>
              ) : sensors.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No sensors found</p>
              ) : (
                sensors.map((s, idx) => {
                  // หา temperature datastream
                  const tempDs = s.datastreams.find(ds => 
                    ds.datastreamName?.toLowerCase().includes('temp')
                  );
                  
                  return (
                    <div
                      key={`sensor-item-${s.thingId || idx}`}
                      className={`border-b border-gray-200 px-4 py-3 hover:bg-gray-50 transition relative ${
                        currentSensor?.thingId === s.thingId ? "bg-blue-50" : ""
                      }`}
                    >
                      {/* เนื้อหา sensor - กดได้ */}
                      <div 
                        className="cursor-pointer pr-14"
                        onClick={() => {
                          setCurrentSensor(s);
                          const marker = markers.current.get(s.thingId);
                          if (marker) {
                            marker.openPopup();
                          }
                        }}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <div className="font-semibold text-sm text-gray-800 flex-1">
                            {s.thingName || "Unknown"}
                          </div>
                          <div className="flex items-center gap-1 mr-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                s.isOnline ? "bg-green-500" : "bg-gray-400"
                              }`}
                            />
                            <span className="text-xs text-gray-500 whitespace-nowrap">
                              {s.isOnline ? "online" : "offline"}
                            </span>
                          </div>
                        </div>
                        <div
                          className="text-2xl font-bold mb-1"
                          style={{ color: colorByDb(s.primaryValue) }}
                        >
                          {s.primaryValue != null ? s.primaryValue.toFixed(1) : '-'} <span className="text-sm">dB</span>
                        </div>
                        
                        {/* แสดง Temperature ถ้ามี */}
                        {tempDs && tempDs.value !== null && (
                          <div className="text-sm text-gray-600 mb-1">
                            🌡️ {tempDs.value.toFixed(1)}°C
                          </div>
                        )}
                        
                        <div className="text-xs text-gray-500">{formatTime(s.primaryTime)}</div>
                      </div>
                      
                      {/* ปุ่ม > แยกออกมา ใหญ่และกดง่าย */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSensor(s);
                          setShowDetailView(true);
                        }}
                        className="absolute top-1/2 right-2 -translate-y-1/2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all flex items-center justify-center"
                        style={{ 
                          fontSize: '48px',
                          width: '52px',
                          height: '52px',
                          lineHeight: '1'
                        }}
                        title="View details"
                      >
                        ›
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel Overlay */}
      {showDetailView && selectedSensor && (
        <DetailPanel 
          sensor={selectedSensor} 
          onClose={() => {
            setShowDetailView(false);
            setSelectedSensor(null);
          }} 
        />
      )}
    </div>
  );
}