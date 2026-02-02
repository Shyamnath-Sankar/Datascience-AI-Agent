import React, { useState, useEffect } from 'react';
import { listDatabaseConnections } from '@/lib/api';

interface DataFile {
  file_id: string;
  filename: string;
  file_type: string;
  upload_time: string;
  size: number;
}

interface DatabaseConnection {
  connection_id: string;
  database: string;
  host: string;
  db_type: string;
}

interface DataSelectorProps {
  sessionId: string | null;
  activeFileId: string | null;
  activeConnectionId?: string | null;
  onFileSelect: (fileId: string) => void;
  onConnectionSelect: (connectionId: string) => void;
  onGenerateInsights: () => void;
  className?: string;
}

export function DataSelector({ 
  sessionId, 
  activeFileId, 
  activeConnectionId,
  onFileSelect, 
  onConnectionSelect,
  onGenerateInsights,
  className = '' 
}: DataSelectorProps) {
  const [activeTab, setActiveTab] = useState<'files' | 'databases'>('databases');
  const [availableFiles, setAvailableFiles] = useState<DataFile[]>([]);
  const [availableConnections, setAvailableConnections] = useState<DatabaseConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      if (activeTab === 'files') {
        loadAvailableFiles();
      } else {
        loadAvailableConnections();
      }
    }
  }, [sessionId, activeTab]);

  const loadAvailableFiles = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:8000/api/upload/files?session_id=${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setAvailableFiles(data.files || []);
      }
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableConnections = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listDatabaseConnections();
      setAvailableConnections(result.connections || []);
    } catch (error) {
      console.error('Error loading connections:', error);
      setError('Failed to load connections');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (!sessionId) {
    return (
      <div className={`bg-[var(--bg-secondary)] border border-dashed border-[var(--border-color)] rounded-xl p-6 text-center ${className}`}>
        <p className="text-sm text-[var(--text-secondary)]">No active session</p>
        <p className="text-xs text-[var(--text-tertiary)] mt-1">Connect a database to start.</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header Tabs */}
      <div className="flex items-center bg-[var(--bg-secondary)] p-1 rounded-lg border border-[var(--border-color)] mb-4">
        <button
          onClick={() => setActiveTab('databases')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
            activeTab === 'databases'
              ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          }`}
        >
          Databases
        </button>
        <button
          onClick={() => setActiveTab('files')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
            activeTab === 'files'
              ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          }`}
        >
          Files
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 opacity-50">
            <div className="w-5 h-5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : activeTab === 'databases' ? (
          availableConnections.length === 0 ? (
            <div className="text-center py-8 px-4 bg-[var(--bg-secondary)]/50 rounded-xl border border-dashed border-[var(--border-color)]">
              <div className="w-8 h-8 mx-auto bg-[var(--bg-tertiary)] rounded-full flex items-center justify-center mb-2 text-[var(--text-tertiary)]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">No connections found</p>
              <a href="/database" className="text-xs text-[var(--accent-primary)] hover:underline mt-1 block">Add Connection →</a>
            </div>
          ) : (
            availableConnections.map((conn) => (
              <div
                key={conn.connection_id}
                onClick={() => onConnectionSelect(conn.connection_id)}
                className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${
                  activeConnectionId === conn.connection_id
                    ? 'bg-[var(--accent-subtle)] border-[var(--accent-primary)] shadow-sm'
                    : 'bg-[var(--bg-primary)] border-[var(--border-color)] hover:border-[var(--accent-primary)]/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${
                    activeConnectionId === conn.connection_id
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]'
                  }`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className={`text-sm font-medium truncate ${
                      activeConnectionId === conn.connection_id ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'
                    }`}>
                      {conn.database}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded-sm">
                        {conn.db_type}
                      </span>
                      <span className="text-[10px] text-[var(--text-tertiary)] truncate">
                        {conn.host}
                      </span>
                    </div>
                  </div>
                  {activeConnectionId === conn.connection_id && (
                    <div className="absolute right-3 top-3 w-2 h-2 bg-[var(--accent-primary)] rounded-full shadow-[0_0_0_2px_white]"></div>
                  )}
                </div>
              </div>
            ))
          )
        ) : (
          availableFiles.length === 0 ? (
            <div className="text-center py-8 px-4 bg-[var(--bg-secondary)]/50 rounded-xl border border-dashed border-[var(--border-color)]">
              <p className="text-xs text-[var(--text-secondary)]">No files uploaded</p>
              <a href="/" className="text-xs text-[var(--accent-primary)] hover:underline mt-1 block">Upload File →</a>
            </div>
          ) : (
            availableFiles.map((file) => (
              <div
                key={file.file_id}
                onClick={() => onFileSelect(file.file_id)}
                className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${
                  activeFileId === file.file_id
                    ? 'bg-[var(--accent-subtle)] border-[var(--accent-primary)] shadow-sm'
                    : 'bg-[var(--bg-primary)] border-[var(--border-color)] hover:border-[var(--accent-primary)]/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${
                    activeFileId === file.file_id
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]'
                  }`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className={`text-sm font-medium truncate ${
                      activeFileId === file.file_id ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'
                    }`}>
                      {file.filename}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded-sm">
                        {file.file_type}
                      </span>
                      <span className="text-[10px] text-[var(--text-tertiary)]">
                        {formatFileSize(file.size)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )
        )}
      </div>
      
      {/* Quick Action */}
      <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
        <button
            onClick={onGenerateInsights}
            disabled={!activeFileId && !activeConnectionId}
            className="w-full btn btn-primary text-xs py-2.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Auto-Generate Insights
        </button>
      </div>
    </div>
  );
}
