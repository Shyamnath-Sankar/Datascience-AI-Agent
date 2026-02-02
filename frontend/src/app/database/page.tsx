'use client';

import { useState, useEffect } from 'react';
import { 
  connectDatabase, 
  listDatabaseConnections,
  disconnectDatabase,
  askDatabaseQuestion,
  executeDatabaseQuery,
  getDatabaseSchema,
  getDatabaseSuggestions,
  getDatabaseQueryHistory,
  getTableSampleData,
  DatabaseConnectionParams
} from '@/lib/api';

// Types
interface Connection {
  connection_id: string;
  host: string;
  port: number;
  database: string;
  username: string;
  db_type: string;
  stats?: {
    query_count: number;
    last_used: string;
  };
}

interface TableInfo {
  name: string;
  type: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
  }>;
  row_count?: number;
}

interface QueryResult {
  success: boolean;
  sql?: string;
  question?: string;
  explanation?: string;
  data?: {
    columns: string[];
    rows: any[];
    total_rows: number;
  };
  error?: string;
  execution_time_ms?: number;
}

interface HistoryEntry {
  id: string;
  timestamp: string;
  query: string;
  natural_language?: string;
  success: boolean;
  row_count: number;
  execution_time_ms: number;
}

export default function DatabasePage() {
  // Session management
  const [sessionId, setSessionId] = useState<string>('');
  
  // Connection state
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activeConnection, setActiveConnection] = useState<Connection | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string>('');
  
  // Schema state
  const [schema, setSchema] = useState<{ tables: TableInfo[]; views: TableInfo[] } | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tablePreview, setTablePreview] = useState<any[] | null>(null);
  
  // Query state
  const [question, setQuestion] = useState('');
  const [sqlQuery, setSqlQuery] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryMode, setQueryMode] = useState<'natural' | 'sql'>('natural');
  
  // Suggestions & History
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  
  // Connection form state
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [connectionTab, setConnectionTab] = useState<'standard' | 'supabase' | 'string'>('standard');
  const [connectionString, setConnectionString] = useState('');
  const [connectionForm, setConnectionForm] = useState<DatabaseConnectionParams>({
    host: 'localhost',
    port: 5432,
    database: '',
    username: '',
    password: '',
    db_type: 'postgresql'
  });

  // Initialize session
  useEffect(() => {
    const stored = localStorage.getItem('sessionId');
    if (stored) {
      setSessionId(stored);
    } else {
      const newSession = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('sessionId', newSession);
      setSessionId(newSession);
    }
  }, []);

  // Parse connection string
  const parseConnectionString = (str: string) => {
    try {
      // Basic postgres parsing: postgresql://user:pass@host:port/db
      // More robust regex to handle special chars in password
      // Format: postgresql://user:password@host:port/database
      // Or: postgresql://user:password@host:port/database?options
      
      const url = new URL(str);
      
      if (url.protocol.includes('postgres')) {
        setConnectionForm({
          ...connectionForm,
          username: url.username,
          password: url.password,
          host: url.hostname,
          port: parseInt(url.port) || 5432,
          database: url.pathname.substring(1), // Remove leading slash
          db_type: 'postgresql'
        });
        return true;
      }
      return false;
    } catch (e) {
      console.error("Error parsing connection string:", e);
      return false;
    }
  };

  // Load connections
  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      const result = await listDatabaseConnections();
      setConnections(result.connections || []);
    } catch (error) {
      console.error('Failed to load connections:', error);
    }
  };

  // Load schema when connection changes
  useEffect(() => {
    if (activeConnection) {
      loadSchema();
      loadSuggestions();
      loadHistory();
    }
  }, [activeConnection]);

  const loadSchema = async () => {
    if (!activeConnection) return;
    try {
      const result = await getDatabaseSchema(activeConnection.connection_id);
      if (result.success) {
        setSchema(result.schema);
      }
    } catch (error) {
      console.error('Failed to load schema:', error);
    }
  };

  const loadSuggestions = async () => {
    if (!activeConnection) return;
    try {
      const result = await getDatabaseSuggestions(activeConnection.connection_id);
      if (result.success) {
        setSuggestions(result.suggestions || []);
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
  };

  const loadHistory = async () => {
    if (!activeConnection || !sessionId) return;
    try {
      const result = await getDatabaseQueryHistory(sessionId, activeConnection.connection_id);
      if (result.success) {
        setHistory(result.history || []);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setConnectionError('');
    
    try {
      const result = await connectDatabase(sessionId, connectionForm);
      
      if (result.success) {
        await loadConnections();
        setActiveConnection({
          connection_id: result.connection_id,
          host: connectionForm.host,
          port: connectionForm.port,
          database: connectionForm.database,
          username: connectionForm.username,
          db_type: connectionForm.db_type || 'postgresql'
        });
        setShowConnectionForm(false);
        setConnectionForm({
          ...connectionForm,
          password: ''
        });
      } else {
        setConnectionError(result.error || 'Connection failed');
      }
    } catch (error: any) {
      setConnectionError(error.message || 'Connection failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    try {
      await disconnectDatabase(connectionId);
      await loadConnections();
      if (activeConnection?.connection_id === connectionId) {
        setActiveConnection(null);
        setSchema(null);
        setQueryResult(null);
      }
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const handleAsk = async () => {
    if (!activeConnection || !question.trim()) return;
    
    setIsQuerying(true);
    setQueryResult(null);
    
    try {
      const result = await askDatabaseQuestion(
        activeConnection.connection_id,
        sessionId,
        question,
        true,
        true,
        true
      );
      
      setQueryResult(result);
      if (result.sql) {
        setSqlQuery(result.sql);
      }
      await loadHistory();
    } catch (error: any) {
      setQueryResult({
        success: false,
        error: error.message || 'Query failed'
      });
    } finally {
      setIsQuerying(false);
    }
  };

  const handleExecuteSQL = async () => {
    if (!activeConnection || !sqlQuery.trim()) return;
    
    setIsQuerying(true);
    setQueryResult(null);
    
    try {
      const result = await executeDatabaseQuery(
        activeConnection.connection_id,
        sessionId,
        sqlQuery,
        true
      );
      
      setQueryResult({
        success: result.success,
        sql: sqlQuery,
        data: result.success ? {
          columns: result.columns,
          rows: result.data,
          total_rows: result.row_count
        } : undefined,
        error: result.error,
        execution_time_ms: result.execution_time_ms
      });
      await loadHistory();
    } catch (error: any) {
      setQueryResult({
        success: false,
        error: error.message || 'Query failed'
      });
    } finally {
      setIsQuerying(false);
    }
  };

  const handleTableClick = async (tableName: string) => {
    setSelectedTable(tableName);
    if (activeConnection) {
      try {
        const result = await getTableSampleData(activeConnection.connection_id, tableName, 5);
        if (result.success) {
          setTablePreview(result.data);
        }
      } catch (error) {
        console.error('Failed to load table preview:', error);
      }
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuestion(suggestion);
    setQueryMode('natural');
  };

  const handleHistoryClick = (entry: HistoryEntry) => {
    setSqlQuery(entry.query);
    if (entry.natural_language) {
      setQuestion(entry.natural_language);
    }
    setQueryMode('sql');
  };

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">
            Database Explorer
          </h1>
          <p className="text-[var(--text-secondary)] mt-2">
            Connect to your database and analyze data using natural language or SQL
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Left Sidebar - Connections & Schema */}
          <div className="col-span-3 space-y-6">
            {/* Connections */}
            <div className="modern-card">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Connections
                </h2>
                <button
                  onClick={() => setShowConnectionForm(true)}
                  className="btn btn-primary text-xs"
                >
                  + New
                </button>
              </div>

              {connections.length === 0 ? (
                <div className="text-center py-8 bg-[var(--bg-tertiary)] rounded-lg border border-dashed border-[var(--border-color)]">
                  <p className="text-[var(--text-tertiary)] text-sm">No connections</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {connections.map((conn) => (
                    <div
                      key={conn.connection_id}
                      className={`p-3 rounded-lg cursor-pointer transition-all duration-200 border ${
                        activeConnection?.connection_id === conn.connection_id
                          ? 'bg-[var(--accent-subtle)] border-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]'
                          : 'bg-[var(--bg-primary)] border-[var(--border-color)] hover:border-[var(--border-hover)]'
                      }`}
                      onClick={() => setActiveConnection(conn)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${activeConnection?.connection_id === conn.connection_id ? 'bg-[var(--accent-primary)]' : 'bg-[var(--text-tertiary)]'}`}></div>
                            <p className="font-medium text-[var(--text-primary)]">
                              {conn.database}
                            </p>
                          </div>
                          <p className="text-xs text-[var(--text-tertiary)] mt-1 ml-4">
                            {conn.host}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDisconnect(conn.connection_id);
                          }}
                          className="text-[var(--error)] hover:text-[var(--error-bg)] p-1 rounded hover:bg-[var(--error-bg)] transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Schema Browser */}
            {activeConnection && schema && (
              <div className="modern-card">
                <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-4">
                  Schema
                </h2>
                
                {/* Tables */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-medium text-[var(--text-tertiary)] uppercase">
                      Tables ({schema.tables.length})
                    </h3>
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {schema.tables.map((table) => (
                      <div
                        key={table.name}
                        className={`group flex items-center justify-between p-2 rounded-md cursor-pointer text-sm transition-colors ${
                          selectedTable === table.name
                            ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-medium'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                        }`}
                        onClick={() => handleTableClick(table.name)}
                      >
                        <div className="flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span className="truncate">{table.name}</span>
                        </div>
                        {table.row_count !== undefined && (
                          <span className="text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded-full">
                            {table.row_count >= 1000 ? `${(table.row_count/1000).toFixed(1)}k` : table.row_count}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Views */}
                {schema.views.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-[var(--text-tertiary)] uppercase mb-2">
                      Views ({schema.views.length})
                    </h3>
                    <div className="space-y-1 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                      {schema.views.map((view) => (
                        <div
                          key={view.name}
                          className="flex items-center gap-2 p-2 rounded-md cursor-pointer text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                          onClick={() => handleTableClick(view.name)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span className="truncate">{view.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Suggestions */}
            {activeConnection && suggestions.length > 0 && (
              <div className="modern-card">
                <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-4">
                  Suggestions
                </h2>
                <div className="space-y-2">
                  {suggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      className="w-full text-left p-3 rounded-lg text-sm bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all border border-transparent hover:border-[var(--border-color)]"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Main Content - Query Interface */}
          <div className="col-span-6 space-y-6">
            {/* Query Input */}
            <div className="modern-card p-0 overflow-hidden">
              <div className="flex border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
                <button
                  className={`px-6 py-3 text-sm font-medium transition-colors border-r border-[var(--border-color)] ${
                    queryMode === 'natural'
                      ? 'bg-[var(--bg-primary)] text-[var(--accent-primary)] border-b-2 border-b-[var(--accent-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  onClick={() => setQueryMode('natural')}
                >
                  Natural Language
                </button>
                <button
                  className={`px-6 py-3 text-sm font-medium transition-colors ${
                    queryMode === 'sql'
                      ? 'bg-[var(--bg-primary)] text-[var(--accent-primary)] border-b-2 border-b-[var(--accent-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  onClick={() => setQueryMode('sql')}
                >
                  SQL Editor
                </button>
              </div>

              <div className="p-4 bg-[var(--bg-primary)]">
                {queryMode === 'natural' ? (
                  <div>
                    <div className="relative">
                      <textarea
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="Ask a question about your data..."
                        className="w-full p-4 border border-[var(--border-color)] rounded-lg bg-[var(--bg-secondary)] text-[var(--text-primary)] min-h-[120px] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none resize-none transition-all placeholder-[var(--text-tertiary)]"
                        disabled={!activeConnection}
                      />
                      <div className="absolute bottom-3 right-3 text-xs text-[var(--text-tertiary)]">
                        Press Enter to send
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={handleAsk}
                        disabled={!activeConnection || !question.trim() || isQuerying}
                        className="btn btn-primary"
                      >
                        {isQuerying ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing...
                          </>
                        ) : (
                          <>
                            <span>Ask AI</span>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <textarea
                      value={sqlQuery}
                      onChange={(e) => setSqlQuery(e.target.value)}
                      placeholder="SELECT * FROM table..."
                      className="w-full p-4 border border-[var(--border-color)] rounded-lg bg-[#1e1e1e] text-[#d4d4d4] min-h-[200px] font-mono text-sm focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none resize-y"
                      disabled={!activeConnection}
                    />
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={handleExecuteSQL}
                        disabled={!activeConnection || !sqlQuery.trim() || isQuerying}
                        className="btn btn-primary bg-[var(--success)] hover:bg-[#059669]"
                      >
                        {isQuerying ? 'Executing...' : 'Run Query'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Query Result */}
            {queryResult && (
              <div className="modern-card animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-[var(--border-color)]">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    Results
                  </h2>
                  <div className="flex items-center gap-4">
                    {queryResult.data && (
                      <span className="text-sm font-medium px-2.5 py-0.5 rounded-full bg-[var(--success-bg)] text-[var(--success)]">
                        {queryResult.data.total_rows} rows
                      </span>
                    )}
                    {queryResult.execution_time_ms && (
                      <span className="text-sm text-[var(--text-tertiary)] font-mono">
                        {queryResult.execution_time_ms.toFixed(0)}ms
                      </span>
                    )}
                  </div>
                </div>

                {queryResult.success ? (
                  <div className="space-y-6">
                    {/* Explanation */}
                    {queryResult.explanation && (
                      <div className="bg-[var(--accent-subtle)] p-4 rounded-lg border border-[var(--border-color)]">
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--accent-primary)]" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-1">AI Analysis</h3>
                            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                              {queryResult.explanation}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Data Table */}
                    {queryResult.data && queryResult.data.rows.length > 0 && (
                      <div className="data-table-container">
                        <div className="overflow-x-auto max-h-[500px]">
                          <table className="w-full">
                            <thead className="bg-[var(--bg-tertiary)] sticky top-0 z-10">
                              <tr>
                                {queryResult.data.columns.map((col) => (
                                  <th key={col} className="whitespace-nowrap">
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-color)] bg-[var(--bg-primary)]">
                              {queryResult.data.rows.slice(0, 100).map((row, idx) => (
                                <tr key={idx} className="hover:bg-[var(--bg-secondary)] transition-colors">
                                  {queryResult.data!.columns.map((col) => (
                                    <td key={col} className="whitespace-nowrap text-sm">
                                      {row[col]?.toString() ?? <span className="text-[var(--text-tertiary)] italic">null</span>}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {queryResult.data.total_rows > 100 && (
                          <div className="p-2 text-center text-xs text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] border-t border-[var(--border-color)]">
                            Showing first 100 rows
                          </div>
                        )}
                      </div>
                    )}

                    {/* SQL Code */}
                    {queryResult.sql && (
                      <div>
                        <button 
                          className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] flex items-center gap-1 mb-2 transition-colors"
                          onClick={() => {
                            const el = document.getElementById('sql-code-block');
                            if (el) el.classList.toggle('hidden');
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                          </svg>
                          View Generated SQL
                        </button>
                        <div id="sql-code-block" className="hidden">
                          <pre className="p-4 bg-[#1e1e1e] text-[#d4d4d4] rounded-lg text-xs overflow-x-auto font-mono border border-[var(--border-color)]">
                            {queryResult.sql}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-[var(--error-bg)] rounded-lg border border-[var(--error)]/20 flex items-start gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--error)] mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <h3 className="text-sm font-medium text-[var(--error)]">Query Failed</h3>
                      <p className="text-sm text-[var(--error)]/80 mt-1">{queryResult.error}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* No Connection Message */}
            {!activeConnection && (
              <div className="modern-card py-16 text-center border-dashed">
                <div className="w-16 h-16 bg-[var(--bg-tertiary)] rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">No Database Connected</h3>
                <p className="text-[var(--text-secondary)] mb-6 max-w-sm mx-auto">
                  Connect to your PostgreSQL, Supabase, or MySQL database to start analyzing your data with AI.
                </p>
                <button
                  onClick={() => setShowConnectionForm(true)}
                  className="btn btn-primary"
                >
                  Connect Database
                </button>
              </div>
            )}
          </div>

          {/* Right Sidebar - Table Preview & History */}
          <div className="col-span-3 space-y-6">
            {/* Table Preview */}
            {selectedTable && tablePreview && (
              <div className="modern-card">
                <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-4 flex items-center justify-between">
                  <span>Preview</span>
                  <span className="text-[var(--accent-primary)] normal-case text-xs bg-[var(--accent-subtle)] px-2 py-0.5 rounded-full">{selectedTable}</span>
                </h2>
                <div className="overflow-x-auto max-h-64 custom-scrollbar">
                  <table className="w-full text-xs">
                    <thead className="bg-[var(--bg-tertiary)] sticky top-0">
                      <tr>
                        {Object.keys(tablePreview[0] || {}).map((col) => (
                          <th key={col} className="px-2 py-1.5 text-left font-medium text-[var(--text-secondary)] border-b border-[var(--border-color)]">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)]">
                      {tablePreview.map((row, idx) => (
                        <tr key={idx} className="hover:bg-[var(--bg-tertiary)]">
                          {Object.values(row).map((val: any, colIdx) => (
                            <td key={colIdx} className="px-2 py-1.5 text-[var(--text-primary)] whitespace-nowrap">
                              {val?.toString() ?? ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Query History */}
            {activeConnection && history.length > 0 && (
              <div className="modern-card">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                    Recent Queries
                  </h2>
                </div>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                  {history.slice(-10).reverse().map((entry) => (
                    <div
                      key={entry.id}
                      className={`p-3 rounded-lg cursor-pointer text-sm border transition-all duration-200 group ${
                        entry.success
                          ? 'bg-[var(--bg-primary)] border-[var(--border-color)] hover:border-[var(--success)] hover:shadow-sm'
                          : 'bg-[var(--error-bg)]/10 border-[var(--error)]/20 hover:border-[var(--error)]'
                      }`}
                      onClick={() => handleHistoryClick(entry)}
                    >
                      {entry.natural_language && (
                        <p className="text-[var(--text-primary)] font-medium mb-1 line-clamp-2">
                          {entry.natural_language}
                        </p>
                      )}
                      <p className="text-[var(--text-tertiary)] text-xs font-mono truncate bg-[var(--bg-tertiary)] p-1 rounded opacity-70 group-hover:opacity-100 transition-opacity">
                        {entry.query}
                      </p>
                      <div className="flex justify-between text-[10px] text-[var(--text-tertiary)] mt-2 uppercase tracking-wide">
                        <span>{entry.row_count} rows</span>
                        <span>{entry.execution_time_ms.toFixed(0)}ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Connection Modal */}
        {showConnectionForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
            <div className="modern-card w-full max-w-md p-0 overflow-hidden shadow-2xl border-[var(--border-color)]">
              <div className="p-6 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">
                  Connect Database
                </h2>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  Add a new data source to your workspace
                </p>
              </div>

              {connectionError && (
                <div className="m-6 mb-0 p-3 bg-[var(--error-bg)] rounded-md border border-[var(--error)]/20 text-sm text-[var(--error)]">
                  {connectionError}
                </div>
              )}

              {/* Tabs */}
              <div className="flex border-b border-[var(--border-color)] px-6 pt-2">
                <button
                  className={`py-3 px-4 text-sm font-medium transition-colors relative ${
                    connectionTab === 'standard'
                      ? 'text-[var(--accent-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  onClick={() => setConnectionTab('standard')}
                >
                  Standard
                  {connectionTab === 'standard' && (
                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[var(--accent-primary)] rounded-t-full"></div>
                  )}
                </button>
                <button
                  className={`py-3 px-4 text-sm font-medium transition-colors relative ${
                    connectionTab === 'supabase'
                      ? 'text-[var(--success)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  onClick={() => {
                    setConnectionTab('supabase');
                    setConnectionForm({
                      ...connectionForm,
                      port: 6543, 
                      database: 'postgres',
                      username: 'postgres.your-project-ref',
                      db_type: 'postgresql'
                    });
                  }}
                >
                  Supabase
                  {connectionTab === 'supabase' && (
                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[var(--success)] rounded-t-full"></div>
                  )}
                </button>
                <button
                  className={`py-3 px-4 text-sm font-medium transition-colors relative ${
                    connectionTab === 'string'
                      ? 'text-[var(--warning)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  onClick={() => setConnectionTab('string')}
                >
                  URI String
                  {connectionTab === 'string' && (
                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[var(--warning)] rounded-t-full"></div>
                  )}
                </button>
              </div>

              <div className="p-6">
                {connectionTab === 'string' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                        Connection String (URI)
                      </label>
                      <textarea
                        value={connectionString}
                        onChange={(e) => {
                          setConnectionString(e.target.value);
                          parseConnectionString(e.target.value);
                        }}
                        className="w-full p-3 border border-[var(--border-color)] rounded-md bg-[var(--bg-secondary)] text-[var(--text-primary)] h-32 text-sm font-mono focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none"
                        placeholder="postgresql://user:password@host:port/database"
                      />
                      <p className="text-xs text-[var(--text-tertiary)] mt-2">
                        Supported: PostgreSQL, MySQL, SQLite, MSSQL connection strings.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {connectionTab === 'standard' && (
                      <div>
                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                          Database Type
                        </label>
                        <div className="relative">
                          <select
                            value={connectionForm.db_type}
                            onChange={(e) => setConnectionForm({...connectionForm, db_type: e.target.value})}
                            className="w-full p-2.5 border border-[var(--border-color)] rounded-md bg-[var(--bg-secondary)] text-[var(--text-primary)] appearance-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none"
                          >
                            <option value="postgresql">PostgreSQL</option>
                            <option value="mysql">MySQL</option>
                            <option value="mssql">SQL Server</option>
                            <option value="sqlite">SQLite</option>
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                            <svg className="w-4 h-4 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                          </div>
                        </div>
                      </div>
                    )}

                    {connectionTab === 'supabase' && (
                      <div className="bg-[var(--success-bg)] p-3 rounded-md text-sm text-[var(--success)] mb-4 flex gap-2">
                        <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                        Optimized for Supabase Transaction Pooler (Port 6543)
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                          Host
                        </label>
                        <input
                          type="text"
                          value={connectionForm.host}
                          onChange={(e) => setConnectionForm({...connectionForm, host: e.target.value})}
                          className="w-full p-2.5 border border-[var(--border-color)] rounded-md bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none"
                          placeholder={connectionTab === 'supabase' ? "db.ref.supabase.co" : "localhost"}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                          Port
                        </label>
                        <input
                          type="number"
                          value={connectionForm.port}
                          onChange={(e) => setConnectionForm({...connectionForm, port: parseInt(e.target.value)})}
                          className="w-full p-2.5 border border-[var(--border-color)] rounded-md bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                        Database Name
                      </label>
                      <input
                        type="text"
                        value={connectionForm.database}
                        onChange={(e) => setConnectionForm({...connectionForm, database: e.target.value})}
                        className="w-full p-2.5 border border-[var(--border-color)] rounded-md bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none"
                        placeholder="postgres"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                        Username
                      </label>
                      <input
                        type="text"
                        value={connectionForm.username}
                        onChange={(e) => setConnectionForm({...connectionForm, username: e.target.value})}
                        className="w-full p-2.5 border border-[var(--border-color)] rounded-md bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none"
                        placeholder="postgres"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                        Password
                      </label>
                      <input
                        type="password"
                        value={connectionForm.password}
                        onChange={(e) => setConnectionForm({...connectionForm, password: e.target.value})}
                        className="w-full p-2.5 border border-[var(--border-color)] rounded-md bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 mt-8">
                  <button
                    onClick={() => {
                      setShowConnectionForm(false);
                      setConnectionError('');
                    }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="btn btn-primary"
                  >
                    {isConnecting ? 'Connecting...' : 'Connect Database'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
