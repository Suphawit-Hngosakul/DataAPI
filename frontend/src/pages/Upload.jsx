import React, { useState } from 'react';
import { Upload, AlertCircle, CheckCircle, Copy, Check } from 'lucide-react';

// Shared API configuration
const API_CONFIG = {
  dataUrl: 'https://wy0vrlpu67.execute-api.us-east-1.amazonaws.com/data',
  uploadUrl: 'http://localhost:8080/api/uploaddata',
  projectName: 'project-name'
};

const ApiInfo = ({ uploadUrl, projectName }) => {
  const fullUrl = `${uploadUrl}/${projectName}`;
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-purple-50 p-6 rounded-lg">
      <h2 className="text-sm font-medium text-purple-800 mb-4">UPLOAD API ENDPOINT</h2>
      <div className="flex items-center space-x-2">
        <div className="flex-1 bg-white px-4 py-3 rounded border text-sm font-mono break-all">
          {fullUrl}
        </div>
        <button
          onClick={handleCopy}
          className="px-4 py-3 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors flex items-center space-x-2"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          <span className="text-sm">{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
        </button>
      </div>
      <p className="text-xs text-gray-600 mt-3">
        💡 ใช้ API endpoint นี้สำหรับอัพโหลดข้อมูลจาก backend หรือ script ของคุณ
      </p>
    </div>
  );
};

const CodeExample = () => {
  const pythonCode = `# Python Example - Upload File to API
import requests

def upload_file(file_path, project_name):
    url = "${API_CONFIG.uploadUrl}/${API_CONFIG.projectName}"
    
    with open(file_path, 'rb') as file:
        files = {'file': file}
        response = requests.post(url, files=files)
    
    if response.status_code == 200:
        print("Upload successful!")
        return response.json()
    else:
        print(f"Upload failed: {response.status_code}")
        return None

# Example usage
result = upload_file("data.json", "${API_CONFIG.projectName}")
print("Result:", result)`;

  const jsCode = `// JavaScript/Node.js Example - Upload File to API
const FormData = require('form-data');
const fs = require('fs');
const fetch = require('node-fetch');

async function uploadFile(filePath, projectName) {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));
  
  const response = await fetch(
    \`${API_CONFIG.uploadUrl}/\${projectName}\`,
    {
      method: 'POST',
      body: formData
    }
  );
  
  if (response.ok) {
    console.log('Upload successful!');
    return await response.json();
  } else {
    console.log(\`Upload failed: \${response.status}\`);
    return null;
  }
}

// Example usage
uploadFile('data.json', '${API_CONFIG.projectName}')
  .then(result => console.log('Result:', result));`;

  const curlCode = `# cURL Example - Upload File to API
curl -X POST \\
  "${API_CONFIG.uploadUrl}/${API_CONFIG.projectName}" \\
  -F "file=@data.json" \\
  -H "Content-Type: multipart/form-data"`;

  const [activeTab, setActiveTab] = useState('python');
  const [copied, setCopied] = useState(false);

  const getCode = () => {
    switch(activeTab) {
      case 'python': return pythonCode;
      case 'javascript': return jsCode;
      case 'curl': return curlCode;
      default: return pythonCode;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-medium text-gray-800">ตัวอย่างโค้ดการอัพโหลด</h3>
        <button
          onClick={handleCopy}
          className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded flex items-center space-x-1"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอกโค้ด'}</span>
        </button>
      </div>
      
      <div className="p-6">
        <div className="flex space-x-2 mb-4">
          <button
            onClick={() => setActiveTab('python')}
            className={`px-4 py-2 text-sm rounded ${
              activeTab === 'python'
                ? 'bg-purple-100 text-purple-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Python
          </button>
          <button
            onClick={() => setActiveTab('javascript')}
            className={`px-4 py-2 text-sm rounded ${
              activeTab === 'javascript'
                ? 'bg-purple-100 text-purple-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            JavaScript
          </button>
          <button
            onClick={() => setActiveTab('curl')}
            className={`px-4 py-2 text-sm rounded ${
              activeTab === 'curl'
                ? 'bg-purple-100 text-purple-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            cURL
          </button>
        </div>
        
        <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
          <pre className="text-xs text-gray-100">
            <code>{getCode()}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

const Instructions = () => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="font-medium text-gray-800 mb-4 flex items-center space-x-2">
        <Upload className="h-5 w-5 text-purple-600" />
        <span>วิธีการอัพโหลดข้อมูล</span>
      </h3>
      
      <div className="space-y-4">
        <div className="flex space-x-3">
          <div className="flex-shrink-0 w-8 h-8 bg-purple-100 text-purple-800 rounded-full flex items-center justify-center font-medium">
            1
          </div>
          <div>
            <h4 className="font-medium text-gray-800 mb-1">คัดลอก API Endpoint</h4>
            <p className="text-sm text-gray-600">
              ใช้ปุ่มคัดลอกด้านบนเพื่อคัดลอก URL ของ API
            </p>
          </div>
        </div>

        <div className="flex space-x-3">
          <div className="flex-shrink-0 w-8 h-8 bg-purple-100 text-purple-800 rounded-full flex items-center justify-center font-medium">
            2
          </div>
          <div>
            <h4 className="font-medium text-gray-800 mb-1">เลือกภาษาที่คุณใช้</h4>
            <p className="text-sm text-gray-600">
              เลือกแท็บ Python, JavaScript หรือ cURL ตามที่คุณต้องการ
            </p>
          </div>
        </div>

        <div className="flex space-x-3">
          <div className="flex-shrink-0 w-8 h-8 bg-purple-100 text-purple-800 rounded-full flex items-center justify-center font-medium">
            3
          </div>
          <div>
            <h4 className="font-medium text-gray-800 mb-1">รันโค้ดจาก Backend</h4>
            <p className="text-sm text-gray-600">
              คัดลอกโค้ดตัวอย่างและรันจาก script, server หรือ terminal ของคุณ
            </p>
          </div>
        </div>

        <div className="flex space-x-3">
          <div className="flex-shrink-0 w-8 h-8 bg-purple-100 text-purple-800 rounded-full flex items-center justify-center font-medium">
            4
          </div>
          <div>
            <h4 className="font-medium text-gray-800 mb-1">ดูข้อมูลที่ Dashboard</h4>
            <p className="text-sm text-gray-600">
              หลังอัพโหลดสำเร็จ ข้อมูลจะแสดงที่หน้า Dashboard โดยอัตโนมัติ
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-blue-50 border-l-4 border-blue-400 p-4">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-blue-400 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-800">รูปแบบไฟล์ที่รองรับ</p>
            <p className="text-xs text-blue-700 mt-1">
              JSON, CSV, Excel (XLSX, XLS)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const SupportedFormats = () => {
  const formats = [
    { name: 'JSON', color: 'bg-blue-100 text-blue-800', example: '{"key": "value"}' },
    { name: 'CSV', color: 'bg-green-100 text-green-800', example: 'column1,column2,column3' },
    { name: 'XLSX', color: 'bg-purple-100 text-purple-800', example: 'Excel Workbook' },
    { name: 'XLS', color: 'bg-orange-100 text-orange-800', example: 'Excel 97-2003' }
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="font-medium text-gray-800 mb-4">รูปแบบไฟล์ที่รองรับ</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {formats.map((format) => (
          <div key={format.name} className="text-center p-4 bg-gray-50 rounded-lg">
            <span className={`inline-block px-3 py-1 rounded text-sm font-medium mb-2 ${format.color}`}>
              {format.name}
            </span>
            <p className="text-xs text-gray-600">{format.example}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const UploadPage = () => {
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            อัพโหลดข้อมูล (Upload Data)
          </h1>
          <p className="text-sm text-gray-600">
            ใช้ API endpoint เพื่ออัพโหลดข้อมูลจาก backend หรือ script ของคุณ
          </p>
        </div>

        <ApiInfo 
          uploadUrl={API_CONFIG.uploadUrl}
          projectName={API_CONFIG.projectName}
        />

        <Instructions />

        <CodeExample />

        <SupportedFormats />
      </div>
    </div>
  );
};

export default UploadPage;