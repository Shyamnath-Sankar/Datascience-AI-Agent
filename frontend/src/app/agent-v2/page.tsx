'use client';

import React, { useEffect, useCallback } from 'react';
import { AdvancedCanvas } from '@/components/canvas/AdvancedCanvas';
import { AdvancedChat } from '@/components/chat/AdvancedChat';
import { DataSelector } from '@/components/agent/DataSelector';
import { AgentSelector } from '@/components/agent/AgentSelector';
import { 
  useDataScienceStore,
  useSession,
  useCanvas,
  useSelectedAgent,
} from '@/lib/stores';
import {
  useChat,
  useCodeExecution,
  useFiles,
  useDatabase,
} from '@/lib/hooks';
import type { Message, AgentType, Artifact } from '@/lib/types';

// =============================================================================
// SUGGESTED QUESTIONS
// =============================================================================

const SUGGESTED_QUESTIONS = [
  "Show me a summary of this dataset",
  "Visualize the distribution of the main columns",
  "What are the key insights in this data?",
  "Are there any correlations between the numeric columns?",
  "Clean this data and handle missing values",
  "Train a model to predict the target variable",
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function AdvancedAgentPage() {
  // Store state
  const session = useSession();
  const canvas = useCanvas();
  const selectedAgent = useSelectedAgent();
  
  // Store actions
  const {
    setSession,
    setCanvasCode,
    addArtifact,
    pinArtifact,
    setSelectedAgent,
    activeFileId,
    activeConnectionId,
    setActiveFile,
    setActiveConnection,
  } = useDataScienceStore();

  // Initialize session from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedSessionId = localStorage.getItem('sessionId');
      if (storedSessionId && !session) {
        setSession({
          id: storedSessionId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }, [session, setSession]);

  // Chat hook
  const {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
  } = useChat({
    sessionId: session?.id || null,
    autoExecute: true,
    onError: (err) => console.error('Chat error:', err),
  });

  // Code execution hook
  const {
    execute: executeCode,
    isExecuting,
  } = useCodeExecution({
    sessionId: session?.id || null,
    fileId: activeFileId,
    autoInstall: true,
  });

  // Files hook - only use what we need
  useFiles({
    sessionId: session?.id || null,
  });

  // Database hook - only use what we need
  useDatabase({
    sessionId: session?.id || null,
  });

  // Handlers
  const handleSendMessage = useCallback(async (content: string) => {
    await sendMessage(content, {
      agent: selectedAgent || undefined,
    });
  }, [sendMessage, selectedAgent]);

  const handleExecuteCode = useCallback(async (code: string) => {
    setCanvasCode(code);
    await executeCode(code);
  }, [executeCode, setCanvasCode]);

  const handleFileSelect = useCallback((fileId: string) => {
    setActiveFile(fileId);
    setCanvasCode(`# Active File: ${fileId}
# Use pandas to analyze: df.head()
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

print("Dataset Shape:", df.shape)
print("\\nColumn Types:")
print(df.dtypes)
print("\\nFirst 5 rows:")
df.head()
`);
  }, [setActiveFile, setCanvasCode]);

  const handleConnectionSelect = useCallback((connectionId: string) => {
    setActiveConnection(connectionId);
    setCanvasCode(`-- Active Database Connection: ${connectionId}
-- You can ask natural language questions in the chat.
-- SQL queries generated will appear here.

/* Example queries:
SELECT * FROM users LIMIT 5;
SELECT COUNT(*) FROM orders WHERE status = 'completed';
*/
`);
  }, [setActiveConnection, setCanvasCode]);

  const handleAgentSelect = useCallback((agentType: string) => {
    setSelectedAgent(agentType as AgentType);
  }, [setSelectedAgent]);

  const handleGenerateInsights = useCallback(async () => {
    await sendMessage("Analyze this dataset and provide key insights with visualizations");
  }, [sendMessage]);

  const handleAddArtifact = useCallback((artifact: Artifact) => {
    addArtifact(artifact);
  }, [addArtifact]);

  const handlePinArtifact = useCallback((artifactId: string) => {
    pinArtifact(artifactId);
  }, [pinArtifact]);

  // Convert messages to the format expected by AdvancedChat
  const formattedMessages: Message[] = messages.map(msg => ({
    ...msg,
    codeBlocks: msg.codeBlocks?.map((block, i) => ({
      id: `${msg.id}-code-${i}`,
      language: (block.language || 'python') as 'python' | 'sql' | 'r' | 'javascript',
      code: block.code,
      isExecutable: block.language === 'python',
    })),
  }));

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-[var(--bg-secondary)] overflow-hidden">
      {/* Left Sidebar - Data Context & Agents */}
      <aside className="w-80 flex-shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-primary)] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-color)]">
          <h2 className="font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
            Data Context
          </h2>
          <p className="text-xs text-[var(--text-tertiary)]">
            Select a data source to analyze
          </p>
        </div>
        
        {/* Data Selector */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <DataSelector
            sessionId={session?.id || null}
            activeFileId={activeFileId}
            activeConnectionId={activeConnectionId}
            onFileSelect={handleFileSelect}
            onConnectionSelect={handleConnectionSelect}
            onGenerateInsights={handleGenerateInsights}
          />
          
          {/* Agent Selector */}
          <div className="pt-4 border-t border-[var(--border-color)]">
            <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3" />
              </svg>
              AI Agents
            </h3>
            <AgentSelector
              onAgentSelect={handleAgentSelect}
              currentMessage=""
            />
          </div>
          
          {/* Quick Stats */}
          {(activeFileId || activeConnectionId) && (
            <div className="pt-4 border-t border-[var(--border-color)]">
              <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
                Quick Stats
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-[var(--bg-secondary)] rounded-lg">
                  <span className="text-[var(--text-tertiary)]">Messages</span>
                  <p className="font-semibold text-[var(--text-primary)]">{messages.length}</p>
                </div>
                <div className="p-2 bg-[var(--bg-secondary)] rounded-lg">
                  <span className="text-[var(--text-tertiary)]">Charts</span>
                  <p className="font-semibold text-[var(--text-primary)]">
                    {canvas.executionResult?.plots?.length || 0}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Status Bar */}
        <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${
              isLoading || isExecuting
                ? 'bg-yellow-400 animate-pulse'
                : session?.id
                  ? 'bg-green-500'
                  : 'bg-gray-400'
            }`} />
            <span className="text-[var(--text-tertiary)]">
              {isLoading ? 'Processing...' : isExecuting ? 'Executing...' : session?.id ? 'Ready' : 'No session'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0">
        <AdvancedChat
          messages={formattedMessages}
          onSendMessage={handleSendMessage}
          onExecuteCode={handleExecuteCode}
          isLoading={isLoading}
          sessionId={session?.id || null}
          activeAgent={selectedAgent || undefined}
          onAgentChange={(agent) => setSelectedAgent(agent)}
          onClearChat={clearMessages}
          showReasoning={true}
          suggestedQuestions={SUGGESTED_QUESTIONS}
          placeholder={
            activeFileId
              ? "Ask about your data, create visualizations, or run analyses..."
              : activeConnectionId
                ? "Ask questions about your database in natural language..."
                : "Select a data source to start analyzing..."
          }
        />
      </main>

      {/* Right Sidebar - Canvas/Workspace */}
      <aside className="w-[420px] flex-shrink-0 border-l border-[var(--border-color)] bg-[var(--bg-primary)] flex flex-col">
        {/* Header */}
        <div className="p-3 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-secondary)]">
          <h2 className="font-semibold text-[var(--text-primary)] text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            Workspace
          </h2>
          <div className="flex items-center gap-2">
            {isExecuting && (
              <div className="flex items-center gap-1 text-xs text-yellow-600">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Running
              </div>
            )}
            <span className={`w-2 h-2 rounded-full ${
              isExecuting ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'
            }`} />
          </div>
        </div>
        
        {/* Canvas */}
        <div className="flex-1 overflow-hidden">
          <AdvancedCanvas
            code={canvas.code}
            onCodeChange={setCanvasCode}
            onExecute={handleExecuteCode}
            executionResult={canvas.executionResult}
            artifacts={canvas.artifacts}
            isExecuting={isExecuting}
            onAddArtifact={handleAddArtifact}
            onPinArtifact={handlePinArtifact}
            showHistory={true}
          />
        </div>
      </aside>
    </div>
  );
}
