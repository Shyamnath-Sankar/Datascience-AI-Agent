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
      if (executionResult.plots && executionResult.plots.length > 0) {
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
      id: 'plots' as const,
      label: 'Charts',
      count: executionResult?.plots?.length || 0,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
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
    <div className="h-full flex flex-col bg-[var(--bg-primary)] border-l border-[var(--border-color)]">
      {/* Tabs */}
      <div className="flex border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-all flex-1 justify-center ${activeTab === tab.id
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--bg-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
              }`}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== null && tab.count > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 text-[10px] rounded-full ${activeTab === tab.id ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden bg-[var(--bg-primary)]">
        {activeTab === 'code' && (
          <div className="h-full flex flex-col">
            <div className="flex-1 border-b border-[var(--border-color)]">
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
                  fontFamily: 'var(--font-mono)',
                }}
              />
            </div>
            <div className="p-3 bg-[var(--bg-secondary)]">
              <button
                onClick={handleExecute}
                disabled={loading || !code.trim()}
                className="w-full btn btn-primary flex items-center justify-center gap-2"
              >
                {loading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                Run Code
              </button>
            </div>
          </div>
        )}

        {activeTab === 'output' && (
          <div className="h-full overflow-auto p-4 bg-[#1e1e1e]">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                <span className="text-sm text-gray-400">Executing...</span>
              </div>
            ) : executionResult ? (
              <div className="space-y-4">
                {executionResult.installations && executionResult.installations.length > 0 && (
                  <div className="bg-blue-900/30 border border-blue-800 rounded p-3 text-xs">
                    {executionResult.installations.map((install, index) => (
                      <div key={index} className={`flex items-center gap-2 ${install.success ? 'text-green-400' : 'text-red-400'}`}>
                        {install.success ? '✓' : '✗'} {install.package}
                      </div>
                    ))}
                  </div>
                )}

                {executionResult.output && (
                  <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap font-ligatures-none">
                    {executionResult.output}
                  </pre>
                )}

                {executionResult.error && (
                  <pre className="text-xs font-mono text-red-400 whitespace-pre-wrap border-l-2 border-red-500 pl-2">
                    {executionResult.error}
                  </pre>
                )}
                
                {!executionResult.output && !executionResult.error && (
                   <div className="text-gray-500 text-xs italic">No text output returned. Check Charts or Data tab.</div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-gray-600">
                <span className="text-sm">Run code to see output</span>
              </div>
            )}
          </div>
        )}

        {activeTab === 'plots' && (
          <div className="h-full overflow-auto p-4 bg-[var(--bg-secondary)]">
            {executionResult?.plots && executionResult.plots.length > 0 ? (
              <div className="space-y-4">
                {/* Plot navigation */}
                {executionResult.plots.length > 1 && (
                  <div className="flex items-center justify-center gap-2 mb-4">
                    {executionResult.plots.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedPlotIndex(index)}
                        className={`w-2 h-2 rounded-full transition-all ${selectedPlotIndex === index
                            ? 'bg-[var(--accent-primary)] w-4'
                            : 'bg-[var(--text-tertiary)]'
                          }`}
                      />
                    ))}
                  </div>
                )}

                {/* Main plot - Updated styling */}
                <div className="modern-card p-2 relative group bg-white border border-[var(--border-color)]">
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                     <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = executionResult.plots[selectedPlotIndex];
                          link.download = `chart-${selectedPlotIndex + 1}.png`;
                          link.click();
                        }}
                        className="p-1.5 bg-white/90 backdrop-blur rounded shadow-sm hover:shadow text-[var(--text-secondary)] border border-[var(--border-color)]"
                        title="Download"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      </button>
                  </div>
                  <img
                    src={executionResult.plots[selectedPlotIndex]}
                    alt={`Chart ${selectedPlotIndex + 1}`}
                    className="w-full h-auto rounded"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-[var(--text-tertiary)]">
                <svg className="w-12 h-12 mb-2 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm">No visualizations generated</span>
              </div>
            )}
          </div>
        )}

        {activeTab === 'variables' && (
          <div className="h-full overflow-auto p-0">
            {executionResult?.variables && Object.keys(executionResult.variables).length > 0 ? (
              <table className="w-full text-xs">
                <thead className="bg-[var(--bg-tertiary)] sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-[var(--text-secondary)]">Variable</th>
                    <th className="px-4 py-2 text-left font-medium text-[var(--text-secondary)]">Type</th>
                    <th className="px-4 py-2 text-left font-medium text-[var(--text-secondary)]">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {Object.entries(executionResult.variables).map(([name, info]) => (
                    <tr key={name} className="hover:bg-[var(--bg-secondary)]">
                      <td className="px-4 py-2 font-mono text-[var(--accent-primary)]">{name}</td>
                      <td className="px-4 py-2 text-[var(--text-secondary)]">{info.type}</td>
                      <td className="px-4 py-2 text-[var(--text-tertiary)] font-mono truncate max-w-[150px]">
                        {info.shape ? `Shape: ${info.shape.join('×')}` : info.value || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-[var(--text-tertiary)]">
                <span className="text-sm">No variables in memory</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
