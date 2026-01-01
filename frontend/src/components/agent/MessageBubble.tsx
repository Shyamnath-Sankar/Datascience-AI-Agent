'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface CodeBlock {
  language: string;
  code: string;
}

interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  plots: string[];
}

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  codeBlocks?: CodeBlock[];
  timestamp?: Date;
  onExecuteCode?: (code: string) => void;
  executionResult?: ExecutionResult;
}

export function MessageBubble({
  role,
  content,
  codeBlocks = [],
  timestamp,
  onExecuteCode,
  executionResult
}: MessageBubbleProps) {
  const isUser = role === 'user';
  const [showCode, setShowCode] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[85%] ${isUser ? 'order-2' : 'order-1'}`}>
        {/* Avatar and content */}
        <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-semibold shadow-sm shrink-0 ${isUser
              ? 'bg-gradient-to-br from-emerald-400 to-green-500'
              : 'bg-gradient-to-br from-blue-500 to-indigo-600'
            }`}>
            {isUser ? 'U' : 'AI'}
          </div>

          <div className={`flex-1 ${isUser ? 'text-right' : 'text-left'}`}>
            {/* Message bubble */}
            <div className={`inline-block px-4 py-3 rounded-2xl shadow-sm ${isUser
                ? 'bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-tr-sm'
                : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
              }`}>
              {isUser ? (
                <p className="whitespace-pre-wrap text-[15px]">{content}</p>
              ) : (
                <div className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-p:text-gray-700 prose-strong:text-gray-800">
                  <ReactMarkdown
                    components={{
                      code: ({ inline, className, children, ...props }: { inline?: boolean; className?: string; children?: React.ReactNode }) => {
                        if (inline) {
                          return (
                            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-blue-600" {...props}>
                              {children}
                            </code>
                          );
                        }
                        return (
                          <pre className="bg-gray-900 p-3 rounded-lg overflow-x-auto my-2">
                            <code className="text-sm font-mono text-gray-100" {...props}>
                              {children}
                            </code>
                          </pre>
                        );
                      },
                      p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="text-gray-700">{children}</li>,
                      h1: ({ children }) => <h1 className="text-lg font-bold mb-2 text-gray-900">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-base font-bold mb-2 text-gray-900">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-sm font-bold mb-1 text-gray-900">{children}</h3>,
                      strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-blue-400 pl-3 my-2 text-gray-600 italic">
                          {children}
                        </blockquote>
                      ),
                    }}
                  >
                    {content}
                  </ReactMarkdown>
                </div>
              )}
            </div>

            {/* Code indicator with inline preview chart */}
            {!isUser && (codeBlocks.length > 0 || (executionResult?.plots && executionResult.plots.length > 0)) && (
              <div className="mt-3 space-y-2">
                {/* Inline chart preview */}
                {executionResult?.plots && executionResult.plots.length > 0 && (
                  <div className="inline-block bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm max-w-md">
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Chart Generated
                      </span>
                      <span className="text-xs text-gray-400">
                        {executionResult.plots.length} chart{executionResult.plots.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="p-2">
                      <img
                        src={executionResult.plots[0]}
                        alt="Generated chart"
                        className="max-w-full h-auto rounded"
                        style={{ maxHeight: '200px' }}
                      />
                    </div>
                  </div>
                )}

                {/* Code toggle */}
                {codeBlocks.length > 0 && (
                  <div className="inline-block">
                    <button
                      onClick={() => setShowCode(!showCode)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-full text-xs text-gray-600 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                      {showCode ? 'Hide code' : 'View code'}
                      <svg className={`w-3 h-3 transition-transform ${showCode ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {showCode && codeBlocks.map((block, index) => (
                      <div key={index} className="mt-2 bg-gray-900 rounded-lg overflow-hidden max-w-lg">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700">
                          <span className="text-xs text-gray-400">{block.language || 'python'}</span>
                          <button
                            onClick={() => copyToClipboard(block.code)}
                            className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy
                          </button>
                        </div>
                        <pre className="p-3 text-xs font-mono text-gray-100 overflow-x-auto max-h-48">
                          <code>{block.code}</code>
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Timestamp */}
            {timestamp && (
              <div className={`text-xs text-gray-400 mt-1.5 ${isUser ? 'text-right' : 'text-left'}`}>
                {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
