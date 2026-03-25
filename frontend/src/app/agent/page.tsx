'use client';

import { useState, useEffect, useRef } from 'react';
import { ChatInterface } from '@/components/agent/ChatInterface';
import { CodeCanvas } from '@/components/agent/CodeCanvas';
import { DataSelector } from '@/components/agent/DataSelector';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { FileUpload } from '@/components/data/FileUpload';
import ReactMarkdown from 'react-markdown';
import {
  chatWithAgent,
  executeCode,
  generateInsights,
  getChatHistory,
  clearChatHistory,
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
  const [currentCode, setCurrentCode] = useState('');
  const [executionResult, setExecutionResult] = useState<ExecutionResult | undefined>();
  const [loading, setLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [showWorkspace, setShowWorkspace] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedSessionId = localStorage.getItem('sessionId');
      const storedActiveFileId = localStorage.getItem('activeFileId');
      const storedConnectionId = localStorage.getItem('activeConnectionId');

      if (storedSessionId) {
        setSessionId(storedSessionId);
        if (storedActiveFileId) {
          setActiveFileId(storedActiveFileId);
        }
        if (storedConnectionId) {
          setActiveConnectionId(storedConnectionId);
        }
        loadChatHistory(storedSessionId);
      }
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChatHistory = async (sid: string) => {
    try {
      const response = await getChatHistory(sid);
      if (response.success && response.history) {
        const formatted: Message[] = response.history.map((msg: any, i: number) => ({
          id: `hist-${i}`,
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
          timestamp: new Date(),
        }));
        setMessages(formatted);
      }
    } catch (err) {
      console.error('Error loading chat history:', err);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!sessionId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      // Route everything through the unified V1 agent endpoint
      // (which internally uses ReActAgent via V2 backend)
      const response = await chatWithAgent(
        sessionId,
        message,
        activeFileId || undefined,
        true,
        activeConnectionId || undefined,
      );

      if (response.success) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.response,
          codeBlocks: response.code_blocks || [],
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);

        if (response.executed_code) {
          setCurrentCode(response.executed_code);
        }
        if (response.execution_result) {
          setExecutionResult(response.execution_result);
          setShowWorkspace(true);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date(),
        },
      ]);
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
        error: 'Failed to execute code.',
        plots: [],
        variables: {},
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
        const insightsMsg: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: response.insights || response.response,
          codeBlocks: response.code_blocks || [],
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, insightsMsg]);

        const pythonCode = response.code_blocks?.find((b: any) => b.language === 'python');
        if (pythonCode) {
          setCurrentCode(pythonCode.code);
          handleExecuteCode(pythonCode.code);
        }
      }
    } catch (err) {
      console.error('Error generating insights:', err);
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
    } catch (err) {
      console.error('Error clearing chat:', err);
    }
  };

  const handleFileSelect = (fileId: string) => {
    setActiveFileId(fileId);
    setActiveConnectionId(null);
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeFileId', fileId);
    }
  };

  const handleConnectionSelect = (connectionId: string) => {
    setActiveConnectionId(connectionId);
    setActiveFileId(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('activeFileId');
    }
  };

  const handleUploadSuccess = (data: any) => {
    if (data.session_id) {
      setSessionId(data.session_id);
      localStorage.setItem('sessionId', data.session_id);
    }
    if (data.files && data.files.length > 0) {
      setActiveFileId(data.files[0].file_id);
      localStorage.setItem('activeFileId', data.files[0].file_id);
    }
    setShowUpload(false);
  };

  return (
    <div className="flex h-screen bg-[var(--bg-secondary)] overflow-hidden">
      {/* ─── Left Sidebar: Context ─── */}
      <div className="w-72 flex-shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-primary)] flex flex-col">
        {/* Sidebar Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-[var(--border-color)]">
          <a href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold">
              D
            </div>
            <span className="font-semibold text-sm text-[var(--text-primary)]">
              Data<span className="text-[var(--accent)]">Agent</span>
            </span>
          </a>
          <ThemeToggle />
        </div>

        {/* Data Context */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Upload button */}
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="w-full btn btn-secondary text-xs py-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            {showUpload ? 'Cancel' : 'Upload Data'}
          </button>

          {showUpload && (
            <div className="modern-card p-3 animate-fade-in">
              <FileUpload onUploadSuccess={handleUploadSuccess} />
            </div>
          )}

          <DataSelector
            sessionId={sessionId}
            activeFileId={activeFileId}
            activeConnectionId={activeConnectionId}
            onFileSelect={handleFileSelect}
            onConnectionSelect={handleConnectionSelect}
            onGenerateInsights={handleGenerateInsights}
          />
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-[var(--border-color)] text-[10px] text-[var(--text-tertiary)] text-center">
          {sessionId ? (
            <span className="flex items-center justify-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
              Session active
            </span>
          ) : (
            'No data loaded'
          )}
        </div>
      </div>

      {/* ─── Main Chat Area ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="h-14 flex items-center justify-between px-6 border-b border-[var(--border-color)] bg-[var(--bg-primary)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold">
              AI
            </div>
            <div>
              <h1 className="text-sm font-semibold text-[var(--text-primary)]">AI Agent</h1>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                {loading ? 'Thinking...' : 'Ready to analyze'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button onClick={handleClearChat} className="btn btn-ghost text-xs py-1.5 px-3">
                Clear
              </button>
            )}
            <button
              onClick={() => setShowWorkspace(!showWorkspace)}
              className={`btn text-xs py-1.5 px-3 ${showWorkspace ? 'btn-primary' : 'btn-secondary'}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              Workspace
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-5 pb-4">
            {messages.length === 0 ? (
              <div className="text-center py-16 animate-fade-in">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/10 to-violet-500/10 border border-[var(--border-color)] flex items-center justify-center mx-auto mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                  What can I help you analyze?
                </h2>
                <p className="text-[var(--text-secondary)] max-w-md mx-auto mb-8">
                  {sessionId
                    ? 'Ask me anything about your data — analysis, charts, ML, or custom code.'
                    : 'Upload a dataset to get started, then ask me anything.'}
                </p>

                {sessionId && (
                  <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
                    {[
                      { label: 'Summarize dataset', icon: '📊' },
                      { label: 'Find correlations', icon: '🔗' },
                      { label: 'Visualize distributions', icon: '📈' },
                      { label: 'Detect anomalies', icon: '🔍' },
                    ].map((suggestion) => (
                      <button
                        key={suggestion.label}
                        onClick={() => handleSendMessage(suggestion.label)}
                        className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-[var(--accent)] text-left transition-colors group"
                      >
                        <span className="text-lg mr-2">{suggestion.icon}</span>
                        <span className="text-sm text-[var(--text-primary)] group-hover:text-[var(--accent)]">
                          {suggestion.label}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                >
                  <div
                    className={`chat-bubble ${
                      msg.role === 'user'
                        ? 'chat-bubble-user'
                        : 'chat-bubble-ai'
                    }`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-[9px] font-bold">
                          AI
                        </div>
                        <span className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                          Agent
                        </span>
                      </div>
                    )}
                    <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
                      {msg.role === 'user' ? (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      ) : (
                        <ReactMarkdown
                          components={{
                            code: ({ inline, className, children, ...props }: any) => {
                              if (inline) {
                                return (
                                  <code className="bg-[var(--bg-secondary)] text-[var(--accent)] px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                                    {children}
                                  </code>
                                );
                              }
                              // We already extract code blocks to a separate UI, so we just return null for block code in markdown
                              return null;
                            },
                            p: ({ children }) => <p className="mb-3 last:mb-0 text-[var(--text-primary)]">{children}</p>,
                            strong: ({ children }) => <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>,
                            ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1 text-[var(--text-secondary)]">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1 text-[var(--text-secondary)]">{children}</ol>,
                            li: ({ children }) => <li>{children}</li>,
                            h2: ({ children }) => <h2 className="text-base font-semibold mt-4 mb-2 text-[var(--text-primary)]">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-sm font-semibold mt-3 mb-2 text-[var(--text-primary)]">{children}</h3>,
                          }}
                        >
                          {/* Strip raw markdown code blocks from the content since we render them separately below */}
                          {msg.content.replace(/```[a-z]*\n[\s\S]*?```/g, '').trim()}
                        </ReactMarkdown>
                      )}
                    </div>

                    {msg.codeBlocks && msg.codeBlocks.length > 0 && (
                      <div className="mt-3">
                        <details className="group rounded-lg overflow-hidden border border-[var(--border-color)]">
                          <summary className="flex items-center justify-between p-2.5 cursor-pointer text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)]">
                            <div className="flex items-center gap-2">
                              <svg className="w-3.5 h-3.5 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              Code ({msg.codeBlocks.length})
                            </div>
                          </summary>
                          <div className="border-t border-[var(--border-color)]">
                            {msg.codeBlocks.map((block, idx) => (
                              <div key={idx} className="relative group/code">
                                <div className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity z-10">
                                  <button
                                    onClick={() => handleExecuteCode(block.code)}
                                    className="px-2 py-1 bg-[var(--accent)] text-white rounded text-[10px] hover:bg-[var(--accent-hover)] flex items-center gap-1"
                                  >
                                    ▶ Run
                                  </button>
                                </div>
                                <pre className="p-3 bg-[#0d1117] text-[#c9d1d9] overflow-x-auto text-[11px] font-mono leading-relaxed m-0">
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
              <div className="flex justify-start animate-fade-in">
                <div className="chat-bubble chat-bubble-ai flex items-center gap-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm text-[var(--text-tertiary)]">Analyzing...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="p-4 bg-[var(--bg-primary)] border-t border-[var(--border-color)]">
          <div className="max-w-3xl mx-auto">
            <ChatInterface
              messages={[]}
              onSendMessage={handleSendMessage}
              onExecuteCode={handleExecuteCode}
              loading={loading}
              sessionId={sessionId}
              onClearChat={handleClearChat}
              hideHistory={true}
            />
          </div>
        </div>
      </div>

      {/* ─── Right Sidebar: Workspace ─── */}
      {showWorkspace && (
        <div className="w-[420px] flex-shrink-0 border-l border-[var(--border-color)] bg-[var(--bg-primary)] flex flex-col animate-fade-in">
          <div className="h-14 px-4 flex items-center justify-between border-b border-[var(--border-color)]">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Workspace</h2>
              <span className={`w-2 h-2 rounded-full ${codeLoading ? 'bg-[var(--warning)] animate-pulse' : 'bg-[var(--success)]'}`} />
            </div>
            <button
              onClick={() => setShowWorkspace(false)}
              className="btn btn-ghost p-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
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
      )}
    </div>
  );
}
