'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import type {
  ExecutionResult,
  Artifact,
  CanvasState,
  CanvasTab,
  CodeBlock,
  PlotData,
  VariableInfo,
  CanvasHistoryEntry
} from '@/lib/types';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

interface AdvancedCanvasProps {
  code: string;
  onCodeChange: (code: string) => void;
  onExecute: (code: string) => Promise<void>;
  executionResult?: ExecutionResult;
  artifacts?: Artifact[];
  isExecuting?: boolean;
  onAddArtifact?: (artifact: Artifact) => void;
  onPinArtifact?: (id: string) => void;
  theme?: 'light' | 'dark';
  showHistory?: boolean;
}

interface TabConfig {
  id: CanvasTab;
  label: string;
  icon: React.ReactNode;
  badge?: number | string;
}

// =============================================================================
// ICONS
// =============================================================================

const Icons = {
  code: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
  results: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  charts: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
    </svg>
  ),
  data: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
    </svg>
  ),
  artifacts: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  play: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  download: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  ),
  copy: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  pin: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  ),
  expand: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
    </svg>
  ),
  spinner: (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  ),
};

// =============================================================================
// ADVANCED CANVAS COMPONENT
// =============================================================================

export function AdvancedCanvas({
  code,
  onCodeChange,
  onExecute,
  executionResult,
  artifacts = [],
  isExecuting = false,
  onAddArtifact,
  onPinArtifact,
  theme = 'light',
  showHistory = true,
}: AdvancedCanvasProps) {
  const [activeTab, setActiveTab] = useState<CanvasTab>('code');
  const [selectedPlotIndex, setSelectedPlotIndex] = useState(0);
  const [history, setHistory] = useState<CanvasHistoryEntry[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  // Auto-switch tabs based on results
  useEffect(() => {
    if (executionResult) {
      if (executionResult.plots?.length > 0) {
        setActiveTab('charts');
        setSelectedPlotIndex(0);
      } else if (executionResult.output || executionResult.error) {
        setActiveTab('results');
      }
    }
  }, [executionResult]);

  // Add to history on execution
  useEffect(() => {
    if (executionResult && code) {
      setHistory(prev => [
        {
          id: Date.now().toString(),
          code,
          executionResult,
          timestamp: new Date(),
        },
        ...prev.slice(0, 49), // Keep last 50
      ]);
    }
  }, [executionResult]);

  // Tab configuration with dynamic badges
  const tabs: TabConfig[] = useMemo(() => [
    { id: 'code', label: 'Code', icon: Icons.code },
    { 
      id: 'results', 
      label: 'Results', 
      icon: Icons.results,
      badge: executionResult?.error ? '!' : undefined
    },
    { 
      id: 'charts', 
      label: 'Charts', 
      icon: Icons.charts,
      badge: executionResult?.plots?.length || undefined
    },
    { 
      id: 'data', 
      label: 'Data', 
      icon: Icons.data,
      badge: executionResult?.variables ? Object.keys(executionResult.variables).length : undefined
    },
    { 
      id: 'artifacts', 
      label: 'Artifacts', 
      icon: Icons.artifacts,
      badge: artifacts.length || undefined
    },
  ], [executionResult, artifacts]);

  const handleExecute = useCallback(async () => {
    if (!code.trim() || isExecuting) return;
    await onExecute(code);
  }, [code, isExecuting, onExecute]);

  const handleCopy = useCallback(async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleDownload = useCallback((data: string, filename: string) => {
    const link = document.createElement('a');
    link.href = data;
    link.download = filename;
    link.click();
  }, []);

  const handleEditorMount = useCallback((editor: any, monaco: Monaco) => {
    monacoRef.current = monaco;
    
    // Add keyboard shortcut for execution
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleExecute();
    });
    
    // Configure Python language features
    monaco.languages.registerCompletionItemProvider('python', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        
        // Common data science completions
        const suggestions = [
          { label: 'df', kind: monaco.languages.CompletionItemKind.Variable, insertText: 'df', detail: 'DataFrame' },
          { label: 'df.head()', kind: monaco.languages.CompletionItemKind.Method, insertText: 'df.head()', detail: 'Show first rows' },
          { label: 'df.describe()', kind: monaco.languages.CompletionItemKind.Method, insertText: 'df.describe()', detail: 'Summary statistics' },
          { label: 'df.info()', kind: monaco.languages.CompletionItemKind.Method, insertText: 'df.info()', detail: 'DataFrame info' },
          { label: 'plt.show()', kind: monaco.languages.CompletionItemKind.Method, insertText: 'plt.show()', detail: 'Display plot' },
        ].map(s => ({ ...s, range }));
        
        return { suggestions };
      },
    });
  }, [handleExecute]);

  // =============================================================================
  // RENDER FUNCTIONS
  // =============================================================================

  const renderCodeEditor = () => (
    <div className="h-full flex flex-col">
      <div className="flex-1 border-b border-[var(--border-color)]">
        <Editor
          height="100%"
          defaultLanguage="python"
          value={code}
          onChange={(value) => onCodeChange(value || '')}
          theme={theme === 'dark' ? 'vs-dark' : 'vs'}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
            tabSize: 4,
            insertSpaces: true,
            padding: { top: 12 },
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontLigatures: true,
            renderLineHighlight: 'all',
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            bracketPairColorization: { enabled: true },
          }}
        />
      </div>
      
      {/* Action Bar */}
      <div className="p-3 bg-[var(--bg-secondary)] flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
          <span>Ctrl+Enter to run</span>
          {showHistory && history.length > 0 && (
            <span>| {history.length} executions</span>
          )}
        </div>
        
        <button
          onClick={handleExecute}
          disabled={isExecuting || !code.trim()}
          className="btn btn-primary flex items-center gap-2 px-4 py-2"
        >
          {isExecuting ? Icons.spinner : Icons.play}
          <span>{isExecuting ? 'Running...' : 'Run Code'}</span>
        </button>
      </div>
    </div>
  );

  const renderResults = () => (
    <div className="h-full overflow-auto p-4 bg-[#1e1e1e] text-gray-300">
      {isExecuting ? (
        <div className="flex flex-col items-center justify-center h-32 gap-3">
          {Icons.spinner}
          <span className="text-sm text-gray-400">Executing code...</span>
        </div>
      ) : executionResult ? (
        <div className="space-y-4 font-mono text-sm">
          {/* Package Installations */}
          {executionResult.installations && executionResult.installations.length > 0 && (
            <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-3">
              <div className="text-blue-400 font-medium mb-2">Package Installations</div>
              {executionResult.installations.map((install, i) => (
                <div key={i} className={`flex items-center gap-2 text-xs ${install.success ? 'text-green-400' : 'text-red-400'}`}>
                  <span>{install.success ? '✓' : '✗'}</span>
                  <span>{install.package}</span>
                  {install.version && <span className="text-gray-500">({install.version})</span>}
                </div>
              ))}
            </div>
          )}
          
          {/* Output */}
          {executionResult.output && (
            <div className="relative group">
              <button
                onClick={() => handleCopy(executionResult.output, 'output')}
                className="absolute top-2 right-2 p-1.5 bg-gray-700/50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                title="Copy output"
              >
                {copiedId === 'output' ? '✓' : Icons.copy}
              </button>
              <pre className="whitespace-pre-wrap break-words leading-relaxed">
                {executionResult.output}
              </pre>
            </div>
          )}
          
          {/* Error */}
          {executionResult.error && (
            <div className="bg-red-900/20 border-l-4 border-red-500 p-4 rounded-r">
              <div className="text-red-400 font-medium mb-2">Error</div>
              <pre className="text-red-300 whitespace-pre-wrap text-xs">
                {executionResult.error}
              </pre>
            </div>
          )}
          
          {/* Execution Stats */}
          {executionResult.executionTimeMs && (
            <div className="text-xs text-gray-500 border-t border-gray-700 pt-3 mt-4">
              Execution time: {executionResult.executionTimeMs}ms
              {executionResult.memoryUsedMb && ` | Memory: ${executionResult.memoryUsedMb.toFixed(2)} MB`}
            </div>
          )}
          
          {/* Empty State */}
          {!executionResult.output && !executionResult.error && (
            <div className="text-gray-500 text-center py-8">
              <p>No text output.</p>
              <p className="text-xs mt-1">Check Charts or Data tab for results.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-gray-500">
          {Icons.results}
          <span className="mt-2 text-sm">Run code to see output</span>
        </div>
      )}
    </div>
  );

  const renderCharts = () => {
    const plots = executionResult?.plots || [];
    
    return (
      <div className="h-full overflow-auto p-4 bg-[var(--bg-secondary)]">
        {plots.length > 0 ? (
          <div className="space-y-4">
            {/* Plot Navigation (if multiple) */}
            {plots.length > 1 && (
              <div className="flex items-center justify-center gap-2 pb-2 border-b border-[var(--border-color)]">
                <button
                  onClick={() => setSelectedPlotIndex(Math.max(0, selectedPlotIndex - 1))}
                  disabled={selectedPlotIndex === 0}
                  className="p-1 rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
                >
                  ←
                </button>
                <div className="flex gap-1.5">
                  {plots.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedPlotIndex(i)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        i === selectedPlotIndex 
                          ? 'bg-[var(--accent-primary)] w-4' 
                          : 'bg-[var(--text-tertiary)] hover:bg-[var(--text-secondary)]'
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setSelectedPlotIndex(Math.min(plots.length - 1, selectedPlotIndex + 1))}
                  disabled={selectedPlotIndex === plots.length - 1}
                  className="p-1 rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
                >
                  →
                </button>
                <span className="text-xs text-[var(--text-tertiary)] ml-2">
                  {selectedPlotIndex + 1} / {plots.length}
                </span>
              </div>
            )}
            
            {/* Main Plot Display */}
            <div className="relative group bg-white rounded-xl shadow-lg overflow-hidden">
              {/* Action Buttons */}
              <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                  onClick={() => {
                    const plotData = typeof plots[selectedPlotIndex] === 'string' 
                      ? plots[selectedPlotIndex] 
                      : (plots[selectedPlotIndex] as PlotData).data;
                    handleDownload(plotData, `chart-${selectedPlotIndex + 1}.png`);
                  }}
                  className="p-2 bg-white/90 backdrop-blur rounded-lg shadow-sm hover:shadow border border-gray-200"
                  title="Download"
                >
                  {Icons.download}
                </button>
                <button
                  onClick={() => setIsFullscreen(true)}
                  className="p-2 bg-white/90 backdrop-blur rounded-lg shadow-sm hover:shadow border border-gray-200"
                  title="Fullscreen"
                >
                  {Icons.expand}
                </button>
                {onAddArtifact && (
                  <button
                    onClick={() => {
                      const plot = plots[selectedPlotIndex];
                      onAddArtifact({
                        id: Date.now().toString(),
                        type: 'visualization',
                        title: `Chart ${selectedPlotIndex + 1}`,
                        content: typeof plot === 'string' ? { id: '', type: 'matplotlib', data: plot } : plot,
                        createdAt: new Date(),
                        isPinned: false,
                      });
                    }}
                    className="p-2 bg-white/90 backdrop-blur rounded-lg shadow-sm hover:shadow border border-gray-200"
                    title="Save as Artifact"
                  >
                    {Icons.pin}
                  </button>
                )}
              </div>
              
              {/* Plot Image */}
              <img
                src={typeof plots[selectedPlotIndex] === 'string' 
                  ? plots[selectedPlotIndex] 
                  : (plots[selectedPlotIndex] as PlotData).data}
                alt={`Chart ${selectedPlotIndex + 1}`}
                className="w-full h-auto"
              />
            </div>
            
            {/* Thumbnail Strip (if multiple) */}
            {plots.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {plots.map((plot, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedPlotIndex(i)}
                    className={`flex-shrink-0 w-20 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                      i === selectedPlotIndex 
                        ? 'border-[var(--accent-primary)] shadow-md' 
                        : 'border-transparent hover:border-[var(--border-color)]'
                    }`}
                  >
                    <img
                      src={typeof plot === 'string' ? plot : (plot as PlotData).data}
                      alt={`Thumbnail ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[var(--text-tertiary)]">
            {Icons.charts}
            <span className="mt-2 text-sm">No visualizations yet</span>
            <span className="text-xs mt-1">Run code with matplotlib/seaborn to see charts</span>
          </div>
        )}
      </div>
    );
  };

  const renderData = () => {
    const variables = executionResult?.variables || {};
    const entries = Object.entries(variables);
    
    return (
      <div className="h-full overflow-auto">
        {entries.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-tertiary)] sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Variable</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Type</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Shape/Size</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {entries.map(([name, info]) => (
                <tr key={name} className="hover:bg-[var(--bg-secondary)] transition-colors">
                  <td className="px-4 py-3">
                    <code className="text-[var(--accent-primary)] font-mono">{name}</code>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    <span className="px-2 py-0.5 bg-[var(--bg-tertiary)] rounded text-xs">
                      {(info as VariableInfo).type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-tertiary)] font-mono text-xs">
                    {(info as VariableInfo).shape 
                      ? `(${(info as VariableInfo).shape!.join(' × ')})` 
                      : (info as VariableInfo).length 
                        ? `length: ${(info as VariableInfo).length}`
                        : '—'}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-tertiary)] font-mono text-xs truncate max-w-[200px]">
                    {(info as VariableInfo).value || (info as VariableInfo).preview || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[var(--text-tertiary)]">
            {Icons.data}
            <span className="mt-2 text-sm">No variables in memory</span>
          </div>
        )}
      </div>
    );
  };

  const renderArtifacts = () => (
    <div className="h-full overflow-auto p-4">
      {artifacts.length > 0 ? (
        <div className="grid gap-4">
          {artifacts.map((artifact) => (
            <div
              key={artifact.id}
              className={`p-4 rounded-xl border ${
                artifact.isPinned 
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-subtle)]' 
                  : 'border-[var(--border-color)] bg-[var(--bg-primary)]'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-medium text-[var(--text-primary)]">{artifact.title}</h4>
                  <span className="text-xs text-[var(--text-tertiary)] capitalize">{artifact.type}</span>
                </div>
                <div className="flex gap-1">
                  {onPinArtifact && (
                    <button
                      onClick={() => onPinArtifact(artifact.id)}
                      className={`p-1.5 rounded ${
                        artifact.isPinned 
                          ? 'text-[var(--accent-primary)]' 
                          : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {Icons.pin}
                    </button>
                  )}
                </div>
              </div>
              
              {/* Artifact Preview */}
              {artifact.type === 'visualization' && typeof artifact.content !== 'string' && (
                <img
                  src={(artifact.content as PlotData).data}
                  alt={artifact.title}
                  className="w-full rounded-lg mt-2"
                />
              )}
              {artifact.type === 'code' && (
                <pre className="text-xs bg-[var(--bg-tertiary)] p-3 rounded-lg mt-2 overflow-x-auto">
                  {artifact.content as string}
                </pre>
              )}
              
              <div className="text-xs text-[var(--text-tertiary)] mt-2">
                {new Date(artifact.createdAt).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-[var(--text-tertiary)]">
          {Icons.artifacts}
          <span className="mt-2 text-sm">No artifacts saved</span>
          <span className="text-xs mt-1">Pin charts or code snippets to save them</span>
        </div>
      )}
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'code': return renderCodeEditor();
      case 'results': return renderResults();
      case 'charts': return renderCharts();
      case 'data': return renderData();
      case 'artifacts': return renderArtifacts();
      default: return renderCodeEditor();
    }
  };

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <div className={`h-full flex flex-col bg-[var(--bg-primary)] ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Tab Bar */}
      <div className="flex border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-all flex-1 justify-center ${
              activeTab === tab.id
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--bg-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.badge && (
              <span className={`ml-1 px-1.5 py-0.5 text-[10px] rounded-full ${
                tab.badge === '!'
                  ? 'bg-red-100 text-red-600'
                  : activeTab === tab.id 
                    ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)]' 
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
        
        {isFullscreen && (
          <button
            onClick={() => setIsFullscreen(false)}
            className="px-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            ×
          </button>
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {renderTabContent()}
      </div>
      
      {/* Execution Status Bar */}
      {isExecuting && (
        <div className="px-4 py-2 bg-[var(--accent-subtle)] text-[var(--accent-primary)] text-xs flex items-center gap-2">
          {Icons.spinner}
          <span>Executing code...</span>
        </div>
      )}
    </div>
  );
}

export default AdvancedCanvas;
