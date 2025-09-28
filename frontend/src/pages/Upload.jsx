import React, { useState } from 'react';
import { Upload as UploadIcon } from 'lucide-react';

// Mock API function
const mockApi = {
  async uploadData() {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { message: 'Upload successful', status: 'success' };
  }
};

// API Info Component
const ApiInfo = ({ projectName }) => {
  return (
    <div className="bg-purple-50 p-4 rounded-lg mb-6">
      <h2 className="text-sm font-medium text-purple-800 mb-2">DATA API</h2>
      <div className="flex items-center space-x-2 text-sm text-gray-600">
        <span className="font-medium">API:</span>
        <span className="bg-white px-2 py-1 rounded border text-xs">
          localhost:8080/api/uploaddata/{projectName}
        </span>
      </div>
    </div>
  );
};

// Upload Page Component
const Upload = () => {
  const [uploadStatus, setUploadStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    setLoading(true);
    try {
      const result = await mockApi.uploadData();
      setUploadStatus(result);
    } catch (error) {
      setUploadStatus({ message: 'Upload failed', status: 'error' });
    }
    setLoading(false);
  };

  const defaultCode = `// Basic API Usage Example
import requests

# Upload data to the API
def upload_data(file_path, project_name):
    url = f"localhost:8080/api/uploaddata/{project_name}"
    
    with open(file_path, 'rb') as file:
        files = {'file': file}
        response = requests.post(url, files=files)
    
    return response.json()

# Get data from API
def get_data(project_name):
    url = f"localhost:8080/api/getdata/{project_name}"
    response = requests.get(url)
    return response.json()

# Example usage
if __name__ == "__main__":
    # Upload a file
    result = upload_data("data.json", "project-name")
    print("Upload result:", result)
    
    # Retrieve data
    data = get_data("project-name")
    print("Retrieved data:", data)`;

  return (
    <div className="space-y-6">
      <ApiInfo projectName="project-name" />
      
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="font-medium text-gray-800">Code Default</h3>
        </div>
        
        <div className="p-6">
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Backend API Integration Code</h4>
            <pre className="text-xs text-gray-600 bg-white p-4 rounded border overflow-x-auto">
              <code>{defaultCode}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Upload;