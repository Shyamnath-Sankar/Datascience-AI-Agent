"""
Centralized prompt templates for AI agents.
STRICTLY optimized for answering the SPECIFIC question asked.
"""

from typing import Optional


class PromptTemplates:
    """Collection of prompt templates - FOCUSED ON ANSWERING EXACT QUESTIONS."""
    
    # System prompt - ENFORCES SPECIFIC ANSWERS
    DATA_ASSISTANT_SYSTEM = """You are a data scientist. You MUST answer the EXACT question asked.

CRITICAL RULES:
1. READ THE QUESTION CAREFULLY - identify the SPECIFIC entity (country, column, category) mentioned
2. ANSWER ONLY about that specific entity - do NOT give global/general answers
3. If asked about "India", answer about INDIA only - not the world, not Africa
4. If asked about a specific year, calculate for THAT year
5. Keep responses under 100 words
6. The DataFrame is already loaded as 'df'

WRONG: Question about India → Answer about global population
RIGHT: Question about India → Filter df for India, calculate for India only

RESPONSE FORMAT:
1. Direct answer (1 sentence with the specific number)
2. Python code that calculates exactly what was asked
3. The code MUST print the specific answer

NEVER give lengthy reports. Answer the question, nothing more."""

    # Prediction prompt - SPECIFIC TARGETING
    PREDICTION_PROMPT = """ANSWER THIS SPECIFIC QUESTION using the data.

## Data Available
{data_context}

## THE QUESTION (answer ONLY this)
{user_request}

## CRITICAL INSTRUCTIONS
1. EXTRACT the specific entity from the question (e.g., "India", "USA", a specific column)
2. Filter the data for ONLY that entity
3. Calculate prediction for ONLY that entity
4. Print the prediction CLEARLY

Example: "Predict India's population in 2025"
- Filter data for India ONLY: df[df['country'] == 'India']
- Get historical population values for India
- Calculate growth trend for India
- Predict India's 2025 population
- Print: "India's predicted population in 2025: X"

DO NOT answer about the world, other countries, or general trends.
Answer ONLY about what was specifically asked.

```python
import numpy as np
from scipy import stats

# STEP 1: Identify and filter for the specific entity asked about
# Example: entity = "India"
# filtered_df = df[df['country'] == entity]

# STEP 2: Extract relevant historical data for this entity
# years = [...]
# values = [...]

# STEP 3: Calculate trend/growth rate
# slope, intercept, r, p, se = stats.linregress(years, values)

# STEP 4: Predict for the specific target year
# target_year = 2025
# prediction = intercept + slope * target_year

# STEP 5: Print the SPECIFIC answer
print(f"\\n=== ANSWER ===")
print(f"[Entity]'s predicted [metric] for [year]: [value]")
```

NOW write code that answers the EXACT question: {user_request}"""

    # Direct answer prompt - STRICT FOCUS
    DIRECT_ANSWER_PROMPT = """Answer this SPECIFIC question using the data.

## Data Available
{data_context}

## THE QUESTION
{user_request}

## RULES
1. Extract the SPECIFIC entity/column from the question
2. Filter/calculate for ONLY that entity
3. Print the exact answer requested
4. Keep explanation under 50 words

If question mentions a specific country → filter for that country
If question mentions a specific column → analyze that column
If question mentions a specific category → filter for that category

```python
# Your code to answer the EXACT question
# Must include:
# 1. Filter for specific entity if mentioned
# 2. Calculate what was asked
# 3. Print the answer clearly

print(f"Answer: [specific result for the specific question]")
```"""

    # Visualization prompt
    VISUALIZATION_PROMPT = """Create a visualization for this SPECIFIC request.

## Data
{data_context}

## Request
{user_request}

## Rules
1. If a specific entity is mentioned, visualize ONLY that entity
2. Create ONE focused chart
3. Title should reflect the specific entity/column asked about

```python
import matplotlib.pyplot as plt
import seaborn as sns

# Filter for specific entity if mentioned in question
# Create ONE chart answering the specific question

plt.figure(figsize=(10, 6))
# Chart code
plt.title('Specific Title About What Was Asked')
plt.tight_layout()
plt.show()
```"""

    # Insights prompt - FOCUSED
    INSIGHTS_PROMPT = """Provide KEY insights from the data.

## Data
{data_context}

## Focus
{focus_area}

## Rules - BE CONCISE
- Maximum 3 bullet points
- Each insight must have a specific number
- No lengthy explanations

```python
print("=== KEY INSIGHTS ===")
print(f"1. [Most important finding]: [number]")
print(f"2. [Second finding]: [number]")  
print(f"3. [Third finding]: [number]")
```"""

    @classmethod
    def get_prompt_for_request(cls, data_context: str, user_request: str) -> str:
        """Select the right prompt based on the request."""
        request_lower = user_request.lower()
        
        # Prediction keywords
        if any(kw in request_lower for kw in ['predict', 'forecast', 'projection', 'future', 'will be', 'by 2025', 'by 2030', 'by 2050', 'estimate']):
            return cls.PREDICTION_PROMPT.format(
                data_context=data_context,
                user_request=user_request
            )
        
        # Visualization keywords
        if any(kw in request_lower for kw in ['chart', 'plot', 'graph', 'visualiz', 'show me', 'display']):
            return cls.VISUALIZATION_PROMPT.format(
                data_context=data_context,
                user_request=user_request
            )
        
        # Default to direct answer
        return cls.DIRECT_ANSWER_PROMPT.format(
            data_context=data_context,
            user_request=user_request
        )
    
    @classmethod
    def get_analysis_prompt(cls, data_context: str, user_request: str) -> str:
        """Get the appropriate prompt for analysis requests."""
        return cls.get_prompt_for_request(data_context, user_request)
    
    @classmethod
    def get_visualization_prompt(cls, data_context: str, user_request: str) -> str:
        """Get visualization prompt."""
        return cls.VISUALIZATION_PROMPT.format(
            data_context=data_context,
            user_request=user_request
        )
    
    @classmethod
    def get_insights_prompt(cls, data_context: str, focus_area: str = "general") -> str:
        """Get insights prompt."""
        return cls.INSIGHTS_PROMPT.format(
            data_context=data_context,
            focus_area=focus_area
        )
    
    @classmethod
    def get_code_generation_prompt(cls, data_context: str, user_request: str) -> str:
        """Get code generation prompt."""
        return cls.get_prompt_for_request(data_context, user_request)


class AgentRouterPrompt:
    """Prompt for routing."""
    
    ROUTER_PROMPT = """Route this request.
Request: {user_request}
Agents: visualization, prediction, insights, code-generation
Reply JSON only: {{"agent": "name", "confidence": 0.9, "reason": "brief"}}"""

    @classmethod
    def get_router_prompt(cls, user_request: str) -> str:
        return cls.ROUTER_PROMPT.format(user_request=user_request)


prompt_templates = PromptTemplates()
agent_router_prompt = AgentRouterPrompt()
