import React, { useState, useEffect, useMemo } from 'react'
import { Database, FileText, Filter, Eye } from 'lucide-react'

// Mock API functions
const mockApi = {
  async fetchData(projectName) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const mockData = [
      {
        species: ["Bird1", "Bird2"],
        DATE: "20250830_2355",
        location: "13.933667182922, 99.763458251953",
        DEVICE: "ESP32-02",
        files: ["20250830_2355_ESP32-02_13.933667182922,99.763458251953.wav", "20250830_2355_ESP32-02_13.933667182922,99.763458251953.json"],
        temperature_c: 28.5275,
        humidity: 78.30472,
        light: 4095.0
      },
      {
        species: ["Bird3"],
        DATE: "20250830_2320",
        location: "13.923445123456, 99.753421654321",
        DEVICE: "ESP32-01",
        files: ["20250830_2320_ESP32-01_13.923445123456,99.753421654321.wav", "20250830_2320_ESP32-01_13.923445123456,99.753421654321.json"],
        temperature_c: 27.8421,
        humidity: 76.52341,
        light: 3876.5
      },
      {
        species: [],
        DATE: "20250830_2145",
        location: "13.945678901234, 99.776543210987",
        DEVICE: "ESP32-03",
        files: ["20250830_2145_ESP32-03_13.945678901234,99.776543210987.wav"],
        temperature_c: 29.1234,
        humidity: 79.87654,
        light: 4090.2
      },
      {
        species: ["Bird1", "Bird4", "Bird5"],
        DATE: "20250830_2100",
        location: "13.912345678901, 99.743210987654",
        DEVICE: "ESP32-02",
        files: ["20250830_2100_ESP32-02_13.912345678901,99.743210987654.wav", "20250830_2100_ESP32-02_13.912345678901,99.743210987654.json"],
        temperature_c: 26.9876,
        humidity: 74.12345,
        light: 3999.8
      },
      {
        species: ["Bird2"],
        DATE: "20250830_2030",
        location: "13.934567890123, 99.765432109876",
        DEVICE: "ESP32-01",
        files: ["20250830_2030_ESP32-01_13.934567890123,99.765432109876.wav", "20250830_2030_ESP32-01_13.934567890123,99.765432109876.json"],
        temperature_c: 28.2109,
        humidity: 77.65432,
        light: 4023.7
      }
    ];

    return mockData;
  },

  async fetchFiles(projectName) {
    await new Promise(resolve => setTimeout(resolve, 300));

    return [
      { name: 'data.csv', size: '2.5 MB', type: 'CSV', lastModified: '2024-01-15' },
      { name: 'report.pdf', size: '1.2 MB', type: 'PDF', lastModified: '2024-01-14' },
      { name: 'config.json', size: '45 KB', type: 'JSON', lastModified: '2024-01-13' },
      { name: 'backup.zip', size: '15.8 MB', type: 'ZIP', lastModified: '2024-01-12' },
    ]
  }
}

const ApiInfo = ({ projectName }) => {
  return (
    <div className="bg-purple-50 p-4 rounded-lg mb-6">
      <h2 className="text-sm font-medium text-purple-800 mb-2">DATA API</h2>
      <div className="flex items-center space-x-2 text-sm text-gray-600">
        <span className="font-medium">API:</span>
        <span className="bg-white px-2 py-1 rounded border text-xs">
          localhost:8080/api/getdata/{projectName}
        </span>
      </div>
    </div>
  )
}

// Enhanced Filter Component with click-to-filter for non-dropdown values
const FilterComponent = ({ filters, activeFilters, onFilterChange, onClearFilters, data, onValueClick }) => {
  const hasActiveFilters = Object.values(activeFilters).some(value => value !== '');

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">กรองข้อมูล (Filter Data)</span>
        </div>
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="text-xs text-purple-600 hover:text-purple-800 underline"
          >
            ล้างตัวกรองทั้งหมด
          </button>
        )}
      </div>
      
      {/* Dropdown Filters */}
      {Object.keys(filters).length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">ตัวกรองแบบเลือก</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(filters).map(([key, values]) => (
              <div key={key} className="relative">
                <label className="block text-xs text-gray-600 mb-1 capitalize">
                  {key.replace(/_/g, ' ')}
                </label>
                <select
                  value={activeFilters[key] || ''}
                  onChange={(e) => onFilterChange(key, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                >
                  <option value="">ทั้งหมด (All)</option>
                  {values.map(value => (
                    <option key={value} value={value}>
                      {Array.isArray(value) ? value.join(', ') : value}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Click-to-filter hint */}
      <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded border-l-2 border-blue-200">
        💡 เคล็ดลับ: คลิกที่ข้อมูลในตารางเพื่อกรองตามค่านั้น (Click on table values to filter by that value)
      </div>

      {hasActiveFilters && (
        <div className="mt-3 text-sm text-gray-600">
          แสดงผลลัพธ์ที่กรองแล้ว: {Object.entries(activeFilters).filter(([_, v]) => v).length} ตัวกรอง
        </div>
      )}
    </div>
  )
}

const DataTable = ({ data, loading, onValueClick }) => {
  const [viewMode, setViewMode] = useState('data'); // 'data' or 'summary'

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
        ไม่พบข้อมูล (No data found)
      </div>
    )
  }

  const renderCellValue = (value, column) => {
    // Non-dropdown columns that should be clickable for filtering
    const clickableColumns = ['location', 'temperature_c', 'humidity', 'light', 'DATE', 'files'];
    const isClickable = clickableColumns.includes(column);

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-gray-400 italic">ไม่มีข้อมูล</span>;
      }
      
      if (column === 'species') {
        // Species is dropdown-filterable, show as badges
        return (
          <div className="flex flex-wrap gap-1">
            {value.map((item, idx) => (
              <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                {item}
              </span>
            ))}
          </div>
        )
      } else if (isClickable) {
        // Files or other arrays - clickable for filtering
        return (
          <div className="text-xs space-y-1">
            {value.map((file, idx) => (
              <button
                key={idx}
                onClick={() => onValueClick(column, file)}
                className="block truncate max-w-xs text-left hover:bg-blue-50 hover:text-blue-700 px-1 py-0.5 rounded transition-colors"
                title={`คลิกเพื่อกรองตาม: ${file}`}
              >
                {file}
              </button>
            ))}
          </div>
        )
      }
    }

    if (column === 'location' && isClickable) {
      const coords = value.split(', ');
      return (
        <button
          onClick={() => onValueClick(column, value)}
          className="text-xs hover:bg-blue-50 hover:text-blue-700 p-1 rounded transition-colors"
          title={`คลิกเพื่อกรองตาม: ${value}`}
        >
          <div>Lat: {coords[0]}</div>
          <div>Lng: {coords[1]}</div>
        </button>
      )
    }

    if (typeof value === 'number' && isClickable) {
      return (
        <button
          onClick={() => onValueClick(column, value)}
          className="hover:bg-blue-50 hover:text-blue-700 px-2 py-1 rounded transition-colors"
          title={`คลิกเพื่อกรองตาม: ${value}`}
        >
          {value.toFixed(2)}
        </button>
      )
    }

    if (isClickable && typeof value === 'string') {
      return (
        <button
          onClick={() => onValueClick(column, value)}
          className="hover:bg-blue-50 hover:text-blue-700 px-2 py-1 rounded transition-colors"
          title={`คลิกเพื่อกรองตาม: ${value}`}
        >
          {value}
        </button>
      )
    }

    // For non-clickable values or dropdown columns
    if (typeof value === 'number') {
      return value.toFixed(2);
    }

    return value
  }

  const columns = Object.keys(data[0]);

  // Summary statistics
  const getSummaryStats = () => {
    const numericColumns = columns.filter(col => 
      data.some(row => typeof row[col] === 'number')
    );
    
    return numericColumns.map(col => {
      const values = data.map(row => row[col]).filter(val => typeof val === 'number');
      return {
        column: col,
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length
      };
    });
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Database className="h-5 w-5 text-gray-500" />
            <h3 className="font-medium text-gray-800">ข้อมูล (Data View)</h3>
            <div className="flex space-x-2">
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                {data.length} รายการ
              </span>
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Live</span>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setViewMode('data')}
              className={`px-3 py-1 text-xs rounded ${
                viewMode === 'data'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              ตารางข้อมูล
            </button>
            <button
              onClick={() => setViewMode('summary')}
              className={`px-3 py-1 text-xs rounded ${
                viewMode === 'summary'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              สรุปข้อมูล
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        {viewMode === 'data' ? (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {columns.map(column => (
                  <th key={column} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {column.replace('_', ' ')}
                    {['location', 'temperature_c', 'humidity', 'light', 'DATE', 'files'].includes(column) && (
                      <span className="ml-1 text-blue-400" title="คลิกข้อมูลในคอลัมน์นี้เพื่อกรอง">🔍</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.map((row, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  {columns.map(column => (
                    <td key={column} className="px-6 py-4 text-sm text-gray-900">
                      {renderCellValue(row[column], column)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-6">
            <h4 className="text-sm font-medium text-gray-800 mb-4">สถิติสรุปข้อมูล</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getSummaryStats().map((stat, idx) => (
                <div key={idx} className="p-4 bg-gray-50 rounded-lg">
                  <h5 className="font-medium text-sm text-gray-700 mb-2 capitalize">
                    {stat.column.replace('_', ' ')}
                  </h5>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div>จำนวน: {stat.count}</div>
                    <div>ต่ำสุด: {stat.min.toFixed(2)}</div>
                    <div>สูงสุด: {stat.max.toFixed(2)}</div>
                    <div>เฉลี่ย: {stat.avg.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Enhanced File Table Component
const FileTable = ({ files, loading }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mt-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow mt-6">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FileText className="h-5 w-5 text-gray-500" />
          <h3 className="font-medium text-gray-800">ไฟล์ (File Management)</h3>
          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
            {files.length} ไฟล์
          </span>
        </div>
        <button className="px-3 py-1 bg-green-100 text-green-800 text-xs rounded hover:bg-green-200">
          อัพโหลดไฟล์
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ชื่อไฟล์</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ขนาด</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ประเภท</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">แก้ไขล่าสุด</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">การจัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {files.map((file, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{file.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{file.size}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className={`px-2 py-1 text-xs rounded ${
                    file.type === 'CSV' ? 'bg-green-100 text-green-800' :
                    file.type === 'PDF' ? 'bg-red-100 text-red-800' :
                    file.type === 'JSON' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {file.type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{file.lastModified}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button className="text-purple-600 hover:text-purple-800 mr-3">
                    <Eye className="h-4 w-4" />
                  </button>
                  <button className="text-blue-600 hover:text-blue-800">
                    ดาวน์โหลด
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const Dashboard = ({ searchQuery }) => {
  const [data, setData] = useState([])
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [filesLoading, setFilesLoading] = useState(true)
  const [activeFilters, setActiveFilters] = useState({})
  const projectName = 'project-name'

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const result = await mockApi.fetchData(projectName)
        setData(result)
      } catch (error) {
        console.error('Error fetching data:', error)
      }
      setLoading(false)
    };

    const fetchFiles = async () => {
      setFilesLoading(true)
      try {
        const result = await mockApi.fetchFiles(projectName)
        setFiles(result)
      } catch (error) {
        console.error('Error fetching files:', error)
      }
      setFilesLoading(false)
    }

    fetchData()
    fetchFiles()
  }, [])

  // Enhanced dynamic filters - only for specific columns
  const filters = useMemo(() => {
    if (data.length === 0) return {}

    const result = {};
    // Define which columns should have dropdown filters
    const dropdownColumns = ['DEVICE', 'species'];
    const columns = Object.keys(data[0]);

    columns.forEach(column => {
      // Only create dropdowns for specified columns
      if (dropdownColumns.includes(column)) {
        const values = [];
        
        data.forEach(item => {
          const value = item[column];
          
          if (Array.isArray(value)) {
            // For array values like species, add individual items
            value.forEach(subValue => {
              if (!values.includes(subValue) && subValue !== '') {
                values.push(subValue);
              }
            });
          } else if (value !== null && value !== undefined && value !== '') {
            // For regular values
            if (!values.includes(value)) {
              values.push(value);
            }
          }
        });

        // Only create filter if there are multiple unique values
        if (values.length > 1) {
          result[column] = values.sort();
        }
      }
    });

    return result;
  }, [data])

  // Enhanced filtering and search
  const filteredData = useMemo(() => {
    let result = data;

    // Apply filters
    Object.entries(activeFilters).forEach(([key, value]) => {
      if (value) {
        result = result.filter(item => {
          const itemValue = item[key];
          
          if (Array.isArray(itemValue)) {
            return itemValue.includes(value);
          }
          
          return itemValue === value;
        });
      }
    });

    // Apply search
    if (searchQuery) {
      result = result.filter(item =>
        Object.values(item).some(value => {
          if (Array.isArray(value)) {
            return value.some(subValue => 
              subValue.toString().toLowerCase().includes(searchQuery.toLowerCase())
            );
          }
          return value.toString().toLowerCase().includes(searchQuery.toLowerCase());
        })
      );
    }

    return result;
  }, [data, activeFilters, searchQuery]);

  const handleFilterChange = (filterKey, value) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterKey]: value
    }))
  }

  const handleClearFilters = () => {
    setActiveFilters({});
  }

  return (
    <div className="space-y-6">
      <ApiInfo projectName={projectName} />

      {Object.keys(filters).length > 0 && (
        <FilterComponent
          filters={filters}
          activeFilters={activeFilters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
        />
      )}

      <DataTable data={filteredData} loading={loading} />
      <FileTable files={files} loading={filesLoading} />
    </div>
  )
}

export default Dashboard