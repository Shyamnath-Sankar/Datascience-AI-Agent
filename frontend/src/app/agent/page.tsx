'use client';

import { useState, useEffect } from 'react';
import { ChatInterface } from '@/components/agent/ChatInterface';
import { CodeCanvas } from '@/components/agent/CodeCanvas';
import { DataSelector } from '@/components/agent/DataSelector';
import { AgentSelector } from '@/components/agent/AgentSelector';
import {
  chatWithAgent,
  executeCode,
  generateInsights,
  getChatHistory,
  clearChatHistory,
  createVisualization,
  generateCodeWithAgent,
  getPackageRecommendations,
  generateInsightsWithAgent
} from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  codeBlocks?: Array<{
    language: string;
    code: string;
  }>;
  timestamp: Date;
}

interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  plots: string[];
  variables: Record<string, any>;
  installations?: Array<{
    package: string;
    success: boolean;
    message: string;
  }>;
}

export default function AgentPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentCode, setCurrentCode] = useState(`# Select a file or database to start analyzing
# The code canvas will update based on your selection
`);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | undefined>();
  const [loading, setLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>('visualization');
  const [currentMessage, setCurrentMessage] = useState<string>('');

  // Load session data from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedSessionId = localStorage.getItem('sessionId');
      const storedActiveFileId = localStorage.getItem('activeFileId');
      
      if (storedSessionId) {
        setSessionId(storedSessionId);
        if (storedActiveFileId) {
          setActiveFileId(storedActiveFileId);
          // Pre-populate code if file selected
          setCurrentCode(`# Analyzing file: ${storedActiveFileId}
print("Dataset shape:", df.shape)
print("Dataset columns:", df.columns.tolist())
print("First few rows:")
print(df.head())
`);
        }
        loadChatHistory(storedSessionId);
      }
    }
  }, []);

  const loadChatHistory = async (sessionId: string) => {
    try {
      const response = await getChatHistory(sessionId);
      if (response.success && response.history) {
        const formattedMessages: Message[] = response.history.map((msg: any, index: number) => ({
          id: `${index}`,
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
          timestamp: new Date()
        }));
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!sessionId) return;

    setCurrentMessage(message);

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      let response;

      // If database is active, prioritize using chatWithAgent which now supports connections
      if (activeConnectionId) {
        response = await chatWithAgent(
          sessionId, 
          message, 
          undefined, 
          true, 
          activeConnectionId
        );
      } else {
        // Auto-select agent based on message content
        let agentToUse = selectedAgent;
        const messageLower = message.toLowerCase();

        // Check for visualization requests
        if (messageLower.includes('chart') ||
            messageLower.includes('graph') ||
            messageLower.includes('plot') ||
            messageLower.includes('visualiz') ||
            messageLower.includes('show me') ||
            messageLower.includes('create') ||
            messageLower.includes('generate') ||
            messageLower.includes('draw')) {
          agentToUse = 'visualization';
        }
        // Check for insights requests
        else if (messageLower.includes('insight') ||
                 messageLower.includes('pattern') ||
                 messageLower.includes('trend') ||
                 messageLower.includes('summary') ||
                 messageLower.includes('analyze') ||
                 messageLower.includes('analysis')) {
          agentToUse = 'insights';
        }
        // Check for simple text questions (use general chat)
        else if (messageLower.includes('what is') ||
                 messageLower.includes('explain') ||
                 messageLower.includes('tell me about') ||
                 messageLower.includes('how many') ||
                 messageLower.includes('which') ||
                 messageLower.includes('why') ||
                 messageLower.includes('when')) {
          agentToUse = 'text-only';
        }

        // Use specialized agent based on selection
        switch (agentToUse) {
          case 'visualization':
            response = await createVisualization(sessionId, message, activeFileId || undefined, true);
            break;
          case 'code-generation':
            response = await generateCodeWithAgent(sessionId, message, activeFileId || undefined, true);
            break;
          case 'insights':
            response = await generateInsightsWithAgent(sessionId, activeFileId || undefined, 'general', true);
            break;
          case 'package-recommendations':
            response = await getPackageRecommendations(message);
            break;
          case 'text-only':
            response = await chatWithAgent(sessionId, message, activeFileId || undefined, false); // No auto-execute for text
            break;
          default:
            response = await createVisualization(sessionId, message, activeFileId || undefined, true);
        }
      }

      if (response.success) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.response,
          codeBlocks: response.code_blocks || [],
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);

        // If there's executed code, set it in the canvas
        if (response.executed_code) {
          setCurrentCode(response.executed_code);
        }

        // If there's an execution result, set it
        if (response.execution_result) {
          // Adapt DB result if needed or standard result
          setExecutionResult(response.execution_result);
          // Only switch code in canvas if it's new
          if (!response.executed_code) {
             // For DB query results that don't return python code, we might want to keep the SQL visible or blank
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error while processing your request. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteCode = async (code: string) => {
    if (!sessionId) return;

    // Database queries cannot be "executed" like Python code in the same way here yet,
    // unless we wrap them. For now, assume this is Python code execution for files.
    if (activeConnectionId) {
        // If it's SQL, we could potentially run it via API, but CodeCanvas is mainly Python.
        // We'll skip for DB context for now or treat as Python if user writes Python.
    }

    setCodeLoading(true);
    setCurrentCode(code);

    try {
      const response = await executeCode(sessionId, code, activeFileId || undefined);
      setExecutionResult(response);
    } catch (error) {
      console.error('Error executing code:', error);
      setExecutionResult({
        success: false,
        output: '',
        error: 'Failed to execute code. Please try again.',
        plots: [],
        variables: {}
      });
    } finally {
      setCodeLoading(false);
    }
  };

  const handleGenerateInsights = async () => {
    if (!sessionId) return;

    setLoading(true);

    try {
      let response;
      if (activeConnectionId) {
        // Use generic chat for DB insights for now
        response = await chatWithAgent(
            sessionId,
            "Analyze this database and provide key insights about the data.",
            undefined,
            true,
            activeConnectionId
        );
      } else {
        response = await generateInsights(sessionId, activeFileId || undefined);
      }

      if (response.success) {
        const insightsMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: response.insights || response.response,
          codeBlocks: response.code_blocks || [],
          timestamp: new Date()
        };
        setMessages(prev => [...prev, insightsMessage]);

        // If there are code blocks, execute the first Python code block automatically
        const pythonCode = response.code_blocks?.find((block: any) => block.language === 'python');
        if (pythonCode) {
          setCurrentCode(pythonCode.code);
          // Auto-execute the insights code
          handleExecuteCode(pythonCode.code);
        }
      }
    } catch (error) {
      console.error('Error generating insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = async () => {
    if (!sessionId) return;

    try {
      await clearChatHistory(sessionId);
      setMessages([]);
      setCurrentCode('');
      setExecutionResult(undefined);
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  };

  const handleFileSelect = (fileId: string) => {
    setActiveFileId(fileId);
    setActiveConnectionId(null); // Clear connection selection
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeFileId', fileId);
    }
    // Update code canvas hint
    setCurrentCode(`# Active File: ${fileId}
# Use pandas to analyze: df.head()
print(df.info())
`);
  };

  const handleConnectionSelect = (connectionId: string) => {
    setActiveConnectionId(connectionId);
    setActiveFileId(null); // Clear file selection
    if (typeof window !== 'undefined') {
      localStorage.removeItem('activeFileId');
    }
    // Update code canvas hint
    setCurrentCode(`-- Active Database Connection: ${connectionId}
-- You can ask natural language questions in the chat.
-- SQL queries generated will appear here.
/* Example: SELECT * FROM users LIMIT 5; */
`);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleAgentSelect = (agentType: string, _agentName: string) => {
    setSelectedAgent(agentType);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-[var(--bg-secondary)] overflow-hidden">
      {/* Left Sidebar - Data Context */}
      <div className="w-80 flex-shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-primary)] flex flex-col">
        <div className="p-4 border-b border-[var(--border-color)]">
          <h2 className="font-semibold text-[var(--text-primary)] mb-1">Context</h2>
          <p className="text-xs text-[var(--text-tertiary)]">Select data source to analyze</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <DataSelector
            sessionId={sessionId}
            activeFileId={activeFileId}
            activeConnectionId={activeConnectionId}
            onFileSelect={handleFileSelect}
            onConnectionSelect={handleConnectionSelect}
            onGenerateInsights={handleGenerateInsights}
          />
          
          <div className="pt-4 border-t border-[var(--border-color)]">
             <AgentSelector
              onAgentSelect={handleAgentSelect}
              currentMessage={currentMessage}
            />
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-secondary)] relative">
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="max-w-4xl mx-auto space-y-6 pb-24">
            {messages.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 bg-[var(--accent-subtle)] text-[var(--accent-primary)] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                  AI Data Assistant
                </h1>
                <p className="text-[var(--text-secondary)] max-w-md mx-auto">
                  Ask questions about your data, generate visualizations, or run custom analysis. Select a data source to get started.
                </p>
                <div className="mt-8 grid grid-cols-2 gap-4 max-w-lg mx-auto text-left">
                  <button 
                    onClick={() => handleSendMessage("Show me a summary of this dataset")}
                    className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-[var(--accent-primary)] hover:shadow-md transition-all group"
                  >
                    <span className="block font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] mb-1">Analyze Data</span>
                    <span className="text-xs text-[var(--text-tertiary)]">Get a comprehensive summary</span>
                  </button>
                  <button 
                    onClick={() => handleSendMessage("Visualize the distribution of the main columns")}
                    className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-[var(--accent-primary)] hover:shadow-md transition-all group"
                  >
                    <span className="block font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] mb-1">Visualize</span>
                    <span className="text-xs text-[var(--text-tertiary)]">Create charts and graphs</span>
                  </button>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`chat-bubble ${
                    msg.role === 'user' 
                      ? 'chat-bubble-user shadow-md' 
                      : 'chat-bubble-ai shadow-sm'
                  }`}>
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-2 mb-2 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
                        <div className="w-4 h-4 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white text-[8px]">AI</div>
                        Assistant
                      </div>
                    )}
                    <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                      {msg.content}
                    </div>
                    {msg.codeBlocks && msg.codeBlocks.length > 0 && (
                      <div className="mt-3">
                        <details className="group border border-[var(--border-color)] rounded-lg overflow-hidden bg-[var(--bg-tertiary)] open:bg-[var(--bg-primary)]">
                          <summary className="flex items-center justify-between p-2 cursor-pointer select-none text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-[var(--text-tertiary)] group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              <span>View Analysis Code</span>
                            </div>
                            <span className="text-[10px] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded border border-[var(--border-color)]">
                              {msg.codeBlocks.length} block{msg.codeBlocks.length > 1 ? 's' : ''}
                            </span>
                          </summary>
                          <div className="border-t border-[var(--border-color)]">
                            {msg.codeBlocks.map((block, idx) => (
                              <div key={idx} className="relative group/code">
                                <div className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity z-10 flex gap-1">
                                  <button 
                                    onClick={() => handleExecuteCode(block.code)}
                                    className="p-1 bg-[var(--accent-primary)] text-white rounded text-[10px] hover:bg-[var(--accent-hover)] flex items-center gap-1 shadow-sm"
                                    title="Run this code"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Run
                                  </button>
                                </div>
                                <pre className="p-3 bg-[#1e1e1e] text-[#d4d4d4] overflow-x-auto text-[11px] font-mono m-0 leading-relaxed">
                                  {block.code}
                                </pre>
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="chat-bubble chat-bubble-ai shadow-sm flex items-center gap-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-[var(--text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-[var(--text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-[var(--text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span className="text-sm text-[var(--text-tertiary)]">Thinking...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-[var(--bg-primary)] border-t border-[var(--border-color)]">
          <div className="max-w-4xl mx-auto relative">
            <ChatInterface
              messages={[]} // Handled in parent layout now
              onSendMessage={handleSendMessage}
              onExecuteCode={handleExecuteCode}
              loading={loading}
              sessionId={sessionId}
              onClearChat={handleClearChat}
              hideHistory={true} // Custom prop to only show input
            />
          </div>
        </div>
      </div>

      {/* Right Sidebar - Code & Results (Collapsible or Permanent) */}
      <div className="w-[400px] flex-shrink-0 border-l border-[var(--border-color)] bg-[var(--bg-primary)] flex flex-col">
        <div className="p-3 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-secondary)]">
          <h2 className="font-semibold text-[var(--text-primary)] text-sm">Workspace</h2>
          <div className="flex gap-2">
             <span className={`w-2 h-2 rounded-full ${codeLoading ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'}`}></span>
          </div>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col">
          <CodeCanvas
            code={currentCode}
            onCodeChange={setCurrentCode}
            onExecute={handleExecuteCode}
            executionResult={executionResult}
            loading={codeLoading}
          />
        </div>
      </div>
    </div>
  );
}
