import React, { useState, useEffect } from 'react';

interface FileMetadata {
  file_id: string;
  filename: string;
  upload_timestamp: string;
  rows: number;
  columns: number;
  column_names: string[];
  dtypes: Record<string, string>;
}

interface FileManagerProps {
  sessionId: string;
  onFileSelect: (fileId: string) => void;
  activeFileId?: string | null;
}

// File type icon component
const FileIcon = ({ filename }: { filename: string }) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const colors: Record<string, string> = {
    csv: 'text-green-500',
    xlsx: 'text-blue-500',
    xls: 'text-blue-500',
    json: 'text-yellow-500',
    parquet: 'text-purple-500',
  };
  const color = colors[ext || ''] || 'text-[var(--text-tertiary)]';

  return (
    <div className={`w-8 h-8 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center ${color}`}>
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    </div>
  );
};

export function FileManager({ sessionId, onFileSelect, activeFileId }: FileManagerProps) {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8000/api/upload/files?session_id=${sessionId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }

      const data = await response.json();
      setFiles(data.files || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const selectFile = async (fileId: string) => {
    try {
      const formData = new FormData();
      formData.append('session_id', sessionId);
      formData.append('file_id', fileId);

      const response = await fetch('http://localhost:8000/api/upload/files/select', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to select file');
      }

      onFileSelect(fileId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select file');
    }
  };

  const deleteFile = async (e: React.MouseEvent, fileId: string) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
      setDeletingId(fileId);
      const response = await fetch(`http://localhost:8000/api/upload/files/${fileId}?session_id=${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete file');
      }

      // Refresh file list
      await fetchFiles();

      // If deleted file was active, select first available file
      if (activeFileId === fileId && files.length > 1) {
        const remainingFiles = files.filter(f => f.file_id !== fileId);
        if (remainingFiles.length > 0) {
          await selectFile(remainingFiles[0].file_id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file');
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchFiles();
    }
  }, [sessionId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => (
          <div key={i} className="animate-pulse flex items-center gap-3 p-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--bg-tertiary)]"></div>
            <div className="flex-1">
              <div className="h-3 bg-[var(--bg-tertiary)] rounded w-3/4 mb-1.5"></div>
              <div className="h-2 bg-[var(--bg-tertiary)] rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 rounded-lg bg-[var(--error-bg)] text-[var(--error)] text-xs">
        <p className="font-medium">Error loading files</p>
        <p className="mt-1 opacity-80">{error}</p>
        <button 
          onClick={fetchFiles}
          className="mt-2 text-xs underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className="w-10 h-10 mx-auto rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-xs text-[var(--text-tertiary)]">No files uploaded</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {files.map((file) => (
        <button
          key={file.file_id}
          onClick={() => selectFile(file.file_id)}
          className={`w-full text-left p-2 rounded-lg transition-all duration-150 group ${
            activeFileId === file.file_id
              ? 'bg-[var(--accent-subtle)] ring-1 ring-[var(--accent-primary)]'
              : 'hover:bg-[var(--bg-tertiary)]'
          }`}
        >
          <div className="flex items-center gap-2">
            <FileIcon filename={file.filename} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[var(--text-primary)] truncate block max-w-[120px]" title={file.filename}>
                  {file.filename}
                </span>
                {activeFileId === file.file_id && (
                  <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]"></span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)] mt-0.5">
                <span>{file.rows.toLocaleString()} rows</span>
                <span>•</span>
                <span>{file.columns} cols</span>
              </div>
            </div>
            <button
              onClick={(e) => deleteFile(e, file.file_id)}
              className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                deletingId === file.file_id 
                  ? 'cursor-wait' 
                  : 'hover:bg-[var(--error-bg)] hover:text-[var(--error)]'
              }`}
              disabled={deletingId === file.file_id}
              title="Delete file"
            >
              {deletingId === file.file_id ? (
                <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </button>
          </div>
        </button>
      ))}

      <button
        onClick={fetchFiles}
        className="w-full mt-2 px-2 py-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors flex items-center justify-center gap-1"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Refresh
      </button>
    </div>
  );
}
