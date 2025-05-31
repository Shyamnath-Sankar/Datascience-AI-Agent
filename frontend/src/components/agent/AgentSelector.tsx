import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
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
  const [loading, setLoading] = useState(false);

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

  const getAgentIcon = (agentName: string) => {
    switch (agentName.toLowerCase()) {
      case 'chart creator':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      case 'data analyst':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'tool advisor':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        );
      case 'business insights':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
    }
  };

  const getAgentType = (agentName: string) => {
    switch (agentName.toLowerCase()) {
      case 'chart creator':
        return 'visualization';
      case 'data analyst':
        return 'code-generation';
      case 'tool advisor':
        return 'package-recommendations';
      case 'business insights':
        return 'insights';
      default:
        return 'code-generation';
    }
  };

  return (
    <div className={`bg-white border border-[var(--excel-border)] rounded-lg ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--excel-border)] bg-gray-50">
        <h3 className="text-sm font-semibold text-[var(--excel-text-primary)]">What would you like to do?</h3>
        {recommendedAgent && (
          <p className="text-xs text-blue-600 mt-1">
            💡 Suggested: {agents.find(a => getAgentType(a.name) === recommendedAgent)?.role || 'Best option for your request'}
          </p>
        )}
      </div>

      {/* Agent Cards */}
      <div className="p-4 space-y-3">
        {agents.map((agent) => {
          const agentType = getAgentType(agent.name);
          const isRecommended = recommendedAgent === agentType;
          const isSelected = selectedAgent === agentType;
          
          return (
            <div
              key={agent.name}
              onClick={() => handleAgentSelect(agentType, agent.name)}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                isSelected
                  ? 'border-[var(--excel-green)] bg-green-50'
                  : isRecommended
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start space-x-3">
                <div className={`p-2 rounded-lg ${
                  isSelected
                    ? 'bg-[var(--excel-green)] text-white'
                    : isRecommended
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {getAgentIcon(agent.name)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-900">{agent.name}</h4>
                    {isRecommended && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                        Recommended
                      </span>
                    )}
                    {isSelected && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                        Selected
                      </span>
                    )}
                  </div>
                  
                  <p className="text-xs text-gray-600 mt-1">{agent.role}</p>
                  <p className="text-xs text-gray-500 mt-1">{agent.goal}</p>
                  
                  {/* Capabilities */}
                  <div className="mt-2">
                    <div className="flex flex-wrap gap-1">
                      {agent.capabilities.slice(0, 3).map((capability, index) => (
                        <span
                          key={index}
                          className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                        >
                          {capability}
                        </span>
                      ))}
                      {agent.capabilities.length > 3 && (
                        <span className="text-xs text-gray-400">
                          +{agent.capabilities.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-3 border-t border-[var(--excel-border)] bg-gray-50">
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => handleAgentSelect('visualization', 'Chart Creator')}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            📊 Create Charts
          </Button>
          <Button
            onClick={() => handleAgentSelect('insights', 'Business Insights')}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            💡 Get Insights
          </Button>
        </div>
      </div>
    </div>
  );
}
