'use client';

import { useState, useEffect, useCallback } from 'react';
import { EditableDataGrid } from '@/components/data/EditableDataGrid';
import { getDataForEditing, updateCell, addRow, deleteRow, addColumn, deleteColumn, getUploadedFiles } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function DataEditorPage() {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [activeFileId, setActiveFileId] = useState<string | null>(null);
    const [data, setData] = useState<any[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [files, setFiles] = useState<{ id: string, name: string }[]>([]);
    const router = useRouter();

    // Load session and file from localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const storedSessionId = localStorage.getItem('sessionId');
            const storedActiveFileId = localStorage.getItem('activeFileId');

            if (storedSessionId) {
                setSessionId(storedSessionId);
                setActiveFileId(storedActiveFileId);
                loadData(storedSessionId, storedActiveFileId || undefined);
            } else {
                // No session, redirect to upload page
                router.push('/');
            }
        }
    }, [router]);

    // Load available files with auto-select
    useEffect(() => {
        if (sessionId) {
            getUploadedFiles(sessionId).then(response => {
                console.log('Files loaded:', response);
                if (response.success && response.files && response.files.length > 0) {
                    setFiles(response.files);
                    // Auto-select first file if no active file
                    if (!activeFileId || !response.files.find((f: any) => f.id === activeFileId)) {
                        const firstFile = response.files[0];
                        console.log('Auto-selecting file:', firstFile);
                        setActiveFileId(firstFile.id);
                        localStorage.setItem('activeFileId', firstFile.id);
                        loadData(sessionId, firstFile.id);
                    }
                } else {
                    console.warn('No files found for session:', sessionId);
                }
            }).catch(err => console.error('Error loading files:', err));
        }
    }, [sessionId]);

    const loadData = async (sessionId: string, fileId?: string) => {
        setLoading(true);
        try {
            const response = await getDataForEditing(sessionId, fileId);
            if (response.success) {
                setData(response.data || []);
                setColumns(response.columns || []);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCellUpdate = useCallback(async (rowIndex: number, column: string, value: any) => {
        if (!sessionId) return;

        try {
            await updateCell(sessionId, rowIndex, column, value, activeFileId || undefined);
            // Optimistically update local state
            setData(prev => {
                const newData = [...prev];
                if (newData[rowIndex]) {
                    newData[rowIndex] = { ...newData[rowIndex], [column]: value };
                }
                return newData;
            });
        } catch (error) {
            console.error('Error updating cell:', error);
            // Reload data on error
            if (sessionId) loadData(sessionId, activeFileId || undefined);
        }
    }, [sessionId, activeFileId]);

    const handleAddRow = useCallback(async (rowData: Record<string, any>) => {
        if (!sessionId) return;

        try {
            await addRow(sessionId, rowData, 'end', activeFileId || undefined);
            if (sessionId) loadData(sessionId, activeFileId || undefined);
        } catch (error) {
            console.error('Error adding row:', error);
        }
    }, [sessionId, activeFileId]);

    const handleDeleteRow = useCallback(async (rowIndex: number) => {
        if (!sessionId) return;

        try {
            await deleteRow(sessionId, rowIndex, activeFileId || undefined);
            // Optimistically remove from local state
            setData(prev => prev.filter((_, idx) => idx !== rowIndex));
        } catch (error) {
            console.error('Error deleting row:', error);
            // Reload data on error
            if (sessionId) loadData(sessionId, activeFileId || undefined);
        }
    }, [sessionId, activeFileId]);

    const handleAddColumn = useCallback(async (columnName: string, dataType: string) => {
        if (!sessionId) return;

        try {
            await addColumn(sessionId, columnName, dataType, undefined, 'end', activeFileId || undefined);
            if (sessionId) loadData(sessionId, activeFileId || undefined);
        } catch (error) {
            console.error('Error adding column:', error);
        }
    }, [sessionId, activeFileId]);

    const handleDeleteColumn = useCallback(async (columnName: string) => {
        if (!sessionId) return;

        try {
            await deleteColumn(sessionId, columnName, activeFileId || undefined);
            // Optimistically update local state
            setColumns(prev => prev.filter(col => col !== columnName));
            setData(prev => prev.map(row => {
                const newRow = { ...row };
                delete newRow[columnName];
                return newRow;
            }));
        } catch (error) {
            console.error('Error deleting column:', error);
            // Reload data on error
            if (sessionId) loadData(sessionId, activeFileId || undefined);
        }
    }, [sessionId, activeFileId]);

    const handleAIAction = useCallback((action: string, result: any) => {
        console.log('AI Action received:', action, result);
        // You can handle AI actions here, like applying suggested changes
        // For example, if AI suggests filling missing values, apply it to the data
    }, []);

    if (!sessionId) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <p className="text-lg text-gray-600">No session found. Please upload data first.</p>
                    <button
                        onClick={() => router.push('/')}
                        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        Go to Upload
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="relative h-[calc(100vh-12rem)] w-full bg-white dark:bg-slate-900 flex flex-col overflow-hidden rounded-lg shadow border border-gray-200 dark:border-slate-700">
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => router.push('/')}
                        className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        <span>Back to Home</span>
                    </button>

                    <div className="h-6 w-px bg-gray-300 dark:bg-slate-600" />

                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                        <span className="text-2xl mr-2">📊</span>
                        AI Data Editor
                    </h1>

                    <div className="ml-6 flex items-center space-x-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Dataset:</span>
                        <select
                            value={activeFileId || ''}
                            onChange={(e) => {
                                const newFileId = e.target.value;
                                setActiveFileId(newFileId);
                                localStorage.setItem('activeFileId', newFileId);
                                loadData(sessionId!, newFileId);
                            }}
                            className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        >
                            <option value="" disabled>Select a dataset</option>
                            {files.length > 0 ? (
                                files.map(file => (
                                    <option key={file.id} value={file.id}>{file.name}</option>
                                ))
                            ) : (
                                <option value="" disabled>No datasets found</option>
                            )}
                        </select>
                        <button
                            onClick={() => router.push('/')}
                            className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 rounded"
                            title="Upload new dataset"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">{data.length}</span> rows × <span className="font-medium">{columns.length}</span> columns
                    </div>

                    <div className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs font-medium rounded-full flex items-center">
                        <span className="mr-1.5">🤖</span>
                        AI Enabled - Click columns to analyze
                    </div>
                </div>
            </div>

            {/* Data Grid */}
            <div className="flex-1 overflow-hidden">
                <EditableDataGrid
                    data={data}
                    columns={columns}
                    onCellUpdate={handleCellUpdate}
                    onAddRow={handleAddRow}
                    onDeleteRow={handleDeleteRow}
                    onAddColumn={handleAddColumn}
                    onDeleteColumn={handleDeleteColumn}
                    loading={loading}
                    className="h-full"
                    sessionId={sessionId}  // ← This enables AI features!
                    fileId={activeFileId || undefined}
                    onAIAction={handleAIAction}
                />
            </div>

            {/* Quick Help Banner */}
            <div className="border-t border-gray-200 dark:border-slate-700 bg-blue-50 dark:bg-slate-800 px-6 py-3">
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-6 text-gray-700 dark:text-gray-300">
                        <div className="flex items-center">
                            <span className="font-semibold mr-2">💡 Quick Tips:</span>
                        </div>
                        <div className="flex items-center space-x-1">
                            <kbd className="px-2 py-0.5 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded text-xs">Click</kbd>
                            <span>column header for AI analysis</span>
                        </div>
                        <div className="flex items-center space-x-1">
                            <kbd className="px-2 py-0.5 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded text-xs">Double-click</kbd>
                            <span>cell to edit</span>
                        </div>
                        <div className="flex items-center space-x-1">
                            <kbd className="px-2 py-0.5 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded text-xs">Right-click</kbd>
                            <span>for context menu</span>
                        </div>
                    </div>

                    <a
                        href="/agent"
                        className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                        Open AI Chat →
                    </a>
                </div>
            </div>
        </div>
    );
}
