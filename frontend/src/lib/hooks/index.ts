'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDataScienceStore } from '@/lib/stores';
import type {
  Message,
  AgentType,
  ExecutionResult,
  AgentResponse,
  ChatRequest,
  DatabaseConnection,
  DataFile,
  StreamingMessage,
  StreamingOptions,
} from '@/lib/types';

// =============================================================================
// API BASE
// =============================================================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || 'API request failed');
  }

  return response.json();
}

// =============================================================================
// useChat HOOK
// =============================================================================

interface UseChatOptions {
  sessionId: string | null;
  onError?: (error: Error) => void;
  autoExecute?: boolean;
}

interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string, options?: Partial<ChatRequest>) => Promise<void>;
  clearMessages: () => void;
  regenerateLastMessage: () => Promise<void>;
}

export function useChat({ sessionId, onError, autoExecute = true }: UseChatOptions): UseChatReturn {
  const {
    messages,
    addMessage,
    updateMessage,
    clearMessages: clearStoreMessages,
    setMessages,
    isLoading,
    setLoading,
    error,
    setError,
    activeFileId,
    activeConnectionId,
    selectedAgent,
    setCanvasCode,
    setExecutionResult,
  } = useDataScienceStore();

  // Load chat history on mount
  useEffect(() => {
    if (sessionId) {
      fetchAPI<{ success: boolean; history: any[] }>(`/agent/chat-history?session_id=${sessionId}`)
        .then((response) => {
          if (response.success && response.history) {
            const formattedMessages: Message[] = response.history.map((msg, i) => ({
              id: `history-${i}`,
              role: msg.role === 'user' ? 'user' : 'assistant',
              content: msg.content,
              timestamp: new Date(),
              codeBlocks: msg.code_blocks || [],
            }));
            setMessages(formattedMessages);
          }
        })
        .catch((err) => console.error('Failed to load chat history:', err));
    }
  }, [sessionId, setMessages]);

  const sendMessage = useCallback(async (content: string, options?: Partial<ChatRequest>) => {
    if (!sessionId || !content.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };
    addMessage(userMessage);
    setLoading(true);
    setError(null);

    try {
      let response: AgentResponse;

      if (activeConnectionId) {
        // Database query
        response = await fetchAPI<AgentResponse>(`/agent/chat?session_id=${sessionId}`, {
          method: 'POST',
          body: JSON.stringify({
            message: content,
            connection_id: activeConnectionId,
            auto_execute: autoExecute,
          }),
        });
      } else {
        // File-based query
        const endpoint = options?.agent 
          ? `/agents/${options.agent}?session_id=${sessionId}`
          : `/agent/chat?session_id=${sessionId}`;

        response = await fetchAPI<AgentResponse>(endpoint, {
          method: 'POST',
          body: JSON.stringify({
            message: content,
            request: content,
            file_id: activeFileId || undefined,
            auto_execute: autoExecute,
            ...options,
          }),
        });
      }

      // Add assistant message
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        codeBlocks: response.codeBlocks?.map((block, i) => ({
          id: `code-${Date.now()}-${i}`,
          language: block.language || 'python',
          code: block.code,
          isExecutable: true,
        })),
        executionResult: response.executionResult,
        metadata: {
          agentUsed: (response.agent as AgentType) || selectedAgent || undefined,
          reasoningTrace: response.reasoningTrace,
        },
      };
      addMessage(assistantMessage);

      // Update canvas if code was executed
      if (response.executedCode) {
        setCanvasCode(response.executedCode);
      }
      if (response.executionResult) {
        setExecutionResult(response.executionResult);
      }

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error.message);
      onError?.(error);

      // Add error message
      addMessage({
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message}`,
        timestamp: new Date(),
      });
    } finally {
      setLoading(false);
    }
  }, [sessionId, activeFileId, activeConnectionId, autoExecute, selectedAgent, addMessage, setLoading, setError, setCanvasCode, setExecutionResult, onError]);

  const clearMessages = useCallback(async () => {
    if (sessionId) {
      try {
        await fetchAPI(`/agent/clear-chat?session_id=${sessionId}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Failed to clear chat history:', err);
      }
    }
    clearStoreMessages();
  }, [sessionId, clearStoreMessages]);

  const regenerateLastMessage = useCallback(async () => {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMessage) {
      // Remove the last assistant message
      const newMessages = messages.slice(0, -1);
      setMessages(newMessages);
      // Resend the user message
      await sendMessage(lastUserMessage.content);
    }
  }, [messages, setMessages, sendMessage]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    regenerateLastMessage,
  };
}

// =============================================================================
// useCodeExecution HOOK
// =============================================================================

interface UseCodeExecutionOptions {
  sessionId: string | null;
  fileId?: string | null;
  autoInstall?: boolean;
  onSuccess?: (result: ExecutionResult) => void;
  onError?: (error: Error) => void;
}

interface UseCodeExecutionReturn {
  execute: (code: string) => Promise<ExecutionResult | null>;
  isExecuting: boolean;
  result: ExecutionResult | null;
  error: string | null;
  installPackage: (packageName: string) => Promise<boolean>;
}

export function useCodeExecution({
  sessionId,
  fileId,
  autoInstall = true,
  onSuccess,
  onError,
}: UseCodeExecutionOptions): UseCodeExecutionReturn {
  const {
    isExecuting,
    setExecuting,
    setExecutionResult,
    addToHistory,
    canvas,
  } = useDataScienceStore();

  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (code: string): Promise<ExecutionResult | null> => {
    if (!sessionId || !code.trim()) return null;

    setExecuting(true);
    setError(null);

    try {
      const response = await fetchAPI<ExecutionResult>(`/agent/execute-code?session_id=${sessionId}`, {
        method: 'POST',
        body: JSON.stringify({
          code,
          file_id: fileId || undefined,
          auto_install: autoInstall,
        }),
      });

      setExecutionResult(response);
      addToHistory({ code, result: response });
      onSuccess?.(response);

      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Execution failed');
      setError(error.message);
      onError?.(error);

      const errorResult: ExecutionResult = {
        success: false,
        output: '',
        error: error.message,
        plots: [],
        variables: {},
        executionTimeMs: 0,
      };
      setExecutionResult(errorResult);

      return errorResult;
    } finally {
      setExecuting(false);
    }
  }, [sessionId, fileId, autoInstall, setExecuting, setExecutionResult, addToHistory, onSuccess, onError]);

  const installPackage = useCallback(async (packageName: string): Promise<boolean> => {
    try {
      const response = await fetchAPI<{ success: boolean }>('/agent/install-package', {
        method: 'POST',
        body: JSON.stringify({ package_name: packageName }),
      });
      return response.success;
    } catch {
      return false;
    }
  }, []);

  return {
    execute,
    isExecuting,
    result: canvas.executionResult ?? null,
    error,
    installPackage,
  };
}

// =============================================================================
// useDatabase HOOK
// =============================================================================

interface UseDatabaseOptions {
  sessionId: string | null;
}

interface UseDatabaseReturn {
  connections: DatabaseConnection[];
  activeConnection: DatabaseConnection | null;
  isConnecting: boolean;
  connect: (params: any) => Promise<DatabaseConnection | null>;
  disconnect: (connectionId: string) => Promise<void>;
  setActive: (connectionId: string) => void;
  query: (sql: string) => Promise<any>;
  askQuestion: (question: string) => Promise<any>;
  getSchema: (connectionId: string) => Promise<any>;
  trainFromSchema: (connectionId: string) => Promise<void>;
}

export function useDatabase({ sessionId }: UseDatabaseOptions): UseDatabaseReturn {
  const {
    connections,
    activeConnectionId,
    addConnection,
    removeConnection,
    setActiveConnection,
    updateConnectionStatus,
  } = useDataScienceStore();

  const [isConnecting, setIsConnecting] = useState(false);

  const activeConnection = connections.find(c => c.id === activeConnectionId) || null;

  // Load existing connections on mount
  useEffect(() => {
    fetchAPI<{ connections: DatabaseConnection[] }>('/database/connections')
      .then((response) => {
        response.connections?.forEach((conn) => {
          if (!connections.find(c => c.id === conn.id)) {
            addConnection(conn);
          }
        });
      })
      .catch((err) => console.error('Failed to load connections:', err));
  }, []);

  const connect = useCallback(async (params: any): Promise<DatabaseConnection | null> => {
    if (!sessionId) return null;

    setIsConnecting(true);
    try {
      const response = await fetchAPI<{ connection_id: string; success: boolean }>(
        `/database/connect?session_id=${sessionId}`,
        {
          method: 'POST',
          body: JSON.stringify(params),
        }
      );

      if (response.success) {
        const newConnection: DatabaseConnection = {
          id: response.connection_id,
          name: params.database || 'New Connection',
          dbType: params.db_type || 'postgresql',
          host: params.host,
          port: params.port,
          database: params.database,
          username: params.username,
          status: 'connected',
          connectedAt: new Date(),
        };
        addConnection(newConnection);
        return newConnection;
      }
      return null;
    } catch (err) {
      console.error('Connection failed:', err);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [sessionId, addConnection]);

  const disconnect = useCallback(async (connectionId: string) => {
    try {
      await fetchAPI(`/database/connections/${connectionId}`, { method: 'DELETE' });
      removeConnection(connectionId);
    } catch (err) {
      console.error('Disconnect failed:', err);
    }
  }, [removeConnection]);

  const setActive = useCallback((connectionId: string) => {
    setActiveConnection(connectionId);
  }, [setActiveConnection]);

  const query = useCallback(async (sql: string) => {
    if (!sessionId || !activeConnectionId) return null;

    return fetchAPI(`/database/query/${activeConnectionId}?session_id=${sessionId}`, {
      method: 'POST',
      body: JSON.stringify({ sql }),
    });
  }, [sessionId, activeConnectionId]);

  const askQuestion = useCallback(async (question: string) => {
    if (!sessionId || !activeConnectionId) return null;

    return fetchAPI(`/database/ask/${activeConnectionId}?session_id=${sessionId}`, {
      method: 'POST',
      body: JSON.stringify({ question, execute: true, explain: true }),
    });
  }, [sessionId, activeConnectionId]);

  const getSchema = useCallback(async (connectionId: string) => {
    return fetchAPI(`/database/schema/${connectionId}`);
  }, []);

  const trainFromSchema = useCallback(async (connectionId: string) => {
    await fetchAPI(`/database/train/${connectionId}/schema`, { method: 'POST' });
  }, []);

  return {
    connections,
    activeConnection,
    isConnecting,
    connect,
    disconnect,
    setActive,
    query,
    askQuestion,
    getSchema,
    trainFromSchema,
  };
}

// =============================================================================
// useFiles HOOK
// =============================================================================

interface UseFilesOptions {
  sessionId: string | null;
}

interface UseFilesReturn {
  files: DataFile[];
  activeFile: DataFile | null;
  isUploading: boolean;
  upload: (file: File) => Promise<DataFile | null>;
  remove: (fileId: string) => Promise<void>;
  setActive: (fileId: string) => void;
  refresh: () => Promise<void>;
}

export function useFiles({ sessionId }: UseFilesOptions): UseFilesReturn {
  const {
    files,
    activeFileId,
    addFile,
    removeFile,
    setActiveFile,
  } = useDataScienceStore();

  const [isUploading, setIsUploading] = useState(false);

  const activeFile = files.find(f => f.id === activeFileId) || null;

  // Load existing files on mount
  useEffect(() => {
    if (sessionId) {
      refresh();
    }
  }, [sessionId]);

  const upload = useCallback(async (file: File): Promise<DataFile | null> => {
    if (!sessionId) return null;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('session_id', sessionId);

      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();

      const newFile: DataFile = {
        id: data.file_id,
        name: file.name,
        size: file.size,
        type: file.name.endsWith('.csv') ? 'csv' : 'excel',
        uploadedAt: new Date(),
        columns: data.columns || [],
        rowCount: data.row_count || 0,
        sessionId,
      };
      addFile(newFile);
      return newFile;
    } catch (err) {
      console.error('Upload failed:', err);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [sessionId, addFile]);

  const remove = useCallback(async (fileId: string) => {
    if (!sessionId) return;

    try {
      await fetchAPI(`/upload/files/${fileId}?session_id=${sessionId}`, { method: 'DELETE' });
      removeFile(fileId);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }, [sessionId, removeFile]);

  const setActive = useCallback((fileId: string) => {
    setActiveFile(fileId);
  }, [setActiveFile]);

  const refresh = useCallback(async () => {
    if (!sessionId) return;

    try {
      const response = await fetchAPI<{ files: any[] }>(`/upload/files?session_id=${sessionId}`);
      // Sync with store
      response.files?.forEach((file) => {
        if (!files.find(f => f.id === file.file_id)) {
          addFile({
            id: file.file_id,
            name: file.filename,
            size: file.size || 0,
            type: file.filename?.endsWith('.csv') ? 'csv' : 'excel',
            uploadedAt: new Date(),
            columns: file.columns || [],
            rowCount: file.row_count || 0,
            sessionId,
          });
        }
      });
    } catch (err) {
      console.error('Refresh failed:', err);
    }
  }, [sessionId, files, addFile]);

  return {
    files,
    activeFile,
    isUploading,
    upload,
    remove,
    setActive,
    refresh,
  };
}

// =============================================================================
// useStreaming HOOK (for real-time updates)
// =============================================================================

export function useStreaming(options: StreamingOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback((url: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data: StreamingMessage = JSON.parse(event.data);
        
        switch (data.type) {
          case 'token':
            options.onToken?.(data.content || '');
            break;
          case 'code_block':
            if (data.codeBlock) options.onCodeBlock?.(data.codeBlock);
            break;
          case 'execution_start':
            options.onExecutionStart?.();
            break;
          case 'execution_result':
            if (data.executionResult) options.onExecutionResult?.(data.executionResult);
            break;
          case 'artifact':
            if (data.artifact) options.onArtifact?.(data.artifact);
            break;
          case 'done':
            eventSource.close();
            break;
          case 'error':
            options.onError?.(new Error(data.error || 'Unknown error'));
            eventSource.close();
            break;
        }
      } catch (err) {
        console.error('Failed to parse streaming message:', err);
      }
    };

    eventSource.onerror = (err) => {
      options.onError?.(new Error('Connection lost'));
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [options]);

  const disconnect = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  return { connect, disconnect };
}
