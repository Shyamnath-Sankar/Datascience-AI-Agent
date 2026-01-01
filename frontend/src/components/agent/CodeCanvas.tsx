'use client';

import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';

interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  plots: string[];
  variables: Record<string, VariableInfo>;
  installations?: Array<{
    package: string;
    success: boolean;
    message: string;
  }>;
}

interface VariableInfo {
  type: string;
  shape?: number[];
  columns?: string[];
  length?: number;
  value?: string;
  memory?: string;
  dtype?: string;
  name?: string;
}

interface CodeCanvasProps {
  code: string;
  onCodeChange: (code: string) => void;
  onExecute: (code: string) => void;
  executionResult?: ExecutionResult;
  loading?: boolean;
}

export function CodeCanvas({
  code,
  onCodeChange,
  onExecute,
  executionResult,
  loading = false
}: CodeCanvasProps) {
  const [activeTab, setActiveTab] = useState<'plots' | 'output' | 'variables' | 'code'>('plots');
  const [selectedPlotIndex, setSelectedPlotIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  // Auto-switch to appropriate tab when execution completes
  useEffect(() => {
    if (executionResult) {
      if (executionResult.plots.length > 0) {
        setActiveTab('plots');
        setSelectedPlotIndex(0);
      } else if (executionResult.output || executionResult.error) {
        setActiveTab('output');
      }
    }
  }, [executionResult]);

  const handleExecute = () => {
    onExecute(code);
    setActiveTab('output');
  };

  const tabs = [
    {
      id: 'plots' as const,
      label: 'Charts',
      count: executionResult?.plots.length || 0,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
      )
    },
    {
      id: 'output' as const,
      label: 'Results',
      count: null,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      id: 'variables' as const,
      label: 'Data',
      count: executionResult ? Object.keys(executionResult.variables).length : 0,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
        </svg>
      )
    },
    {
      id: 'code' as const,
      label: 'Code',
      count: null,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      )
    }
  ];

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br from-green-400 to-emerald-500 text-white">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </span>
          Analysis Results
        </h3>
        <div className="flex items-center gap-2">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </div>
          )}
          {!loading && executionResult && (
            <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${executionResult.success
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
              }`}>
              {executionResult.success ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {executionResult.success ? 'Success' : 'Error'}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-gray-50/50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${activeTab === tab.id
                ? 'border-blue-500 text-blue-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== null && tab.count > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${activeTab === tab.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-600'
                }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'code' && (
          <div className="h-full flex flex-col">
            <div className="flex-1">
              <Editor
                height="100%"
                defaultLanguage="python"
                value={code}
                onChange={(value) => onCodeChange(value || '')}
                theme="vs-light"
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  wordWrap: 'on',
                  tabSize: 4,
                  insertSpaces: true,
                  padding: { top: 10 },
                }}
              />
            </div>
            <div className="p-2 border-t border-gray-200 bg-gray-50">
              <button
                onClick={handleExecute}
                disabled={loading || !code.trim()}
                className="w-full px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-medium rounded-lg hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Run Code
              </button>
            </div>
          </div>
        )}

        {activeTab === 'output' && (
          <div className="h-full overflow-auto p-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                <svg className="w-8 h-8 animate-spin text-blue-500 mb-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm">Executing code...</span>
              </div>
            ) : executionResult ? (
              <div className="space-y-4">
                {/* Package installations */}
                {executionResult.installations && executionResult.installations.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-blue-800 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Package Installations
                    </h4>
                    {executionResult.installations.map((install, index) => (
                      <div key={index} className={`text-xs flex items-center gap-1 ${install.success ? 'text-green-700' : 'text-red-700'}`}>
                        {install.success ? '✓' : '✗'} {install.package}: {install.message}
                      </div>
                    ))}
                  </div>
                )}

                {/* Success/Error status */}
                <div className={`px-4 py-3 rounded-lg flex items-center gap-2 ${executionResult.success
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                  }`}>
                  {executionResult.success ? (
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <span className="font-medium">
                    {executionResult.success ? 'Execution completed successfully' : 'Execution encountered an error'}
                  </span>
                </div>

                {/* Output */}
                {executionResult.output && (
                  <div className="bg-gray-900 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-400">Output</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(executionResult.output)}
                        className="text-xs text-gray-500 hover:text-gray-300"
                      >
                        Copy
                      </button>
                    </div>
                    <pre className="p-3 text-xs font-mono text-gray-100 whitespace-pre-wrap overflow-x-auto max-h-64">
                      {executionResult.output}
                    </pre>
                  </div>
                )}

                {/* Error */}
                {executionResult.error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-red-100 border-b border-red-200">
                      <span className="text-sm font-medium text-red-700">Error Details</span>
                    </div>
                    <pre className="p-3 text-xs font-mono text-red-800 whitespace-pre-wrap overflow-x-auto">
                      {executionResult.error}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm">No results yet</span>
                <span className="text-xs text-gray-400">Ask a question to see analysis results</span>
              </div>
            )}
          </div>
        )}

        {activeTab === 'plots' && (
          <div className="h-full overflow-auto p-4">
            {executionResult?.plots && executionResult.plots.length > 0 ? (
              <div className="space-y-4">
                {/* Plot navigation for multiple plots */}
                {executionResult.plots.length > 1 && (
                  <div className="flex items-center justify-center gap-2">
                    {executionResult.plots.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedPlotIndex(index)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${selectedPlotIndex === index
                            ? 'bg-blue-500 text-white shadow'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                      >
                        {index + 1}
                      </button>
                    ))}
                  </div>
                )}

                {/* Main plot display */}
                <div
                  className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white cursor-pointer"
                  onClick={() => setIsZoomed(!isZoomed)}
                >
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Chart {selectedPlotIndex + 1} of {executionResult.plots.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const link = document.createElement('a');
                          link.href = executionResult.plots[selectedPlotIndex];
                          link.download = `chart-${selectedPlotIndex + 1}.png`;
                          link.click();
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsZoomed(!isZoomed);
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                        {isZoomed ? 'Zoom Out' : 'Zoom In'}
                      </button>
                    </div>
                  </div>
                  <div className={`p-4 flex items-center justify-center bg-white ${isZoomed ? 'fixed inset-0 z-50 p-8' : ''}`}>
                    {isZoomed && (
                      <button
                        onClick={() => setIsZoomed(false)}
                        className="absolute top-4 right-4 p-2 bg-gray-800 text-white rounded-full hover:bg-gray-700"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    <img
                      src={executionResult.plots[selectedPlotIndex]}
                      alt={`Chart ${selectedPlotIndex + 1}`}
                      className={`${isZoomed ? 'max-h-full max-w-full object-contain' : 'max-w-full h-auto'}`}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                <svg className="w-16 h-16 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
                <span className="text-sm font-medium text-gray-500">No charts generated</span>
                <span className="text-xs text-gray-400 mt-1">Ask for a visualization to see charts here</span>
              </div>
            )}
          </div>
        )}

        {activeTab === 'variables' && (
          <div className="h-full overflow-auto p-4">
            {executionResult?.variables && Object.keys(executionResult.variables).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(executionResult.variables).map(([name, info]) => (
                  <div key={name} className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:border-blue-200 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-800 font-mono">{name}</span>
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{info.type}</span>
                    </div>
                    <div className="space-y-1 text-xs text-gray-600">
                      {info.shape && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">Dimensions:</span>
                          <span className="font-mono">{info.shape.join(' × ')}</span>
                        </div>
                      )}
                      {info.columns && (
                        <div className="flex items-start gap-2">
                          <span className="text-gray-400 shrink-0">Columns:</span>
                          <span className="font-mono text-xs break-words">{info.columns.join(', ')}</span>
                        </div>
                      )}
                      {info.memory && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">Memory:</span>
                          <span>{info.memory}</span>
                        </div>
                      )}
                      {info.length !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">Length:</span>
                          <span>{info.length.toLocaleString()}</span>
                        </div>
                      )}
                      {info.dtype && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">Data Type:</span>
                          <span className="font-mono">{info.dtype}</span>
                        </div>
                      )}
                      {info.value && (
                        <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                          <span className="text-xs font-mono text-gray-700 break-all">{info.value}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
                <span className="text-sm">No data variables</span>
                <span className="text-xs text-gray-400">Variables will appear here after code execution</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
