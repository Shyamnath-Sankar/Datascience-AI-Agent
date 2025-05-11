// API client for communicating with the backend

const API_BASE_URL = 'http://localhost:8000/api';

// Generic fetch function with error handling
async function fetchAPI<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'An error occurred while fetching data');
  }
  
  return response.json();
}

// File upload function
export async function uploadFile(file: File, sessionId?: string): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  
  if (sessionId) {
    formData.append('session_id', sessionId);
  }
  
  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'An error occurred while uploading the file');
  }
  
  return response.json();
}

// Data profiling
export async function getDataSummary(sessionId: string): Promise<any> {
  return fetchAPI(`/profile/summary?session_id=${sessionId}`);
}

export async function getColumnProfile(sessionId: string, columnName: string): Promise<any> {
  return fetchAPI(`/profile/column/${columnName}?session_id=${sessionId}`);
}

// Data cleaning
export async function handleMissingValues(sessionId: string, operations: any): Promise<any> {
  return fetchAPI(`/cleaning/missing-values?session_id=${sessionId}`, {
    method: 'POST',
    body: JSON.stringify(operations),
  });
}

export async function handleOutliers(sessionId: string, operations: any): Promise<any> {
  return fetchAPI(`/cleaning/outliers?session_id=${sessionId}`, {
    method: 'POST',
    body: JSON.stringify(operations),
  });
}

export async function transformData(sessionId: string, operations: any): Promise<any> {
  return fetchAPI(`/cleaning/transform?session_id=${sessionId}`, {
    method: 'POST',
    body: JSON.stringify(operations),
  });
}

// Machine learning
export async function trainModel(sessionId: string, modelParams: any): Promise<any> {
  return fetchAPI(`/ml/train?session_id=${sessionId}`, {
    method: 'POST',
    body: JSON.stringify(modelParams),
  });
}

export async function predict(sessionId: string, predictionParams: any): Promise<any> {
  return fetchAPI(`/ml/predict?session_id=${sessionId}`, {
    method: 'POST',
    body: JSON.stringify(predictionParams),
  });
}

export async function listModels(sessionId: string): Promise<any> {
  return fetchAPI(`/ml/models?session_id=${sessionId}`);
}

// Data visualization
export async function generateChartData(sessionId: string, chartParams: any): Promise<any> {
  return fetchAPI(`/visualization/chart-data?session_id=${sessionId}`, {
    method: 'POST',
    body: JSON.stringify(chartParams),
  });
}

export async function getAvailableCharts(sessionId: string): Promise<any> {
  return fetchAPI(`/visualization/available-charts?session_id=${sessionId}`);
}
