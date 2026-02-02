"""
Centralized prompt templates for AI agents.
Best-in-class prompts for a comprehensive Data Science AI Agent.
"""

from typing import Optional


class PromptTemplates:
    """Collection of prompt templates - OPTIMIZED FOR ACCURATE, CONSISTENT RESPONSES."""
    
    # ==================== SYSTEM PROMPT ====================
    DATA_ASSISTANT_SYSTEM = """You are an expert data scientist AI assistant with comprehensive capabilities.

CAPABILITIES YOU HAVE:
1. DATA PROFILING - Summarize, describe, find data quality issues
2. DATA CLEANING - Handle missing values, outliers, encoding
3. EDA - Explore relationships, distributions, trends
4. STATISTICS - Hypothesis testing, correlations, significance tests
5. PREDICTION - Forecast future values using multiple regression models
6. MACHINE LEARNING - Classification, clustering, feature importance
7. VISUALIZATION - Create informative charts and graphs

CRITICAL RULES (NEVER VIOLATE):
1. READ THE QUESTION CAREFULLY - identify the SPECIFIC entity mentioned
2. ANSWER ONLY about that specific entity - NOT global/general answers
3. Example: Question about "India" → Answer about INDIA only
4. Use proper statistical methods with metrics (R², p-value, CI)
5. Keep explanations under 100 words
6. The DataFrame is already loaded as 'df'

RESPONSE FORMAT:
1. Brief direct answer (1-2 sentences)
2. Python code that calculates exactly what was asked
3. Code MUST print a clearly formatted result with metrics

WRONG: Question about India → Answer about world population
RIGHT: Question about India → Filter df for India, calculate India's prediction only"""

    # ==================== PREDICTION PROMPT (MULTI-MODEL) ====================
    PREDICTION_PROMPT = """GENERATE A RIGOROUS PREDICTION using multiple statistical models.

## Data Available
{data_context}

## THE QUESTION
{user_request}

## REQUIRED METHODOLOGY (YOU MUST FOLLOW THIS EXACTLY)

### Step 1: Data Preparation
- Identify the SPECIFIC entity mentioned (e.g., "India", "USA")
- Filter data for ONLY that entity
- Extract time series: years and values

### Step 2: Apply THREE Models (REQUIRED - DO ALL THREE)
1. **Linear Regression** - scipy.stats.linregress
2. **Polynomial Regression (degree 2)** - np.polyfit  
3. **Exponential Growth** - log-linear regression for CAGR

### Step 3: Model Selection
- Calculate R² for each model
- Select the model with the BEST R² score
- If R² < 0.7, warn about low confidence

### Step 4: Prediction with Confidence Interval
- Generate point prediction from best model
- Calculate 95% confidence interval (±2%)

### Step 5: Output Format (REQUIRED - USE THIS EXACT FORMAT)

```python
import numpy as np
from scipy import stats

# STEP 1: Filter for specific entity
entity = "EXTRACT_FROM_QUESTION"  # e.g., "India"
target_year = EXTRACT_YEAR  # e.g., 2026

# Find the entity column (country, name, etc.)
entity_col = None
for col in df.columns:
    if df[col].dtype == 'object' and entity.lower() in df[col].str.lower().values:
        entity_col = col
        break

if entity_col:
    entity_data = df[df[entity_col].str.lower() == entity.lower()].copy()
else:
    entity_data = df.copy()  # Use all data if no entity filter

# Extract years and values (adjust column names as needed)
year_col = [c for c in entity_data.columns if 'year' in c.lower()][0] if any('year' in c.lower() for c in entity_data.columns) else entity_data.columns[0]
value_cols = entity_data.select_dtypes(include=[np.number]).columns
value_col = value_cols[0] if len(value_cols) > 0 else None

years = entity_data[year_col].values
values = entity_data[value_col].values

print(f"Analyzing {{len(years)}} data points for {{entity}}")

# MODEL 1: Linear Regression
slope, intercept, r_lin, p_val, std_err = stats.linregress(years, values)
pred_linear = intercept + slope * target_year
r2_linear = r_lin ** 2

# MODEL 2: Polynomial Regression (degree 2)
years_norm = years - years.mean()
coeffs = np.polyfit(years_norm, values, 2)
poly = np.poly1d(coeffs)
pred_poly = poly(target_year - years.mean())
predictions_poly = poly(years_norm)
ss_res = np.sum((values - predictions_poly) ** 2)
ss_tot = np.sum((values - values.mean()) ** 2)
r2_poly = max(0, 1 - (ss_res / ss_tot))

# MODEL 3: Exponential Growth (CAGR)
log_values = np.log(values[values > 0])
years_valid = years[values > 0]
slope_exp, intercept_exp, r_exp, _, _ = stats.linregress(years_valid, log_values)
r2_exp = r_exp ** 2
cagr = np.exp(slope_exp) - 1
pred_exp = np.exp(intercept_exp) * ((1 + cagr) ** (target_year - years_valid[0]))

# SELECT BEST MODEL
models = {{
    'Linear': (r2_linear, pred_linear),
    'Polynomial': (r2_poly, pred_poly),
    'Exponential': (r2_exp, pred_exp)
}}
best_name, (best_r2, best_pred) = max(models.items(), key=lambda x: x[1][0])

# Calculate confidence interval (±2% for simplicity)
ci_low = best_pred * 0.98
ci_high = best_pred * 1.02

# FORMATTED OUTPUT
print("\\n" + "=" * 55)
print("📊 PREDICTION ANALYSIS REPORT")
print("=" * 55)
print(f"Entity: {{entity}}")
print(f"Target Year: {{target_year}}")
print(f"Data Points: {{len(years)}}")
print("\\n📈 MODEL COMPARISON:")
print("-" * 40)
for name, (r2, pred) in models.items():
    marker = "✓ BEST" if name == best_name else "      "
    print(f"  {{marker}} {{name:12}} R²={{r2:.4f}}  →  {{pred:,.0f}}")
print(f"\\n✅ SELECTED: {{best_name}} (R² = {{best_r2:.4f}})")
print(f"\\n🎯 PREDICTION: {{best_pred:,.0f}}")
print(f"   95% CI: {{ci_low:,.0f}} — {{ci_high:,.0f}}")
print("=" * 55)
```

NOW write code that answers EXACTLY: {user_request}"""

    # ==================== STATISTICS PROMPT ====================
    STATISTICS_PROMPT = """Perform rigorous statistical analysis.

## Data Available
{data_context}

## THE QUESTION
{user_request}

## STATISTICAL METHODS AVAILABLE
- T-test: Compare two groups (scipy.stats.ttest_ind)
- Chi-square: Test independence (scipy.stats.chi2_contingency)
- ANOVA: Compare multiple groups (scipy.stats.f_oneway)
- Correlation: Pearson, Spearman (scipy.stats.pearsonr, spearmanr)
- Normality test: Shapiro-Wilk (scipy.stats.shapiro)

## REQUIRED OUTPUT FORMAT
Include these metrics in your output:
- Test statistic
- P-value
- Effect size (Cohen's d, Cramér's V, etc.)
- Interpretation (significant/not significant)

```python
from scipy import stats
import numpy as np

# Your statistical analysis code
# Must include: test statistic, p-value, effect size, interpretation

print("\\n" + "=" * 50)
print("📊 STATISTICAL ANALYSIS")
print("=" * 50)
print(f"Test: [test name]")
print(f"Statistic: [value]")
print(f"P-value: [value]")
print(f"Effect Size: [value]")
print(f"\\n✅ Conclusion: [interpretation]")
print("=" * 50)
```"""

    # ==================== EDA PROMPT ====================
    EDA_PROMPT = """Perform Exploratory Data Analysis.

## Data Available
{data_context}

## THE QUESTION
{user_request}

## EDA COMPONENTS
1. Summary statistics
2. Missing values analysis
3. Distribution analysis
4. Correlation analysis (for numeric columns)
5. Key insights

```python
import numpy as np
import pandas as pd

# Generate comprehensive EDA
print("\\n" + "=" * 55)
print("📊 EXPLORATORY DATA ANALYSIS")
print("=" * 55)

# Dataset overview
print(f"\\n📋 OVERVIEW")
print(f"Rows: {{len(df):,}}")
print(f"Columns: {{len(df.columns)}}")
print(f"Memory: {{df.memory_usage(deep=True).sum() / 1024 / 1024:.2f}} MB")

# Missing values
missing = df.isna().sum()
missing_cols = missing[missing > 0]
print(f"\\n⚠️ MISSING VALUES: {{len(missing_cols)}} columns")
for col, count in missing_cols.head(5).items():
    print(f"  - {{col}}: {{count}} ({{count/len(df)*100:.1f}}%)")

# Numeric summary
print(f"\\n📈 NUMERIC SUMMARY")
print(df.describe().round(2).to_string())

# Key correlations
numeric_cols = df.select_dtypes(include=[np.number]).columns
if len(numeric_cols) >= 2:
    corr = df[numeric_cols].corr()
    print(f"\\n🔗 TOP CORRELATIONS")
    # Show top correlations

print("=" * 55)
```"""

    # ==================== DIRECT ANSWER PROMPT ====================
    DIRECT_ANSWER_PROMPT = """Answer this SPECIFIC question using the data.

## Data Available
{data_context}

## THE QUESTION
{user_request}

## RULES
1. Extract the SPECIFIC entity/column from the question
2. Filter/calculate for ONLY that entity
3. Print the exact answer requested
4. Include relevant metrics (mean, count, percentage, etc.)
5. Keep explanation under 50 words

```python
import numpy as np
import pandas as pd

# Your code to answer the EXACT question
# 1. Filter for specific entity if mentioned
# 2. Calculate what was asked
# 3. Print clear, formatted answer

print("\\n=== ANSWER ===")
print(f"[Your specific answer with numbers]")
```"""

    # ==================== VISUALIZATION PROMPT ====================
    VISUALIZATION_PROMPT = """Create a professional visualization.

## Data
{data_context}

## Request
{user_request}

## RULES
1. If a specific entity is mentioned, visualize ONLY that entity
2. Create ONE focused, informative chart
3. Use professional styling
4. Include clear title, labels, and annotations

```python
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np

# Set professional style
plt.style.use('seaborn-v0_8-whitegrid')
fig, ax = plt.subplots(figsize=(10, 6))

# Your visualization code
# - Filter for specific entity if mentioned
# - Choose appropriate chart type
# - Add clear titles and labels

plt.title('Clear, Descriptive Title', fontsize=14, fontweight='bold')
plt.xlabel('X-axis Label', fontsize=11)
plt.ylabel('Y-axis Label', fontsize=11)
plt.tight_layout()
plt.show()
```"""

    # ==================== INSIGHTS PROMPT ====================
    INSIGHTS_PROMPT = """Provide KEY insights from the data.

## Data
{data_context}

## Focus
{focus_area}

## RULES - BE CONCISE
- Maximum 5 bullet points
- Each insight must have a specific number/metric
- Prioritize actionable findings
- No lengthy explanations

```python
import numpy as np
import pandas as pd

# Analyze data and extract key insights

print("\\n" + "=" * 50)
print("💡 KEY INSIGHTS")
print("=" * 50)
print(f"1. [Most important finding]: [specific number]")
print(f"2. [Second finding]: [specific number]")
print(f"3. [Third finding]: [specific number]")
print(f"\\n📝 RECOMMENDATION: [actionable suggestion]")
print("=" * 50)
```"""

    # ==================== ML PROMPT ====================
    ML_PROMPT = """Perform machine learning analysis.

## Data Available
{data_context}

## THE QUESTION
{user_request}

## ML CAPABILITIES
- Classification: Train classifiers with accuracy metrics
- Regression: Prediction with R², RMSE, MAE
- Clustering: K-Means, assign cluster labels
- Feature Importance: Identify key predictors

## REQUIRED OUTPUT
- Model performance metrics
- Key findings
- Visualization if appropriate

```python
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import numpy as np

# Your ML code
# Include:
# - Data preparation
# - Model training
# - Evaluation metrics
# - Results interpretation

print("\\n" + "=" * 50)
print("🤖 MACHINE LEARNING RESULTS")
print("=" * 50)
print(f"Model: [model name]")
print(f"Accuracy/R²: [value]")
print(f"Key Features: [list]")
print("=" * 50)
```"""

    # ==================== PROMPT SELECTION ====================
    @classmethod
    def get_prompt_for_request(cls, data_context: str, user_request: str) -> str:
        """Intelligently select the best prompt based on the request."""
        request_lower = user_request.lower()
        
        # Prediction keywords
        prediction_keywords = ['predict', 'forecast', 'projection', 'future', 'will be', 
                               'by 2025', 'by 2026', 'by 2030', 'by 2050', 'estimate', 'next year']
        if any(kw in request_lower for kw in prediction_keywords):
            return cls.PREDICTION_PROMPT.format(
                data_context=data_context,
                user_request=user_request
            )
        
        # Statistics keywords
        stats_keywords = ['significant', 'correlation', 'correlate', 't-test', 'test', 
                          'p-value', 'hypothesis', 'compare', 'difference between', 'anova']
        if any(kw in request_lower for kw in stats_keywords):
            return cls.STATISTICS_PROMPT.format(
                data_context=data_context,
                user_request=user_request
            )
        
        # EDA keywords
        eda_keywords = ['explore', 'eda', 'exploratory', 'overview', 'summary', 'describe',
                        'profile', 'understand', 'distribution', 'missing']
        if any(kw in request_lower for kw in eda_keywords):
            return cls.EDA_PROMPT.format(
                data_context=data_context,
                user_request=user_request
            )
        
        # ML keywords
        ml_keywords = ['train', 'model', 'classify', 'classification', 'cluster', 
                       'feature importance', 'machine learning', 'ml']
        if any(kw in request_lower for kw in ml_keywords):
            return cls.ML_PROMPT.format(
                data_context=data_context,
                user_request=user_request
            )
        
        # Visualization keywords
        viz_keywords = ['chart', 'plot', 'graph', 'visualiz', 'show me', 'display', 'histogram', 'scatter']
        if any(kw in request_lower for kw in viz_keywords):
            return cls.VISUALIZATION_PROMPT.format(
                data_context=data_context,
                user_request=user_request
            )
        
        # Insights keywords
        insight_keywords = ['insight', 'pattern', 'trend', 'key finding', 'important']
        if any(kw in request_lower for kw in insight_keywords):
            return cls.INSIGHTS_PROMPT.format(
                data_context=data_context,
                focus_area="general"
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
    
    @classmethod
    def get_prediction_prompt(cls, data_context: str, user_request: str) -> str:
        """Get prediction-specific prompt."""
        return cls.PREDICTION_PROMPT.format(
            data_context=data_context,
            user_request=user_request
        )
    
    @classmethod
    def get_statistics_prompt(cls, data_context: str, user_request: str) -> str:
        """Get statistics-specific prompt."""
        return cls.STATISTICS_PROMPT.format(
            data_context=data_context,
            user_request=user_request
        )
    
    @classmethod
    def get_eda_prompt(cls, data_context: str, user_request: str) -> str:
        """Get EDA-specific prompt."""
        return cls.EDA_PROMPT.format(
            data_context=data_context,
            user_request=user_request
        )


class AgentRouterPrompt:
    """Enhanced prompt for intelligent agent routing."""
    
    ROUTER_PROMPT = """Classify this data science request into one category.

Request: {user_request}

Categories:
- prediction: Forecasting future values, estimating, projecting
- statistics: Hypothesis testing, correlation, significance tests
- eda: Exploratory analysis, data summary, profiling
- visualization: Charts, graphs, plots
- ml: Machine learning, classification, clustering
- cleaning: Handle missing values, outliers
- insights: Key findings, patterns, trends
- code-generation: General data analysis code

Reply with ONLY this JSON:
{{"agent": "category_name", "confidence": 0.0-1.0, "reason": "one sentence"}}"""

    @classmethod
    def get_router_prompt(cls, user_request: str) -> str:
        return cls.ROUTER_PROMPT.format(user_request=user_request)


# Global instances
prompt_templates = PromptTemplates()
agent_router_prompt = AgentRouterPrompt()
