import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';

interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  plots: string[];
  variables: Record<string, any>;
  installations?: Array<{
    package: string;
    success: boolean;
    message: string;
  }>;
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
  const [activeTab, setActiveTab] = useState<'code' | 'output' | 'plots' | 'variables'>('plots');

  // Auto-switch to charts tab when execution completes
  useEffect(() => {
    if (executionResult) {
      if (executionResult.plots.length > 0) {
        setActiveTab('plots');
      } else if (executionResult.output || executionResult.error) {
        setActiveTab('output');
      }
    }
  }, [executionResult]);

  const handleExecute = () => {
    onExecute(code);
    setActiveTab('output');
  };

  return (
    <div className="h-full flex flex-col bg-white border-l border-[var(--excel-border)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--excel-border)] bg-gray-50">
        <h3 className="text-sm font-semibold text-[var(--excel-text-primary)]">Analysis Results</h3>
        <div className="text-xs text-gray-500">
          {loading ? 'Analyzing...' : 'Ready'}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--excel-border)]">
        {[
          { id: 'plots', label: 'Charts', count: executionResult?.plots.length || 0 },
          { id: 'output', label: 'Results', count: null },
          { id: 'variables', label: 'Data Summary', count: executionResult ? Object.keys(executionResult.variables).length : 0 },
          { id: 'code', label: 'Technical Details', count: null }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-[var(--excel-green)] text-[var(--excel-green)]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.count !== null && tab.count > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-200 text-gray-600 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'code' && (
          <div className="h-full">
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
              }}
            />
          </div>
        )}

        {activeTab === 'output' && (
          <div className="h-full overflow-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-sm text-gray-500">Executing code...</div>
              </div>
            ) : executionResult ? (
              <div className="space-y-4">
                {/* Installation results */}
                {executionResult.installations && executionResult.installations.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-blue-800 mb-2">Package Installations</h4>
                    {executionResult.installations.map((install, index) => (
                      <div key={index} className={`text-xs ${install.success ? 'text-green-700' : 'text-red-700'}`}>
                        {install.package}: {install.message}
                      </div>
                    ))}
                  </div>
                )}

                {/* Success/Error indicator */}
                <div className={`px-3 py-2 rounded-lg text-sm ${
                  executionResult.success 
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                  {executionResult.success ? '✓ Execution completed' : '✗ Execution failed'}
                </div>

                {/* Output */}
                {executionResult.output && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Output</h4>
                    <pre className="text-xs font-mono text-gray-800 whitespace-pre-wrap">
                      {executionResult.output}
                    </pre>
                  </div>
                )}

                {/* Error */}
                {executionResult.error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-red-700 mb-2">Error</h4>
                    <pre className="text-xs font-mono text-red-800 whitespace-pre-wrap">
                      {executionResult.error}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32">
                <div className="text-sm text-gray-500">No execution results yet</div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'plots' && (
          <div className="h-full overflow-auto p-4">
            {executionResult?.plots && executionResult.plots.length > 0 ? (
              <div className="space-y-4">
                {executionResult.plots.map((plot, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                      <span className="text-sm font-medium text-gray-700">Plot {index + 1}</span>
                    </div>
                    <div className="p-4">
                      <img 
                        src={plot} 
                        alt={`Plot ${index + 1}`}
                        className="max-w-full h-auto"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32">
                <div className="text-sm text-gray-500">No plots generated</div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'variables' && (
          <div className="h-full overflow-auto p-4">
            {executionResult?.variables && Object.keys(executionResult.variables).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(executionResult.variables).map(([name, info]) => (
                  <div key={name} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{name}</span>
                      <span className="text-xs text-gray-500">{info.type}</span>
                    </div>
                    {info.shape && (
                      <div className="text-xs text-gray-600">Shape: {info.shape.join(' × ')}</div>
                    )}
                    {info.columns && (
                      <div className="text-xs text-gray-600">Columns: {info.columns.join(', ')}</div>
                    )}
                    {info.length !== undefined && (
                      <div className="text-xs text-gray-600">Length: {info.length}</div>
                    )}
                    {info.value && (
                      <div className="text-xs text-gray-600 mt-1 font-mono">{info.value}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32">
                <div className="text-sm text-gray-500">No variables to display</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
