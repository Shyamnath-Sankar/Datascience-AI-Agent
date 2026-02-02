'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getAvailableCharts, generateChartData, chatWithAgent } from '@/lib/api';
import { ChartDisplay } from '@/components/data/ChartDisplay';
import { FileUpload } from '@/components/data/FileUpload';
import { FileManager } from '@/components/data/FileManager';

// Chart type icons and metadata
const CHART_TYPES = {
  bar: {
    name: 'Bar Chart',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    description: 'Compare values across categories',
  },
  line: {
    name: 'Line Chart',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      </svg>
    ),
    description: 'Show trends over time',
  },
  pie: {
    name: 'Pie Chart',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
      </svg>
    ),
    description: 'Show proportions of a whole',
  },
  scatter: {
    name: 'Scatter Plot',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <circle cx="6" cy="18" r="2" fill="currentColor" />
        <circle cx="10" cy="10" r="2" fill="currentColor" />
        <circle cx="14" cy="14" r="2" fill="currentColor" />
        <circle cx="18" cy="6" r="2" fill="currentColor" />
      </svg>
    ),
    description: 'Show correlation between variables',
  },
  histogram: {
    name: 'Histogram',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18M4 21V10h3v11M9 21V7h3v14M14 21V4h3v17M19 21v-7h2v7" />
      </svg>
    ),
    description: 'Show distribution of values',
  },
  heatmap: {
    name: 'Heatmap',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
      </svg>
    ),
    description: 'Show correlation matrix',
  },
};

const AGGREGATIONS = [
  { value: 'mean', label: 'Average', description: 'Mean of values' },
  { value: 'sum', label: 'Sum', description: 'Total of values' },
  { value: 'count', label: 'Count', description: 'Number of items' },
  { value: 'min', label: 'Min', description: 'Minimum value' },
  { value: 'max', label: 'Max', description: 'Maximum value' },
  { value: 'median', label: 'Median', description: 'Middle value' },
];

export default function DataVisualizationPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [availableCharts, setAvailableCharts] = useState<any>(null);
  const [chartData, setChartData] = useState<any>(null);
  const [selectedChart, setSelectedChart] = useState<string>('bar');
  const [chartHistory, setChartHistory] = useState<any[]>([]);
  const [showUpload, setShowUpload] = useState<boolean>(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState<boolean>(false);
  const [chartConfig, setChartConfig] = useState({
    x_column: '',
    y_columns: [] as string[],
    group_by: '',
    aggregation: 'mean',
    title: '',
    showLegend: true,
    showGrid: true,
  });
  
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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

  const handleUploadSuccess = (data: any) => {
    setSessionId(data.session_id);
    setActiveFileId(data.files[0]?.file_id || null);
    setError(null);
    setShowUpload(false);

    if (typeof window !== 'undefined') {
      localStorage.setItem('sessionId', data.session_id);
      if (data.files[0]?.file_id) {
        localStorage.setItem('activeFileId', data.files[0].file_id);
      }
    }

    fetchAvailableCharts(data.session_id);
  };

  const handleFileSelect = (fileId: string) => {
    setActiveFileId(fileId);
    setChartData(null);
    setError(null);

    if (typeof window !== 'undefined') {
      localStorage.setItem('activeFileId', fileId);
    }

    if (sessionId) {
      fetchAvailableCharts(sessionId);
    }
  };

  const fetchAvailableCharts = async (sid: string) => {
    try {
      setLoading(true);
      const data = await getAvailableCharts(sid);
      setAvailableCharts(data);

      if (data.available_charts && data.available_charts.length > 0) {
        setSelectedChart(data.available_charts[0]);
      }

      // Auto-select first columns if available
      if (data.categorical_columns?.length > 0 && !chartConfig.x_column) {
        setChartConfig(prev => ({
          ...prev,
          x_column: data.categorical_columns[0],
        }));
      }
      if (data.numeric_columns?.length > 0 && chartConfig.y_columns.length === 0) {
        setChartConfig(prev => ({
          ...prev,
          y_columns: [data.numeric_columns[0]],
        }));
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
      setGenerating(true);
      setError(null);

      const chartParams = {
        chart_type: selectedChart,
        ...chartConfig
      };

      const data = await generateChartData(sessionId, chartParams);
      setChartData(data);
      
      // Add to history
      setChartHistory(prev => [
        {
          id: Date.now(),
          type: selectedChart,
          config: { ...chartConfig },
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 9), // Keep last 10
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate chart data');
    } finally {
      setGenerating(false);
    }
  };

  const handleChartTypeChange = (chartType: string) => {
    setSelectedChart(chartType);
    setChartData(null);
  };

  const handleConfigChange = (field: string, value: any) => {
    setChartConfig(prev => ({
      ...prev,
      [field]: value
    }));
    setChartData(null);
  };

  const handleMultiYColumnSelect = (column: string) => {
    setChartConfig(prev => {
      const exists = prev.y_columns.includes(column);
      return {
        ...prev,
        y_columns: exists
          ? prev.y_columns.filter(c => c !== column)
          : [...prev.y_columns, column],
      };
    });
    setChartData(null);
  };

  const getAISuggestion = async () => {
    if (!sessionId) return;
    
    try {
      setLoadingAI(true);
      const response = await chatWithAgent(
        sessionId,
        "Based on the current data, what's the best visualization to show insights? Suggest a specific chart type and which columns to use. Be concise.",
        activeFileId || undefined,
        false
      );
      
      if (response.response) {
        setAiSuggestion(response.response);
      }
    } catch (err) {
      console.error('AI suggestion error:', err);
    } finally {
      setLoadingAI(false);
    }
  };

  const downloadChart = useCallback(() => {
    if (!chartRef.current) return;
    
    const canvas = chartRef.current.querySelector('canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = `chart-${selectedChart}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  }, [selectedChart]);

  const restoreFromHistory = (historyItem: any) => {
    setSelectedChart(historyItem.type);
    setChartConfig(historyItem.config);
    handleGenerateChart();
  };

  // Loading state
  if (loading && !availableCharts) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-[var(--border-color)] rounded-full"></div>
            <div className="w-16 h-16 border-4 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
          <p className="mt-6 text-[var(--text-secondary)] font-medium">Loading visualization studio...</p>
        </div>
      </div>
    );
  }

  // No session - show upload
  if (!sessionId && !loading) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12 pt-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--accent-primary)] to-blue-600 mb-6 shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-4">
              Visualization Studio
            </h1>
            <p className="text-xl text-[var(--text-secondary)] max-w-2xl mx-auto">
              Transform your data into stunning, interactive visualizations. Upload your dataset to get started.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[
              { icon: '📊', title: 'Multiple Chart Types', desc: 'Bar, line, pie, scatter, and more' },
              { icon: '🎨', title: 'Customizable', desc: 'Full control over colors and styles' },
              { icon: '🤖', title: 'AI-Powered', desc: 'Smart chart recommendations' },
            ].map((feature, i) => (
              <div key={i} className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] text-center">
                <div className="text-3xl mb-2">{feature.icon}</div>
                <h3 className="font-semibold text-[var(--text-primary)]">{feature.title}</h3>
                <p className="text-sm text-[var(--text-secondary)]">{feature.desc}</p>
              </div>
            ))}
          </div>

          {/* Upload Card */}
          <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-color)] p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4 text-center">
              Upload Your Data
            </h2>
            <FileUpload onUploadSuccess={handleUploadSuccess} />
          </div>
        </div>
      </div>
    );
  }

  // Main visualization interface
  return (
    <div className="min-h-screen p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Visualization Studio</h1>
            <p className="text-[var(--text-secondary)]">Create interactive charts from your data</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowUpload(!showUpload)}
              className="flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload Data
            </Button>
            <Button
              variant="outline"
              onClick={getAISuggestion}
              disabled={loadingAI}
              className="flex items-center gap-2"
            >
              {loadingAI ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              )}
              AI Suggest
            </Button>
          </div>
        </div>

        {/* AI Suggestion Banner */}
        {aiSuggestion && (
          <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[var(--accent-primary)] flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--text-primary)]">AI Recommendation</p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">{aiSuggestion}</p>
              </div>
              <button
                onClick={() => setAiSuggestion(null)}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Upload Panel */}
        {showUpload && (
          <div className="mt-4 p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)]">
            <FileUpload onUploadSuccess={handleUploadSuccess} sessionId={sessionId || undefined} />
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-4 rounded-xl bg-[var(--error-bg)] border border-[var(--error)] flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--error)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium text-[var(--error)]">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-[var(--error)] hover:opacity-70">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar - File Manager & History */}
        <div className="lg:col-span-2 space-y-4">
          {/* File Manager */}
          <div className="bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-color)]">
              <h3 className="font-semibold text-[var(--text-primary)] text-sm">Files</h3>
            </div>
            <div className="p-2">
              {sessionId && (
                <FileManager
                  sessionId={sessionId}
                  onFileSelect={handleFileSelect}
                  activeFileId={activeFileId}
                />
              )}
            </div>
          </div>

          {/* Chart History */}
          {chartHistory.length > 0 && (
            <div className="bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border-color)]">
                <h3 className="font-semibold text-[var(--text-primary)] text-sm">Recent Charts</h3>
              </div>
              <div className="p-2 max-h-48 overflow-y-auto">
                {chartHistory.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => restoreFromHistory(item)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors flex items-center gap-2"
                  >
                    <span className="text-xs">
                      {CHART_TYPES[item.type as keyof typeof CHART_TYPES]?.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                        {CHART_TYPES[item.type as keyof typeof CHART_TYPES]?.name}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">{item.timestamp}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Chart Configuration Panel */}
        <div className="lg:col-span-3">
          <div className="bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] overflow-hidden sticky top-4">
            <div className="px-4 py-3 border-b border-[var(--border-color)]">
              <h3 className="font-semibold text-[var(--text-primary)]">Chart Configuration</h3>
            </div>
            
            <div className="p-4 space-y-5 max-h-[calc(100vh-200px)] overflow-y-auto">
              {/* Chart Type Selection */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-3">Chart Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {availableCharts?.available_charts?.map((chartType: string) => {
                    const chartInfo = CHART_TYPES[chartType as keyof typeof CHART_TYPES];
                    return (
                      <button
                        key={chartType}
                        onClick={() => handleChartTypeChange(chartType)}
                        className={`p-3 rounded-lg border transition-all duration-200 flex flex-col items-center gap-1 ${
                          selectedChart === chartType
                            ? 'bg-[var(--accent-subtle)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
                            : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                      >
                        {chartInfo?.icon || (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2z" />
                          </svg>
                        )}
                        <span className="text-xs font-medium">{chartInfo?.name || chartType}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-[var(--border-color)]"></div>

              {/* X-Axis */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  X-Axis (Categories)
                </label>
                <select
                  className="w-full px-3 py-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent"
                  value={chartConfig.x_column}
                  onChange={(e) => handleConfigChange('x_column', e.target.value)}
                >
                  <option value="">Select column...</option>
                  {availableCharts?.categorical_columns?.length > 0 && (
                    <optgroup label="Categorical">
                      {availableCharts.categorical_columns.map((col: string) => (
                        <option key={`cat-${col}`} value={col}>{col}</option>
                      ))}
                    </optgroup>
                  )}
                  {availableCharts?.numeric_columns?.length > 0 && (
                    <optgroup label="Numeric">
                      {availableCharts.numeric_columns.map((col: string) => (
                        <option key={`num-${col}`} value={col}>{col}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Y-Axis */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Y-Axis (Values)
                </label>
                <div className="space-y-1 max-h-32 overflow-y-auto p-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)]">
                  {availableCharts?.numeric_columns?.map((col: string) => (
                    <label
                      key={col}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-[var(--bg-tertiary)] ${
                        chartConfig.y_columns.includes(col) ? 'bg-[var(--accent-subtle)]' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={chartConfig.y_columns.includes(col)}
                        onChange={() => handleMultiYColumnSelect(col)}
                        className="w-4 h-4 rounded border-[var(--border-color)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
                      />
                      <span className="text-sm text-[var(--text-primary)]">{col}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Group By */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Group By (Optional)
                </label>
                <select
                  className="w-full px-3 py-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent"
                  value={chartConfig.group_by}
                  onChange={(e) => handleConfigChange('group_by', e.target.value)}
                >
                  <option value="">None</option>
                  {availableCharts?.categorical_columns?.map((col: string) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              {/* Aggregation */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Aggregation
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {AGGREGATIONS.map((agg) => (
                    <button
                      key={agg.value}
                      onClick={() => handleConfigChange('aggregation', agg.value)}
                      className={`px-2 py-1.5 text-xs rounded-md transition-colors ${
                        chartConfig.aggregation === agg.value
                          ? 'bg-[var(--accent-primary)] text-white'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                      }`}
                      title={agg.description}
                    >
                      {agg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart Options */}
              <div className="border-t border-[var(--border-color)] pt-4">
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-3">
                  Display Options
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={chartConfig.showLegend}
                      onChange={(e) => handleConfigChange('showLegend', e.target.checked)}
                      className="w-4 h-4 rounded border-[var(--border-color)] text-[var(--accent-primary)]"
                    />
                    <span className="text-sm text-[var(--text-secondary)]">Show Legend</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={chartConfig.showGrid}
                      onChange={(e) => handleConfigChange('showGrid', e.target.checked)}
                      className="w-4 h-4 rounded border-[var(--border-color)] text-[var(--accent-primary)]"
                    />
                    <span className="text-sm text-[var(--text-secondary)]">Show Grid Lines</span>
                  </label>
                </div>
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerateChart}
                disabled={generating || !chartConfig.x_column || chartConfig.y_columns.length === 0}
                className="w-full py-3 flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Generate Chart
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Chart Display Area */}
        <div className="lg:col-span-7">
          <div className="bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
            {/* Chart Header */}
            <div className="px-4 py-3 border-b border-[var(--border-color)] flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-[var(--text-primary)]">
                  {chartData 
                    ? `${CHART_TYPES[selectedChart as keyof typeof CHART_TYPES]?.name || selectedChart} Visualization`
                    : 'Chart Preview'
                  }
                </h3>
                {chartData && (
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                    X: {chartConfig.x_column} | Y: {chartConfig.y_columns.join(', ')}
                    {chartConfig.group_by && ` | Grouped by: ${chartConfig.group_by}`}
                  </p>
                )}
              </div>
              {chartData && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={downloadChart}
                    className="flex items-center gap-1.5 text-sm py-1.5"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </Button>
                </div>
              )}
            </div>

            {/* Chart Content */}
            <div ref={chartRef} className="p-6">
              <div className="min-h-[400px] lg:min-h-[500px]">
                <ChartDisplay
                  chartType={selectedChart}
                  chartData={chartData}
                  chartConfig={chartConfig}
                />
              </div>
            </div>

            {/* Chart Footer with Data Summary */}
            {chartData && (
              <div className="px-4 py-3 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
                <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                  <span>Aggregation: {chartConfig.aggregation.toUpperCase()}</span>
                  <span>Chart type: {selectedChart}</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          {availableCharts && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)] p-3">
                <p className="text-xs text-[var(--text-tertiary)]">Numeric Columns</p>
                <p className="text-xl font-semibold text-[var(--text-primary)]">
                  {availableCharts.numeric_columns?.length || 0}
                </p>
              </div>
              <div className="bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)] p-3">
                <p className="text-xs text-[var(--text-tertiary)]">Categorical Columns</p>
                <p className="text-xl font-semibold text-[var(--text-primary)]">
                  {availableCharts.categorical_columns?.length || 0}
                </p>
              </div>
              <div className="bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)] p-3">
                <p className="text-xs text-[var(--text-tertiary)]">Available Charts</p>
                <p className="text-xl font-semibold text-[var(--text-primary)]">
                  {availableCharts.available_charts?.length || 0}
                </p>
              </div>
              <div className="bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)] p-3">
                <p className="text-xs text-[var(--text-tertiary)]">Charts Created</p>
                <p className="text-xl font-semibold text-[var(--text-primary)]">
                  {chartHistory.length}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
