import React, { useEffect, useState, useRef } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Upload as UploadIcon, Database, Layers as LayersIcon, Filter, Home, List, ChevronRight, Plus } from 'lucide-react';

const FROST_API_URL = "https://dikn83u8md.execute-api.us-east-1.amazonaws.com/frost/get";
const DATA_API_URL = "https://dporrqg75e.execute-api.us-east-1.amazonaws.com";
const REFRESH_MS = 300000;
const OFFLINE_MS = 15000;

export default function SoundMap({ 
  onNavigateToNewDevice, 
  onNavigateToUpload, 
  onNavigateToHome, 
  onNavigateToMyThing, 
  idToken, 
  userEmail, 
  signOutRedirect,
  onNavigateToNewDataset 
}) {
  const mapRef = useRef(null);
  const frostMarkers = useRef(new Map());
  const projectLayersRef = useRef(new Map());
  
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentSensor, setCurrentSensor] = useState(null);
  const [dataType, setDataType] = useState("sensor");
  const [showDetailView, setShowDetailView] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // === Projects/Layers State ===
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  // 🔥 เพิ่ม state สำหรับ project detail view
  const [selectedProject, setSelectedProject] = useState(null);
  const [layers, setLayers] = useState([]);
  const [selectedLayers, setSelectedLayers] = useState(new Set());
  const [cqlFilter, setCqlFilter] = useState("");
  const [showProjectPanel, setShowProjectPanel] = useState(false);
  const [projectPanelCollapsed, setProjectPanelCollapsed] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [showCqlInput, setShowCqlInput] = useState(false);
  // 🔥 เพิ่ม state สำหรับ view mode (list/detail)
  const [viewMode, setViewMode] = useState('list');

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
    return {
      color: "#ffffff",
      fillColor: offline ? "#9e9e9e" : "#e74c3c",
      fillOpacity: offline ? 0.4 : 0.85,
      weight: 3,
      radius: 10
    };
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

  // === FROST Sensor Data Fetch ===
  useEffect(() => {
    if (dataType !== 'sensor') return;

    const fetchData = async () => {
      try {
        const res = await fetch(FROST_API_URL, {
          headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
        });

        if (res.status === 401) {
          console.warn("Unauthorized: token ไม่มีหรือหมดอายุ");
          setLoading(false);
          return;
        }

        const text = await res.text();

        if (!res.ok) {
          console.error("API error:", res.status, text);
          setLoading(false);
          return;
        }

        const data = text ? JSON.parse(text) : { features: [] };
        setLoading(false);

        const features = data.features ?? [];
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
              isOnline: false,
            });
          }

          const thing = thingsMap.get(id);

          thing.datastreams.push({
            datastreamId: props.datastreamId,
            datastreamName: props.datastreamName,
            value: props.value,
            time: props.time,
          });

          if (
            props.datastreamName?.toLowerCase().includes("sound") ||
            props.datastreamName?.toLowerCase().includes("level")
          ) {
            thing.primaryValue = props.value;
            thing.primaryTime = props.time;
            thing.isOnline = isOnline(props.time);
          }

          if (thing.primaryValue === null && props.value !== null) {
            thing.primaryValue = props.value;
            thing.primaryTime = props.time;
            thing.isOnline = isOnline(props.time);
          }
        });

        const ids = new Set();

        thingsMap.forEach((thing) => {
          const id = thing.thingId;
          ids.add(id);

          const [lat, lon] = thing.coordinates;
          const updatedAt = isoToMs(thing.primaryTime);
          const style = styleByValue(thing.primaryValue, updatedAt);

          const datastreamsInfo = thing.datastreams
            .filter((ds) => ds.value !== null)
            .map((ds) => {
              const isSound = ds.datastreamName?.toLowerCase().includes("sound");
              return `<b>${ds.datastreamName}:</b> ${ds.value}${isSound ? " dB" : ""}<br/>`;
            })
            .join("");

          const html = `
            <div class='font-sans'>
              <b>${thing.thingName ?? "Thing"}</b><br/>
              ${datastreamsInfo || '<span class="text-gray-500">No data available</span>'}
              <span class='text-xs text-gray-500'>
                ${formatTime(thing.primaryTime)}<br/>
                Status: <b>${thing.isOnline ? "online" : "offline"}</b>
              </span>
            </div>`;

          if (frostMarkers.current.has(id)) {
            const m = frostMarkers.current.get(id);
            m.setLatLng([lat, lon]);
            m.setStyle(style);
            if (m.isPopupOpen()) m.setPopupContent(html);
          } else {
            const m = L.circleMarker([lat, lon], style)
              .bindPopup(html)
              .on("click", () => setCurrentSensor(thing))
              .addTo(mapRef.current);
            frostMarkers.current.set(id, m);
          }
        });

        for (const [id, m] of frostMarkers.current.entries()) {
          if (!ids.has(id)) {
            mapRef.current.removeLayer(m);
            frostMarkers.current.delete(id);
          }
        }

        setSensors((prev) => {
          const newSensors = Array.from(thingsMap.values());
          if (showDetailView) return prev;
          return newSensors;
        });

      } catch (e) {
        console.error("Error fetching FROST:", e);
        setLoading(false);
      }
    };

    fetchData();
    const i1 = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(i1);
  }, [showDetailView, dataType, idToken]);

  // === Projects API Functions ===
  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const response = await fetch(`${DATA_API_URL}/datasets`);
      const data = await response.json();
      // 🔥 รองรับทั้ง array และ object response
      const projectsData = Array.isArray(data) ? data : (data.datasets || []);
      setProjects(projectsData);
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchLayers = async (datasetId) => {
    try {
      const response = await fetch(`${DATA_API_URL}/datasets/${datasetId}/layers`);
      const data = await response.json();
      // 🔥 รองรับทั้ง array และ object response
      const layersData = Array.isArray(data) ? data : (data.layers || []);
      setLayers(layersData);
    } catch (error) {
      console.error('Error fetching layers:', error);
      setLayers([]);
    }
  };

  const fetchFeatures = async (datasetId, layerId, cqlFilterParam = "") => {
    try {
      let url = `${DATA_API_URL}/datasets/${datasetId}/layers/${layerId}`;
      if (cqlFilterParam) {
        url += `?CQL_FILTER=${encodeURIComponent(cqlFilterParam)}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching features:', error);
      return null;
    }
  };

  // 🔥 แก้ไข: เพิ่ม reset states เมื่อเปลี่ยน dataType
  useEffect(() => {
    if (dataType === 'general') {
      fetchProjects();
      setShowProjectPanel(true);
      // Reset states
      setViewMode('list');
      setSelectedProjectId(null);
      setSelectedProject(null);
      setLayers([]);
      setSelectedLayers(new Set());
      
      // Clear existing layers
      projectLayersRef.current.forEach(layer => {
        if (mapRef.current) mapRef.current.removeLayer(layer);
      });
      projectLayersRef.current.clear();
    } else {
      setShowProjectPanel(false);
    }
  }, [dataType]);

  useEffect(() => {
    if (selectedProjectId) {
      fetchLayers(selectedProjectId);
      setSelectedLayers(new Set());
      
      projectLayersRef.current.forEach(layer => {
        if (mapRef.current) mapRef.current.removeLayer(layer);
      });
      projectLayersRef.current.clear();
    }
  }, [selectedProjectId]);

  // 🔥 แก้ไข: รองรับทั้ง layer_id และ id
  const toggleLayer = async (layer) => {
    const layerId = layer.layer_id || layer.id;
    const newSelected = new Set(selectedLayers);
    
    if (newSelected.has(layerId)) {
      newSelected.delete(layerId);
      const leafletLayer = projectLayersRef.current.get(layerId);
      if (leafletLayer && mapRef.current) {
        mapRef.current.removeLayer(leafletLayer);
        projectLayersRef.current.delete(layerId);
      }
    } else {
      newSelected.add(layerId);
      
      const features = await fetchFeatures(selectedProjectId, layerId, cqlFilter);
      
      if (features && features.features && features.features.length > 0 && mapRef.current) {
        const geoJsonLayer = L.geoJSON(features, {
          pointToLayer: (feature, latlng) => {
            // 🔥 แก้ไข: ใช้สีตาม noise_level ถ้ามี
            const props = feature.properties || {};
            const value = parseFloat(props.noise_level || props.value || 0);
            const color = colorByDb(value);
            
            return L.circleMarker(latlng, {
              radius: 8,
              fillColor: color,
              color: "#FFFFFF",
              weight: 2,
              opacity: 1,
              fillOpacity: 0.8
            });
          },
          style: (feature) => {
            return {
              color: "#1E3A8A",
              weight: 2,
              opacity: 0.8,
              fillColor: "#3B82F6",
              fillOpacity: 0.4
            };
          },
          onEachFeature: (feature, layer) => {
            const props = feature.properties || {};
            let popupContent = `<div class="font-sans text-sm"><b style="font-size: 16px; color: #1E3A8A;">Feature</b><br/><br/>`;
            
            const entries = Object.entries(props);
            if (entries.length > 0) {
              popupContent += '<div style="background: #f8fafc; padding: 8px; border-radius: 4px; margin: 4px 0;">';
              entries.forEach(([key, value]) => {
                if (key !== 'id' && key !== 'geometry_name' && value != null) {
                  popupContent += `<div style="margin: 4px 0;"><b style="color: #1E3A8A;">${key}:</b> <span style="color: #475569;">${value}</span></div>`;
                }
              });
              popupContent += '</div>';
            }
            
            const geomType = feature.geometry?.type;
            if (geomType) {
              popupContent += `<div style="margin-top: 8px; padding: 4px 8px; background: #dbeafe; border-radius: 4px; display: inline-block;"><span style="font-size: 11px; color: #1e40af; font-weight: 600;">Type: ${geomType}</span></div>`;
            }
            
            popupContent += '</div>';
            layer.bindPopup(popupContent, { maxWidth: 300 });
          }
        }).addTo(mapRef.current);
        
        projectLayersRef.current.set(layerId, geoJsonLayer);
        
        const bounds = geoJsonLayer.getBounds();
        if (bounds.isValid()) {
          mapRef.current.fitBounds(bounds, { padding: [50, 50] });
        }
      }
    }
    
    setSelectedLayers(newSelected);
  };

  const applyCqlFilter = async () => {
    for (const layerId of selectedLayers) {
      const layer = layers.find(l => (l.layer_id || l.id) === layerId);
      if (layer && mapRef.current) {
        const existingLayer = projectLayersRef.current.get(layerId);
        if (existingLayer) mapRef.current.removeLayer(existingLayer);
        
        const features = await fetchFeatures(selectedProjectId, layerId, cqlFilter);
        
        if (features && features.features && features.features.length > 0) {
          const geoJsonLayer = L.geoJSON(features, {
            pointToLayer: (feature, latlng) => {
              const props = feature.properties || {};
              const value = parseFloat(props.noise_level || props.value || 0);
              const color = colorByDb(value);
              
              return L.circleMarker(latlng, {
                radius: 8,
                fillColor: color,
                color: "#FFFFFF",
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
              });
            },
            style: (feature) => {
              return {
                color: "#1E3A8A",
                weight: 2,
                opacity: 0.8,
                fillColor: "#3B82F6",
                fillOpacity: 0.4
              };
            },
            onEachFeature: (feature, layer) => {
              const props = feature.properties || {};
              let popupContent = `<div class="font-sans text-sm"><b style="font-size: 16px; color: #1E3A8A;">Feature</b><br/><br/>`;
              
              const entries = Object.entries(props);
              if (entries.length > 0) {
                popupContent += '<div style="background: #f8fafc; padding: 8px; border-radius: 4px; margin: 4px 0;">';
                entries.forEach(([key, value]) => {
                  if (key !== 'id' && key !== 'geometry_name' && value != null) {
                    popupContent += `<div style="margin: 4px 0;"><b style="color: #1E3A8A;">${key}:</b> <span style="color: #475569;">${value}</span></div>`;
                  }
                });
                popupContent += '</div>';
              }
              
              const geomType = feature.geometry?.type;
              if (geomType) {
                popupContent += `<div style="margin-top: 8px; padding: 4px 8px; background: #dbeafe; border-radius: 4px; display: inline-block;"><span style="font-size: 11px; color: #1e40af; font-weight: 600;">Type: ${geomType}</span></div>`;
              }
              
              popupContent += '</div>';
              layer.bindPopup(popupContent, { maxWidth: 300 });
            }
          }).addTo(mapRef.current);
          
          projectLayersRef.current.set(layerId, geoJsonLayer);
        }
      }
    }
  };

  const getChartDataFromHistory = (historicalData, datastreamName) => {
    if (!historicalData || !historicalData.features) {
      return null;
    }
    
    const matchingFeatures = historicalData.features.filter(f => {
      const props = f.properties;
      return props?.datastreamName === datastreamName && 
             (props?.result !== null && props?.result !== undefined || 
              props?.value !== null && props?.value !== undefined);
    });
    
    if (matchingFeatures.length === 0) {
      return null;
    }
    
    const sortedData = matchingFeatures
      .map(f => {
        const props = f.properties;
        return {
          value: props.result ?? props.value,
          time: props.phenomenonTime ?? props.time
        };
      })
      .filter(d => d.value !== null && d.value !== undefined)
      .sort((a, b) => new Date(a.time) - new Date(b.time))
      .slice(-500);
    
    return sortedData.map(d => d.value);
  };

  // === Detail Panel Component ===
  const DetailPanel = ({ sensor, onClose, idToken }) => {
    const [historicalData, setHistoricalData] = useState(null);
    const [loadingHistory, setLoadingHistory] = useState(true);
    
    useEffect(() => {
      const fetchHistoricalData = async () => {
        try {
          setLoadingHistory(true);
          const response = await fetch(
            `${FROST_API_URL}?thingId=${sensor.thingId}&limit=300`,
            {
              headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
            }
          );
          const data = await response.json();
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
    
    const soundDatastream = sensor.datastreams.find(ds => 
      ds.datastreamName?.toLowerCase().includes('sound') || 
      ds.datastreamName?.toLowerCase().includes('level')
    );
    
    const tempDatastream = sensor.datastreams.find(ds => 
      ds.datastreamName?.toLowerCase().includes('temp')
    );
    
    return (
      <>
        <div 
          className="fixed inset-0 bg-black/30 z-[9998] transition-opacity"
          onClick={onClose}
        />
        
        <div className="fixed top-0 right-0 h-full w-[500px] bg-white shadow-2xl z-[9999] overflow-y-auto animate-slide-in">
          <div className="bg-blue-900 text-white px-6 py-4 flex items-center justify-between sticky top-0">
            <h1 className="text-xl font-semibold">{sensor.thingName || "Unknown Device"}</h1>
            <button
              onClick={onClose}
              className="text-3xl hover:bg-white/20 w-10 h-10 rounded-lg transition flex items-center justify-center leading-none"
            >
              ‹
            </button>
          </div>

          <div className="p-6 space-y-6">
            {loadingHistory ? (
              <div className="text-center text-gray-400 py-8">
                <div className="animate-spin border-t-2 border-blue-500 border-solid rounded-full w-8 h-8 mx-auto mb-4" />
                Loading sensor data...
              </div>
            ) : (
              <>
                <div>
                  <p className="text-blue-900 text-base font-medium">
                    By Project : <span className="font-semibold">Project1</span>
                  </p>
                  <p className="text-blue-900 text-base font-medium mt-2">
                    Location : <span className="font-semibold">{sensor.location || "N/A"}</span>
                  </p>
                </div>

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
                          
                          <SensorChart data={chartData} unit="dB" />
                        </>
                      );
                    })()}
                  </div>
                )}

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
                          
                          <SensorChart data={chartData} unit="°C" />
                        </>
                      );
                    })()}
                  </div>
                )}

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
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
          .animate-slide-in {
            animation: slide-in 0.3s ease-out;
          }
        `}</style>
      </>
    );
  };

  const SensorChart = ({ data, unit = '' }) => {
    const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, value: 0, index: 0 });
    const chartRef = useRef(null);
    
    const maxVal = Math.max(...data);
    const minVal = Math.min(...data);
    const range = maxVal - minVal || 1;
    
    const createSmoothPath = (points, tension = 0.8) => {
      if (points.length < 2) return '';
      
      let path = `M ${points[0].x},${points[0].y}`;
      
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];
        
        const cp1x = p1.x + (p2.x - p0.x) / 6 * tension;
        const cp1y = p1.y + (p2.y - p0.y) / 6 * tension;
        const cp2x = p2.x - (p3.x - p1.x) / 6 * tension;
        const cp2y = p2.y - (p3.y - p1.y) / 6 * tension;
        
        path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
      }
      
      return path;
    };
    
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
          <path
            d={smoothPath}
            fill="none"
            stroke="#3B82F6"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        
        {tooltip.show && (
          <>
            <div
              className="absolute w-3 h-3 bg-red-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 ring-2 ring-red-300"
              style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
            />
            
            <div
              className="absolute top-0 bottom-0 w-px bg-gray-300 pointer-events-none"
              style={{ left: `${tooltip.x}px` }}
            />
            
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
    <div className="w-full h-screen flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center bg-blue-900 text-white px-6 py-3 shadow-md">
        <div className="flex items-center gap-6">
          <h1
            onClick={onNavigateToHome || (() => window.location.reload())}
            className="font-semibold text-xl cursor-pointer hover:text-blue-200 transition"
          >
            DataAPI
          </h1>
          
          <div className="flex items-center gap-3">
          </div>
        </div>

        <div className="flex gap-3 items-center">
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="appearance-none bg-white/10 text-white px-4 py-2 rounded-md text-sm font-semibold cursor-pointer hover:bg-white/20 transition flex items-center justify-between gap-3 border border-white/20"
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
            
            {dropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-[9999]" 
                  onClick={() => setDropdownOpen(false)}
                />
                
                <div className="absolute top-full mt-1 left-0 w-full bg-white rounded-lg shadow-lg z-[10000] overflow-hidden">
                  <button
                    onClick={() => {
                      setDataType('sensor');
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm font-medium transition ${
                      dataType === 'sensor' 
                        ? 'bg-blue-100 text-blue-900' 
                        : 'text-gray-800 hover:bg-gray-100'
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
                        : 'text-gray-800 hover:bg-gray-100'
                    }`}
                  >
                    General
                  </button>
                </div>
              </>
            )}
          </div>
        
          
          {/* 🔥 เปลี่ยน: เพิ่มปุ่ม New Dataset + Upload สำหรับ General */}
          {dataType === 'general' ? (
            <>
              <button
                onClick={onNavigateToNewDataset}
                className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-md text-sm font-semibold hover:bg-white/20 transition border border-white/20"
              >
                <Plus size={16} />
                New Dataset
              </button>
            </>
          ) : (
            <button
              onClick={onNavigateToNewDevice}
              className="bg-white text-blue-900 px-4 py-2 rounded-md text-sm font-semibold hover:bg-blue-50 transition shadow-sm"
            >
              + New Device
            </button>
          )}

          {userEmail && (
            <div className="flex items-center gap-2 pl-3 border-l border-white/30">
              <span className="text-sm">{userEmail}</span>
              <button
                onClick={() => {
                  // เคลียร์ storage ฝั่ง client
                  sessionStorage.clear();
                  localStorage.clear();
                  // เรียกฟังก์ชัน logout ที่ส่งมาจาก App
                  if (signOutRedirect) {
                    signOutRedirect();
                  }
                }}
      className="bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-md text-sm font-medium transition"
    >
      Sign Out
    </button>
  </div>
)}

        </div>
      </div>

      {/* Container */}
      <div className="flex flex-1 relative overflow-hidden">
        <div id="map" className="flex-1 h-full z-0" />

        {/* Sensor Sidebar */}
        {dataType === 'sensor' && (
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
                        <div 
                          className="cursor-pointer pr-14"
                          onClick={() => {
                            setCurrentSensor(s);
                            const marker = frostMarkers.current.get(s.thingId);
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
                          
                          {tempDs && tempDs.value !== null && (
                            <div className="text-sm text-gray-600 mb-1">
                              🌡️ {tempDs.value.toFixed(1)}°C
                            </div>
                          )}
                          
                          <div className="text-xs text-gray-500">{formatTime(s.primaryTime)}</div>
                        </div>
                        
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
        )}

        {/* 🔥 Projects Panel - เปลี่ยนจาก dropdown เป็น list/detail view */}
        {dataType === 'general' && showProjectPanel && (
          <div
            className={`absolute top-4 right-4 bg-white rounded-xl shadow-xl overflow-hidden transition-all ${
              projectPanelCollapsed ? "w-auto" : "w-80 max-h-[calc(100vh-6rem)]"
            }`}
            style={{ zIndex: 1000 }}
          >
            <div className={`flex justify-between items-center bg-[#1E3A8A] text-white px-4 py-3 ${projectPanelCollapsed ? 'rounded-xl' : 'rounded-t-xl'}`}>
              {/* 🔥 เพิ่ม: ปุ่มกลับเมื่ออยู่ใน detail view */}
              {viewMode === 'detail' && !projectPanelCollapsed && (
                <button
                  onClick={() => {
                    setViewMode('list');
                    setSelectedProjectId(null);
                    setSelectedProject(null);
                    setLayers([]);
                    setSelectedLayers(new Set());
                    projectLayersRef.current.forEach(layer => {
                      if (mapRef.current) mapRef.current.removeLayer(layer);
                    });
                    projectLayersRef.current.clear();
                  }}
                  className="text-white hover:bg-white/20 px-2 py-1 rounded-md transition text-lg"
                >
                  ‹
                </button>
              )}
              <h2 className="font-semibold text-sm flex items-center gap-2 flex-1">
                <Database size={16} />
                {!projectPanelCollapsed && (viewMode === 'list' ? "Projects" : selectedProject?.name || "Project")}
              </h2>
              <button
                onClick={() => setProjectPanelCollapsed(!projectPanelCollapsed)}
                className="bg-white/20 px-3 py-2 rounded-md hover:bg-white/30 transition text-sm font-bold"
              >
                {projectPanelCollapsed ? "☰" : "✕"}
              </button>
            </div>

            {!projectPanelCollapsed && (
              <div className="overflow-y-auto max-h-[calc(100vh-8rem)]">
                {loadingProjects ? (
                  <div className="text-center text-gray-400 py-8">
                    <div className="animate-spin border-t-2 border-blue-500 border-solid rounded-full w-8 h-8 mx-auto mb-4" />
                    Loading projects...
                  </div>
                ) : viewMode === 'list' ? (
                  /* 🔥 เพิ่ม: List View - แสดงรายการ Projects */
                  <div className="p-2">
                    {projects.length === 0 ? (
                      <p className="text-center text-gray-500 py-8 text-sm">No projects found</p>
                    ) : (
                      projects.map((project) => (
                        <div
                          key={project.dataset_id || project.id}
                          onClick={() => {
                            setSelectedProjectId(project.dataset_id || project.id);
                            setSelectedProject(project);
                            setViewMode('detail');
                          }}
                          className="border border-gray-200 rounded-lg p-4 mb-2 hover:bg-blue-50 hover:border-[#1E3A8A] transition cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-800 text-sm">{project.name}</h3>
                              {project.description && <p className="text-xs text-gray-500 mt-1">{project.description}</p>}
                              <p className="text-xs text-gray-400 mt-1">
                                Created: {new Date(project.created_at).toLocaleDateString('th-TH')}
                              </p>
                            </div>
                            <ChevronRight size={20} className="text-gray-400" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  /* 🔥 เพิ่ม: Detail View - แสดง Layers ของ Project ที่เลือก */
                  <div className="p-4 space-y-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Project Info</p>
                      <p className="text-sm text-gray-700">{selectedProject?.description || 'No description'}</p>
                    </div>

                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                          <LayersIcon size={16} />
                          Layers
                        </label>
                        <span className="text-xs text-gray-500">{selectedLayers.size} selected</span>
                      </div>

                      {layers.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No layers found</p>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {layers.map((layer) => (
                            <label
                              key={layer.layer_id || layer.id}
                              className="flex items-start gap-3 p-3 rounded-lg hover:bg-blue-50 cursor-pointer border border-gray-200 transition"
                            >
                              <input
                                type="checkbox"
                                checked={selectedLayers.has(layer.layer_id || layer.id)}
                                onChange={() => toggleLayer(layer)}
                                className="mt-1 w-4 h-4 text-[#1E3A8A] rounded focus:ring-[#1E3A8A]"
                              />
                              <div className="flex-1">
                                <div className="font-medium text-sm text-gray-800">{layer.name}</div>
                                {layer.description && <div className="text-xs text-gray-500 mt-1">{layer.description}</div>}
                                <div className="text-xs text-gray-400 mt-1">{layer.geom_type || 'GEOMETRY'}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    {selectedLayers.size > 0 && (
                      <div className="border-t pt-4">
                        <button
                          onClick={() => setShowCqlInput(!showCqlInput)}
                          className="flex items-center gap-2 text-sm font-semibold text-[#1E3A8A] hover:text-blue-700 mb-2"
                        >
                          <Filter size={16} />
                          CQL Filter {showCqlInput ? '▼' : '▶'}
                        </button>

                        {showCqlInput && (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={cqlFilter}
                              onChange={(e) => setCqlFilter(e.target.value)}
                              placeholder="e.g., noise_level > 80"
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1E3A8A] focus:border-transparent"
                            />
                            <button
                              onClick={applyCqlFilter}
                              className="w-full bg-[#1E3A8A] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-800 transition"
                            >
                              Apply Filter
                            </button>
                            {cqlFilter && (
                              <button
                                onClick={() => {
                                  setCqlFilter('');
                                  applyCqlFilter();
                                }}
                                className="w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-300 transition"
                              >
                                Clear Filter
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail Panel Overlay */}
      {showDetailView && selectedSensor && (
        <DetailPanel 
          sensor={selectedSensor} 
          onClose={() => {
            setShowDetailView(false);
            setSelectedSensor(null);
          }}
          idToken={idToken}
        />
      )}
    </div>
  );
}