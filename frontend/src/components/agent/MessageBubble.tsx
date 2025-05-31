import React from 'react';
import ReactMarkdown from 'react-markdown';

interface CodeBlock {
  language: string;
  code: string;
}

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  codeBlocks?: CodeBlock[];
  timestamp?: Date;
  onExecuteCode?: (code: string) => void;
}

export function MessageBubble({ 
  role, 
  content, 
  codeBlocks = [], 
  timestamp,
  onExecuteCode 
}: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}>
        {/* Avatar */}
        <div className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
            isUser ? 'bg-[var(--excel-green)]' : 'bg-[var(--excel-blue)]'
          }`}>
            {isUser ? 'U' : 'AI'}
          </div>
          
          <div className={`flex-1 ${isUser ? 'text-right' : 'text-left'}`}>
            {/* Message bubble */}
            <div className={`inline-block px-4 py-3 rounded-lg ${
              isUser 
                ? 'bg-[var(--excel-green)] text-white' 
                : 'bg-white border border-[var(--excel-border)] text-[var(--excel-text-primary)]'
            }`}>
              {isUser ? (
                <p className="whitespace-pre-wrap">{content}</p>
              ) : (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown
                    components={{
                      code: ({ node, inline, className, children, ...props }) => {
                        if (inline) {
                          return (
                            <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono" {...props}>
                              {children}
                            </code>
                          );
                        }
                        return (
                          <pre className="bg-gray-50 p-3 rounded-md overflow-x-auto">
                            <code className="text-sm font-mono" {...props}>
                              {children}
                            </code>
                          </pre>
                        );
                      },
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                      li: ({ children }) => <li className="mb-1">{children}</li>,
                      h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-md font-bold mb-2">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                    }}
                  >
                    {content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
            
            {/* Code indicator - don't show full code blocks, just indicate code was generated */}
            {codeBlocks.length > 0 && !isUser && (
              <div className="mt-3">
                <div className="inline-flex items-center px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-700">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  Code generated and executed in canvas
                </div>
              </div>
            )}
            
            {/* Timestamp */}
            {timestamp && (
              <div className={`text-xs text-gray-500 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
                {timestamp.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
