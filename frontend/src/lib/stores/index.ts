'use client';

import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  Session,
  DataFile,
  DatabaseConnection,
  Message,
  CanvasState,
  Agent,
  AgentType,
  ExecutionResult,
  Artifact,
  CodeBlock,
} from '@/lib/types';

// =============================================================================
// STORE INTERFACE
// =============================================================================

interface DataScienceStore {
  // Session State
  session: Session | null;
  setSession: (session: Session) => void;
  clearSession: () => void;

  // Files State
  files: DataFile[];
  activeFileId: string | null;
  addFile: (file: DataFile) => void;
  removeFile: (fileId: string) => void;
  setActiveFile: (fileId: string | null) => void;

  // Database Connections State
  connections: DatabaseConnection[];
  activeConnectionId: string | null;
  addConnection: (connection: DatabaseConnection) => void;
  removeConnection: (connectionId: string) => void;
  setActiveConnection: (connectionId: string | null) => void;
  updateConnectionStatus: (connectionId: string, status: DatabaseConnection['status']) => void;

  // Messages State
  messages: Message[];
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  clearMessages: () => void;
  setMessages: (messages: Message[]) => void;

  // Canvas State
  canvas: CanvasState;
  setCanvasCode: (code: string) => void;
  setExecutionResult: (result: ExecutionResult | undefined) => void;
  setActiveTab: (tab: CanvasState['activeTab']) => void;
  addArtifact: (artifact: Artifact) => void;
  removeArtifact: (artifactId: string) => void;
  pinArtifact: (artifactId: string) => void;
  addToHistory: (entry: { code: string; result?: ExecutionResult }) => void;

  // Agent State
  agents: Agent[];
  selectedAgent: AgentType | null;
  setAgents: (agents: Agent[]) => void;
  setSelectedAgent: (agent: AgentType | null) => void;

  // UI State
  isLoading: boolean;
  isExecuting: boolean;
  error: string | null;
  setLoading: (loading: boolean) => void;
  setExecuting: (executing: boolean) => void;
  setError: (error: string | null) => void;

  // Hydration state
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;

  // Computed/Derived
  hasActiveDataSource: () => boolean;
  getActiveDataSourceType: () => 'file' | 'database' | null;
}

// =============================================================================
// DEFAULT VALUES
// =============================================================================

const defaultCanvasState: CanvasState = {
  activeTab: 'code',
  code: '# Start coding here\nimport pandas as pd\nimport matplotlib.pyplot as plt\n\n# Your data is available as df\nprint(df.head())\n',
  executionResult: undefined,
  artifacts: [],
  pinnedArtifacts: [],
  isExecuting: false,
  history: [],
};

const defaultAgents: Agent[] = [
  {
    id: 'visualization',
    name: 'Chart Creator',
    role: 'Create Charts & Graphs',
    goal: 'Turn your data into clear, easy-to-understand visual charts',
    icon: 'chart-bar',
    capabilities: ['Bar charts', 'Line charts', 'Scatter plots', 'Histograms', 'Heatmaps'],
    keywords: ['chart', 'plot', 'graph', 'visualize', 'show'],
  },
  {
    id: 'code-generation',
    name: 'Data Analyst',
    role: 'Analyze & Process Data',
    goal: 'Answer your questions by analyzing your data',
    icon: 'code',
    capabilities: ['Data analysis', 'Calculations', 'Data processing', 'Custom code'],
    keywords: ['analyze', 'calculate', 'process', 'code'],
  },
  {
    id: 'prediction',
    name: 'Prediction Expert',
    role: 'Forecast & Predict',
    goal: 'Make accurate predictions using statistical models',
    icon: 'trending-up',
    capabilities: ['Linear regression', 'Polynomial regression', 'Time series', 'Forecasting'],
    keywords: ['predict', 'forecast', 'future', 'estimate', 'projection'],
  },
  {
    id: 'statistics',
    name: 'Statistics Expert',
    role: 'Statistical Analysis',
    goal: 'Perform rigorous hypothesis testing and statistical analysis',
    icon: 'calculator',
    capabilities: ['T-tests', 'ANOVA', 'Chi-square', 'Correlation', 'Hypothesis testing'],
    keywords: ['significant', 'correlation', 'test', 'p-value', 'hypothesis'],
  },
  {
    id: 'eda',
    name: 'EDA Expert',
    role: 'Exploratory Analysis',
    goal: 'Comprehensive exploratory data analysis',
    icon: 'search',
    capabilities: ['Data profiling', 'Distribution analysis', 'Missing values', 'Outlier detection'],
    keywords: ['explore', 'summary', 'overview', 'describe', 'profile'],
  },
  {
    id: 'sql',
    name: 'SQL Expert',
    role: 'Database Query Expert',
    goal: 'Answer questions about your database using natural language',
    icon: 'database',
    capabilities: ['Natural language to SQL', 'Query optimization', 'Schema exploration'],
    keywords: ['sql', 'query', 'database', 'table', 'select'],
  },
  {
    id: 'ml',
    name: 'ML Engineer',
    role: 'Machine Learning',
    goal: 'Build and train machine learning models',
    icon: 'cpu',
    capabilities: ['Classification', 'Regression', 'Clustering', 'Feature importance'],
    keywords: ['train', 'model', 'classify', 'cluster', 'machine learning'],
  },
  {
    id: 'insights',
    name: 'Business Insights',
    role: 'Generate Business Insights',
    goal: 'Discover key insights and opportunities in your data',
    icon: 'lightbulb',
    capabilities: ['Pattern detection', 'Trend analysis', 'Anomaly detection', 'Recommendations'],
    keywords: ['insight', 'pattern', 'trend', 'finding', 'recommendation'],
  },
];

// =============================================================================
// STORE IMPLEMENTATION (NO PERSIST - SSR SAFE)
// =============================================================================

export const useDataScienceStore = create<DataScienceStore>()(
  immer((set, get) => ({
    // Hydration state
    _hasHydrated: true, // No hydration needed without persist
    setHasHydrated: (state) => set({ _hasHydrated: state }),

    // Session State
    session: null,
    setSession: (session) => set((state) => { state.session = session; }),
    clearSession: () => set((state) => { 
      state.session = null;
      state.files = [];
      state.connections = [];
      state.messages = [];
      state.activeFileId = null;
      state.activeConnectionId = null;
    }),

    // Files State
    files: [],
    activeFileId: null,
    addFile: (file) => set((state) => { 
      state.files.push(file);
      state.activeFileId = file.id;
      state.activeConnectionId = null;
    }),
    removeFile: (fileId) => set((state) => { 
      state.files = state.files.filter(f => f.id !== fileId);
      if (state.activeFileId === fileId) {
        state.activeFileId = state.files.length > 0 ? state.files[0].id : null;
      }
    }),
    setActiveFile: (fileId) => set((state) => { 
      state.activeFileId = fileId;
      state.activeConnectionId = null;
    }),

    // Database Connections State
    connections: [],
    activeConnectionId: null,
    addConnection: (connection) => set((state) => { 
      state.connections.push(connection);
      state.activeConnectionId = connection.id;
      state.activeFileId = null;
    }),
    removeConnection: (connectionId) => set((state) => { 
      state.connections = state.connections.filter(c => c.id !== connectionId);
      if (state.activeConnectionId === connectionId) {
        state.activeConnectionId = null;
      }
    }),
    setActiveConnection: (connectionId) => set((state) => { 
      state.activeConnectionId = connectionId;
      state.activeFileId = null;
    }),
    updateConnectionStatus: (connectionId, status) => set((state) => {
      const conn = state.connections.find(c => c.id === connectionId);
      if (conn) conn.status = status;
    }),

    // Messages State
    messages: [],
    addMessage: (message) => set((state) => { 
      state.messages.push(message);
    }),
    updateMessage: (messageId, updates) => set((state) => {
      const msg = state.messages.find(m => m.id === messageId);
      if (msg) {
        Object.assign(msg, updates);
      }
    }),
    clearMessages: () => set((state) => { 
      state.messages = [];
    }),
    setMessages: (messages) => set((state) => { 
      state.messages = messages;
    }),

    // Canvas State
    canvas: defaultCanvasState,
    setCanvasCode: (code) => set((state) => { 
      state.canvas.code = code;
    }),
    setExecutionResult: (result) => set((state) => { 
      state.canvas.executionResult = result;
    }),
    setActiveTab: (tab) => set((state) => { 
      state.canvas.activeTab = tab;
    }),
    addArtifact: (artifact) => set((state) => { 
      state.canvas.artifacts.push(artifact);
    }),
    removeArtifact: (artifactId) => set((state) => { 
      state.canvas.artifacts = state.canvas.artifacts.filter(a => a.id !== artifactId);
      state.canvas.pinnedArtifacts = state.canvas.pinnedArtifacts.filter(id => id !== artifactId);
    }),
    pinArtifact: (artifactId) => set((state) => {
      const artifact = state.canvas.artifacts.find(a => a.id === artifactId);
      if (artifact) {
        artifact.isPinned = !artifact.isPinned;
        if (artifact.isPinned) {
          state.canvas.pinnedArtifacts.push(artifactId);
        } else {
          state.canvas.pinnedArtifacts = state.canvas.pinnedArtifacts.filter(id => id !== artifactId);
        }
      }
    }),
    addToHistory: (entry) => set((state) => {
      state.canvas.history.unshift({
        id: Date.now().toString(),
        code: entry.code,
        executionResult: entry.result,
        timestamp: new Date(),
      });
      // Keep only last 50 entries
      if (state.canvas.history.length > 50) {
        state.canvas.history = state.canvas.history.slice(0, 50);
      }
    }),

    // Agent State
    agents: defaultAgents,
    selectedAgent: null,
    setAgents: (agents) => set((state) => { 
      state.agents = agents;
    }),
    setSelectedAgent: (agent) => set((state) => { 
      state.selectedAgent = agent;
    }),

    // UI State
    isLoading: false,
    isExecuting: false,
    error: null,
    setLoading: (loading) => set((state) => { 
      state.isLoading = loading;
    }),
    setExecuting: (executing) => set((state) => { 
      state.isExecuting = executing;
      state.canvas.isExecuting = executing;
    }),
    setError: (error) => set((state) => { 
      state.error = error;
    }),

    // Computed/Derived
    hasActiveDataSource: () => {
      const state = get();
      return state.activeFileId !== null || state.activeConnectionId !== null;
    },
    getActiveDataSourceType: () => {
      const state = get();
      if (state.activeFileId) return 'file';
      if (state.activeConnectionId) return 'database';
      return null;
    },
  }))
);

// =============================================================================
// SELECTOR HOOKS
// =============================================================================

export const useSession = () => useDataScienceStore((state) => state.session);
export const useFiles = () => useDataScienceStore((state) => state.files);
export const useActiveFile = () => {
  const files = useDataScienceStore((state) => state.files);
  const activeFileId = useDataScienceStore((state) => state.activeFileId);
  return files.find((f) => f.id === activeFileId);
};
export const useConnections = () => useDataScienceStore((state) => state.connections);
export const useActiveConnection = () => {
  const connections = useDataScienceStore((state) => state.connections);
  const activeConnectionId = useDataScienceStore((state) => state.activeConnectionId);
  return connections.find((c) => c.id === activeConnectionId);
};
export const useMessages = () => useDataScienceStore((state) => state.messages);
export const useCanvas = () => useDataScienceStore((state) => state.canvas);
export const useAgents = () => useDataScienceStore((state) => state.agents);
export const useSelectedAgent = () => useDataScienceStore((state) => state.selectedAgent);
export const useIsLoading = () => useDataScienceStore((state) => state.isLoading);
export const useIsExecuting = () => useDataScienceStore((state) => state.isExecuting);
export const useError = () => useDataScienceStore((state) => state.error);
export const useHasHydrated = () => useDataScienceStore((state) => state._hasHydrated);

// =============================================================================
// LOCAL STORAGE HELPER (Use in components with useEffect)
// =============================================================================

export const loadFromLocalStorage = () => {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem('data-science-store');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.state || null;
    }
  } catch (e) {
    console.error('Failed to load from localStorage:', e);
  }
  return null;
};

export const saveToLocalStorage = (state: Partial<DataScienceStore>) => {
  if (typeof window === 'undefined') return;
  
  try {
    const toStore = {
      session: state.session,
      activeFileId: state.activeFileId,
      activeConnectionId: state.activeConnectionId,
      selectedAgent: state.selectedAgent,
    };
    localStorage.setItem('data-science-store', JSON.stringify({ state: toStore }));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
};
