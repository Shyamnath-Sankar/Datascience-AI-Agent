# Prompts module - System prompts and templates
from .system_prompts import (
    MASTER_SYSTEM_PROMPT,
    VISUALIZATION_EXPERT_PROMPT,
    STATISTICAL_EXPERT_PROMPT,
    PREDICTION_EXPERT_PROMPT,
    ML_EXPERT_PROMPT,
    SQL_EXPERT_PROMPT,
    EDA_EXPERT_PROMPT,
    COT_ANALYSIS_PROMPT,
    FEW_SHOT_EXAMPLES,
    AgentRole,
    PromptContext,
    get_prompt_for_agent,
    build_optimized_context,
    get_few_shot_example,
)

# Aliases for backwards compatibility
VISUALIZATION_AGENT_PROMPT = VISUALIZATION_EXPERT_PROMPT
STATISTICS_AGENT_PROMPT = STATISTICAL_EXPERT_PROMPT
PREDICTION_AGENT_PROMPT = PREDICTION_EXPERT_PROMPT
ML_AGENT_PROMPT = ML_EXPERT_PROMPT
SQL_AGENT_PROMPT = SQL_EXPERT_PROMPT
EDA_AGENT_PROMPT = EDA_EXPERT_PROMPT
COT_REASONING_TEMPLATE = COT_ANALYSIS_PROMPT
CONTEXT_WINDOW_TEMPLATE = ""  # Placeholder for compatibility
get_agent_prompt = get_prompt_for_agent
build_context_prompt = build_optimized_context

__all__ = [
    # Original exports
    "MASTER_SYSTEM_PROMPT",
    "VISUALIZATION_EXPERT_PROMPT",
    "STATISTICAL_EXPERT_PROMPT",
    "PREDICTION_EXPERT_PROMPT",
    "ML_EXPERT_PROMPT",
    "SQL_EXPERT_PROMPT",
    "EDA_EXPERT_PROMPT",
    "COT_ANALYSIS_PROMPT",
    "FEW_SHOT_EXAMPLES",
    "AgentRole",
    "PromptContext",
    "get_prompt_for_agent",
    "build_optimized_context",
    "get_few_shot_example",
    # Aliases for compatibility
    "VISUALIZATION_AGENT_PROMPT",
    "STATISTICS_AGENT_PROMPT",
    "PREDICTION_AGENT_PROMPT",
    "ML_AGENT_PROMPT",
    "SQL_AGENT_PROMPT",
    "EDA_AGENT_PROMPT",
    "COT_REASONING_TEMPLATE",
    "CONTEXT_WINDOW_TEMPLATE",
    "get_agent_prompt",
    "build_context_prompt",
]
