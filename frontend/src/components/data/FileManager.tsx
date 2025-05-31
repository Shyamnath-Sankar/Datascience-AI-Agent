import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';

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

export function FileManager({ sessionId, onFileSelect, activeFileId }: FileManagerProps) {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8000/api/upload/files?session_id=${sessionId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }

      const data = await response.json();
      setFiles(data.files || []);
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

  const deleteFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
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
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchFiles();
    }
  }, [sessionId]);

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-600 text-sm">
        Error: {error}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        No files uploaded yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-[var(--excel-text-primary)] mb-3">
        Uploaded Files ({files.length})
      </h3>

      {files.map((file) => (
        <div
          key={file.file_id}
          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
            activeFileId === file.file_id
              ? 'border-[var(--excel-green)] bg-[rgba(33,115,70,0.05)]'
              : 'border-[var(--excel-border)] hover:border-[var(--excel-blue)] hover:bg-gray-50'
          }`}
          onClick={() => selectFile(file.file_id)}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-[var(--excel-green)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm font-medium text-[var(--excel-text-primary)] truncate">
                  {file.filename}
                </p>
                {activeFileId === file.file_id && (
                  <span className="ml-2 px-2 py-1 text-xs bg-[var(--excel-green)] text-white rounded">
                    Active
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center text-xs text-[var(--excel-text-muted)]">
                <span>{file.rows} rows</span>
                <span className="mx-1">•</span>
                <span>{file.columns} columns</span>
                <span className="mx-1">•</span>
                <span>{new Date(file.upload_timestamp).toLocaleDateString()}</span>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteFile(file.file_id);
              }}
              className="ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
              title="Delete file"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={fetchFiles}
        className="w-full mt-3 px-3 py-2 text-xs text-[var(--excel-blue)] border border-[var(--excel-blue)] rounded hover:bg-[var(--excel-blue)] hover:text-white transition-colors"
      >
        Refresh Files
      </button>
    </div>
  );
}
