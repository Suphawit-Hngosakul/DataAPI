import React, { useState } from 'react';
import { Upload as UploadIcon, X, FileText, CheckCircle } from 'lucide-react';

const Upload = ({ onNavigateBack }) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file) => {
    setUploadedFile(file);
    // TODO: Handle actual file upload
    console.log('File selected:', file);
  };

  const handleUpload = async () => {
    if (!uploadedFile) return;
    
    setUploading(true);
    
    // TODO: Implement actual upload logic
    setTimeout(() => {
      setUploading(false);
      alert(`File "${uploadedFile.name}" uploaded successfully!`);
      setUploadedFile(null);
    }, 2000);
  };

  const removeFile = () => {
    setUploadedFile(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <div className="bg-blue-900 text-white px-6 py-4 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onNavigateBack && (
              <button
                onClick={onNavigateBack}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors"
              >
                ← Back to Map
              </button>
            )}
            <h1 className="text-2xl font-bold">DataAPI</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6 mt-8">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-blue-900 to-blue-800 px-8 py-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Upload Your file</h2>
            <button
              onClick={onNavigateBack}
              className="flex items-center gap-2 bg-blue-800 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
            >
              <X size={16} />
              Cancel
            </button>
          </div>

          {/* Upload Area */}
          <div className="p-8">
            <div
              className={`relative border-2 border-dashed rounded-2xl p-12 transition-all ${
                dragActive
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 bg-gray-50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                id="file-upload"
                className="hidden"
                onChange={handleChange}
              />
              
              {!uploadedFile ? (
                <label
                  htmlFor="file-upload"
                  className="flex flex-col items-center justify-center cursor-pointer"
                >
                  <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-6">
                    <UploadIcon size={48} className="text-gray-400" />
                  </div>
                  <p className="text-gray-600 text-lg mb-2">
                    Drag and drop your file here
                  </p>
                  <p className="text-gray-400 text-sm mb-4">or</p>
                  <button className="bg-blue-900 hover:bg-blue-800 text-white px-6 py-3 rounded-lg font-semibold transition-colors">
                    Browse Files
                  </button>
                  <p className="text-gray-400 text-xs mt-4">
                    Supported formats: CSV, JSON, Excel
                  </p>
                </label>
              ) : (
                <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FileText size={24} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{uploadedFile.name}</p>
                      <p className="text-sm text-gray-500">
                        {(uploadedFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={removeFile}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>
              )}
            </div>

            {/* Upload Button */}
            {uploadedFile && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex items-center gap-2 bg-blue-900 hover:bg-blue-800 text-white px-8 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin border-t-2 border-white rounded-full w-5 h-5" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={20} />
                      Upload File
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-3">📋 Upload Instructions:</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>• Supported file formats: CSV, JSON, Excel (.xlsx, .xls)</li>
            <li>• Maximum file size: 10MB</li>
            <li>• Make sure your data includes required columns</li>
            <li>• Files will be processed automatically after upload</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Upload;