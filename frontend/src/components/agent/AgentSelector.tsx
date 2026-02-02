import React, { useState, useEffect } from 'react';
import { listAvailableAgents, selectBestAgent } from '@/lib/api';

interface Agent {
  name: string;
  role: string;
  goal: string;
  capabilities: string[];
}

interface AgentSelectorProps {
  onAgentSelect: (agentType: string, agentName: string) => void;
  currentMessage?: string;
  className?: string;
}

export function AgentSelector({ onAgentSelect, currentMessage, className = '' }: AgentSelectorProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [recommendedAgent, setRecommendedAgent] = useState<string | null>(null);

  useEffect(() => {
    loadAvailableAgents();
  }, []);

  useEffect(() => {
    if (currentMessage) {
      getRecommendedAgent(currentMessage);
    }
  }, [currentMessage]);

  const loadAvailableAgents = async () => {
    try {
      const response = await listAvailableAgents();
      if (response.success) {
        setAgents(response.agents);
      }
    } catch (error) {
      console.error('Error loading agents:', error);
    }
  };

  const getRecommendedAgent = async (message: string) => {
    try {
      const response = await selectBestAgent(message);
      if (response.success) {
        setRecommendedAgent(response.selected_agent.agent);
      }
    } catch (error) {
      console.error('Error getting agent recommendation:', error);
    }
  };

  const handleAgentSelect = (agentType: string, agentName: string) => {
    setSelectedAgent(agentType);
    onAgentSelect(agentType, agentName);
  };

  const getAgentType = (agentName: string) => {
    switch (agentName.toLowerCase()) {
      case 'chart creator': return 'visualization';
      case 'data analyst': return 'code-generation';
      case 'tool advisor': return 'package-recommendations';
      case 'business insights': return 'insights';
      default: return 'code-generation';
    }
  };

  // Compact agent list for sidebar
  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">AI Specialists</h3>
        {recommendedAgent && (
          <span className="text-[10px] text-[var(--accent-primary)] bg-[var(--accent-subtle)] px-1.5 py-0.5 rounded-full">
            Auto-Detecting
          </span>
        )}
      </div>

      <div className="space-y-1">
        {agents.slice(0, 4).map((agent) => {
          const agentType = getAgentType(agent.name);
          const isRecommended = recommendedAgent === agentType;
          const isSelected = selectedAgent === agentType;
          
          return (
            <button
              key={agent.name}
              onClick={() => handleAgentSelect(agentType, agent.name)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all duration-200 flex items-center justify-between group ${
                isSelected
                  ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-medium shadow-sm'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${
                    isSelected ? 'bg-[var(--accent-primary)]' : 'bg-transparent group-hover:bg-[var(--border-color)]'
                }`}></div>
                <span>{agent.role}</span>
              </div>
              
              {isRecommended && (
                <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_0_2px_white]" title="Recommended for your task"></div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
