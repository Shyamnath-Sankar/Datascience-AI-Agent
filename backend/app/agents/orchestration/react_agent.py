"""
Advanced Agent Orchestration System.
Implements:
- ReAct (Reasoning + Acting) pattern with REAL tool execution
- Tool calling with structured outputs
- Multi-agent collaboration
- Adaptive planning
- Error recovery with self-healing loops
"""

from typing import Dict, Any, List, Optional, Callable, Union
from dataclasses import dataclass, field
from enum import Enum
from abc import ABC, abstractmethod
import logging
import json
import re
import asyncio
from datetime import datetime

logger = logging.getLogger(__name__)


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================


class ToolType(Enum):
    """Types of tools available to agents."""

    DATA_QUERY = "data_query"
    VISUALIZATION = "visualization"
    STATISTICAL = "statistical"
    MACHINE_LEARNING = "machine_learning"
    SQL = "sql"
    CODE_EXECUTION = "code_execution"


@dataclass
class Tool:
    """Definition of a tool that agents can use."""

    name: str
    description: str
    tool_type: ToolType
    parameters: Dict[str, Any]
    required_params: List[str]
    execute: Optional[Callable] = None

    def to_schema(self) -> Dict[str, Any]:
        """Convert tool to JSON schema for LLM."""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": self.parameters,
                "required": self.required_params,
            },
        }


# =============================================================================
# TOOL EXECUTOR REGISTRY — Binds tools to real implementations
# =============================================================================


class ToolExecutorRegistry:
    """
    Registry that binds tool names to real executor callables.
    Initialized lazily to avoid circular imports.
    """

    _executors: Dict[str, Callable] = {}
    _initialized: bool = False

    @classmethod
    def initialize(cls):
        """Register all real tool executors. Called once on first use."""
        if cls._initialized:
            return

        cls._executors = {
            "execute_python": cls._execute_python,
            "create_visualization": cls._create_visualization,
            "run_statistical_test": cls._run_statistical_test,
            "train_model": cls._train_model,
            "query_database": cls._query_database,
        }
        cls._initialized = True

    @classmethod
    def get_executor(cls, tool_name: str) -> Optional[Callable]:
        """Get the executor for a tool name."""
        cls.initialize()
        return cls._executors.get(tool_name)

    # -------------------------------------------------------------------------
    # Real Tool Implementations
    # -------------------------------------------------------------------------

    @staticmethod
    async def _execute_python(session_id: str, **params) -> Dict[str, Any]:
        """Execute Python code using the CodeExecutor."""
        from ...utils.code_executor import code_executor

        code = params.get("code", "")
        file_id = params.get("file_id")
        description = params.get("description", "")

        if not code.strip():
            return {"success": False, "error": "No code provided"}

        result = await asyncio.to_thread(
            code_executor.execute_code, code, session_id, file_id
        )

        # Format result for the agent
        output_parts = []
        if result.get("output"):
            output_parts.append(f"Output:\n{result['output'][:2000]}")
        if result.get("error"):
            output_parts.append(f"Error:\n{result['error']}")
        if result.get("plots"):
            output_parts.append(f"Generated {len(result['plots'])} plot(s)")
        if result.get("variables"):
            var_summary = ", ".join(
                f"{k}: {v.get('type', 'unknown')}" 
                for k, v in list(result['variables'].items())[:10]
            )
            output_parts.append(f"Variables: {var_summary}")

        return {
            "success": result.get("success", False),
            "output": "\n".join(output_parts) if output_parts else "Code executed with no output.",
            "plots": result.get("plots", []),
            "variables": result.get("variables", {}),
            "error": result.get("error"),
        }

    @staticmethod
    async def _create_visualization(session_id: str, **params) -> Dict[str, Any]:
        """Create a visualization by generating and executing matplotlib code."""
        chart_type = params.get("chart_type", "bar")
        x_column = params.get("x_column", "")
        y_column = params.get("y_column", "")
        title = params.get("title", "Chart")
        filter_expr = params.get("filter", "")

        # Build visualization code
        code_lines = [
            "import matplotlib.pyplot as plt",
            "import seaborn as sns",
            "plt.style.use('seaborn-v0_8-whitegrid')",
            "fig, ax = plt.subplots(figsize=(10, 6), dpi=100)",
        ]

        if filter_expr:
            code_lines.append(f"plot_df = df.query('{filter_expr}')")
        else:
            code_lines.append("plot_df = df")

        chart_code = {
            "bar": f"sns.barplot(data=plot_df, x='{x_column}', y='{y_column}', ax=ax)",
            "line": f"sns.lineplot(data=plot_df, x='{x_column}', y='{y_column}', ax=ax)",
            "scatter": f"sns.scatterplot(data=plot_df, x='{x_column}', y='{y_column}', ax=ax)",
            "histogram": f"sns.histplot(data=plot_df, x='{x_column}', kde=True, ax=ax)",
            "heatmap": f"sns.heatmap(plot_df.select_dtypes(include='number').corr(), annot=True, fmt='.2f', ax=ax)",
            "box": f"sns.boxplot(data=plot_df, x='{x_column}', y='{y_column}', ax=ax)",
            "pie": f"plot_df['{x_column}'].value_counts().head(10).plot.pie(ax=ax, autopct='%1.1f%%')",
        }

        code_lines.append(chart_code.get(chart_type, chart_code["bar"]))
        code_lines.append(f"ax.set_title('{title}', fontsize=14, fontweight='bold', pad=20)")
        code_lines.append("plt.tight_layout()")
        code_lines.append("plt.show()")

        code = "\n".join(code_lines)

        # Execute the generated visualization code
        result = await ToolExecutorRegistry._execute_python(
            session_id, code=code, description=f"Creating {chart_type} chart"
        )
        result["generated_code"] = code
        return result

    @staticmethod
    async def _run_statistical_test(session_id: str, **params) -> Dict[str, Any]:
        """Run a statistical test by generating and executing scipy code."""
        test_type = params.get("test_type", "correlation")
        column1 = params.get("column1", "")
        column2 = params.get("column2", "")
        group_column = params.get("group_column", "")

        test_code = {
            "ttest": f"""
from scipy import stats
import numpy as np
if '{group_column}':
    groups = df['{group_column}'].unique()[:2]
    group1 = df[df['{group_column}'] == groups[0]]['{column1}'].dropna()
    group2 = df[df['{group_column}'] == groups[1]]['{column1}'].dropna()
else:
    group1 = df['{column1}'].dropna()
    group2 = df['{column2}'].dropna()

stat, p_value = stats.ttest_ind(group1, group2)
pooled_std = np.sqrt((group1.std()**2 + group2.std()**2) / 2)
cohens_d = abs(group1.mean() - group2.mean()) / pooled_std if pooled_std > 0 else 0

print("=" * 55)
print("STATISTICAL TEST: Independent t-test")
print("=" * 55)
print(f"Group 1 mean: {{group1.mean():.4f}} (n={{len(group1)}})")
print(f"Group 2 mean: {{group2.mean():.4f}} (n={{len(group2)}})")
print(f"t-statistic: {{stat:.4f}}")
print(f"p-value: {{p_value:.6f}}")
print(f"Cohen's d: {{cohens_d:.4f}}")
print(f"Significant (α=0.05): {{'Yes' if p_value < 0.05 else 'No'}}")
print("=" * 55)
""",
            "correlation": f"""
from scipy import stats
col1 = df['{column1}'].dropna()
col2 = df['{column2}'].dropna()
min_len = min(len(col1), len(col2))
col1, col2 = col1.iloc[:min_len], col2.iloc[:min_len]

r_pearson, p_pearson = stats.pearsonr(col1, col2)
r_spearman, p_spearman = stats.spearmanr(col1, col2)

print("=" * 55)
print("CORRELATION ANALYSIS")
print("=" * 55)
print(f"Pearson r: {{r_pearson:.4f}} (p={{p_pearson:.6f}})")
print(f"Spearman ρ: {{r_spearman:.4f}} (p={{p_spearman:.6f}})")
strength = 'strong' if abs(r_pearson) > 0.7 else 'moderate' if abs(r_pearson) > 0.4 else 'weak'
direction = 'positive' if r_pearson > 0 else 'negative'
print(f"Interpretation: {{strength}} {{direction}} correlation")
print("=" * 55)
""",
            "anova": f"""
from scipy import stats
groups = [group['{column1}'].dropna().values for name, group in df.groupby('{group_column}')]
stat, p_value = stats.f_oneway(*groups)
eta_sq = stat * (len(groups) - 1) / (stat * (len(groups) - 1) + sum(len(g) for g in groups) - len(groups))

print("=" * 55)
print("ONE-WAY ANOVA")
print("=" * 55)
print(f"F-statistic: {{stat:.4f}}")
print(f"p-value: {{p_value:.6f}}")
print(f"Eta-squared: {{eta_sq:.4f}}")
print(f"Groups compared: {{len(groups)}}")
print(f"Significant (α=0.05): {{'Yes' if p_value < 0.05 else 'No'}}")
print("=" * 55)
""",
            "chi_square": f"""
from scipy import stats
contingency = pd.crosstab(df['{column1}'], df['{column2}'])
chi2, p_value, dof, expected = stats.chi2_contingency(contingency)
n = contingency.sum().sum()
cramers_v = (chi2 / (n * (min(contingency.shape) - 1))) ** 0.5

print("=" * 55)
print("CHI-SQUARE TEST")
print("=" * 55)
print(f"Chi-square: {{chi2:.4f}}")
print(f"p-value: {{p_value:.6f}}")
print(f"Degrees of freedom: {{dof}}")
print(f"Cramer's V: {{cramers_v:.4f}}")
print(f"Significant (α=0.05): {{'Yes' if p_value < 0.05 else 'No'}}")
print("=" * 55)
""",
            "normality": f"""
from scipy import stats
data = df['{column1}'].dropna()
stat_sw, p_sw = stats.shapiro(data[:5000])
stat_ks, p_ks = stats.kstest(data, 'norm', args=(data.mean(), data.std()))

print("=" * 55)
print("NORMALITY TESTS")
print("=" * 55)
print(f"Shapiro-Wilk: W={{stat_sw:.4f}}, p={{p_sw:.6f}}")
print(f"Kolmogorov-Smirnov: D={{stat_ks:.4f}}, p={{p_ks:.6f}}")
print(f"Skewness: {{data.skew():.4f}}")
print(f"Kurtosis: {{data.kurtosis():.4f}}")
normal = p_sw > 0.05
print(f"Normal distribution (Shapiro, α=0.05): {{'Yes' if normal else 'No'}}")
print("=" * 55)
""",
        }

        code = test_code.get(test_type, test_code["correlation"])
        result = await ToolExecutorRegistry._execute_python(
            session_id, code=code, description=f"Running {test_type} test"
        )
        result["generated_code"] = code
        return result

    @staticmethod
    async def _train_model(session_id: str, **params) -> Dict[str, Any]:
        """Train an ML model by generating and executing sklearn code."""
        model_type = params.get("model_type", "linear_regression")
        target = params.get("target_column", "")
        features = params.get("feature_columns", [])
        test_size = params.get("test_size", 0.2)

        features_str = str(features)

        code = f"""
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix

# Prepare data
feature_cols = {features_str}
target_col = '{target}'

# Drop rows with missing values in relevant columns
model_df = df[feature_cols + [target_col]].dropna()

# Encode categorical features
le_dict = {{}}
for col in feature_cols:
    if model_df[col].dtype == 'object':
        le_dict[col] = LabelEncoder()
        model_df[col] = le_dict[col].fit_transform(model_df[col])

X = model_df[feature_cols].values
y = model_df[target_col].values

# Encode target if categorical
is_classification = model_df[target_col].dtype == 'object' or model_df[target_col].nunique() < 20
if model_df[target_col].dtype == 'object':
    le_target = LabelEncoder()
    y = le_target.fit_transform(y)

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size={test_size}, random_state=42)

# Scale features
scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s = scaler.transform(X_test)
"""

        model_imports = {
            "linear_regression": "from sklearn.linear_model import LinearRegression\nmodel = LinearRegression()",
            "logistic_regression": "from sklearn.linear_model import LogisticRegression\nmodel = LogisticRegression(max_iter=1000)",
            "random_forest": "from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor\nmodel = RandomForestClassifier(n_estimators=100, random_state=42) if is_classification else RandomForestRegressor(n_estimators=100, random_state=42)",
            "xgboost": "from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor\nmodel = GradientBoostingClassifier(random_state=42) if is_classification else GradientBoostingRegressor(random_state=42)",
            "kmeans": "from sklearn.cluster import KMeans\nmodel = KMeans(n_clusters=min(5, len(X_train)), random_state=42)",
        }

        code += model_imports.get(model_type, model_imports["linear_regression"])
        code += f"""

# Train
model.fit(X_train_s, y_train)
y_pred = model.predict(X_test_s)

# Evaluate
print("=" * 55)
print("MACHINE LEARNING RESULTS")
print("=" * 55)
print(f"Model: {model_type}")
print(f"Features: {{len(feature_cols)}}")
print(f"Train samples: {{len(X_train)}} / Test samples: {{len(X_test)}}")
print("-" * 55)

if is_classification and '{model_type}' != 'kmeans':
    print(f"Accuracy: {{accuracy_score(y_test, y_pred):.4f}}")
    print(f"Precision: {{precision_score(y_test, y_pred, average='weighted', zero_division=0):.4f}}")
    print(f"Recall: {{recall_score(y_test, y_pred, average='weighted', zero_division=0):.4f}}")
    print(f"F1 Score: {{f1_score(y_test, y_pred, average='weighted', zero_division=0):.4f}}")
else:
    print(f"R² Score: {{r2_score(y_test, y_pred):.4f}}")
    print(f"MAE: {{mean_absolute_error(y_test, y_pred):.4f}}")
    print(f"RMSE: {{mean_squared_error(y_test, y_pred, squared=False):.4f}}")

# Feature importance
if hasattr(model, 'feature_importances_'):
    importance = sorted(zip(feature_cols, model.feature_importances_), key=lambda x: x[1], reverse=True)
    print("\\nTop Features:")
    for feat, imp in importance[:5]:
        print(f"  {{feat}}: {{imp:.4f}}")
elif hasattr(model, 'coef_'):
    coefs = model.coef_.flatten() if hasattr(model.coef_, 'flatten') else model.coef_
    importance = sorted(zip(feature_cols, abs(coefs)), key=lambda x: x[1], reverse=True)
    print("\\nTop Features (by coefficient magnitude):")
    for feat, imp in importance[:5]:
        print(f"  {{feat}}: {{imp:.4f}}")

print("=" * 55)
"""
        result = await ToolExecutorRegistry._execute_python(
            session_id, code=code, description=f"Training {model_type} model"
        )
        result["generated_code"] = code
        return result

    @staticmethod
    async def _query_database(session_id: str, **params) -> Dict[str, Any]:
        """Execute SQL query against connected database."""
        sql = params.get("sql", "")
        explain = params.get("explain", True)

        if not sql.strip():
            return {"success": False, "error": "No SQL query provided", "output": ""}

        try:
            from ...utils.sql_agent import get_sql_agent
            agent = get_sql_agent()
            result = agent.execute_query(sql)
            return {
                "success": True,
                "output": f"Query returned {result.get('row_count', 0)} rows.\n{str(result.get('data', ''))[:2000]}",
                "data": result.get("data"),
                "row_count": result.get("row_count", 0),
            }
        except ImportError:
            return {
                "success": False,
                "error": "SQL Agent not available. No database connection configured.",
                "output": "",
            }
        except Exception as e:
            return {"success": False, "error": str(e), "output": ""}


# Standard tools with executors wired via the registry
def _build_standard_tools() -> List[Tool]:
    """Build the standard tools list with real executors from the registry."""
    ToolExecutorRegistry.initialize()

    return [
        Tool(
            name="execute_python",
            description="Execute Python code to analyze data. The DataFrame 'df' is pre-loaded.",
            tool_type=ToolType.CODE_EXECUTION,
            parameters={
                "code": {"type": "string", "description": "Python code to execute"},
                "description": {"type": "string", "description": "What this code does"},
            },
            required_params=["code"],
            execute=ToolExecutorRegistry.get_executor("execute_python"),
        ),
        Tool(
            name="create_visualization",
            description="Create a chart or graph from the data.",
            tool_type=ToolType.VISUALIZATION,
            parameters={
                "chart_type": {
                    "type": "string",
                    "enum": ["bar", "line", "scatter", "histogram", "heatmap", "box", "pie"],
                },
                "x_column": {"type": "string"},
                "y_column": {"type": "string"},
                "title": {"type": "string"},
                "filter": {"type": "string", "description": "Optional filter expression"},
            },
            required_params=["chart_type", "x_column", "title"],
            execute=ToolExecutorRegistry.get_executor("create_visualization"),
        ),
        Tool(
            name="run_statistical_test",
            description="Perform a statistical hypothesis test.",
            tool_type=ToolType.STATISTICAL,
            parameters={
                "test_type": {
                    "type": "string",
                    "enum": ["ttest", "anova", "chi_square", "correlation", "normality"],
                },
                "column1": {"type": "string"},
                "column2": {"type": "string"},
                "group_column": {"type": "string", "description": "For comparing groups"},
            },
            required_params=["test_type", "column1"],
            execute=ToolExecutorRegistry.get_executor("run_statistical_test"),
        ),
        Tool(
            name="train_model",
            description="Train a machine learning model.",
            tool_type=ToolType.MACHINE_LEARNING,
            parameters={
                "model_type": {
                    "type": "string",
                    "enum": ["linear_regression", "logistic_regression", "random_forest", "xgboost", "kmeans"],
                },
                "target_column": {"type": "string"},
                "feature_columns": {"type": "array", "items": {"type": "string"}},
                "test_size": {"type": "number", "default": 0.2},
            },
            required_params=["model_type", "target_column", "feature_columns"],
            execute=ToolExecutorRegistry.get_executor("train_model"),
        ),
        Tool(
            name="query_database",
            description="Execute SQL query against connected database.",
            tool_type=ToolType.SQL,
            parameters={
                "sql": {"type": "string", "description": "SQL query to execute"},
                "explain": {"type": "boolean", "default": True},
            },
            required_params=["sql"],
            execute=ToolExecutorRegistry.get_executor("query_database"),
        ),
    ]


STANDARD_TOOLS = _build_standard_tools()


# =============================================================================
# REASONING STEPS
# =============================================================================


class ReasoningStep(Enum):
    """Steps in the ReAct reasoning cycle."""

    THINK = "think"
    PLAN = "plan"
    ACT = "act"
    OBSERVE = "observe"
    REFLECT = "reflect"
    COMPLETE = "complete"


@dataclass
class ThoughtStep:
    """A single step in the agent's reasoning process."""

    step_type: ReasoningStep
    content: str
    timestamp: datetime = field(default_factory=datetime.now)
    tool_call: Optional[Dict[str, Any]] = None
    observation: Optional[str] = None
    confidence: float = 1.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "step": self.step_type.value,
            "content": self.content,
            "timestamp": self.timestamp.isoformat(),
            "tool_call": self.tool_call,
            "observation": self.observation,
            "confidence": self.confidence,
        }


@dataclass
class ReasoningTrace:
    """Complete reasoning trace for transparency."""

    steps: List[ThoughtStep] = field(default_factory=list)
    final_answer: Optional[str] = None
    total_tokens: int = 0
    execution_time_ms: int = 0

    def add_step(self, step: ThoughtStep):
        self.steps.append(step)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "steps": [s.to_dict() for s in self.steps],
            "final_answer": self.final_answer,
            "total_tokens": self.total_tokens,
            "execution_time_ms": self.execution_time_ms,
        }


# =============================================================================
# AGENT BASE CLASS
# =============================================================================


class BaseAdvancedAgent(ABC):
    """Base class for all advanced agents with ReAct capabilities."""

    def __init__(
        self,
        name: str,
        description: str,
        tools: List[Tool] = None,
        max_iterations: int = 10,
        verbose: bool = False,
    ):
        self.name = name
        self.description = description
        self.tools = tools or STANDARD_TOOLS
        self.max_iterations = max_iterations
        self.verbose = verbose
        self.reasoning_trace = ReasoningTrace()

    @abstractmethod
    def get_system_prompt(self) -> str:
        """Get the system prompt for this agent."""
        pass

    @abstractmethod
    async def process(
        self, user_request: str, data_context: str, session_id: str
    ) -> Dict[str, Any]:
        """Process a user request using ReAct pattern."""
        pass

    def build_tool_prompt(self) -> str:
        """Build the tools section of the prompt."""
        tools_desc = "\n## AVAILABLE TOOLS\n"
        tools_desc += "You can call these tools by placing a JSON block inside ```tool ... ``` markers.\n"
        for tool in self.tools:
            tools_desc += f"\n### {tool.name}\n"
            tools_desc += f"Description: {tool.description}\n"
            tools_desc += f"Parameters: {json.dumps(tool.parameters, indent=2)}\n"
            tools_desc += f"Required: {json.dumps(tool.required_params)}\n"
        return tools_desc

    def parse_tool_call(self, response: str) -> Optional[Dict[str, Any]]:
        """Parse a tool call from the agent's response."""
        # Look for structured tool call format
        tool_pattern = r"```tool\n(.*?)\n```"
        match = re.search(tool_pattern, response, re.DOTALL)

        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                # Try to fix common JSON issues
                raw = match.group(1).strip()
                try:
                    # Sometimes LLM wraps in extra braces or has trailing commas
                    cleaned = re.sub(r",\s*}", "}", raw)
                    cleaned = re.sub(r",\s*]", "]", cleaned)
                    return json.loads(cleaned)
                except json.JSONDecodeError:
                    pass

        # Alternative: Look for ACTION: format
        action_pattern = r"ACTION:\s*(\w+)\nINPUT:\s*(\{.*?\})"
        match = re.search(action_pattern, response, re.DOTALL)

        if match:
            try:
                return {
                    "tool": match.group(1),
                    "parameters": json.loads(match.group(2)),
                }
            except json.JSONDecodeError:
                pass

        # Fallback: look for any JSON block that has a "tool" key
        json_pattern = r'\{[^{}]*"tool"\s*:\s*"[^"]+?"[^{}]*\}'
        match = re.search(json_pattern, response, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass

        # Last resort: extract python code blocks and treat as execute_python
        code_pattern = r"```python\n(.*?)\n```"
        code_match = re.search(code_pattern, response, re.DOTALL)
        if code_match:
            return {
                "tool": "execute_python",
                "parameters": {
                    "code": code_match.group(1),
                    "description": "Agent-generated Python code",
                },
            }

        return None

    def add_thought(self, step_type: ReasoningStep, content: str, **kwargs):
        """Add a reasoning step to the trace."""
        step = ThoughtStep(step_type=step_type, content=content, **kwargs)
        self.reasoning_trace.add_step(step)

        if self.verbose:
            logger.info(f"[{step_type.value.upper()}] {content[:100]}...")


# =============================================================================
# REACT AGENT IMPLEMENTATION
# =============================================================================


class ReActAgent(BaseAdvancedAgent):
    """
    Agent implementing the ReAct (Reasoning + Acting) pattern.

    This agent explicitly thinks through problems, plans actions,
    executes tools, observes results, and reflects on outcomes.
    Includes self-healing: when execution errors occur, it reflects
    and tries a corrected approach.
    """

    REACT_PROMPT = """You are an advanced AI Data Science Agent using the ReAct (Reasoning + Acting) framework.

For each request, follow this explicit reasoning pattern:

## REASONING LOOP

**THINK**: Analyze the request. What is being asked? What data/columns are relevant?
**PLAN**: Break down into specific steps. Which tools will you use?
**ACT**: Execute a tool (use ```tool ... ``` blocks) OR write Python code (use ```python ... ``` blocks).
**OBSERVE**: Analyze the results. Did it work? What did you learn?
**REFLECT**: Is this complete? Do you need another iteration? Was there an error to fix?

## OUTPUT FORMAT

Structure your response EXACTLY like this:

THINK: [Your analysis of the request]

PLAN:
1. [First step]
2. [Second step]
...

ACT: [Describe what tool you're calling]
```tool
{
    "tool": "tool_name",
    "parameters": {
        "param1": "value1"
    }
}
```

OBSERVE: [Results from the tool — this will be filled by the system]

REFLECT: [Assessment of results, whether complete or need adjustment]

ANSWER: [Final response to user — only include this when you have complete results]

## TOOL CALL FORMAT
When calling a tool, use this exact format:
```tool
{
    "tool": "execute_python",
    "parameters": {
        "code": "your python code here",
        "description": "what this code does"
    }
}
```

Alternatively, you can write Python code directly in a ```python block and it will be auto-executed:
```python
# Your analysis code here
print(df.describe())
```

## RULES
1. Always show THINK before acting — explain your reasoning
2. Use tools when appropriate, explain why you chose that approach
3. If code fails, REFLECT on the error and try a corrected approach (up to 3 retries)
4. ALWAYS provide a clear ANSWER: section with actionable findings
5. Be specific: if a country/product/entity is mentioned, analyze ONLY that entity
6. Include quantitative metrics (R², p-values, confidence intervals) when relevant
"""

    def __init__(self, llm_generate_fn: Callable, **kwargs):
        """
        Args:
            llm_generate_fn: Async callable(prompt, session_id) -> str
                             Returns the LLM response text.
        """
        if "name" not in kwargs:
            kwargs["name"] = "ReAct Data Scientist"
        if "description" not in kwargs:
            kwargs["description"] = "Advanced data analysis agent with iterative reasoning"
        super().__init__(**kwargs)
        self.llm_generate_fn = llm_generate_fn
        self._max_retries_per_tool = 3

    def get_system_prompt(self) -> str:
        """Build composite system prompt from master + ReAct + tools."""
        from ...prompts.system_prompts import MASTER_SYSTEM_PROMPT
        return MASTER_SYSTEM_PROMPT + "\n\n" + self.REACT_PROMPT + self.build_tool_prompt()

    async def process(
        self, user_request: str, data_context: str, session_id: str
    ) -> Dict[str, Any]:
        """Process using ReAct loop with real tool execution and error recovery."""
        start_time = datetime.now()
        self.reasoning_trace = ReasoningTrace()

        # Initial thinking
        self.add_thought(ReasoningStep.THINK, f"Analyzing request: {user_request}")

        full_prompt = f"""{self.get_system_prompt()}

## DATA CONTEXT
{data_context}

## USER REQUEST
{user_request}

Begin your analysis:"""

        iteration = 0
        accumulated_context = ""
        final_response = None
        retry_count = 0
        all_plots = []
        all_code_blocks = []
        all_variables = {}

        while iteration < self.max_iterations:
            iteration += 1
            logger.info(f"[ReAct] Iteration {iteration}/{self.max_iterations}")

            # Generate next step from LLM
            try:
                current_prompt = full_prompt + accumulated_context
                response_text = await self.llm_generate_fn(current_prompt, session_id)
            except Exception as e:
                self.add_thought(ReasoningStep.REFLECT, f"LLM error: {str(e)}")
                return self._build_error_response(str(e), start_time)

            # Parse the response sections
            sections = self._parse_react_response(response_text)

            # Track reasoning steps
            if sections.get("think"):
                self.add_thought(ReasoningStep.THINK, sections["think"])
            if sections.get("plan"):
                self.add_thought(ReasoningStep.PLAN, sections["plan"])

            # Check for tool call
            tool_call = self.parse_tool_call(response_text)
            if tool_call:
                tool_name = tool_call.get("tool", "unknown")
                self.add_thought(
                    ReasoningStep.ACT,
                    f"Calling tool: {tool_name}",
                    tool_call=tool_call,
                )

                # Execute tool with real executor
                tool_result = await self._execute_tool(tool_call, session_id)

                # Collect artifacts
                if isinstance(tool_result, dict):
                    if tool_result.get("plots"):
                        all_plots.extend(tool_result["plots"])
                    if tool_result.get("variables"):
                        all_variables.update(tool_result["variables"])
                    if tool_result.get("generated_code"):
                        all_code_blocks.append({
                            "language": "python",
                            "code": tool_result["generated_code"],
                        })

                # Format observation
                observation_text = self._format_tool_result(tool_result)
                self.add_thought(
                    ReasoningStep.OBSERVE,
                    f"Tool result received",
                    observation=observation_text[:500],
                )

                # Check if tool failed — trigger error recovery
                tool_success = isinstance(tool_result, dict) and tool_result.get("success", True)
                tool_error = isinstance(tool_result, dict) and tool_result.get("error")

                if not tool_success and tool_error and retry_count < self._max_retries_per_tool:
                    retry_count += 1
                    self.add_thought(
                        ReasoningStep.REFLECT,
                        f"Tool execution failed (attempt {retry_count}/{self._max_retries_per_tool}). "
                        f"Error: {tool_error}. Analyzing error and retrying with corrected approach.",
                    )
                    accumulated_context += (
                        f"\n\nOBSERVATION: EXECUTION ERROR (attempt {retry_count}):\n{observation_text}"
                        f"\n\nREFLECT: The previous tool call failed. Analyze the error carefully, fix the issue, and try again."
                        f"\n\nContinue your analysis with the corrected approach:"
                    )
                    continue
                else:
                    retry_count = 0  # Reset on success
                    accumulated_context += (
                        f"\n\nOBSERVATION:\n{observation_text}"
                        f"\n\nContinue your analysis:"
                    )

            # Check for final answer
            if sections.get("answer"):
                self.add_thought(ReasoningStep.COMPLETE, sections["answer"])
                final_response = sections["answer"]
                break

            # Reflection
            if sections.get("reflect"):
                self.add_thought(ReasoningStep.REFLECT, sections["reflect"])

                # Check if agent thinks it's complete
                reflect_lower = sections["reflect"].lower()
                if any(word in reflect_lower for word in ["complete", "done", "finished", "answered"]):
                    # Extract answer from existing context
                    final_response = sections.get("answer") or self._extract_answer_from_trace()
                    break

            # If no tool call and no answer, the LLM might have given a direct response
            if not tool_call and not sections.get("answer"):
                # Use the raw response as the answer
                final_response = response_text
                break

        # Build final response
        execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
        self.reasoning_trace.execution_time_ms = execution_time
        self.reasoning_trace.final_answer = final_response

        # Extract code blocks from final response if not already captured
        from ...utils.shared_utils import text_processor
        response_code_blocks = text_processor.extract_code_blocks(final_response or "")
        all_code_blocks.extend(response_code_blocks)

        # Record observability trace
        try:
            from ...utils.observability import observer
            observer.record_trace(
                agent_name=self.name,
                session_id=session_id,
                user_request=user_request,
                reasoning_trace=self.reasoning_trace.to_dict(),
                success=True,
                latency_ms=float(execution_time),
            )
        except Exception as obs_err:
            logger.debug(f"Observability recording failed: {obs_err}")

        return {
            "success": True,
            "response": final_response or response_text,
            "reasoning_trace": self.reasoning_trace.to_dict(),
            "iterations": iteration,
            "code_blocks": all_code_blocks,
            "has_code": len(all_code_blocks) > 0,
            "plots": all_plots,
            "variables": all_variables,
        }

    def _parse_react_response(self, response: str) -> Dict[str, str]:
        """Parse sections from ReAct formatted response."""
        sections = {}

        patterns = {
            "think": r"THINK:\s*(.*?)(?=PLAN:|ACT:|OBSERVE:|REFLECT:|ANSWER:|$)",
            "plan": r"PLAN:\s*(.*?)(?=ACT:|THINK:|OBSERVE:|REFLECT:|ANSWER:|$)",
            "act": r"ACT:\s*(.*?)(?=OBSERVE:|REFLECT:|ANSWER:|$)",
            "observe": r"OBSERVE:\s*(.*?)(?=REFLECT:|ANSWER:|THINK:|$)",
            "reflect": r"REFLECT:\s*(.*?)(?=THINK:|ACT:|ANSWER:|$)",
            "answer": r"ANSWER:\s*(.*?)$",
        }

        for section, pattern in patterns.items():
            match = re.search(pattern, response, re.DOTALL | re.IGNORECASE)
            if match:
                sections[section] = match.group(1).strip()

        return sections

    async def _execute_tool(self, tool_call: Dict[str, Any], session_id: str) -> Any:
        """Execute a tool with its real registered executor."""
        tool_name = tool_call.get("tool")
        params = tool_call.get("parameters", {})

        # Find the tool
        tool = next((t for t in self.tools if t.name == tool_name), None)

        if not tool:
            return {"success": False, "error": f"Unknown tool '{tool_name}'", "output": ""}

        if tool.execute:
            try:
                return await tool.execute(session_id=session_id, **params)
            except Exception as e:
                logger.error(f"Tool execution error ({tool_name}): {e}")
                return {"success": False, "error": str(e), "output": ""}

        return {"success": False, "error": f"Tool '{tool_name}' has no executor registered", "output": ""}

    def _format_tool_result(self, result: Any) -> str:
        """Format a tool result into readable text for the LLM."""
        if isinstance(result, dict):
            parts = []
            if result.get("success"):
                parts.append("✓ Execution successful")
            else:
                parts.append(f"✗ Execution failed: {result.get('error', 'Unknown error')}")

            if result.get("output"):
                parts.append(f"\n{result['output']}")
            if result.get("plots"):
                parts.append(f"\n[{len(result['plots'])} plot(s) generated]")
            return "\n".join(parts)

        return str(result)[:2000]

    def _extract_answer_from_trace(self) -> str:
        """Extract an answer from the reasoning trace when ANSWER: wasn't explicitly provided."""
        # Look for the last observation or reflection with useful content
        for step in reversed(self.reasoning_trace.steps):
            if step.step_type in (ReasoningStep.OBSERVE, ReasoningStep.REFLECT):
                if step.content and len(step.content) > 20:
                    return step.content
        return "Analysis complete. Please check the generated plots and outputs above."

    def _build_error_response(self, error: str, start_time: datetime) -> Dict[str, Any]:
        """Build an error response."""
        execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
        self.reasoning_trace.execution_time_ms = execution_time
        return {
            "success": False,
            "response": f"I encountered an error during analysis: {error}",
            "reasoning_trace": self.reasoning_trace.to_dict(),
            "iterations": 0,
            "code_blocks": [],
            "has_code": False,
            "plots": [],
            "variables": {},
            "error": error,
        }


# =============================================================================
# MULTI-AGENT ORCHESTRATOR
# =============================================================================


@dataclass
class AgentCapability:
    """Describes what an agent can do."""

    agent_id: str
    agent_class: type
    specializations: List[str]
    priority: int = 5
    keywords: List[str] = field(default_factory=list)


class MultiAgentOrchestrator:
    """
    Orchestrates multiple specialized agents.
    Routes requests to the most appropriate agent(s).
    Supports collaborative multi-agent workflows.
    """

    def __init__(self, llm_generate_fn: Callable = None):
        self.llm_generate_fn = llm_generate_fn
        self.agents: Dict[str, BaseAdvancedAgent] = {}
        self.capabilities: List[AgentCapability] = []
        self.routing_cache: Dict[str, str] = {}

    def register_agent(
        self,
        agent_id: str,
        agent: BaseAdvancedAgent,
        specializations: List[str],
        keywords: List[str] = None,
    ):
        """Register an agent with the orchestrator."""
        self.agents[agent_id] = agent
        self.capabilities.append(
            AgentCapability(
                agent_id=agent_id,
                agent_class=type(agent),
                specializations=specializations,
                keywords=keywords or [],
            )
        )

    def route_request(self, user_request: str) -> str:
        """Determine which agent should handle a request."""
        request_lower = user_request.lower()

        # Check cache first
        cache_key = hash(request_lower[:100])
        if cache_key in self.routing_cache:
            return self.routing_cache[cache_key]

        # Score each agent based on keyword matches
        scores = {}
        for cap in self.capabilities:
            score = 0
            for keyword in cap.keywords:
                if keyword in request_lower:
                    score += 10
            for spec in cap.specializations:
                if spec in request_lower:
                    score += 5
            scores[cap.agent_id] = score + cap.priority

        if not scores:
            return "default"

        # Return highest scoring agent
        best_agent = max(scores, key=scores.get)
        self.routing_cache[cache_key] = best_agent

        return best_agent

    async def process_request(
        self,
        user_request: str,
        data_context: str,
        session_id: str,
        agent_id: str = None,
    ) -> Dict[str, Any]:
        """Process a request with the appropriate agent."""
        if agent_id is None:
            agent_id = self.route_request(user_request)

        agent = self.agents.get(agent_id)
        if not agent:
            return {"success": False, "error": f"Agent '{agent_id}' not found"}

        logger.info(f"Routing to agent: {agent_id}")

        result = await agent.process(
            user_request=user_request, data_context=data_context, session_id=session_id
        )

        result["agent_used"] = agent_id
        return result

    async def collaborative_process(
        self,
        user_request: str,
        data_context: str,
        session_id: str,
        agent_sequence: List[str],
    ) -> Dict[str, Any]:
        """
        Process a request using multiple agents in sequence.
        Each agent's output becomes context for the next.
        """
        accumulated_results = []
        current_context = data_context

        for agent_id in agent_sequence:
            result = await self.process_request(
                user_request=user_request,
                data_context=current_context,
                session_id=session_id,
                agent_id=agent_id,
            )

            accumulated_results.append({"agent": agent_id, "result": result})

            # Update context with this agent's findings
            if result.get("success") and result.get("response"):
                current_context += (
                    f"\n\n## Previous Analysis ({agent_id}):\n{result['response']}"
                )

        return {
            "success": True,
            "collaborative_results": accumulated_results,
            "final_context": current_context,
        }


# =============================================================================
# PLANNING AGENT
# =============================================================================


class PlanningAgent(BaseAdvancedAgent):
    """
    Agent that creates execution plans for complex requests.
    Decomposes tasks into subtasks and coordinates execution.
    """

    PLANNING_PROMPT = """You are a Planning Agent that breaks down complex data analysis tasks.

## YOUR ROLE
1. Analyze the user's request
2. Identify sub-tasks required
3. Determine dependencies between tasks
4. Create an execution plan

## OUTPUT FORMAT

```json
{
    "goal": "High-level goal description",
    "tasks": [
        {
            "id": "task_1",
            "description": "What needs to be done",
            "agent": "agent_id to use",
            "dependencies": [],
            "estimated_complexity": "low|medium|high"
        }
    ],
    "execution_order": ["task_1", "task_2"],
    "notes": "Any special considerations"
}
```

## RULES
1. Each task should be atomic and achievable by a single agent
2. Identify dependencies clearly
3. Prioritize tasks that unblock others
4. Consider data requirements at each step
"""

    def __init__(self, llm_generate_fn: Callable, orchestrator: MultiAgentOrchestrator):
        super().__init__(
            name="Planning Agent",
            description="Creates execution plans for complex analysis tasks",
        )
        self.llm_generate_fn = llm_generate_fn
        self.orchestrator = orchestrator

    def get_system_prompt(self) -> str:
        available_agents = ", ".join(self.orchestrator.agents.keys()) if self.orchestrator.agents else "default"
        return self.PLANNING_PROMPT + f"\n\n## AVAILABLE AGENTS\n{available_agents}"

    async def process(
        self, user_request: str, data_context: str, session_id: str
    ) -> Dict[str, Any]:
        """Create and optionally execute a plan."""
        prompt = f"""{self.get_system_prompt()}

## DATA CONTEXT
{data_context}

## USER REQUEST
{user_request}

Create an execution plan:"""

        response_text = await self.llm_generate_fn(prompt, session_id)

        # Parse the plan
        try:
            plan_match = re.search(r"```json\n(.*?)\n```", response_text, re.DOTALL)
            if plan_match:
                plan = json.loads(plan_match.group(1))
            else:
                plan = {"error": "Could not parse plan"}
        except json.JSONDecodeError:
            plan = {"error": "Invalid JSON in plan"}

        return {
            "success": "error" not in plan,
            "plan": plan,
            "raw_response": response_text,
        }

    async def execute_plan(
        self, plan: Dict[str, Any], data_context: str, session_id: str
    ) -> Dict[str, Any]:
        """Execute a pre-created plan."""
        results = {}

        for task_id in plan.get("execution_order", []):
            task = next((t for t in plan.get("tasks", []) if t["id"] == task_id), None)
            if not task:
                continue

            # Check dependencies
            deps_satisfied = all(d in results for d in task.get("dependencies", []))
            if not deps_satisfied:
                results[task_id] = {"error": "Dependencies not satisfied"}
                continue

            # Build context with dependency results
            task_context = data_context
            for dep_id in task.get("dependencies", []):
                if results.get(dep_id, {}).get("success"):
                    task_context += f"\n\n## Result from {dep_id}:\n{results[dep_id].get('response', '')}"

            # Execute task
            result = await self.orchestrator.process_request(
                user_request=task["description"],
                data_context=task_context,
                session_id=session_id,
                agent_id=task.get("agent"),
            )

            results[task_id] = result

        return {"success": True, "plan": plan, "task_results": results}
