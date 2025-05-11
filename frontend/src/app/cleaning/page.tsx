'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { handleMissingValues, handleOutliers } from '@/lib/api';

export default function DataCleaningPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('missing');

  useEffect(() => {
    // Get session ID from localStorage
    const storedSessionId = typeof window !== 'undefined' ? localStorage.getItem('sessionId') : null;
    setSessionId(storedSessionId);
  }, []);

  const handleMissingValueOperation = async (operation: string, params: any) => {
    if (!sessionId) {
      setError('No session found. Please upload a file first.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const operations = {
        [operation]: params
      };
      
      const result = await handleMissingValues(sessionId, operations);
      
      setSuccess(`Successfully applied ${operation}. Removed ${result.original_rows - result.cleaned_rows} rows with missing values.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to handle missing values');
    } finally {
      setLoading(false);
    }
  };

  const handleOutlierOperation = async (operation: string, params: any) => {
    if (!sessionId) {
      setError('No session found. Please upload a file first.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const operations = {
        [operation]: params
      };
      
      const result = await handleOutliers(sessionId, operations);
      
      setSuccess(`Successfully applied ${operation}. Removed ${result.rows_removed} outliers.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to handle outliers');
    } finally {
      setLoading(false);
    }
  };

  if (!sessionId) {
    return (
      <Card>
        <div className="text-center py-8">
          <p className="text-red-500">No session found. Please upload a file first.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Data Cleaning</h1>
        <p className="mt-2 text-lg text-gray-600">
          Clean and prepare your data for analysis
        </p>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('missing')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'missing'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Missing Values
          </button>
          <button
            onClick={() => setActiveTab('outliers')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'outliers'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Outliers
          </button>
          <button
            onClick={() => setActiveTab('transform')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'transform'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Transformations
          </button>
        </nav>
      </div>

      {/* Status messages */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border-l-4 border-green-400 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === 'missing' && (
          <Card title="Handle Missing Values">
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-2">Drop Rows with Missing Values</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Remove rows that contain missing values in selected columns.
                </p>
                <div className="flex space-x-4">
                  <Button 
                    onClick={() => handleMissingValueOperation('drop_rows', { columns: [] })}
                    disabled={loading}
                  >
                    Drop All Rows with Any Missing Values
                  </Button>
                  {/* In a real implementation, you would have a column selector here */}
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-2">Fill Missing Values</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Replace missing values with calculated or specified values.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button 
                    onClick={() => handleMissingValueOperation('fill_mean', { columns: ['column1', 'column2'] })}
                    disabled={loading}
                    variant="secondary"
                  >
                    Fill with Mean
                  </Button>
                  <Button 
                    onClick={() => handleMissingValueOperation('fill_median', { columns: ['column1', 'column2'] })}
                    disabled={loading}
                    variant="secondary"
                  >
                    Fill with Median
                  </Button>
                  <Button 
                    onClick={() => handleMissingValueOperation('fill_mode', { columns: ['column1', 'column2'] })}
                    disabled={loading}
                    variant="secondary"
                  >
                    Fill with Mode
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'outliers' && (
          <Card title="Handle Outliers">
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-2">Remove Outliers</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Identify and remove outliers using different methods.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button 
                    onClick={() => handleOutlierOperation('z_score', { columns: ['column1', 'column2'], threshold: 3 })}
                    disabled={loading}
                  >
                    Z-Score Method (±3 std)
                  </Button>
                  <Button 
                    onClick={() => handleOutlierOperation('iqr', { columns: ['column1', 'column2'], factor: 1.5 })}
                    disabled={loading}
                  >
                    IQR Method (1.5 × IQR)
                  </Button>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-2">Cap Outliers</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Instead of removing outliers, cap them at specified thresholds.
                </p>
                <Button 
                  onClick={() => handleOutlierOperation('clip', { 
                    columns: ['column1', 'column2'],
                    min: null,
                    max: null
                  })}
                  disabled={loading}
                  variant="secondary"
                >
                  Cap Outliers at Percentiles
                </Button>
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'transform' && (
          <Card title="Data Transformations">
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-2">Normalize Data</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Scale numeric features to a standard range.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button disabled={loading}>Min-Max Scaling (0-1)</Button>
                  <Button disabled={loading}>Standardization (Z-score)</Button>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-2">Feature Engineering</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Create new features or transform existing ones.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button disabled={loading} variant="secondary">Log Transform</Button>
                  <Button disabled={loading} variant="secondary">One-Hot Encoding</Button>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
