import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '../ui/Button';
import { uploadFile } from '@/lib/api';

interface FileUploadProps {
  onUploadSuccess: (data: any) => void;
  sessionId?: string;
}

export function FileUpload({ onUploadSuccess, sessionId }: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...acceptedFiles]);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    multiple: true  // Enable multiple file uploads
  });

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one file');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const uploadResults = [];
      let currentSessionId = sessionId;

      for (const file of selectedFiles) {
        const data = await uploadFile(file, currentSessionId);
        uploadResults.push(data);
        // Use the session ID from the first upload for subsequent uploads
        if (!currentSessionId) {
          currentSessionId = data.session_id;
        }
      }

      // Call success handler with the results
      onUploadSuccess({
        session_id: currentSessionId,
        files: uploadResults,
        message: `Successfully uploaded ${uploadResults.length} file(s)`
      });
      setSelectedFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during upload');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center space-y-3">
          <svg
            className="w-12 h-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-lg font-medium text-gray-700">
            {isDragActive ? 'Drop the files here' : 'Drag & drop CSV or Excel files here'}
          </p>
          <p className="text-sm text-gray-500">or click to browse files (multiple files supported)</p>
        </div>
      </div>

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Selected Files:</h4>
          <div className="space-y-2">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm text-gray-700">{file.name}</span>
                  <span className="text-xs text-gray-500 ml-2">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="text-red-500 hover:text-red-700 p-1"
                  disabled={isUploading}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex justify-center">
        <Button
          onClick={handleUpload}
          disabled={selectedFiles.length === 0 || isUploading}
          className="w-full sm:w-auto"
        >
          {isUploading ? `Uploading ${selectedFiles.length} file(s)...` : `Upload ${selectedFiles.length} File(s)`}
        </Button>
      </div>
    </div>
  );
}
