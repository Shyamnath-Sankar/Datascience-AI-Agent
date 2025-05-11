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
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Data Science Platform</h1>
        <p className="mt-2 text-lg text-gray-600">
          Upload your data to begin analysis, visualization, and machine learning
        </p>
      </div>

      <Card title="Upload Your Data">
        <FileUpload onUploadSuccess={handleUploadSuccess} />
      </Card>

      {uploadedData && (
        <>
          <Card title="Data Preview">
            <div className="mb-4">
              <p className="text-sm text-gray-500">
                Filename: <span className="font-medium">{uploadedData.filename}</span>
              </p>
              <p className="text-sm text-gray-500">
                Rows: <span className="font-medium">{uploadedData.rows}</span>,
                Columns: <span className="font-medium">{uploadedData.columns}</span>
              </p>
            </div>

            {uploadedData.preview && uploadedData.preview.length > 0 && (
              <DataTable
                data={uploadedData.preview}
                columns={uploadedData.column_names}
              />
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleContinue}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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
