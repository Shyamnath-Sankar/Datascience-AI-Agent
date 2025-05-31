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

// File management
export async function listFiles(sessionId: string): Promise<any> {
  return fetchAPI(`/upload/files?session_id=${sessionId}`);
}

export async function selectActiveFile(sessionId: string, fileId: string): Promise<any> {
  const formData = new FormData();
  formData.append('session_id', sessionId);
  formData.append('file_id', fileId);

  const response = await fetch(`${API_BASE_URL}/upload/files/select`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to select file');
  }

  return response.json();
}

export async function deleteFile(sessionId: string, fileId: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/upload/files/${fileId}?session_id=${sessionId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete file');
  }

  return response.json();
}

// Data profiling
export async function getDataSummary(sessionId: string, fileId?: string): Promise<any> {
  const params = new URLSearchParams({ session_id: sessionId });
  if (fileId) {
    params.append('file_id', fileId);
  }
  return fetchAPI(`/profile/summary?${params.toString()}`);
}

export async function getColumnProfile(sessionId: string, columnName: string, fileId?: string): Promise<any> {
  const params = new URLSearchParams({ session_id: sessionId });
  if (fileId) {
    params.append('file_id', fileId);
  }
  return fetchAPI(`/profile/column/${columnName}?${params.toString()}`);
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

// AI Agent
export async function chatWithAgent(sessionId: string, message: string, fileId?: string, autoExecute: boolean = true): Promise<any> {
  return fetchAPI(`/agent/chat?session_id=${sessionId}`, {
    method: 'POST',
    body: JSON.stringify({ message, file_id: fileId, auto_execute: autoExecute }),
  });
}

export async function executeCode(sessionId: string, code: string, fileId?: string, autoInstall: boolean = true): Promise<any> {
  return fetchAPI(`/agent/execute-code?session_id=${sessionId}`, {
    method: 'POST',
    body: JSON.stringify({ code, file_id: fileId, auto_install: autoInstall }),
  });
}

export async function installPackage(packageName: string): Promise<any> {
  return fetchAPI(`/agent/install-package`, {
    method: 'POST',
    body: JSON.stringify({ package_name: packageName }),
  });
}

export async function generateInsights(sessionId: string, fileId?: string): Promise<any> {
  return fetchAPI(`/agent/generate-insights?session_id=${sessionId}`, {
    method: 'POST',
    body: JSON.stringify({ file_id: fileId }),
  });
}

export async function getChatHistory(sessionId: string): Promise<any> {
  return fetchAPI(`/agent/chat-history?session_id=${sessionId}`);
}

export async function clearChatHistory(sessionId: string): Promise<any> {
  return fetchAPI(`/agent/clear-chat?session_id=${sessionId}`, {
    method: 'DELETE',
  });
}

export async function getAvailableData(sessionId: string): Promise<any> {
  return fetchAPI(`/agent/available-data?session_id=${sessionId}`);
}

// Specialized Agents
export async function createVisualization(sessionId: string, request: string, fileId?: string, autoExecute: boolean = true): Promise<any> {
  return fetchAPI(`/agents/visualization?session_id=${sessionId}`, {
    method: 'POST',
    body: JSON.stringify({ request, file_id: fileId, auto_execute: autoExecute }),
  });
}

export async function generateCodeWithAgent(sessionId: string, request: string, fileId?: string, autoExecute: boolean = true): Promise<any> {
  return fetchAPI(`/agents/code-generation?session_id=${sessionId}`, {
    method: 'POST',
    body: JSON.stringify({ request, file_id: fileId, auto_execute: autoExecute }),
  });
}

export async function getPackageRecommendations(request: string): Promise<any> {
  return fetchAPI(`/agents/package-recommendations`, {
    method: 'POST',
    body: JSON.stringify({ request }),
  });
}

export async function generateInsightsWithAgent(sessionId: string, fileId?: string, focusArea: string = 'general', autoExecute: boolean = true): Promise<any> {
  return fetchAPI(`/agents/insights?session_id=${sessionId}`, {
    method: 'POST',
    body: JSON.stringify({ file_id: fileId, focus_area: focusArea, auto_execute: autoExecute }),
  });
}

export async function listAvailableAgents(): Promise<any> {
  return fetchAPI(`/agents/list`);
}

export async function selectBestAgent(request: string): Promise<any> {
  return fetchAPI(`/agents/agent-selector`, {
    method: 'POST',
    body: JSON.stringify({ request }),
  });
}

// Data Editor
export async function getDataForEditing(
  sessionId: string,
  fileId?: string,
  page: number = 1,
  pageSize: number = 100
): Promise<any> {
  const params = new URLSearchParams({
    session_id: sessionId,
    page: page.toString(),
    page_size: pageSize.toString()
  });
  if (fileId) {
    params.append('file_id', fileId);
  }
  return fetchAPI(`/editor/data?${params.toString()}`);
}

export async function updateCell(
  sessionId: string,
  rowIndex: number,
  column: string,
  value: any,
  fileId?: string
): Promise<any> {
  return fetchAPI(`/editor/cell?session_id=${sessionId}`, {
    method: 'PUT',
    body: JSON.stringify({
      file_id: fileId,
      row_index: rowIndex,
      column: column,
      value: value
    }),
  });
}

export async function addRow(
  sessionId: string,
  data: Record<string, any>,
  position: string | number = 'end',
  fileId?: string
): Promise<any> {
  return fetchAPI(`/editor/row?session_id=${sessionId}`, {
    method: 'POST',
    body: JSON.stringify({
      file_id: fileId,
      data: data,
      position: position
    }),
  });
}

export async function deleteRow(
  sessionId: string,
  rowIndex: number,
  fileId?: string
): Promise<any> {
  const params = new URLSearchParams({ session_id: sessionId });
  if (fileId) {
    params.append('file_id', fileId);
  }
  return fetchAPI(`/editor/row/${rowIndex}?${params.toString()}`, {
    method: 'DELETE',
  });
}

export async function addColumn(
  sessionId: string,
  columnName: string,
  dataType: string = 'string',
  defaultValue?: any,
  position: string | number = 'end',
  fileId?: string
): Promise<any> {
  return fetchAPI(`/editor/column?session_id=${sessionId}`, {
    method: 'POST',
    body: JSON.stringify({
      file_id: fileId,
      column_name: columnName,
      data_type: dataType,
      default_value: defaultValue,
      position: position
    }),
  });
}

export async function deleteColumn(
  sessionId: string,
  columnName: string,
  fileId?: string
): Promise<any> {
  const params = new URLSearchParams({ session_id: sessionId });
  if (fileId) {
    params.append('file_id', fileId);
  }
  return fetchAPI(`/editor/column/${columnName}?${params.toString()}`, {
    method: 'DELETE',
  });
}
