/**
 * Comprehensive Type System for the Data Science AI Platform
 * Provides full type safety across the application
 */

// =============================================================================
// CORE ENTITIES
// =============================================================================

export interface Session {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  activeFileId?: string;
  activeConnectionId?: string;
  metadata?: Record<string, unknown>;
}

export interface DataFile {
  id: string;
  name: string;
  size: number;
  type: 'csv' | 'excel' | 'json' | 'parquet';
  uploadedAt: Date;
  columns: ColumnInfo[];
  rowCount: number;
  sessionId: string;
}

export interface ColumnInfo {
  name: string;
  type: DataType;
  nullable: boolean;
  uniqueCount: number;
  missingCount: number;
  missingPercent: number;
  statistics?: ColumnStatistics;
}

export type DataType = 
  | 'string' 
  | 'number' 
  | 'integer' 
  | 'float' 
  | 'boolean' 
  | 'datetime' 
  | 'category';

export interface ColumnStatistics {
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  std?: number;
  q25?: number;
  q75?: number;
  mode?: string | number;
  skewness?: number;
  kurtosis?: number;
}

// =============================================================================
// DATABASE TYPES
// =============================================================================

export interface DatabaseConnection {
  id: string;
  name: string;
  dbType: 'postgresql' | 'mysql' | 'sqlite' | 'mssql' | 'oracle';
  host: string;
  port: number;
  database: string;
  username: string;
  status: 'connected' | 'disconnected' | 'error';
  schema?: DatabaseSchema;
  connectedAt?: Date;
}

export interface DatabaseSchema {
  tables: TableInfo[];
  views: ViewInfo[];
  lastRefreshed: Date;
}

export interface TableInfo {
  name: string;
  schema: string;
  columns: DatabaseColumn[];
  primaryKey?: string[];
  foreignKeys?: ForeignKey[];
  indexes?: IndexInfo[];
  rowCount?: number;
}

export interface DatabaseColumn {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  references?: { table: string; column: string };
}

export interface ForeignKey {
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
}

export interface ViewInfo {
  name: string;
  schema: string;
  definition?: string;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  isUnique: boolean;
}

// =============================================================================
// AGENT TYPES
// =============================================================================

export type AgentType = 
  | 'visualization' 
  | 'code-generation' 
  | 'insights' 
  | 'prediction' 
  | 'statistics' 
  | 'eda' 
  | 'sql' 
  | 'ml';

export interface Agent {
  id: AgentType;
  name: string;
  role: string;
  goal: string;
  icon: string;
  capabilities: string[];
  keywords: string[];
}

export interface AgentResponse {
  success: boolean;
  agent: string;
  response: string;
  codeBlocks?: CodeBlock[];
  hasCode: boolean;
  executionResult?: ExecutionResult;
  executedCode?: string;
  reasoningTrace?: ReasoningTrace;
  error?: string;
}

export interface ReasoningTrace {
  steps: ReasoningStep[];
  finalAnswer?: string;
  totalTokens: number;
  executionTimeMs: number;
}

export interface ReasoningStep {
  step: 'think' | 'plan' | 'act' | 'observe' | 'reflect' | 'complete';
  content: string;
  timestamp: string;
  toolCall?: ToolCall;
  observation?: string;
  confidence: number;
}

export interface ToolCall {
  tool: string;
  parameters: Record<string, unknown>;
}

// =============================================================================
// CHAT & MESSAGING
// =============================================================================

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  codeBlocks?: CodeBlock[];
  executionResult?: ExecutionResult;
  artifacts?: Artifact[];
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  agentUsed?: AgentType;
  processingTimeMs?: number;
  tokenCount?: number;
  model?: string;
  reasoningTrace?: ReasoningTrace;
}

export interface CodeBlock {
  id: string;
  language: 'python' | 'sql' | 'r' | 'javascript';
  code: string;
  description?: string;
  isExecutable: boolean;
  executionStatus?: 'pending' | 'running' | 'success' | 'error';
}

// =============================================================================
// EXECUTION & RESULTS
// =============================================================================

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  plots: PlotData[];
  variables: Record<string, VariableInfo>;
  dataframes?: DataFramePreview[];
  installations?: PackageInstallation[];
  executionTimeMs: number;
  memoryUsedMb?: number;
}

export interface PlotData {
  id: string;
  type: 'matplotlib' | 'plotly' | 'bokeh';
  data: string; // base64 for static, JSON for interactive
  title?: string;
  metadata?: PlotMetadata;
}

export interface PlotMetadata {
  width: number;
  height: number;
  format: 'png' | 'svg' | 'html';
  interactivity?: boolean;
}

export interface VariableInfo {
  name: string;
  type: string;
  shape?: number[];
  columns?: string[];
  length?: number;
  value?: string;
  memory?: string;
  dtype?: string;
  preview?: string;
}

export interface DataFramePreview {
  name: string;
  shape: [number, number];
  columns: string[];
  dtypes: Record<string, string>;
  head: Record<string, unknown>[];
}

export interface PackageInstallation {
  package: string;
  version?: string;
  success: boolean;
  message: string;
}

// =============================================================================
// CANVAS & ARTIFACTS
// =============================================================================

export type ArtifactType = 
  | 'code' 
  | 'visualization' 
  | 'data' 
  | 'table' 
  | 'markdown' 
  | 'json' 
  | 'insight';

export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  content: string | PlotData | DataFramePreview;
  createdAt: Date;
  sourceMessageId?: string;
  isPinned: boolean;
  metadata?: Record<string, unknown>;
}

export interface CanvasState {
  activeTab: CanvasTab;
  code: string;
  executionResult?: ExecutionResult;
  artifacts: Artifact[];
  pinnedArtifacts: string[];
  isExecuting: boolean;
  history: CanvasHistoryEntry[];
}

export type CanvasTab = 'code' | 'results' | 'charts' | 'data' | 'artifacts';

export interface CanvasHistoryEntry {
  id: string;
  code: string;
  executionResult?: ExecutionResult;
  timestamp: Date;
}

// =============================================================================
// VISUALIZATION TYPES
// =============================================================================

export type ChartType = 
  | 'bar' 
  | 'line' 
  | 'scatter' 
  | 'pie' 
  | 'histogram' 
  | 'box' 
  | 'heatmap' 
  | 'area' 
  | 'bubble'
  | 'treemap'
  | 'funnel';

export interface ChartConfig {
  type: ChartType;
  title: string;
  xColumn?: string;
  yColumn?: string;
  groupBy?: string;
  aggregation?: 'sum' | 'mean' | 'count' | 'min' | 'max' | 'median';
  colorScheme?: string;
  showLegend?: boolean;
  showGrid?: boolean;
  annotations?: ChartAnnotation[];
}

export interface ChartAnnotation {
  type: 'point' | 'line' | 'region' | 'text';
  x?: number | string;
  y?: number | string;
  text?: string;
  color?: string;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
}

// =============================================================================
// MACHINE LEARNING TYPES
// =============================================================================

export type MLModelType = 
  | 'linear_regression' 
  | 'logistic_regression' 
  | 'random_forest' 
  | 'xgboost' 
  | 'gradient_boosting'
  | 'svm'
  | 'kmeans'
  | 'dbscan';

export interface MLModel {
  id: string;
  name: string;
  type: MLModelType;
  targetColumn: string;
  featureColumns: string[];
  trainedAt: Date;
  metrics: ModelMetrics;
  featureImportance?: FeatureImportance[];
}

export interface ModelMetrics {
  // Classification metrics
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  rocAuc?: number;
  confusionMatrix?: number[][];
  
  // Regression metrics
  r2?: number;
  mae?: number;
  rmse?: number;
  mape?: number;
  
  // Clustering metrics
  silhouetteScore?: number;
  inertia?: number;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
  rank: number;
}

// =============================================================================
// STREAMING TYPES
// =============================================================================

export interface StreamingMessage {
  type: 'token' | 'code_block' | 'execution_start' | 'execution_result' | 'artifact' | 'done' | 'error';
  content?: string;
  codeBlock?: CodeBlock;
  executionResult?: ExecutionResult;
  artifact?: Artifact;
  error?: string;
}

export interface StreamingOptions {
  onToken?: (token: string) => void;
  onCodeBlock?: (block: CodeBlock) => void;
  onExecutionStart?: () => void;
  onExecutionResult?: (result: ExecutionResult) => void;
  onArtifact?: (artifact: Artifact) => void;
  onComplete?: (response: AgentResponse) => void;
  onError?: (error: Error) => void;
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: APIError;
  meta?: APIMeta;
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface APIMeta {
  requestId: string;
  processingTimeMs: number;
  version: string;
}

export interface ChatRequest {
  message: string;
  fileId?: string;
  connectionId?: string;
  autoExecute?: boolean;
  streaming?: boolean;
  agent?: AgentType;
}

export interface ExecuteCodeRequest {
  code: string;
  fileId?: string;
  autoInstall?: boolean;
  timeout?: number;
}

export interface DatabaseQueryRequest {
  question?: string;
  sql?: string;
  execute?: boolean;
  explain?: boolean;
}

// =============================================================================
// STATE MANAGEMENT TYPES
// =============================================================================

export interface AppState {
  session: Session | null;
  files: DataFile[];
  connections: DatabaseConnection[];
  messages: Message[];
  canvas: CanvasState;
  agents: Agent[];
  selectedAgent: AgentType | null;
  isLoading: boolean;
  error: string | null;
}

export type AppAction = 
  | { type: 'SET_SESSION'; payload: Session }
  | { type: 'ADD_FILE'; payload: DataFile }
  | { type: 'REMOVE_FILE'; payload: string }
  | { type: 'SET_ACTIVE_FILE'; payload: string }
  | { type: 'ADD_CONNECTION'; payload: DatabaseConnection }
  | { type: 'SET_ACTIVE_CONNECTION'; payload: string }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'UPDATE_MESSAGE'; payload: Partial<Message> & { id: string } }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'SET_CANVAS_CODE'; payload: string }
  | { type: 'SET_EXECUTION_RESULT'; payload: ExecutionResult }
  | { type: 'ADD_ARTIFACT'; payload: Artifact }
  | { type: 'PIN_ARTIFACT'; payload: string }
  | { type: 'SET_SELECTED_AGENT'; payload: AgentType }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };
