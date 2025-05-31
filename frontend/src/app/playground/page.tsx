'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FileUpload } from '@/components/data/FileUpload';
import { FileManager } from '@/components/data/FileManager';
import { EditableDataGrid } from '@/components/data/EditableDataGrid';
import {
  getDataForEditing,
  updateCell,
  addRow,
  deleteRow,
  addColumn,
  deleteColumn
} from '@/lib/api';

export default function PlaygroundPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [uploadedData, setUploadedData] = useState<any>(null);
  const [gridData, setGridData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [availableFiles, setAvailableFiles] = useState<any[]>([]);
  const pageSize = 50;

  // Load session data from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedSessionId = localStorage.getItem('sessionId');
      const storedActiveFileId = localStorage.getItem('activeFileId');
      
      if (storedSessionId) {
        setSessionId(storedSessionId);
        if (storedActiveFileId) {
          setActiveFileId(storedActiveFileId);
        }
      }
    }
  }, []);

  // Load data when session and file are available
  useEffect(() => {
    if (sessionId && activeFileId) {
      loadGridData();
    }
  }, [sessionId, activeFileId, currentPage]);

  const loadGridData = async () => {
    if (!sessionId) return;

    try {
      setLoading(true);
      setError(null);
      
      const response = await getDataForEditing(sessionId, activeFileId, currentPage, pageSize);
      
      setGridData(response.data || []);
      setColumns(response.columns || []);
      setTotalPages(response.total_pages || 1);
      setTotalRows(response.total_rows || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      console.error('Error loading grid data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = (data: any) => {
    setUploadedData(data);
    setSessionId(data.session_id);
    setActiveFileId(data.files?.[0]?.file_id || data.file_id);
    setError(null);

    // Store in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('sessionId', data.session_id);
      if (data.files?.[0]?.file_id || data.file_id) {
        localStorage.setItem('activeFileId', data.files?.[0]?.file_id || data.file_id);
      }
    }
  };

  const handleFileSelect = (fileId: string) => {
    setActiveFileId(fileId);
    setCurrentPage(1); // Reset to first page when switching files
    setError(null);

    // Store in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeFileId', fileId);
    }
  };

  const handleCellUpdate = async (rowIndex: number, column: string, value: any) => {
    if (!sessionId) throw new Error('No session available');
    
    // Calculate actual row index considering pagination
    const actualRowIndex = (currentPage - 1) * pageSize + rowIndex;
    
    await updateCell(sessionId, actualRowIndex, column, value, activeFileId);
    
    // Update local data
    setGridData(prev => {
      const newData = [...prev];
      if (newData[rowIndex]) {
        newData[rowIndex] = { ...newData[rowIndex], [column]: value };
      }
      return newData;
    });
  };

  const handleAddRow = async (data: Record<string, any>) => {
    if (!sessionId) throw new Error('No session available');
    
    await addRow(sessionId, data, 'end', activeFileId);
    
    // Reload data to get the new row
    await loadGridData();
  };

  const handleDeleteRow = async (rowIndex: number) => {
    if (!sessionId) throw new Error('No session available');
    
    // Calculate actual row index considering pagination
    const actualRowIndex = (currentPage - 1) * pageSize + rowIndex;
    
    await deleteRow(sessionId, actualRowIndex, activeFileId);
    
    // Reload data to reflect the deletion
    await loadGridData();
  };

  const handleAddColumn = async (columnName: string, dataType: string) => {
    if (!sessionId) throw new Error('No session available');
    
    await addColumn(sessionId, columnName, dataType, undefined, 'end', activeFileId);
    
    // Reload data to get the new column
    await loadGridData();
  };

  const handleDeleteColumn = async (columnName: string) => {
    if (!sessionId) throw new Error('No session available');
    
    if (!confirm(`Are you sure you want to delete column "${columnName}"? This action cannot be undone.`)) {
      return;
    }
    
    await deleteColumn(sessionId, columnName, activeFileId);
    
    // Reload data to reflect the deletion
    await loadGridData();
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleAddNewRow = async () => {
    const newRowData: Record<string, any> = {};
    columns.forEach(col => {
      newRowData[col] = '';
    });

    try {
      await handleAddRow(newRowData);
    } catch (error) {
      console.error('Error adding row:', error);
    }
  };

  const handleExportData = () => {
    // This would implement data export functionality
    alert('Export functionality would be implemented here');
  };

  // Load available files when session changes
  useEffect(() => {
    const loadFiles = async () => {
      if (sessionId) {
        try {
          const response = await fetch(`http://localhost:8000/api/upload/files?session_id=${sessionId}`);
          if (response.ok) {
            const data = await response.json();
            setAvailableFiles(data.files || []);
          }
        } catch (error) {
          console.error('Error loading files:', error);
        }
      }
    };
    loadFiles();
  }, [sessionId]);

  if (!sessionId) {
    return (
      <div className="fixed inset-0 bg-gray-100 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-center mb-6">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Data Editor</h1>
              <p className="text-gray-600">Upload your data to start editing</p>
            </div>
            <FileUpload onUploadSuccess={handleUploadSuccess} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white flex flex-col overflow-hidden">
      {/* Excel-like Header */}
      <div className="bg-white border-b border-gray-200 flex-shrink-0">
        {/* File Manager Dropdown in Top Left */}
        <div className="flex items-center justify-between px-2 py-1">
          <div className="flex items-center space-x-4">
            {/* Back to Main App */}
            <a
              href="/"
              className="flex items-center space-x-1 text-sm text-gray-600 hover:text-green-600 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to App</span>
            </a>

            {/* File Manager Dropdown */}
            <div className="relative">
              <select
                value={activeFileId || ''}
                onChange={(e) => handleFileSelect(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded px-3 py-1 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Select a file...</option>
                {availableFiles.map((file) => (
                  <option key={file.file_id} value={file.file_id}>
                    {file.filename}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center space-x-2">
              <Button
                onClick={handleAddNewRow}
                className="text-xs px-3 py-1"
                variant="outline"
              >
                + Row
              </Button>
              <Button
                onClick={() => setShowAddColumn(true)}
                className="text-xs px-3 py-1"
                variant="outline"
              >
                + Column
              </Button>
              <Button
                onClick={handleExportData}
                className="text-xs px-3 py-1"
                variant="outline"
              >
                Export
              </Button>
            </div>
          </div>

          {/* File Info */}
          <div className="flex items-center space-x-4">
            {activeFileId && (
              <span className="text-sm text-gray-600">
                {totalRows} rows × {columns.length} columns
              </span>
            )}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 px-2 py-1">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-red-700">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 overflow-hidden">
        {activeFileId && gridData.length > 0 ? (
          <EditableDataGrid
            data={gridData}
            columns={columns}
            onCellUpdate={handleCellUpdate}
            onAddRow={handleAddRow}
            onDeleteRow={handleDeleteRow}
            onAddColumn={handleAddColumn}
            onDeleteColumn={handleDeleteColumn}
            loading={loading}
            className="h-full"
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-50">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-500 text-lg">
                {loading ? 'Loading data...' : 'Select a file to start editing'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Hidden File Manager for Data */}
      <div className="hidden">
        {sessionId && (
          <FileManager
            sessionId={sessionId}
            onFileSelect={handleFileSelect}
            activeFileId={activeFileId}
          />
        )}
      </div>
    </div>
  );
}
