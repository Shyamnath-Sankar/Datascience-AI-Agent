import google.generativeai as genai
from typing import Dict, List, Any, Optional
import re
from .file_handler import get_dataframe

# Configure Gemini API
GEMINI_API_KEY = "AIzaSyBkY6Sm51IG-GwxTFwcErQkHaB41zS0S-I"
genai.configure(api_key=GEMINI_API_KEY)

class BaseAgent:
    """Base class for all specialized agents."""
    
    def __init__(self, name: str, role: str, goal: str, backstory: str):
        self.name = name
        self.role = role
        self.goal = goal
        self.backstory = backstory
        self.model = genai.GenerativeModel('gemini-2.0-flash-exp')
    
    def get_data_context(self, session_id: str, file_id: Optional[str] = None) -> str:
        """Get context about the available data for the session."""
        try:
            df = get_dataframe(session_id, file_id)
            if df is None:
                return "No data available in the current session."
            
            context = f"""
Available Dataset Information:
- Shape: {df.shape[0]} rows, {df.shape[1]} columns
- Columns: {', '.join(df.columns.tolist())}
- Data types: {df.dtypes.to_dict()}
- Missing values: {df.isnull().sum().to_dict()}
- Sample data (first 3 rows):
{df.head(3).to_string()}
"""
            return context
        except Exception as e:
            return f"Error accessing data: {str(e)}"
    
    def _extract_code_blocks(self, text: str) -> List[Dict[str, str]]:
        """Extract Python code blocks from the response text."""
        code_blocks = []
        lines = text.split('\n')
        in_code_block = False
        current_code = []
        current_language = ""
        
        for line in lines:
            if line.strip().startswith('```'):
                if in_code_block:
                    code_blocks.append({
                        "language": current_language,
                        "code": '\n'.join(current_code)
                    })
                    current_code = []
                    in_code_block = False
                else:
                    current_language = line.strip()[3:].strip() or "python"
                    in_code_block = True
            elif in_code_block:
                current_code.append(line)
        
        return code_blocks
    
    def _clean_response_text(self, text: str) -> str:
        """Remove code blocks from response text to keep only explanations."""
        lines = text.split('\n')
        cleaned_lines = []
        in_code_block = False
        
        for line in lines:
            if line.strip().startswith('```'):
                in_code_block = not in_code_block
                continue
            elif not in_code_block:
                cleaned_lines.append(line)
        
        cleaned_text = '\n'.join(cleaned_lines).strip()
        cleaned_text = re.sub(r'\n\s*\n\s*\n', '\n\n', cleaned_text)
        
        return cleaned_text

class VisualizationAgent(BaseAgent):
    """Specialized agent for creating data visualizations."""
    
    def __init__(self):
        super().__init__(
            name="Chart Creator",
            role="Create Charts & Graphs",
            goal="Turn your data into clear, easy-to-understand visual charts",
            backstory="I help you see patterns and trends in your data by creating beautiful charts and graphs that make complex information simple to understand."
        )
    
    def create_visualization(self, session_id: str, user_request: str, file_id: Optional[str] = None) -> Dict[str, Any]:
        """Create visualizations based on user request."""
        try:
            data_context = self.get_data_context(session_id, file_id)
            
            prompt = f"""
You are a data visualization expert helping non-technical business users understand their data.

Dataset Context:
{data_context}

User Request: {user_request}

IMPORTANT: You are helping NON-TECHNICAL users. Your response should be:
1. Written in simple, business-friendly language
2. Focus on insights and findings, not technical details
3. Explain what the charts show in plain English
4. Provide actionable business recommendations
5. NO technical jargon or code explanations
6. Be concise and direct

ALWAYS create visualizations to answer the user's request. Your response should contain:
- What you found in the data (in simple terms)
- What the charts reveal (business insights)
- Key takeaways and recommendations

```python
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np

# IMPORTANT: The dataframe is already loaded as 'df' - DO NOT try to load CSV files
# Use the existing 'df' variable that contains your data

# Set up plotting style
plt.style.use('default')
sns.set_palette("husl")
plt.figure(figsize=(12, 8))

# First, examine the data structure
print("Available columns:", df.columns.tolist())
print("Data shape:", df.shape)
print("Sample data:")
print(df.head())

# Create the requested visualization using the existing dataframe 'df'
# DO NOT use pd.read_csv() - the data is already loaded
# Your specific visualization code here based on the request
# Make sure to include proper titles, labels, and formatting

plt.tight_layout()
plt.show()
```

Respond as if you're presenting findings to a business executive who wants clear insights, not technical details.
"""
            
            response = self.model.generate_content(prompt)
            code_blocks = self._extract_code_blocks(response.text)
            clean_response = self._clean_response_text(response.text)
            
            return {
                "agent": self.name,
                "response": clean_response,
                "code_blocks": code_blocks,
                "has_code": len(code_blocks) > 0
            }
            
        except Exception as e:
            return {
                "agent": self.name,
                "response": f"Error creating visualization: {str(e)}",
                "code_blocks": [],
                "has_code": False
            }

class CodeExecutionAgent(BaseAgent):
    """Specialized agent for code execution and debugging."""
    
    def __init__(self):
        super().__init__(
            name="Data Analyst",
            role="Analyze & Process Data",
            goal="Answer your questions by analyzing your data",
            backstory="I help you get answers from your data by performing calculations, finding patterns, and providing clear insights about what your data means for your business."
        )
    
    def generate_code(self, session_id: str, user_request: str, file_id: Optional[str] = None) -> Dict[str, Any]:
        """Generate executable Python code based on user request."""
        try:
            data_context = self.get_data_context(session_id, file_id)
            
            prompt = f"""
You are a data analysis expert helping non-technical business users get answers from their data.

Dataset Context:
{data_context}

User Request: {user_request}

IMPORTANT: You are helping NON-TECHNICAL users. Your response should be:
1. Written in simple, business-friendly language
2. Focus on the results and findings, not the process
3. Provide clear answers to their questions
4. Give actionable insights
5. NO technical explanations or code details
6. Be direct and concise

Perform the analysis silently in the background, but your response should only contain:
- Direct answers to their questions
- Key findings from the analysis
- Business implications
- Clear recommendations

```python
# IMPORTANT: The dataframe is already loaded as 'df' - DO NOT try to load CSV files
# Use the existing 'df' variable that contains your data

# First, examine the data structure
print("Available columns:", df.columns.tolist())
print("Data shape:", df.shape)

# Perform the requested analysis using the existing dataframe 'df'
# DO NOT use pd.read_csv() - the data is already loaded
# Your analysis code here
```

Respond as if you're a business analyst presenting results to stakeholders who want answers, not technical details.
"""
            
            response = self.model.generate_content(prompt)
            code_blocks = self._extract_code_blocks(response.text)
            clean_response = self._clean_response_text(response.text)
            
            return {
                "agent": self.name,
                "response": clean_response,
                "code_blocks": code_blocks,
                "has_code": len(code_blocks) > 0
            }
            
        except Exception as e:
            return {
                "agent": self.name,
                "response": f"Error generating code: {str(e)}",
                "code_blocks": [],
                "has_code": False
            }

class PackageManagerAgent(BaseAgent):
    """Specialized agent for package management and installation."""
    
    def __init__(self):
        super().__init__(
            name="Tool Advisor",
            role="Recommend Analysis Tools",
            goal="Help you understand what tools can enhance your data analysis",
            backstory="I help you understand what additional capabilities you can add to analyze your data better, explaining the benefits in simple business terms."
        )
    
    def recommend_packages(self, user_request: str) -> Dict[str, Any]:
        """Recommend packages based on user needs."""
        try:
            prompt = f"""
You are a helpful assistant for non-technical business users who need data analysis tools.

User Request: {user_request}

IMPORTANT: You are helping NON-TECHNICAL users. Your response should be:
1. Written in simple, business-friendly language
2. Focus on what they can accomplish, not technical details
3. Explain benefits in business terms
4. NO technical jargon or installation commands
5. Be encouraging and supportive

Your response should only contain:
- What capabilities they'll gain
- How it will help their business goals
- Simple explanation of benefits
- Reassurance that technical setup will be handled

Respond as if you're a business consultant explaining how new tools will help them achieve their goals.
"""
            
            response = self.model.generate_content(prompt)
            
            return {
                "agent": self.name,
                "response": response.text,
                "recommendations": self._extract_package_recommendations(response.text)
            }
            
        except Exception as e:
            return {
                "agent": self.name,
                "response": f"Error recommending packages: {str(e)}",
                "recommendations": []
            }
    
    def _extract_package_recommendations(self, text: str) -> List[str]:
        """Extract package names from the response."""
        # Simple regex to find package names in pip install commands
        import re
        packages = re.findall(r'pip install ([a-zA-Z0-9\-_]+)', text)
        return packages

class InsightsAgent(BaseAgent):
    """Specialized agent for data insights and analysis."""
    
    def __init__(self):
        super().__init__(
            name="Business Insights",
            role="Generate Business Insights",
            goal="Discover key insights and opportunities in your data",
            backstory="I analyze your data to find important business insights, trends, and opportunities that can help you make better decisions and improve your business performance."
        )
    
    def generate_insights(self, session_id: str, file_id: Optional[str] = None, focus_area: str = "general") -> Dict[str, Any]:
        """Generate comprehensive insights about the dataset."""
        try:
            data_context = self.get_data_context(session_id, file_id)
            
            prompt = f"""
You are a senior business analyst presenting insights to non-technical executives and decision-makers.

Dataset Context:
{data_context}

Focus Area: {focus_area}

IMPORTANT: You are presenting to NON-TECHNICAL business leaders. Your response should be:
1. Written in executive summary style
2. Focus on business impact and opportunities
3. Use clear, jargon-free language
4. Provide actionable recommendations
5. Highlight key trends and patterns
6. NO technical details or statistical jargon

Your insights should include:
- Executive Summary (2-3 key findings)
- Key Business Insights
- Opportunities for Improvement
- Recommended Actions
- Risk Areas to Monitor

```python
# IMPORTANT: The dataframe is already loaded as 'df' - DO NOT try to load CSV files
# Use the existing 'df' variable that contains your data

# First, examine the data structure
print("Available columns:", df.columns.tolist())
print("Data shape:", df.shape)
print("Sample data:")
print(df.head())

# Generate insights using the existing dataframe 'df'
# DO NOT use pd.read_csv() - the data is already loaded
# Your insights analysis code here
```

Present as if you're giving a board presentation - focus on what matters for business decisions.
"""
            
            response = self.model.generate_content(prompt)
            code_blocks = self._extract_code_blocks(response.text)
            clean_response = self._clean_response_text(response.text)
            
            return {
                "agent": self.name,
                "response": clean_response,
                "code_blocks": code_blocks,
                "has_code": len(code_blocks) > 0
            }
            
        except Exception as e:
            return {
                "agent": self.name,
                "response": f"Error generating insights: {str(e)}",
                "code_blocks": [],
                "has_code": False
            }

# Global instances
visualization_agent = VisualizationAgent()
code_execution_agent = CodeExecutionAgent()
package_manager_agent = PackageManagerAgent()
insights_agent = InsightsAgent()
