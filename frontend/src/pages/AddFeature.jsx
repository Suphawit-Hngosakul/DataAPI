import React, { useState, useEffect } from 'react';
import { Database, MapPin, Plus, Trash2, X } from 'lucide-react';

const DATA_API_URL = "https://dporrqg75e.execute-api.us-east-1.amazonaws.com";

export default function AddFeature({ 
  onComplete, 
  onCancel, 
  idToken, 
  userEmail,
  datasetId,
  datasetName,
  layerId,
  layerName,
  layerSchema,
  geomType,
  srid = 4326
}) {
  // 🔥 เพิ่มการตรวจสอบ props ก่อนอื่น
  if (!datasetId || !layerId || !geomType || !layerSchema) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-indigo-100">
        <div className="bg-blue-900 text-white px-6 py-4 shadow-md">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <h1 className="text-2xl font-bold">Add Feature</h1>
            {userEmail && <div className="text-sm text-blue-200">{userEmail}</div>}
          </div>
        </div>
        
        <div className="max-w-4xl mx-auto p-6 mt-8">
          <div className="bg-white rounded-xl shadow-xl p-8 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Missing Layer Information</h2>
            <p className="text-gray-600 mb-6">
              Required layer information is missing. Please select a layer from the map first.
            </p>
            <button
              onClick={onCancel}
              className="px-6 py-3 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition"
            >
              ← Back to Map
            </button>
          </div>
        </div>
      </div>
    );
  }

  const [formData, setFormData] = useState({});
  const [coordinates, setCoordinates] = useState({
    point: { lat: '', lon: '' },
    line: [{ lat: '', lon: '' }, { lat: '', lon: '' }],
    polygon: [[{ lat: '', lon: '' }, { lat: '', lon: '' }, { lat: '', lon: '' }, { lat: '', lon: '' }]]
  });
  const [submitting, setSubmitting] = useState(false);

  // Initialize form data based on schema
  useEffect(() => {
    if (layerSchema && layerSchema.length > 0) {
      const initialData = {};
      layerSchema.forEach(field => {
        initialData[field.field_name] = '';
      });
      setFormData(initialData);
    }
  }, [layerSchema]);

  const handleFieldChange = (fieldName, value, dataType) => {
    let processedValue = value;
    
    if (dataType === 'numeric' || dataType === 'integer' || dataType === 'bigint') {
      processedValue = value === '' ? '' : parseFloat(value);
    } else if (dataType === 'boolean') {
      processedValue = value === 'true';
    }
    
    setFormData({ ...formData, [fieldName]: processedValue });
  };

  const updateCoordinate = (type, index, subIndex, field, value) => {
    const newCoords = { ...coordinates };
    
    if (type === 'point') {
      newCoords.point[field] = value;
    } else if (type === 'line') {
      newCoords.line[index][field] = value;
    } else if (type === 'polygon') {
      newCoords.polygon[0][index][field] = value;
    }
    
    setCoordinates(newCoords);
  };

  const addLinePoint = () => {
    setCoordinates({
      ...coordinates,
      line: [...coordinates.line, { lat: '', lon: '' }]
    });
  };

  const removeLinePoint = (index) => {
    if (coordinates.line.length > 2) {
      setCoordinates({
        ...coordinates,
        line: coordinates.line.filter((_, i) => i !== index)
      });
    }
  };

  const addPolygonPoint = () => {
    setCoordinates({
      ...coordinates,
      polygon: [[...coordinates.polygon[0], { lat: '', lon: '' }]]
    });
  };

  const removePolygonPoint = (index) => {
    if (coordinates.polygon[0].length > 3) {
      setCoordinates({
        ...coordinates,
        polygon: [[...coordinates.polygon[0].filter((_, i) => i !== index)]]
      });
    }
  };

  const buildGeometry = () => {
    const type = geomType.toUpperCase();
    
    if (type === 'POINT') {
      const { lat, lon } = coordinates.point;
      if (!lat || !lon) throw new Error('Please enter both latitude and longitude');
      return {
        type: 'POINT',
        coordinates: [parseFloat(lon), parseFloat(lat)],
        srid
      };
    }
    
    if (type === 'LINESTRING') {
      const coords = coordinates.line
        .filter(p => p.lat && p.lon)
        .map(p => [parseFloat(p.lon), parseFloat(p.lat)]);
      
      if (coords.length < 2) throw new Error('LineString requires at least 2 points');
      return {
        type: 'LINESTRING',
        coordinates: coords,
        srid
      };
    }
    
    if (type === 'POLYGON') {
      const coords = coordinates.polygon[0]
        .filter(p => p.lat && p.lon)
        .map(p => [parseFloat(p.lon), parseFloat(p.lat)]);
      
      if (coords.length < 3) throw new Error('Polygon requires at least 3 points');
      
      const first = coords[0];
      const last = coords[coords.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        coords.push([first[0], first[1]]);
      }
      
      return {
        type: 'POLYGON',
        coordinates: [coords],
        srid
      };
    }
    
    throw new Error(`Unsupported geometry type: ${type}`);
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      const data = {};
      for (const field of layerSchema) {
        const value = formData[field.field_name];
        
        if (value === '' || value === null || value === undefined) {
          alert(`Please fill in: ${field.field_name}`);
          setSubmitting(false);
          return;
        }
        
        data[field.field_name] = value;
      }

      const geom = buildGeometry();

      const response = await fetch(
        `${DATA_API_URL}/datasets/${datasetId}/layers/${layerId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ data, geom })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add feature');
      }

      alert('Feature added successfully!');
      
      if (onComplete) {
        onComplete(result);
      }

    } catch (error) {
      console.error('Error adding feature:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const renderGeometryInput = () => {
    const type = geomType.toUpperCase();

    if (type === 'POINT') {
      return (
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">
            <MapPin size={16} className="inline mr-1" />
            Point Coordinates
          </label>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              step="any"
              placeholder="Latitude"
              value={coordinates.point.lat}
              onChange={(e) => updateCoordinate('point', null, null, 'lat', e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-900 focus:border-transparent"
            />
            <input
              type="number"
              step="any"
              placeholder="Longitude"
              value={coordinates.point.lon}
              onChange={(e) => updateCoordinate('point', null, null, 'lon', e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-900 focus:border-transparent"
            />
          </div>
          <p className="text-xs text-gray-500">Example: Lat 13.7563, Lon 100.5018</p>
        </div>
      );
    }

    if (type === 'LINESTRING') {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-semibold text-gray-700">
              LineString Points (min 2)
            </label>
            <button
              type="button"
              onClick={addLinePoint}
              className="flex items-center gap-1 text-sm text-blue-900 hover:text-blue-700"
            >
              <Plus size={16} />
              Add Point
            </button>
          </div>
          {coordinates.line.map((point, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <span className="text-sm text-gray-600 w-8">#{idx + 1}</span>
              <input
                type="number"
                step="any"
                placeholder="Lat"
                value={point.lat}
                onChange={(e) => updateCoordinate('line', idx, null, 'lat', e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-900"
              />
              <input
                type="number"
                step="any"
                placeholder="Lon"
                value={point.lon}
                onChange={(e) => updateCoordinate('line', idx, null, 'lon', e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-900"
              />
              {coordinates.line.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeLinePoint(idx)}
                  className="text-red-500 hover:text-red-700 p-2"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      );
    }

    if (type === 'POLYGON') {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-semibold text-gray-700">
              Polygon Points (min 3, auto-close)
            </label>
            <button
              type="button"
              onClick={addPolygonPoint}
              className="flex items-center gap-1 text-sm text-blue-900 hover:text-blue-700"
            >
              <Plus size={16} />
              Add Point
            </button>
          </div>
          {coordinates.polygon[0].map((point, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <span className="text-sm text-gray-600 w-8">#{idx + 1}</span>
              <input
                type="number"
                step="any"
                placeholder="Lat"
                value={point.lat}
                onChange={(e) => updateCoordinate('polygon', idx, null, 'lat', e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-900"
              />
              <input
                type="number"
                step="any"
                placeholder="Lon"
                value={point.lon}
                onChange={(e) => updateCoordinate('polygon', idx, null, 'lon', e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-900"
              />
              {coordinates.polygon[0].length > 3 && (
                <button
                  type="button"
                  onClick={() => removePolygonPoint(idx)}
                  className="text-red-500 hover:text-red-700 p-2"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ))}
          <p className="text-xs text-gray-500">First and last points will be automatically connected</p>
        </div>
      );
    }

    return <p className="text-red-500">Unsupported geometry type: {geomType}</p>;
  };

  const renderFieldInput = (field) => {
    const { field_name, data_type } = field;
    const value = formData[field_name] || '';

    if (data_type === 'text' || data_type === 'varchar') {
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => handleFieldChange(field_name, e.target.value, data_type)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-900 focus:border-transparent"
          placeholder={`Enter ${field_name}`}
        />
      );
    }

    if (data_type === 'numeric' || data_type === 'integer' || data_type === 'bigint' || data_type === 'real' || data_type === 'double precision') {
      return (
        <input
          type="number"
          step="any"
          value={value}
          onChange={(e) => handleFieldChange(field_name, e.target.value, data_type)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-900 focus:border-transparent"
          placeholder={`Enter ${field_name}`}
        />
      );
    }

    if (data_type === 'boolean') {
      return (
        <select
          value={value.toString()}
          onChange={(e) => handleFieldChange(field_name, e.target.value, data_type)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-900 focus:border-transparent"
        >
          <option value="">Select...</option>
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      );
    }

    if (data_type === 'timestamp' || data_type === 'date') {
      return (
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => handleFieldChange(field_name, e.target.value, data_type)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-900 focus:border-transparent"
        />
      );
    }

    return (
      <input
        type="text"
        value={value}
        onChange={(e) => handleFieldChange(field_name, e.target.value, data_type)}
        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-900 focus:border-transparent"
        placeholder={`Enter ${field_name}`}
      />
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-indigo-100">
      {/* Navbar */}
      <div className="bg-blue-900 text-white px-6 py-4 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onCancel && (
              <button
                onClick={onCancel}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors"
              >
                ← Back to Map
              </button>
            )}
            <h1 className="text-2xl font-bold">Add Feature</h1>
          </div>
          {userEmail && (
            <div className="text-sm text-blue-200">
              {userEmail}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6 mt-8">
        <div className="bg-white rounded-xl shadow-2xl w-full">
          {/* Header */}
          <div className="px-6 py-6 border-b bg-gradient-to-r from-gray-50 to-blue-50 rounded-t-xl">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-md mb-2">
                <Database size={16} />
                Dataset: {datasetName}
              </div>
              <div className="text-gray-600 text-sm mt-2">
                Layer: <span className="font-semibold">{layerName}</span> ({geomType})
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="p-6 space-y-6">
            <div className="text-center mb-6">
              <p className="text-gray-600 text-sm">
                Fill in the feature attributes and coordinates
              </p>
            </div>

            {/* Attributes */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Attributes</h3>
              <div className="space-y-4">
                {layerSchema && layerSchema.map((field, idx) => (
                  <div key={idx}>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {field.field_name} 
                      <span className="text-red-500 ml-1">*</span>
                      <span className="text-xs text-gray-500 ml-2">({field.data_type})</span>
                    </label>
                    {renderFieldInput(field)}
                  </div>
                ))}
              </div>
            </div>

            {/* Geometry */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Geometry</h3>
              {renderGeometryInput()}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={onCancel}
                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-3 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition disabled:opacity-50"
              >
                {submitting ? 'Adding...' : 'Add Feature'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}