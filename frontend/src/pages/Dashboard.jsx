import React, { useState, useEffect, useMemo } from 'react'
import { Database, FileText, Filter, Eye, Copy, Check } from 'lucide-react'

// API functions
const api = {
  async fetchData(apiUrl) {
    try {
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching data:', error);
      throw error;
    }
  },

  async fetchFiles(projectName) {
    try {
      const response = await fetch(`http://localhost:8080/api/getfiles/${projectName}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching files:', error);
      return [];
    }
  }
}

const ApiInfo = ({ apiUrl }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(apiUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-purple-50 p-4 rounded-lg mb-6">
      <h2 className="text-sm font-medium text-purple-800 mb-2">DATA API</h2>
      <div className="flex items-center space-x-2">
        <span className="font-medium text-sm text-gray-600">API:</span>
        <div className="flex-1 bg-white px-3 py-2 rounded border text-xs font-mono break-all">
          {apiUrl}
        </div>
        <button
          onClick={handleCopy}
          className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors flex items-center space-x-1 flex-shrink-0"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          <span className="text-xs">{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
        </button>
      </div>
    </div>
  )
}

const FilterComponent = ({ filters, activeFilters, onFilterChange, onClearFilters, onValueClick }) => {
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
  const [viewMode, setViewMode] = useState('data');

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
    const clickableColumns = ['location', 'temperature_c', 'humidity', 'light', 'DATE', 'files'];
    const isClickable = clickableColumns.includes(column);

    if (value === null || value === undefined) {
      return <span className="text-gray-400 italic">ไม่มีข้อมูล</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-gray-400 italic">ไม่มีข้อมูล</span>;
      }
      
      if (column === 'species') {
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

    if (column === 'location' && isClickable && typeof value === 'string') {
      const coords = value.split(', ');
      return (
        <button
          onClick={() => onValueClick(column, value)}
          className="text-xs hover:bg-blue-50 hover:text-blue-700 p-1 rounded transition-colors"
          title={`คลิกเพื่อกรองตาม: ${value}`}
        >
          <div>Lat: {coords[0]}</div>
          <div>Lng: {coords[1] || '-'}</div>
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

    if (typeof value === 'number') {
      return value.toFixed(2);
    }

    return String(value);
  }

  const columns = Object.keys(data[0]);

  const getSummaryStats = () => {
    const numericColumns = columns.filter(col => 
      data.some(row => typeof row[col] === 'number')
    );
    
    return numericColumns.map(col => {
      const values = data.map(row => row[col]).filter(val => typeof val === 'number');
      if (values.length === 0) return null;
      
      return {
        column: col,
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length
      };
    }).filter(stat => stat !== null);
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
                    {column.replace(/_/g, ' ')}
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
                    {stat.column.replace(/_/g, ' ')}
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

  if (files.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow mt-6 p-6 text-center text-gray-500">
        ไม่พบไฟล์ (No files found)
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

const Dashboard = () => {
  const [data, setData] = useState([])
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [filesLoading, setFilesLoading] = useState(true)
  const [activeFilters, setActiveFilters] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState(null)
  
  const apiUrl = 'https://wy0vrlpu67.execute-api.us-east-1.amazonaws.com/data?mode=latest'
  const projectName = 'project-name'

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.fetchData(apiUrl)
      console.log('Fetched data:', result)
      
      let dataArray = []
      if (Array.isArray(result)) {
        dataArray = result
      } else if (result && typeof result === 'object') {
        if (result.data && Array.isArray(result.data)) {
          dataArray = result.data
        } else if (result.items && Array.isArray(result.items)) {
          dataArray = result.items
        } else if (result.body) {
          try {
            const parsed = typeof result.body === 'string' ? JSON.parse(result.body) : result.body
            dataArray = Array.isArray(parsed) ? parsed : []
          } catch (e) {
            console.error('Error parsing body:', e)
          }
        }
      }
      
      setData(dataArray)
    } catch (error) {
      console.error('Error fetching data:', error)
      setError(`ไม่สามารถดึงข้อมูลได้: ${error.message}`)
      setData([])
    }
    setLoading(false)
  }

  useEffect(() => {
    const fetchFiles = async () => {
      setFilesLoading(true)
      try {
        const result = await api.fetchFiles(projectName)
        if (Array.isArray(result)) {
          setFiles(result)
        } else {
          setFiles([])
        }
      } catch (error) {
        console.error('Error fetching files:', error)
        setFiles([])
      }
      setFilesLoading(false)
    }

    fetchData()
    fetchFiles()
  }, [apiUrl])

  const filters = useMemo(() => {
    if (data.length === 0) return {}

    const result = {}
    const dropdownColumns = ['DEVICE', 'species']
    const columns = Object.keys(data[0])

    columns.forEach(column => {
      if (dropdownColumns.includes(column)) {
        const values = []
        
        data.forEach(item => {
          const value = item[column]
          
          if (Array.isArray(value)) {
            value.forEach(subValue => {
              if (subValue !== null && subValue !== undefined && subValue !== '' && !values.includes(subValue)) {
                values.push(subValue)
              }
            })
          } else if (value !== null && value !== undefined && value !== '' && !values.includes(value)) {
            values.push(value)
          }
        })

        if (values.length > 1) {
          result[column] = values.sort()
        }
      }
    })

    return result
  }, [data])

  const filteredData = useMemo(() => {
    let result = data

    Object.entries(activeFilters).forEach(([key, value]) => {
      if (value) {
        result = result.filter(item => {
          const itemValue = item[key]
          
          if (Array.isArray(itemValue)) {
            return itemValue.includes(value)
          }
          
          return itemValue === value
        })
      }
    })

    if (searchQuery) {
      result = result.filter(item =>
        Object.values(item).some(value => {
          if (value === null || value === undefined) return false
          
          if (Array.isArray(value)) {
            return value.some(subValue => 
              String(subValue).toLowerCase().includes(searchQuery.toLowerCase())
            )
          }
          return String(value).toLowerCase().includes(searchQuery.toLowerCase())
        })
      )
    }

    return result
  }, [data, activeFilters, searchQuery])

  const handleFilterChange = (filterKey, value) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterKey]: value
    }))
  }

  const handleClearFilters = () => {
    setActiveFilters({})
  }

  const handleValueClick = (column, value) => {
    setActiveFilters(prev => ({
      ...prev,
      [column]: value
    }))
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p className="font-medium">เกิดข้อผิดพลาด</p>
          <p className="text-sm mt-1">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            ลองใหม่อีกครั้ง
          </button>
        </div>
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="font-medium text-blue-800 mb-2">ข้อมูลการดีบัก:</p>
          <p className="text-sm text-blue-700">เปิด Console (F12) เพื่อดูข้อมูลเพิ่มเติม</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Dashboard</h1>
          <p className="text-sm text-gray-600">ระบบจัดการข้อมูลและไฟล์</p>
        </div>

        <ApiInfo apiUrl={apiUrl} />

        {Object.keys(filters).length > 0 && (
          <FilterComponent
            filters={filters}
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
            onValueClick={handleValueClick}
          />
        )}

        <DataTable data={filteredData} loading={loading} onValueClick={handleValueClick} />
        <FileTable files={files} loading={filesLoading} />
      </div>
    </div>
  )
}

export default Dashboard