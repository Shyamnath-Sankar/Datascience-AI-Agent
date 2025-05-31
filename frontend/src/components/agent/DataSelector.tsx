import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';

interface DataFile {
  file_id: string;
  filename: string;
  file_type: string;
  upload_time: string;
  size: number;
}

interface DataSelectorProps {
  sessionId: string | null;
  activeFileId: string | null;
  onFileSelect: (fileId: string) => void;
  onGenerateInsights: () => void;
  className?: string;
}

export function DataSelector({ 
  sessionId, 
  activeFileId, 
  onFileSelect, 
  onGenerateInsights,
  className = '' 
}: DataSelectorProps) {
  const [availableFiles, setAvailableFiles] = useState<DataFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      loadAvailableFiles();
    }
  }, [sessionId]);

  const loadAvailableFiles = async () => {
    if (!sessionId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`http://localhost:8000/api/upload/files?session_id=${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setAvailableFiles(data.files || []);
      } else {
        setError('Failed to load files');
      }
    } catch (error) {
      console.error('Error loading files:', error);
      setError('Error loading files');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString();
  };

  if (!sessionId) {
    return (
      <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-2">
          <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-yellow-800">No Session Active</p>
            <p className="text-xs text-yellow-600">Please upload data first to start using the AI agent.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-[var(--excel-border)] rounded-lg ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--excel-border)] bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--excel-text-primary)]">Available Data</h3>
          <Button
            onClick={onGenerateInsights}
            size="sm"
            variant="outline"
            disabled={!activeFileId}
            className="text-xs"
          >
            Generate Insights
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-gray-500">Loading files...</div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={loadAvailableFiles}
              className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
            >
              Try again
            </button>
          </div>
        ) : availableFiles.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">No data files available</p>
            <p className="text-xs text-gray-400 mt-1">Upload some data to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {availableFiles.map((file) => (
              <div
                key={file.file_id}
                onClick={() => onFileSelect(file.file_id)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  activeFileId === file.file_id
                    ? 'border-[var(--excel-green)] bg-green-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${
                        activeFileId === file.file_id ? 'bg-[var(--excel-green)]' : 'bg-gray-300'
                      }`} />
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.filename}
                      </p>
                    </div>
                    <div className="flex items-center space-x-4 mt-1">
                      <span className="text-xs text-gray-500 uppercase">
                        {file.file_type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatFileSize(file.size)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(file.upload_time)}
                      </span>
                    </div>
                  </div>
                  {activeFileId === file.file_id && (
                    <div className="flex-shrink-0">
                      <svg className="w-4 h-4 text-[var(--excel-green)]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {availableFiles.length > 0 && (
        <div className="px-4 py-3 border-t border-[var(--excel-border)] bg-gray-50">
          <p className="text-xs text-gray-500">
            {availableFiles.length} file{availableFiles.length !== 1 ? 's' : ''} available
            {activeFileId && (
              <span className="ml-2 text-[var(--excel-green)]">
                • {availableFiles.find(f => f.file_id === activeFileId)?.filename} selected
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
