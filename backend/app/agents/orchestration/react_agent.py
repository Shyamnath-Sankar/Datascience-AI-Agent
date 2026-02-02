"""
Advanced Agent Orchestration System.
Implements:
- ReAct (Reasoning + Acting) pattern
- Tool calling with structured outputs
- Multi-agent collaboration
- Adaptive planning
- Error recovery
"""

from typing import Dict, Any, List, Optional, Callable, Union
from dataclasses import dataclass, field
from enum import Enum
from abc import ABC, abstractmethod
import logging
import json
import re
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


# Standard tools available to all agents
STANDARD_TOOLS = [
    Tool(
        name="execute_python",
        description="Execute Python code to analyze data. The DataFrame 'df' is pre-loaded.",
        tool_type=ToolType.CODE_EXECUTION,
        parameters={
            "code": {"type": "string", "description": "Python code to execute"},
            "description": {"type": "string", "description": "What this code does"},
        },
        required_params=["code"],
    ),
    Tool(
        name="create_visualization",
        description="Create a chart or graph from the data.",
        tool_type=ToolType.VISUALIZATION,
        parameters={
            "chart_type": {
                "type": "string",
                "enum": [
                    "bar",
                    "line",
                    "scatter",
                    "histogram",
                    "heatmap",
                    "box",
                    "pie",
                ],
            },
            "x_column": {"type": "string"},
            "y_column": {"type": "string"},
            "title": {"type": "string"},
            "filter": {"type": "string", "description": "Optional filter expression"},
        },
        required_params=["chart_type", "x_column", "title"],
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
    ),
    Tool(
        name="train_model",
        description="Train a machine learning model.",
        tool_type=ToolType.MACHINE_LEARNING,
        parameters={
            "model_type": {
                "type": "string",
                "enum": [
                    "linear_regression",
                    "logistic_regression",
                    "random_forest",
                    "xgboost",
                    "kmeans",
                ],
            },
            "target_column": {"type": "string"},
            "feature_columns": {"type": "array", "items": {"type": "string"}},
            "test_size": {"type": "number", "default": 0.2},
        },
        required_params=["model_type", "target_column", "feature_columns"],
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
    ),
]


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
        for tool in self.tools:
            tools_desc += f"\n### {tool.name}\n"
            tools_desc += f"Description: {tool.description}\n"
            tools_desc += f"Parameters: {json.dumps(tool.parameters, indent=2)}\n"
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
                pass

        # Alternative: Look for ACTION: format
        action_pattern = r"ACTION:\s*(\w+)\nINPUT:\s*({.*?})"
        match = re.search(action_pattern, response, re.DOTALL)

        if match:
            try:
                return {
                    "tool": match.group(1),
                    "parameters": json.loads(match.group(2)),
                }
            except json.JSONDecodeError:
                pass

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
    """

    REACT_PROMPT = """You are an advanced AI agent using the ReAct (Reasoning + Acting) framework.

For each request, you MUST follow this explicit reasoning pattern:

## REASONING LOOP

**THINK**: Analyze the request. What is being asked? What information do I need?
**PLAN**: Break down into specific steps. What tools should I use?
**ACT**: Execute a tool or generate code.
**OBSERVE**: Analyze the results. Did it work? What did I learn?
**REFLECT**: Is this complete? Do I need to iterate?

## OUTPUT FORMAT

You MUST structure your response exactly like this:

```
THINK: [Your analysis of the request]

PLAN: 
1. [First step]
2. [Second step]
...

ACT: [Tool name or code execution]
```tool
{
    "tool": "tool_name",
    "parameters": {
        "param1": "value1"
    }
}
```

OBSERVE: [Results from the tool]

REFLECT: [Assessment of results, next steps if needed]

ANSWER: [Final response to user]
```

## RULES
1. Always show your reasoning explicitly
2. Use tools when appropriate, but explain why
3. If first attempt fails, reflect and try a different approach
4. Provide a clear, actionable final answer
"""

    def __init__(self, llm_client, **kwargs):
        super().__init__(**kwargs)
        self.llm_client = llm_client

    def get_system_prompt(self) -> str:
        return self.REACT_PROMPT + self.build_tool_prompt()

    async def process(
        self, user_request: str, data_context: str, session_id: str
    ) -> Dict[str, Any]:
        """Process using ReAct loop."""
        self.reasoning_trace = ReasoningTrace()  # Reset trace

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

        while iteration < self.max_iterations:
            iteration += 1

            # Generate next step
            try:
                response = await self.llm_client.generate(
                    prompt=full_prompt + accumulated_context, session_id=session_id
                )
                response_text = response.get("text", "")
            except Exception as e:
                self.add_thought(ReasoningStep.REFLECT, f"Error: {str(e)}")
                return {"success": False, "error": str(e)}

            # Parse the response
            sections = self._parse_react_response(response_text)

            # Track reasoning steps
            if sections.get("think"):
                self.add_thought(ReasoningStep.THINK, sections["think"])
            if sections.get("plan"):
                self.add_thought(ReasoningStep.PLAN, sections["plan"])

            # Check for tool call
            tool_call = self.parse_tool_call(response_text)
            if tool_call:
                self.add_thought(
                    ReasoningStep.ACT,
                    f"Calling tool: {tool_call.get('tool', 'unknown')}",
                    tool_call=tool_call,
                )

                # Execute tool
                tool_result = await self._execute_tool(tool_call, session_id)

                self.add_thought(
                    ReasoningStep.OBSERVE,
                    f"Tool result received",
                    observation=str(tool_result)[:500],
                )

                accumulated_context += (
                    f"\n\nOBSERVATION: {tool_result}\n\nContinue your analysis:"
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
                if (
                    "complete" in sections["reflect"].lower()
                    or "done" in sections["reflect"].lower()
                ):
                    break

        return {
            "success": True,
            "response": final_response or response_text,
            "reasoning_trace": self.reasoning_trace.to_dict(),
            "iterations": iteration,
        }

    def _parse_react_response(self, response: str) -> Dict[str, str]:
        """Parse sections from ReAct formatted response."""
        sections = {}

        patterns = {
            "think": r"THINK:\s*(.*?)(?=PLAN:|ACT:|$)",
            "plan": r"PLAN:\s*(.*?)(?=ACT:|THINK:|$)",
            "act": r"ACT:\s*(.*?)(?=OBSERVE:|$)",
            "observe": r"OBSERVE:\s*(.*?)(?=REFLECT:|ANSWER:|$)",
            "reflect": r"REFLECT:\s*(.*?)(?=THINK:|ACT:|ANSWER:|$)",
            "answer": r"ANSWER:\s*(.*?)$",
        }

        for section, pattern in patterns.items():
            match = re.search(pattern, response, re.DOTALL | re.IGNORECASE)
            if match:
                sections[section] = match.group(1).strip()

        return sections

    async def _execute_tool(self, tool_call: Dict[str, Any], session_id: str) -> Any:
        """Execute a tool and return results."""
        tool_name = tool_call.get("tool")
        params = tool_call.get("parameters", {})

        # Find the tool
        tool = next((t for t in self.tools if t.name == tool_name), None)

        if not tool:
            return f"Error: Unknown tool '{tool_name}'"

        if tool.execute:
            try:
                return await tool.execute(session_id=session_id, **params)
            except Exception as e:
                return f"Error executing {tool_name}: {str(e)}"

        # Default: return that tool would be called
        return f"Tool '{tool_name}' would be executed with params: {params}"


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

    def __init__(self, llm_client):
        self.llm_client = llm_client
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

    def __init__(self, llm_client, orchestrator: MultiAgentOrchestrator):
        super().__init__(
            name="Planning Agent",
            description="Creates execution plans for complex analysis tasks",
        )
        self.llm_client = llm_client
        self.orchestrator = orchestrator

    def get_system_prompt(self) -> str:
        available_agents = ", ".join(self.orchestrator.agents.keys())
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

        response = await self.llm_client.generate(prompt=prompt, session_id=session_id)

        # Parse the plan
        try:
            plan_match = re.search(
                r"```json\n(.*?)\n```", response.get("text", ""), re.DOTALL
            )
            if plan_match:
                plan = json.loads(plan_match.group(1))
            else:
                plan = {"error": "Could not parse plan"}
        except json.JSONDecodeError:
            plan = {"error": "Invalid JSON in plan"}

        return {
            "success": "error" not in plan,
            "plan": plan,
            "raw_response": response.get("text", ""),
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
