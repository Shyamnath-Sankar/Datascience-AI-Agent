'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getAvailableCharts, generateChartData } from '@/lib/api';
import { ChartDisplay } from '@/components/data/ChartDisplay';
import { FileUpload } from '@/components/data/FileUpload';
import { FileManager } from '@/components/data/FileManager';

export default function DataVisualizationPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [uploadedData, setUploadedData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [availableCharts, setAvailableCharts] = useState<any>(null);
  const [chartData, setChartData] = useState<any>(null);
  const [selectedChart, setSelectedChart] = useState<string>('');
  const [chartConfig, setChartConfig] = useState({
    x_column: '',
    y_columns: [],
    group_by: '',
    aggregation: 'mean'
  });

  useEffect(() => {
    // Get session ID from localStorage
    const storedSessionId = typeof window !== 'undefined' ? localStorage.getItem('sessionId') : null;
    const storedActiveFileId = typeof window !== 'undefined' ? localStorage.getItem('activeFileId') : null;

    setSessionId(storedSessionId);
    setActiveFileId(storedActiveFileId);

    if (storedSessionId) {
      fetchAvailableCharts(storedSessionId);
    } else {
      setLoading(false);
    }
  }, []);

  // Handle file upload success
  const handleUploadSuccess = (data: any) => {
    setUploadedData(data);
    setSessionId(data.session_id);
    setActiveFileId(data.files[0]?.file_id || null);
    setError(null);

    // Store in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('sessionId', data.session_id);
      if (data.files[0]?.file_id) {
        localStorage.setItem('activeFileId', data.files[0].file_id);
      }
    }

    // Fetch available charts for the new data
    fetchAvailableCharts(data.session_id);
  };

  // Handle file selection
  const handleFileSelect = (fileId: string) => {
    setActiveFileId(fileId);
    setChartData(null); // Reset chart data when switching files
    setError(null);

    // Store in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeFileId', fileId);
    }

    // Fetch available charts for the selected file
    if (sessionId) {
      fetchAvailableCharts(sessionId);
    }
  };

  const fetchAvailableCharts = async (sid: string) => {
    try {
      setLoading(true);
      const data = await getAvailableCharts(sid);
      setAvailableCharts(data);

      // Set default chart type if available
      if (data.available_charts && data.available_charts.length > 0) {
        setSelectedChart(data.available_charts[0]);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load available charts');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateChart = async () => {
    if (!sessionId || !selectedChart) {
      setError('Please select a chart type first.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const chartParams = {
        chart_type: selectedChart,
        ...chartConfig
      };

      const data = await generateChartData(sessionId, chartParams);
      setChartData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate chart data');
    } finally {
      setLoading(false);
    }
  };

  const handleChartTypeChange = (chartType: string) => {
    setSelectedChart(chartType);
    setChartData(null); // Reset chart data when changing chart type
  };

  const handleConfigChange = (field: string, value: any) => {
    setChartConfig({
      ...chartConfig,
      [field]: value
    });
    setChartData(null); // Reset chart data when changing configuration
  };

  if (loading && !availableCharts) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--excel-green)]"></div>
          <p className="mt-4 text-[var(--excel-text-muted)]">Loading visualization options...</p>
        </div>
      </div>
    );
  }

  if (!sessionId && !loading) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg shadow-md p-6 mb-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl font-bold text-white">Data Visualization</h1>
            <p className="mt-2 text-lg text-blue-100">
              Upload your data to create interactive charts and visualizations
            </p>
          </div>
        </div>

        <Card title="Upload Your Data">
          <FileUpload onUploadSuccess={handleUploadSuccess} />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg shadow-md p-6 mb-8">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-white">Data Visualization</h1>
          <p className="mt-2 text-lg text-blue-100">
            Create interactive charts and visualizations to gain insights from your data
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm text-white flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Bar Charts
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm text-white flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              Line Charts
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm text-white flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
              Pie Charts
            </div>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-md shadow-sm">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* File Upload Section */}
      {sessionId && (
        <Card title="Upload Additional Files">
          <FileUpload onUploadSuccess={handleUploadSuccess} sessionId={sessionId} />
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* File Manager Sidebar */}
        <div className="lg:col-span-1">
          <Card title="File Manager">
            {sessionId && (
              <FileManager
                sessionId={sessionId}
                onFileSelect={handleFileSelect}
                activeFileId={activeFileId}
              />
            )}
          </Card>
        </div>

        {/* Chart Configuration Panel */}
        <div className="lg:col-span-1">
          <Card title="Chart Configuration">
            <div className="space-y-5">
              {/* Chart Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Chart Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {availableCharts?.available_charts?.map((chartType: string) => (
                    <button
                      key={chartType}
                      onClick={() => handleChartTypeChange(chartType)}
                      className={`py-2 px-3 text-sm rounded-md transition-all duration-200 flex items-center justify-center ${
                        selectedChart === chartType
                          ? 'bg-blue-100 text-blue-700 border border-blue-300 shadow-sm'
                          : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                      }`}
                    >
                      {chartType === 'bar' && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      )}
                      {chartType === 'line' && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                        </svg>
                      )}
                      {chartType === 'pie' && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                        </svg>
                      )}
                      {chartType === 'scatter' && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 11V9a2 2 0 00-2-2m2 4v4a2 2 0 104 0v-1m-4-3H9m2 0h4m6 1a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      {chartType.charAt(0).toUpperCase() + chartType.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Data Configuration</h3>

                {/* X-Axis Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <span className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      X-Axis
                    </span>
                  </label>
                  <select
                    className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-white"
                    value={chartConfig.x_column}
                    onChange={(e) => handleConfigChange('x_column', e.target.value)}
                  >
                    <option value="">Select a column</option>
                    <optgroup label="Categorical Columns">
                      {availableCharts?.categorical_columns?.map((column: string) => (
                        <option key={`cat-${column}`} value={column}>{column}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Numeric Columns">
                      {availableCharts?.numeric_columns?.map((column: string) => (
                        <option key={`num-${column}`} value={column}>{column}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Y-Axis Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <span className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                      Y-Axis
                    </span>
                  </label>
                  <select
                    className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-white"
                    value={chartConfig.y_columns[0] || ''}
                    onChange={(e) => handleConfigChange('y_columns', [e.target.value])}
                  >
                    <option value="">Select a column</option>
                    {availableCharts?.numeric_columns?.map((column: string) => (
                      <option key={column} value={column}>{column}</option>
                    ))}
                  </select>
                </div>

                {/* Group By Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <span className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                      Group By (Optional)
                    </span>
                  </label>
                  <select
                    className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-white"
                    value={chartConfig.group_by}
                    onChange={(e) => handleConfigChange('group_by', e.target.value)}
                  >
                    <option value="">None</option>
                    {availableCharts?.categorical_columns?.map((column: string) => (
                      <option key={column} value={column}>{column}</option>
                    ))}
                  </select>
                </div>

                {/* Aggregation Method */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <span className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      Aggregation Method
                    </span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['mean', 'sum', 'count'].map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => handleConfigChange('aggregation', method)}
                        className={`py-1 px-2 text-xs rounded-md transition-all duration-200 ${
                          chartConfig.aggregation === method
                            ? 'bg-blue-100 text-blue-700 border border-blue-300'
                            : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {method.charAt(0).toUpperCase() + method.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={handleGenerateChart}
                  disabled={loading || !chartConfig.x_column || !chartConfig.y_columns.length}
                  className="w-full py-2.5 flex items-center justify-center"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Generate Chart
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Chart Display Area */}
        <div className="lg:col-span-2">
          <Card title={chartData ? `${selectedChart.charAt(0).toUpperCase() + selectedChart.slice(1)} Chart` : 'Chart Preview'}>
            <div className="mb-3">
              {chartData && (
                <div className="bg-blue-50 p-3 rounded-md mb-4">
                  <p className="text-sm text-blue-700">
                    <span className="font-medium">Configuration:</span> X: {chartConfig.x_column},
                    Y: {chartConfig.y_columns.join(', ')}
                    {chartConfig.group_by && `, Grouped by: ${chartConfig.group_by}`}
                  </p>
                </div>
              )}

              <ChartDisplay
                chartType={selectedChart}
                chartData={chartData}
                chartConfig={chartConfig}
              />
            </div>

            {chartData && (
              <div className="mt-4 flex justify-end space-x-2">
                <Button variant="outline">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Chart
                </Button>
                <Button variant="outline">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export Data
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
