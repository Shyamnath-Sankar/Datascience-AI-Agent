'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import type {
  Message,
  CodeBlock,
  AgentType,
  ReasoningStep,
  StreamingMessage,
} from '@/lib/types';

// =============================================================================
// TYPES
// =============================================================================

interface AdvancedChatProps {
  messages: Message[];
  onSendMessage: (message: string, options?: SendOptions) => Promise<void>;
  onExecuteCode: (code: string) => Promise<void>;
  isLoading?: boolean;
  sessionId: string | null;
  activeAgent?: AgentType;
  onAgentChange?: (agent: AgentType) => void;
  onClearChat?: () => void;
  showReasoning?: boolean;
  streamingEnabled?: boolean;
  suggestedQuestions?: string[];
  placeholder?: string;
  theme?: 'light' | 'dark';
}

interface SendOptions {
  agent?: AgentType;
  autoExecute?: boolean;
  streaming?: boolean;
}

// =============================================================================
// ICONS
// =============================================================================

const Icons = {
  send: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  ),
  user: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  ai: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5" />
    </svg>
  ),
  copy: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  play: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    </svg>
  ),
  thinking: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  chevronDown: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
};

// =============================================================================
// MESSAGE BUBBLE COMPONENT
// =============================================================================

interface MessageBubbleProps {
  message: Message;
  onExecuteCode: (code: string) => Promise<void>;
  showReasoning?: boolean;
  theme?: 'light' | 'dark';
}

function MessageBubble({ message, onExecuteCode, showReasoning, theme }: MessageBubbleProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = useCallback(async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const renderCodeBlock = useCallback((block: CodeBlock, index: number) => {
    const blockId = `${message.id}-code-${index}`;
    
    return (
      <div key={blockId} className="relative group my-3">
        {/* Code Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 rounded-t-lg">
          <span className="text-xs text-gray-400 font-mono">{block.language}</span>
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => handleCopy(block.code, blockId)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white transition-colors"
            >
              {copiedId === blockId ? Icons.check : Icons.copy}
              {copiedId === blockId ? 'Copied' : 'Copy'}
            </button>
            {block.isExecutable && (
              <button
                onClick={() => onExecuteCode(block.code)}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                {Icons.play}
                Run
              </button>
            )}
          </div>
        </div>
        
        {/* Code Content */}
        <SyntaxHighlighter
          language={block.language}
          style={oneDark}
          customStyle={{
            margin: 0,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            fontSize: '13px',
          }}
          showLineNumbers={block.code.split('\n').length > 3}
        >
          {block.code}
        </SyntaxHighlighter>
      </div>
    );
  }, [message.id, copiedId, handleCopy, onExecuteCode]);

  const renderReasoningTrace = useCallback(() => {
    const trace = message.metadata?.reasoningTrace;
    if (!trace || !showReasoning) return null;

    const stepIcons: Record<string, React.ReactNode> = {
      think: Icons.thinking,
      plan: '📋',
      act: '⚡',
      observe: '👁️',
      reflect: '🔍',
      complete: Icons.check,
    };

    return (
      <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
        <button
          onClick={() => setExpandedReasoning(!expandedReasoning)}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          {Icons.thinking}
          <span>Reasoning Trace ({trace.steps.length} steps)</span>
          <span className={`transform transition-transform ${expandedReasoning ? 'rotate-180' : ''}`}>
            {Icons.chevronDown}
          </span>
        </button>
        
        {expandedReasoning && (
          <div className="mt-2 space-y-2 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
            {trace.steps.map((step: ReasoningStep, i: number) => (
              <div key={i} className="text-xs">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 font-medium uppercase">
                  <span>{stepIcons[step.step] || '•'}</span>
                  <span>{step.step}</span>
                  <span className="text-gray-400 text-[10px]">
                    {Math.round(step.confidence * 100)}% confidence
                  </span>
                </div>
                <div className="text-gray-700 dark:text-gray-300 mt-1 pl-5">
                  {step.content.length > 200 ? `${step.content.slice(0, 200)}...` : step.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }, [message.metadata?.reasoningTrace, showReasoning, expandedReasoning]);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex items-start gap-3 max-w-[85%] ${isUser ? 'flex-row-reverse' : ''}`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser 
            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' 
            : 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white'
        }`}>
          {isUser ? Icons.user : Icons.ai}
        </div>
        
        {/* Message Content */}
        <div className={`rounded-2xl px-4 py-3 ${
          isUser 
            ? 'bg-blue-500 text-white rounded-tr-sm' 
            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-tl-sm shadow-sm'
        }`}>
          {/* Agent Badge (for assistant messages) */}
          {!isUser && message.metadata?.agentUsed && (
            <div className="flex items-center gap-2 mb-2 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
              {message.metadata.agentUsed} Agent
            </div>
          )}
          
          {/* Main Content */}
          <div className={`prose prose-sm max-w-none ${
            isUser 
              ? 'prose-invert' 
              : 'dark:prose-invert'
          }`}>
            <ReactMarkdown
              components={{
                code({ node, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const isInline = !match && !String(children).includes('\n');
                  
                  if (isInline) {
                    return (
                      <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono" {...props}>
                        {children}
                      </code>
                    );
                  }
                  
                  return null; // Code blocks are rendered separately
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
          
          {/* Code Blocks */}
          {message.codeBlocks && message.codeBlocks.length > 0 && (
            <div className="mt-3">
              {message.codeBlocks.map((block, i) => renderCodeBlock(block, i))}
            </div>
          )}
          
          {/* Reasoning Trace */}
          {renderReasoningTrace()}
          
          {/* Timestamp */}
          <div className={`text-[10px] mt-2 ${
            isUser ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'
          }`}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {message.metadata?.processingTimeMs && (
              <span className="ml-2">({message.metadata.processingTimeMs}ms)</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// TYPING INDICATOR
// =============================================================================

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center">
          {Icons.ai}
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-sm text-gray-500">Analyzing...</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUGGESTED QUESTIONS
// =============================================================================

interface SuggestedQuestionsProps {
  questions: string[];
  onSelect: (question: string) => void;
}

function SuggestedQuestions({ questions, onSelect }: SuggestedQuestionsProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {questions.map((question, i) => (
        <button
          key={i}
          onClick={() => onSelect(question)}
          className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full hover:border-blue-500 hover:text-blue-600 transition-colors"
        >
          {question}
        </button>
      ))}
    </div>
  );
}

// =============================================================================
// MAIN CHAT COMPONENT
// =============================================================================

export function AdvancedChat({
  messages,
  onSendMessage,
  onExecuteCode,
  isLoading = false,
  sessionId,
  activeAgent,
  onAgentChange,
  onClearChat,
  showReasoning = true,
  streamingEnabled = false,
  suggestedQuestions = [],
  placeholder = 'Ask anything about your data...',
  theme = 'light',
}: AdvancedChatProps) {
  const [inputValue, setInputValue] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [inputValue]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!inputValue.trim() || isLoading || !sessionId) return;
    
    const message = inputValue.trim();
    setInputValue('');
    
    await onSendMessage(message, {
      agent: activeAgent,
      streaming: streamingEnabled,
    });
  }, [inputValue, isLoading, sessionId, activeAgent, streamingEnabled, onSendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit, isComposing]);

  const handleSuggestedQuestion = useCallback((question: string) => {
    setInputValue(question);
    textareaRef.current?.focus();
  }, []);

  // Empty state
  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        AI Data Assistant
      </h2>
      <p className="text-gray-600 dark:text-gray-400 text-center max-w-md mb-6">
        Ask questions about your data, generate visualizations, run statistical analyses, or build machine learning models.
      </p>
      
      {suggestedQuestions.length > 0 && (
        <div className="w-full max-w-lg">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 text-center">
            Try one of these:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {suggestedQuestions.slice(0, 4).map((question, i) => (
              <button
                key={i}
                onClick={() => handleSuggestedQuestion(question)}
                className="p-3 text-left text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-500 hover:shadow-md transition-all"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 ? (
            renderEmptyState()
          ) : (
            <>
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onExecuteCode={onExecuteCode}
                  showReasoning={showReasoning}
                  theme={theme}
                />
              ))}
              {isLoading && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>
      
      {/* Input Area */}
      <div
        ref={inputContainerRef}
        className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
      >
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit}>
            <div className="relative flex items-end bg-gray-100 dark:bg-gray-700 rounded-2xl border border-gray-200 dark:border-gray-600 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                placeholder={sessionId ? placeholder : 'Select a data source first'}
                disabled={!sessionId || isLoading}
                className="flex-1 resize-none bg-transparent px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none disabled:opacity-50 max-h-[150px]"
                rows={1}
              />
              
              <div className="flex items-center gap-2 px-3 py-2">
                <button
                  type="submit"
                  disabled={!inputValue.trim() || !sessionId || isLoading}
                  className="p-2 rounded-xl bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-blue-500 transition-colors"
                >
                  {Icons.send}
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-between mt-2 px-1">
              <span className="text-xs text-gray-400">
                Press Enter to send, Shift+Enter for new line
              </span>
              {inputValue.length > 0 && (
                <span className="text-xs text-gray-400">
                  {inputValue.length} / 10000
                </span>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AdvancedChat;
