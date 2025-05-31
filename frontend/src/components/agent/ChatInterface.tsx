import React, { useState, useRef, useEffect } from 'react';
import { MessageBubble } from './MessageBubble';
import { Button } from '@/components/ui/Button';

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

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  onExecuteCode: (code: string) => void;
  loading?: boolean;
  sessionId: string | null;
  onClearChat: () => void;
}

export function ChatInterface({ 
  messages, 
  onSendMessage, 
  onExecuteCode, 
  loading = false,
  sessionId,
  onClearChat
}: ChatInterfaceProps) {
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim() && !loading) {
      onSendMessage(inputMessage.trim());
      setInputMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const suggestedQuestions = [
    "What are the key insights from my data?",
    "Show me charts to understand my data better",
    "What patterns can you find in this data?",
    "Which factors are most important?",
    "Are there any unusual values I should know about?",
    "What trends do you see over time?",
    "How can I improve my business based on this data?",
    "What should I focus on first?"
  ];

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--excel-border)] bg-gray-50">
        <div>
          <h2 className="text-lg font-semibold text-[var(--excel-text-primary)]">Your Data Assistant</h2>
          <p className="text-sm text-gray-600">
            {sessionId ? 'Ask me anything about your data in plain English' : 'Upload data to get started'}
          </p>
        </div>
        {messages.length > 0 && (
          <Button
            onClick={onClearChat}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            Clear Chat
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto bg-[var(--excel-blue)] rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Welcome! I'm here to help with your data</h3>
              <p className="text-gray-600 max-w-md">
                I can answer questions about your data, create charts, and find insights to help your business.
                {!sessionId && " Please upload some data first to get started."}
              </p>
            </div>

            {sessionId && (
              <div className="w-full max-w-2xl">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Try asking:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {suggestedQuestions.map((question, index) => (
                    <button
                      key={index}
                      onClick={() => setInputMessage(question)}
                      className="text-left p-3 text-sm bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                role={message.role}
                content={message.content}
                codeBlocks={message.codeBlocks}
                timestamp={message.timestamp}
                onExecuteCode={onExecuteCode}
              />
            ))}
            {loading && (
              <div className="flex justify-start mb-4">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--excel-blue)] flex items-center justify-center text-white text-sm font-medium">
                    AI
                  </div>
                  <div className="bg-white border border-[var(--excel-border)] rounded-lg px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                      <span className="text-sm text-gray-500">Thinking...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-[var(--excel-border)] bg-white p-4">
        <form onSubmit={handleSubmit} className="flex space-x-3">
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={sessionId ? "Ask me anything about your data in plain English..." : "Upload data first to start chatting"}
              disabled={!sessionId || loading}
              className="w-full px-4 py-3 border border-[var(--excel-border)] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[var(--excel-green)] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
              rows={1}
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>
          <Button
            type="submit"
            disabled={!inputMessage.trim() || !sessionId || loading}
            className="px-6 py-3 self-end"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </Button>
        </form>
      </div>
    </div>
  );
}
