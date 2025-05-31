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
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentCode, setCurrentCode] = useState(`# Let's start by examining the dataset
print("Dataset shape:", df.shape)
print("Dataset columns:", df.columns.tolist())
print("First few rows:")
print(df.head())
print("\\nDataset info:")
print(df.info())
print("\\nBasic statistics:")
print(df.describe())`);
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
          setExecutionResult(response.execution_result);
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
      const response = await generateInsights(sessionId, activeFileId || undefined);

      if (response.success) {
        const insightsMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: response.insights,
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
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeFileId', fileId);
    }
  };

  const handleAgentSelect = (agentType: string, agentName: string) => {
    setSelectedAgent(agentType);
  };

  return (
    <div className="fixed inset-0 bg-white flex overflow-hidden">
      {/* Left Sidebar - Data Selector */}
      <div className="w-80 flex-shrink-0 border-r border-[var(--excel-border)] bg-gray-50">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[var(--excel-border)] bg-white">
            <div className="flex items-center justify-between">
              <a
                href="/"
                className="flex items-center space-x-2 text-sm text-gray-600 hover:text-[var(--excel-green)] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back to App</span>
              </a>
            </div>
          </div>

          {/* Data Selector */}
          <div className="flex-1 p-4 space-y-4">
            <DataSelector
              sessionId={sessionId}
              activeFileId={activeFileId}
              onFileSelect={handleFileSelect}
              onGenerateInsights={handleGenerateInsights}
            />

            {/* Agent Selector */}
            <AgentSelector
              onAgentSelect={handleAgentSelect}
              currentMessage={currentMessage}
            />
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex">
        {/* Chat Interface */}
        <div className="flex-1">
          <ChatInterface
            messages={messages}
            onSendMessage={handleSendMessage}
            onExecuteCode={handleExecuteCode}
            loading={loading}
            sessionId={sessionId}
            onClearChat={handleClearChat}
          />
        </div>

        {/* Right Sidebar - Code Canvas */}
        <div className="w-96 flex-shrink-0">
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
