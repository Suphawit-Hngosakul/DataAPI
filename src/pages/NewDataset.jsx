import React, { useState } from 'react';
import { Database, X, Plus, Trash2, ChevronRight } from 'lucide-react';

const DATA_API_URL = "https://dporrqg75e.execute-api.us-east-1.amazonaws.com";

export default function NewDataset({ onComplete, onCancel }) {
  const [step, setStep] = useState('dataset');
  const [createdDatasetId, setCreatedDatasetId] = useState(null);
  const [createdDatasetName, setCreatedDatasetName] = useState('');
  
  const [datasetForm, setDatasetForm] = useState({
    name: '',
    description: '',
    source: ''
  });
  const [creatingDataset, setCreatingDataset] = useState(false);
  
  const [layerForm, setLayerForm] = useState({
    name: '',
    description: '',
    geom_type: 'Point',
    properties: [{ name: '', type: 'string' }]
  });
  const [creatingLayer, setCreatingLayer] = useState(false);

  const handleCreateDataset = async () => {
    if (!datasetForm.name.trim()) {
      alert('Please enter dataset name');
      return;
    }

    setCreatingDataset(true);
    try {
      const response = await fetch(`${DATA_API_URL}/datasets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: datasetForm.name,
          description: datasetForm.description,
          source: datasetForm.source,
          owner_id: 1
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create dataset');
      }

      const result = await response.json();
      const datasetId = result.dataset_id || result.id;
      
      if (!datasetId) {
        throw new Error('No dataset_id returned from API');
      }

      setCreatedDatasetId(datasetId);
      setCreatedDatasetName(datasetForm.name);
      setStep('layer');
    } catch (error) {
      console.error('Error creating dataset:', error);
      alert(`Failed to create dataset: ${error.message}`);
    } finally {
      setCreatingDataset(false);
    }
  };

  const handleCreateLayer = async () => {
    if (!layerForm.name.trim()) {
      alert('Please enter layer name');
      return;
    }

    setCreatingLayer(true);
    try {
      const response = await fetch(`${DATA_API_URL}/datasets/${createdDatasetId}/layers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: layerForm.name,
          description: layerForm.description,
          geom_type: layerForm.geom_type,
          properties: layerForm.properties.filter(p => p.name.trim())
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create layer');
      }

      const result = await response.json();
      
      if (onComplete) {
        onComplete({
          datasetId: createdDatasetId,
          datasetName: createdDatasetName,
          layerId: result.layer_id || result.id,
          layerName: layerForm.name
        });
      }
    } catch (error) {
      console.error('Error creating layer:', error);
      alert(`Failed to create layer: ${error.message}`);
    } finally {
      setCreatingLayer(false);
    }
  };

  const addProperty = () => {
    setLayerForm({
      ...layerForm,
      properties: [...layerForm.properties, { name: '', type: 'string' }]
    });
  };

  const removeProperty = (index) => {
    setLayerForm({
      ...layerForm,
      properties: layerForm.properties.filter((_, i) => i !== index)
    });
  };

  const updateProperty = (index, field, value) => {
    const newProperties = [...layerForm.properties];
    newProperties[index][field] = value;
    setLayerForm({ ...layerForm, properties: newProperties });
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
            <h1 className="text-2xl font-bold">DataAPI - Create Dataset</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6 mt-8">
        <div className="bg-white rounded-xl shadow-2xl w-full">
          {/* Progress Indicator */}
          <div className="px-6 py-6 border-b bg-gradient-to-r from-gray-50 to-blue-50 rounded-t-xl">
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-md ${
                  step === 'dataset' ? 'bg-blue-900 text-white' : 'bg-green-500 text-white'
                }`}>
                  {step === 'dataset' ? '1' : '✓'}
                </div>
                <span className={`font-semibold ${step === 'dataset' ? 'text-blue-900' : 'text-gray-600'}`}>
                  Dataset
                </span>
              </div>

              <ChevronRight className="text-gray-400" size={20} />

              <div className="flex items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-md ${
                  step === 'layer' ? 'bg-blue-900 text-white' : 'bg-gray-300 text-gray-600'
                }`}>
                  2
                </div>
                <span className={`font-semibold ${step === 'layer' ? 'text-blue-900' : 'text-gray-500'}`}>
                  Layer
                </span>
              </div>
            </div>

            {step === 'layer' && (
              <div className="mt-4 text-center">
                <div className="inline-flex items-center gap-2 bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-md">
                  <Database size={16} />
                  Dataset: {createdDatasetName}
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-6">
            {step === 'dataset' ? (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <p className="text-gray-600 text-sm">
                    Fill the form below to create a new dataset
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Dataset Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-900 focus:border-transparent"
                    placeholder="e.g., Bangkok Noise Levels"
                    value={datasetForm.name}
                    onChange={(e) => setDatasetForm({ ...datasetForm, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-900 focus:border-transparent"
                    placeholder="Describe your dataset..."
                    rows="4"
                    value={datasetForm.description}
                    onChange={(e) => setDatasetForm({ ...datasetForm, description: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Source
                  </label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-900 focus:border-transparent"
                    placeholder="e.g., Sensor, Manual Entry"
                    value={datasetForm.source}
                    onChange={(e) => setDatasetForm({ ...datasetForm, source: e.target.value })}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={onCancel}
                    className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateDataset}
                    disabled={creatingDataset}
                    className="px-6 py-3 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition disabled:opacity-50"
                  >
                    {creatingDataset ? 'Creating...' : 'Create Dataset'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <p className="text-gray-600 text-sm">
                    Define the structure of your layer
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Layer Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-900 focus:border-transparent"
                    placeholder="e.g., Noise Measurements"
                    value={layerForm.name}
                    onChange={(e) => setLayerForm({ ...layerForm, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-900 focus:border-transparent"
                    placeholder="Describe your layer..."
                    rows="3"
                    value={layerForm.description}
                    onChange={(e) => setLayerForm({ ...layerForm, description: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Geometry Type
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-900 focus:border-transparent"
                    value={layerForm.geom_type}
                    onChange={(e) => setLayerForm({ ...layerForm, geom_type: e.target.value })}
                  >
                    <option value="Point">Point</option>
                    <option value="LineString">Line</option>
                    <option value="Polygon">Polygon</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-semibold text-gray-700">
                      Properties
                    </label>
                    <button
                      onClick={addProperty}
                      className="flex items-center gap-1 text-sm text-blue-900 hover:text-blue-700"
                    >
                      <Plus size={16} />
                      Add Property
                    </button>
                  </div>

                  <div className="space-y-3">
                    {layerForm.properties.map((prop, index) => (
                      <div key={index} className="flex gap-3 items-start">
                        <input
                          type="text"
                          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-900 focus:border-transparent"
                          placeholder="Property name"
                          value={prop.name}
                          onChange={(e) => updateProperty(index, 'name', e.target.value)}
                        />
                        <select
                          className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-900 focus:border-transparent"
                          value={prop.type}
                          onChange={(e) => updateProperty(index, 'type', e.target.value)}
                        >
                          <option value="string">String</option>
                          <option value="number">Number</option>
                          <option value="boolean">Boolean</option>
                          <option value="date">Date</option>
                        </select>
                        {layerForm.properties.length > 1 && (
                          <button
                            onClick={() => removeProperty(index)}
                            className="text-red-500 hover:text-red-700 p-2"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between gap-3 pt-4">
                  <button
                    onClick={() => setStep('dataset')}
                    className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleCreateLayer}
                    disabled={creatingLayer}
                    className="px-6 py-3 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition disabled:opacity-50"
                  >
                    {creatingLayer ? 'Creating...' : 'Create Layer'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}