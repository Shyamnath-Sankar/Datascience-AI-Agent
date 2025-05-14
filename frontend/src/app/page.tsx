'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { FileUpload } from '@/components/data/FileUpload';
import { DataTable } from '@/components/data/DataTable';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [uploadedData, setUploadedData] = useState<any>(null);
  const router = useRouter();

  const handleUploadSuccess = (data: any) => {
    setUploadedData(data);
    // Store session ID in localStorage for use across pages
    if (data.session_id && typeof window !== 'undefined') {
      localStorage.setItem('sessionId', data.session_id);
    }
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
          <Card title="Data Preview">
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
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-[var(--excel-green)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-2xl font-bold text-[var(--excel-text-primary)]">{uploadedData.rows}</p>
                </div>
              </div>

              <div className="metric-card columns">
                <p className="text-sm text-[var(--excel-text-muted)] mb-1">Columns</p>
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-[var(--excel-blue)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  <p className="text-2xl font-bold text-[var(--excel-text-primary)]">{uploadedData.columns}</p>
                </div>
              </div>
            </div>

            {uploadedData.preview && uploadedData.preview.length > 0 && (
              <div className="mt-4">
                <h3 className="text-lg font-medium mb-4 text-[var(--excel-green)]">Data Sample</h3>
                <DataTable
                  data={uploadedData.preview}
                  columns={uploadedData.column_names}
                />
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
        </>
      )}
    </div>
  );
}
