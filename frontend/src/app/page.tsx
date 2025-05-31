'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { FileUpload } from '@/components/data/FileUpload';
import { FileManager } from '@/components/data/FileManager';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [uploadedData, setUploadedData] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const router = useRouter();

  const handleUploadSuccess = (data: any) => {
    setUploadedData(data);
    setSessionId(data.session_id);

    // Store session ID in localStorage for use across pages
    if (data.session_id && typeof window !== 'undefined') {
      localStorage.setItem('sessionId', data.session_id);
    }

    // If multiple files were uploaded, set the first one as active
    if (data.files && data.files.length > 0) {
      setActiveFileId(data.files[0].file_id);
    }
  };

  const handleFileSelect = (fileId: string) => {
    setActiveFileId(fileId);
    // You could also fetch and display the selected file's preview here
  };

  const handleContinue = () => {
    router.push('/profile');
  };

  return (
    <div className="space-y-6">
      <div className="excel-card p-6 mb-8 text-center">
        <h1 className="text-2xl font-bold text-[var(--excel-green)]">Data Science Platform</h1>
        <p className="mt-2 text-[var(--excel-text-muted)]">
          Upload your data to begin analysis, visualization, and machine learning
        </p>

        <div className="mt-4 flex justify-center">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-[rgba(33,115,70,0.1)] text-[var(--excel-green)] text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Excel-inspired UI
          </div>
        </div>
      </div>

      <Card title="Upload Your Data">
        <FileUpload onUploadSuccess={handleUploadSuccess} />
      </Card>

      {uploadedData && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* File Manager Sidebar */}
            <div className="lg:col-span-1">
              <Card title="File Manager">
                {sessionId && (
                  <FileManager
                    sessionId={sessionId}
                    onFileSelect={handleFileSelect}
                    activeFileId={activeFileId}
                  />
                )}
              </Card>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3">
              <Card title="Upload Summary">
                {uploadedData.files ? (
                  // Multiple files uploaded
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-green-800 font-medium">{uploadedData.message}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="metric-card">
                        <p className="text-sm text-[var(--excel-text-muted)] mb-1">Total Files</p>
                        <div className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-[var(--excel-green)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <p className="text-2xl font-bold text-[var(--excel-text-primary)]">{uploadedData.files.length}</p>
                        </div>
                      </div>
                      <div className="metric-card">
                        <p className="text-sm text-[var(--excel-text-muted)] mb-1">Total Rows</p>
                        <div className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-[var(--excel-blue)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                          </svg>
                          <p className="text-2xl font-bold text-[var(--excel-text-primary)]">
                            {uploadedData.files.reduce((sum: number, file: any) => sum + file.rows, 0).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="metric-card">
                        <p className="text-sm text-[var(--excel-text-muted)] mb-1">Session ID</p>
                        <div className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-[var(--excel-orange)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                          <p className="text-sm font-mono text-[var(--excel-text-primary)]">{uploadedData.session_id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Single file uploaded (backward compatibility)
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="metric-card rows">
                      <p className="text-sm text-[var(--excel-text-muted)] mb-1">Filename</p>
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-[var(--excel-green)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-lg font-medium text-[var(--excel-text-primary)]">{uploadedData.filename}</p>
                      </div>
                    </div>
                    <div className="metric-card rows">
                      <p className="text-sm text-[var(--excel-text-muted)] mb-1">Rows</p>
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-[var(--excel-blue)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                        <p className="text-2xl font-bold text-[var(--excel-text-primary)]">{uploadedData.rows?.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="metric-card columns">
                      <p className="text-sm text-[var(--excel-text-muted)] mb-1">Columns</p>
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-[var(--excel-orange)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 4H5a2 2 0 00-2 2v12a2 2 0 002 2h4m6-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <p className="text-2xl font-bold text-[var(--excel-text-primary)]">{uploadedData.columns}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleContinue}
                    className="excel-button"
                  >
                    Continue to Data Profile
                  </button>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
