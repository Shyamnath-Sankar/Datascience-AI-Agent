'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/data/DataTable';
import { FileManager } from '@/components/data/FileManager';
import { getDataSummary } from '@/lib/api';

export default function DataProfilePage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');

  useEffect(() => {
    // Get session ID from localStorage
    const storedSessionId = typeof window !== 'undefined' ? localStorage.getItem('sessionId') : null;
    setSessionId(storedSessionId);

    if (storedSessionId) {
      fetchProfileData(storedSessionId);
    } else {
      setLoading(false);
      setError('No session found. Please upload a file first.');
    }
  }, []);

  const fetchProfileData = async (sid: string, fileId?: string) => {
    try {
      setLoading(true);
      const data = await getDataSummary(sid, fileId);
      setProfileData(data);
      setActiveFileId(data.file_id || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data profile');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (fileId: string) => {
    if (sessionId) {
      fetchProfileData(sessionId, fileId);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--excel-green)]"></div>
          <p className="mt-4 text-[var(--excel-text-muted)]">Loading data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="text-center py-8">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-red-600 font-medium mb-2">Error Loading Data</p>
          <p className="text-[var(--excel-text-muted)]">{error}</p>
        </div>
      </Card>
    );
  }

  if (!profileData) {
    return (
      <Card>
        <div className="text-center py-8">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-[var(--excel-text-muted)] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          <p className="text-[var(--excel-text-primary)] font-medium mb-2">No Data Available</p>
          <p className="text-[var(--excel-text-muted)]">Please upload a file first to see data profiling.</p>
          <button
            onClick={() => window.location.href = '/'}
            className="mt-4 excel-button"
          >
            Go to Upload Page
          </button>
        </div>
      </Card>
    );
  }

  return (
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
      <div className="lg:col-span-3 space-y-6">
        <div className="excel-card p-6 mb-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-2xl font-bold text-[var(--excel-green)]">Data Profile</h1>
            <p className="mt-2 text-[var(--excel-text-muted)]">
              Explore and understand your dataset
            </p>
            {profileData?.file_id && (
              <p className="mt-1 text-xs text-[var(--excel-text-muted)]">
                Analyzing file: {profileData.file_id.slice(0, 8)}...
              </p>
            )}

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="metric-card rows">
              <p className="text-sm text-[var(--excel-text-muted)] mb-1">Rows</p>
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-[var(--excel-green)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-2xl font-bold text-[var(--excel-text-primary)]">{profileData.rows}</p>
              </div>
            </div>

            <div className="metric-card columns">
              <p className="text-sm text-[var(--excel-text-muted)] mb-1">Columns</p>
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-[var(--excel-blue)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                <p className="text-2xl font-bold text-[var(--excel-text-primary)]">{profileData.columns}</p>
              </div>
            </div>

            <div className="metric-card types">
              <p className="text-sm text-[var(--excel-text-muted)] mb-1">Data Types</p>
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                <p className="text-2xl font-bold text-[var(--excel-text-primary)]">
                  {profileData.numeric_columns?.length || 0} / {profileData.categorical_columns?.length || 0}
                </p>
              </div>
              <p className="text-xs text-[var(--excel-text-muted)] mt-1">Numeric / Categorical</p>
            </div>
          </div>
        </div>
      </div>

      {/* Excel-inspired tab navigation */}
      <div className="excel-tabs mb-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`excel-tab ${activeTab === 'overview' ? 'active' : ''}`}
          title="View dataset overview"
        >
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Overview
          </div>
        </button>
        <button
          onClick={() => setActiveTab('statistics')}
          className={`excel-tab ${activeTab === 'statistics' ? 'active' : ''}`}
          title="View statistical summary of numeric columns"
        >
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Statistics
          </div>
        </button>
        <button
          onClick={() => setActiveTab('missing')}
          className={`excel-tab ${activeTab === 'missing' ? 'active' : ''}`}
          title="Analyze missing values in your dataset"
        >
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            Missing Values
          </div>
        </button>
        <button
          onClick={() => setActiveTab('correlation')}
          className={`excel-tab ${activeTab === 'correlation' ? 'active' : ''}`}
          title="View correlation matrix between numeric variables"
        >
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            Correlation
          </div>
        </button>
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <Card title="Dataset Overview">
            <h3 className="text-lg font-medium mb-4 text-[var(--excel-green)]">Column Information</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-medium text-[var(--excel-text-primary)] uppercase tracking-wider">Column Name</th>
                    <th className="text-left text-xs font-medium text-[var(--excel-text-primary)] uppercase tracking-wider">Type</th>
                    <th className="text-left text-xs font-medium text-[var(--excel-text-primary)] uppercase tracking-wider">Missing Values</th>
                    <th className="text-left text-xs font-medium text-[var(--excel-text-primary)] uppercase tracking-wider">Missing %</th>
                  </tr>
                </thead>
                <tbody>
                  {profileData.column_names?.map((column: string, index: number) => {
                    const missingPercentage = profileData.missing_percentage?.[column] || 0;
                    const hasMissingValues = missingPercentage > 0;

                    return (
                      <tr key={index}>
                        <td className="whitespace-nowrap text-sm font-medium text-[var(--excel-text-primary)]">{column}</td>
                        <td className="whitespace-nowrap text-sm text-[var(--excel-text-muted)]">
                          {profileData.dtypes?.[column]}
                        </td>
                        <td className="whitespace-nowrap text-sm text-[var(--excel-text-muted)]">
                          {profileData.missing_values?.[column] || 0}
                        </td>
                        <td className={`whitespace-nowrap text-sm ${hasMissingValues ? 'text-red-600 font-medium' : 'text-[var(--excel-text-muted)]'}`}>
                          {missingPercentage ? missingPercentage.toFixed(2) + '%' : '0%'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-sm text-[var(--excel-text-muted)]">
              <p>Tip: Click on column headers to sort the data (in a real implementation)</p>
            </div>
          </Card>
        )}

        {activeTab === 'statistics' && (
          <Card title="Statistical Summary">
            {profileData.numeric_statistics && (
              <>
                <h3 className="text-lg font-medium mb-4 text-[var(--excel-blue)]">Numeric Column Statistics</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr>
                        <th className="text-left text-xs font-medium text-[var(--excel-text-primary)] uppercase tracking-wider">Column</th>
                        <th className="text-left text-xs font-medium text-[var(--excel-text-primary)] uppercase tracking-wider">Mean</th>
                        <th className="text-left text-xs font-medium text-[var(--excel-text-primary)] uppercase tracking-wider">Median</th>
                        <th className="text-left text-xs font-medium text-[var(--excel-text-primary)] uppercase tracking-wider">Min</th>
                        <th className="text-left text-xs font-medium text-[var(--excel-text-primary)] uppercase tracking-wider">Max</th>
                        <th className="text-left text-xs font-medium text-[var(--excel-text-primary)] uppercase tracking-wider">Std Dev</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profileData.numeric_columns?.map((column: string) => {
                        const stats = profileData.numeric_statistics[column];
                        return stats ? (
                          <tr key={column}>
                            <td className="whitespace-nowrap text-sm font-medium text-[var(--excel-text-primary)]">{column}</td>
                            <td className="whitespace-nowrap text-sm text-[var(--excel-text-muted)]">{stats.mean?.toFixed(2)}</td>
                            <td className="whitespace-nowrap text-sm text-[var(--excel-text-muted)]">{stats['50%']?.toFixed(2)}</td>
                            <td className="whitespace-nowrap text-sm text-[var(--excel-text-muted)]">{stats.min?.toFixed(2)}</td>
                            <td className="whitespace-nowrap text-sm text-[var(--excel-text-muted)]">{stats.max?.toFixed(2)}</td>
                            <td className="whitespace-nowrap text-sm text-[var(--excel-text-muted)]">{stats.std?.toFixed(2)}</td>
                          </tr>
                        ) : null;
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 p-4 bg-[rgba(0,120,212,0.05)] border-l-4 border-[var(--excel-blue)] rounded">
                  <h4 className="text-sm font-medium text-[var(--excel-blue)] mb-1">Excel-like Functions</h4>
                  <p className="text-sm text-[var(--excel-text-muted)]">
                    These statistics are similar to Excel's AVERAGE(), MEDIAN(), MIN(), MAX(), and STDEV() functions.
                  </p>
                </div>
              </>
            )}
          </Card>
        )}

        {activeTab === 'missing' && (
          <Card title="Missing Values Analysis">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium mb-4 text-[var(--excel-green)]">Missing Values by Column</h3>
                <div className="h-64 excel-card p-4 flex items-center justify-center">
                  {/* This would be a bar chart in a real implementation */}
                  <div className="text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-[var(--excel-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="mt-2 text-[var(--excel-text-muted)]">Excel-style bar chart visualization</p>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-4 text-[var(--excel-green)]">Missing Values Table</h3>
                <div className="overflow-y-auto h-64 excel-card p-0">
                  <table className="min-w-full">
                    <thead>
                      <tr>
                        <th className="text-left text-xs font-medium text-[var(--excel-text-primary)] uppercase tracking-wider">Column</th>
                        <th className="text-left text-xs font-medium text-[var(--excel-text-primary)] uppercase tracking-wider">Missing Count</th>
                        <th className="text-left text-xs font-medium text-[var(--excel-text-primary)] uppercase tracking-wider">Missing %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profileData.column_names?.map((column: string) => {
                        const missingPercentage = profileData.missing_percentage?.[column] || 0;
                        const hasMissingValues = missingPercentage > 0;

                        return (
                          <tr key={column}>
                            <td className="whitespace-nowrap text-sm font-medium text-[var(--excel-text-primary)]">{column}</td>
                            <td className="whitespace-nowrap text-sm text-[var(--excel-text-muted)]">
                              {profileData.missing_values?.[column] || 0}
                            </td>
                            <td className={`whitespace-nowrap text-sm ${hasMissingValues ? 'text-red-600 font-medium' : 'text-[var(--excel-text-muted)]'}`}>
                              {missingPercentage ? missingPercentage.toFixed(2) + '%' : '0%'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-[rgba(33,115,70,0.05)] border-l-4 border-[var(--excel-green)] rounded">
              <h4 className="text-sm font-medium text-[var(--excel-green)] mb-1">Excel Data Cleaning Tip</h4>
              <p className="text-sm text-[var(--excel-text-muted)]">
                In Excel, you can use COUNTBLANK() to count missing values and conditional formatting to highlight them.
              </p>
            </div>
          </Card>
        )}

        {activeTab === 'correlation' && (
          <Card title="Correlation Analysis">
            <h3 className="text-lg font-medium mb-4 text-[var(--excel-blue)]">Correlation Matrix</h3>
            <div className="h-96 excel-card p-4 flex items-center justify-center mb-4">
              {/* This would be a heatmap in a real implementation */}
              <div className="text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-[var(--excel-blue)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                <p className="mt-2 text-[var(--excel-text-muted)]">Excel-style heatmap visualization</p>
                <p className="mt-1 text-xs text-[var(--excel-text-muted)]">Colors range from red (negative correlation) to green (positive correlation)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
              <div className="p-4 bg-[rgba(33,115,70,0.1)] rounded border border-[var(--excel-border)]">
                <h4 className="text-sm font-medium text-[var(--excel-green)] mb-2">Positive Correlation</h4>
                <p className="text-sm text-[var(--excel-text-muted)]">
                  Values close to 1 indicate a strong positive correlation.
                  As one variable increases, the other tends to increase as well.
                </p>
              </div>

              <div className="p-4 bg-[rgba(255,0,0,0.1)] rounded border border-[var(--excel-border)]">
                <h4 className="text-sm font-medium text-red-600 mb-2">Negative Correlation</h4>
                <p className="text-sm text-[var(--excel-text-muted)]">
                  Values close to -1 indicate a strong negative correlation.
                  As one variable increases, the other tends to decrease.
                </p>
              </div>
            </div>

            <div className="p-4 bg-[rgba(0,120,212,0.05)] border-l-4 border-[var(--excel-blue)] rounded">
              <h4 className="text-sm font-medium text-[var(--excel-blue)] mb-1">Excel Data Analysis Tip</h4>
              <p className="text-sm text-[var(--excel-text-muted)]">
                In Excel, you can use the CORREL() function to calculate correlation between two data ranges,
                or use the Data Analysis ToolPak to create a complete correlation matrix.
              </p>
            </div>
          </Card>
        )}
        </div>
      </div>
    </div>
  );
}
