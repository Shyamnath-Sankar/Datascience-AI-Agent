'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FileManager } from '@/components/data/FileManager';
import { trainModel, getDataSummary } from '@/lib/api';

export default function MachineLearningPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [dataLoading, setDataLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [modelResult, setModelResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('train');
  const [columnData, setColumnData] = useState<{
    numeric_columns: string[];
    categorical_columns: string[];
    all_columns: string[];
  }>({
    numeric_columns: [],
    categorical_columns: [],
    all_columns: []
  });
  const [modelParams, setModelParams] = useState({
    target_column: '',
    feature_columns: [] as string[],
    test_size: 0.2,
    random_state: 42
  });

  useEffect(() => {
    // Get session ID from localStorage
    const storedSessionId = typeof window !== 'undefined' ? localStorage.getItem('sessionId') : null;
    setSessionId(storedSessionId);

    if (storedSessionId) {
      fetchDataSummary(storedSessionId);
    } else {
      setDataLoading(false);
    }
  }, []);

  const fetchDataSummary = async (sid: string, fileId?: string) => {
    try {
      setDataLoading(true);
      const data = await getDataSummary(sid, fileId);

      // Extract column information
      const numericColumns = data.numeric_columns || [];
      const categoricalColumns = data.categorical_columns || [];
      const allColumns = data.column_names || [];

      setColumnData({
        numeric_columns: numericColumns,
        categorical_columns: categoricalColumns,
        all_columns: allColumns
      });

      setActiveFileId(data.file_id || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dataset information');
    } finally {
      setDataLoading(false);
    }
  };

  const handleFileSelect = (fileId: string) => {
    if (sessionId) {
      fetchDataSummary(sessionId, fileId);
      // Reset model result when switching files
      setModelResult(null);
      setError(null);
    }
  };

  const handleParamChange = (param: string, value: any) => {
    setModelParams(prev => ({
      ...prev,
      [param]: value
    }));
  };

  const handleFeatureSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const options = e.target.options;
    const selectedFeatures = [];

    for (let i = 0; i < options.length; i++) {
      if (options[i].selected) {
        selectedFeatures.push(options[i].value);
      }
    }

    handleParamChange('feature_columns', selectedFeatures);
  };

  const handleTrainModel = async (modelType: string) => {
    if (!sessionId) {
      setError('No session found. Please upload a file first.');
      return;
    }

    if (!modelParams.target_column) {
      setError('Please select a target column');
      return;
    }

    if (modelParams.feature_columns.length === 0) {
      setError('Please select at least one feature column');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const trainingParams = {
        model_type: modelType,
        target_column: modelParams.target_column,
        feature_columns: modelParams.feature_columns,
        test_size: modelParams.test_size,
        random_state: modelParams.random_state,
        hyperparameters: {}
      };

      const result = await trainModel(sessionId, trainingParams);
      setModelResult(result);

      // Switch to evaluate tab after successful training
      setActiveTab('evaluate');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to train model');
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
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg shadow-md p-6 mb-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl font-bold text-white">Machine Learning</h1>
            <p className="mt-2 text-lg text-blue-100">
              Train models and make predictions on your data
            </p>
            {activeFileId && (
              <p className="mt-1 text-xs text-blue-200">
                Working with file: {activeFileId.slice(0, 8)}...
              </p>
            )}
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm text-white flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Linear Regression
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm text-white flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              Random Forest
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm text-white flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Decision Tree
            </div>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="bg-white rounded-lg shadow-sm mb-6">
        <nav className="flex">
          <button
            onClick={() => setActiveTab('train')}
            className={`flex-1 py-4 px-4 text-center font-medium text-sm transition-colors duration-200 ${
              activeTab === 'train'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              Train Model
            </div>
          </button>
          <button
            onClick={() => setActiveTab('evaluate')}
            className={`flex-1 py-4 px-4 text-center font-medium text-sm transition-colors duration-200 ${
              activeTab === 'evaluate'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Evaluate Model
            </div>
          </button>
          <button
            onClick={() => setActiveTab('predict')}
            className={`flex-1 py-4 px-4 text-center font-medium text-sm transition-colors duration-200 ${
              activeTab === 'predict'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Make Predictions
            </div>
          </button>
        </nav>
      </div>

      {/* Loading indicator */}
      {dataLoading && (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-md shadow-sm mb-6">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === 'train' && !dataLoading && (
          <Card title="Train a Machine Learning Model">
            <div className="space-y-6">
              {/* Target and Feature Selection */}
              <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm">
                <h3 className="text-lg font-medium mb-2 text-gray-800 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Select Target and Features
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Choose the target variable to predict and the features to use for training.
                </p>
                <div className="grid grid-cols-1 gap-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Target Column</label>
                    <select
                      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-white"
                      value={modelParams.target_column}
                      onChange={(e) => handleParamChange('target_column', e.target.value)}
                    >
                      <option value="">Select a target column</option>
                      <optgroup label="Numeric Columns (Recommended)">
                        {columnData.numeric_columns.map((column) => (
                          <option key={column} value={column}>{column}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Categorical Columns">
                        {columnData.categorical_columns.map((column) => (
                          <option key={column} value={column}>{column}</option>
                        ))}
                      </optgroup>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      {modelParams.target_column ?
                        `Selected target: ${modelParams.target_column}` :
                        'Select the column you want to predict'}
                    </p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Feature Columns</label>
                    <select
                      multiple
                      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-white h-32"
                      value={modelParams.feature_columns}
                      onChange={handleFeatureSelection}
                    >
                      <optgroup label="Numeric Columns">
                        {columnData.numeric_columns
                          .filter(col => col !== modelParams.target_column)
                          .map((column) => (
                            <option key={column} value={column}>{column}</option>
                          ))
                        }
                      </optgroup>
                      <optgroup label="Categorical Columns">
                        {columnData.categorical_columns
                          .filter(col => col !== modelParams.target_column)
                          .map((column) => (
                            <option key={column} value={column}>{column}</option>
                          ))
                        }
                      </optgroup>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Hold Ctrl/Cmd to select multiple features.
                      {modelParams.feature_columns.length > 0 &&
                        ` Selected ${modelParams.feature_columns.length} features.`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Model Selection */}
              <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm">
                <h3 className="text-lg font-medium mb-2 text-gray-800 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Select Model Type
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Choose the type of machine learning model to train.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    onClick={() => handleTrainModel('linear_regression')}
                    disabled={loading || !modelParams.target_column || modelParams.feature_columns.length === 0}
                    className="flex items-center justify-center"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Training...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        Linear Regression
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => handleTrainModel('random_forest')}
                    disabled={loading || !modelParams.target_column || modelParams.feature_columns.length === 0}
                    className="flex items-center justify-center"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Training...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                        </svg>
                        Random Forest
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => handleTrainModel('decision_tree')}
                    disabled={loading || !modelParams.target_column || modelParams.feature_columns.length === 0}
                    className="flex items-center justify-center"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Training...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Decision Tree
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Advanced Options */}
              <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm">
                <h3 className="text-lg font-medium mb-2 text-gray-800 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Advanced Options
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Configure additional training parameters.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Test Size</label>
                    <div className="flex items-center">
                      <input
                        type="range"
                        min="0.1"
                        max="0.5"
                        step="0.05"
                        value={modelParams.test_size}
                        onChange={(e) => handleParamChange('test_size', parseFloat(e.target.value))}
                        className="mt-1 block w-full"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700 w-12">
                        {(modelParams.test_size * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">Percentage of data to use for testing</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Random State</label>
                    <input
                      type="number"
                      value={modelParams.random_state}
                      onChange={(e) => handleParamChange('random_state', parseInt(e.target.value))}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-white"
                    />
                    <p className="mt-1 text-xs text-gray-500">For reproducible results</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'evaluate' && (
          <Card title="Model Evaluation">
            {modelResult ? (
              <div className="space-y-6">
                <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm">
                  <h3 className="text-lg font-medium mb-4 text-gray-800 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Model Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                      <p className="text-sm font-medium text-blue-700 mb-1">Model Type</p>
                      <p className="text-lg font-semibold text-gray-800 flex items-center">
                        {modelResult.model_type === 'linear_regression' && (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                        )}
                        {modelResult.model_type === 'random_forest' && (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                          </svg>
                        )}
                        {modelResult.model_type === 'decision_tree' && (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        )}
                        {modelResult.model_type.split('_').map((word: string) =>
                          word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(' ')}
                      </p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                      <p className="text-sm font-medium text-purple-700 mb-1">Target Column</p>
                      <p className="text-lg font-semibold text-gray-800 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        {modelResult.target_column}
                      </p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                      <p className="text-sm font-medium text-green-700 mb-1">Features</p>
                      <p className="text-lg font-semibold text-gray-800 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                        </svg>
                        {modelResult.feature_columns?.length} features
                      </p>
                      <div className="mt-2 text-xs text-gray-500 max-h-20 overflow-y-auto">
                        {modelResult.feature_columns?.join(', ')}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm">
                  <h3 className="text-lg font-medium mb-4 text-gray-800 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Performance Metrics
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
                    {modelResult.metrics && Object.entries(modelResult.metrics).map(([key, value]: [string, any]) => {
                      // Determine color based on metric type
                      let bgColor = 'bg-blue-50';
                      let borderColor = 'border-blue-100';
                      let textColor = 'text-blue-700';

                      if (key.includes('r2')) {
                        bgColor = 'bg-green-50';
                        borderColor = 'border-green-100';
                        textColor = 'text-green-700';
                      } else if (key.includes('error') || key.includes('mse') || key.includes('rmse')) {
                        bgColor = 'bg-red-50';
                        borderColor = 'border-red-100';
                        textColor = 'text-red-700';
                      } else if (key.includes('accuracy')) {
                        bgColor = 'bg-indigo-50';
                        borderColor = 'border-indigo-100';
                        textColor = 'text-indigo-700';
                      }

                      return (
                        <div key={key} className={`${bgColor} p-4 rounded-lg border ${borderColor}`}>
                          <p className={`text-sm font-medium ${textColor} mb-1`}>
                            {key.toUpperCase()}
                          </p>
                          <p className="text-2xl font-bold text-gray-800">
                            {typeof value === 'number' ? value.toFixed(4) : value}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {key.includes('r2') && 'Coefficient of determination (higher is better)'}
                            {key.includes('mse') && 'Mean Squared Error (lower is better)'}
                            {key.includes('rmse') && 'Root Mean Squared Error (lower is better)'}
                            {key.includes('accuracy') && 'Prediction accuracy (higher is better)'}
                            {key.includes('precision') && 'Precision score (higher is better)'}
                            {key.includes('recall') && 'Recall score (higher is better)'}
                            {key.includes('f1') && 'F1 score (higher is better)'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {modelResult.feature_importance && (
                  <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm">
                    <h3 className="text-lg font-medium mb-4 text-gray-800 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                      </svg>
                      Feature Importance
                    </h3>
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div className="space-y-2">
                        {Object.entries(modelResult.feature_importance)
                          .sort((a, b) => (b[1] as number) - (a[1] as number))
                          .map(([feature, importance]: [string, any]) => {
                            const percent = Math.abs(importance) * 100;
                            return (
                              <div key={feature} className="flex items-center">
                                <div className="w-1/4 text-sm font-medium text-gray-700 truncate pr-2">
                                  {feature}
                                </div>
                                <div className="w-3/4">
                                  <div className="relative h-4 w-full bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className={`absolute top-0 left-0 h-full ${importance >= 0 ? 'bg-blue-500' : 'bg-red-500'}`}
                                      style={{ width: `${Math.min(percent, 100)}%` }}
                                    ></div>
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1 text-right">
                                    {importance.toFixed(4)} ({percent.toFixed(2)}%)
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        }
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <p className="text-gray-500 mb-2">No model has been trained yet.</p>
                <button
                  onClick={() => setActiveTab('train')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  Train a Model
                </button>
              </div>
            )}
          </Card>
        )}

        {activeTab === 'predict' && (
          <Card title="Make Predictions">
            {modelResult ? (
              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-2">Prediction Settings</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Configure prediction parameters.
                  </p>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Model</label>
                      <select className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                        <option value={modelResult.model_id}>{modelResult.model_type} - {modelResult.target_column}</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button>Generate Predictions</Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No model has been trained yet. Train a model first.</p>
              </div>
            )}
          </Card>
        )}
        </div>
      </div>
    </div>
  );
}
