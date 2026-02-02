"""
Specialized AI Agents for the Data Science Platform.
Each agent is optimized for specific types of data science tasks.
"""

import logging
from typing import Dict, List, Any, Optional

from .agent_base import BaseAgent
from .config import settings
from .file_handler import get_dataframe
from .shared_utils import text_processor, data_context_builder
from .prompt_templates import prompt_templates
from .gemini_client import get_gemini_client

# Configure logging
logger = logging.getLogger(__name__)


class VisualizationAgent(BaseAgent):
    """Specialized agent for creating data visualizations."""
    
    def __init__(self):
        super().__init__(
            name="Chart Creator",
            role="Create Charts & Graphs",
            goal="Turn your data into clear, easy-to-understand visual charts",
            backstory="I help you see patterns and trends in your data by creating beautiful charts and graphs that make complex information simple to understand."
        )
    
    def create_visualization(
        self, 
        session_id: str, 
        user_request: str, 
        file_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create visualizations based on user request.
        
        Args:
            session_id: The session ID
            user_request: What the user wants to visualize
            file_id: Optional specific file ID
            
        Returns:
            Dictionary with response, code_blocks, and metadata
        """
        try:
            client = self._get_client()
            data_context = self.get_data_context(session_id, file_id)
            
            prompt = prompt_templates.get_visualization_prompt(
                data_context=data_context,
                user_request=user_request
            )
            
            response = client.client.models.generate_content(
                model=settings.gemini_model,
                contents=f"{prompt_templates.DATA_ASSISTANT_SYSTEM}\n\n{prompt}"
            )
            
            code_blocks = text_processor.extract_code_blocks(response.text)
            clean_response = text_processor.clean_response_text(response.text)
            
            return {
                "agent": self.name,
                "response": clean_response,
                "code_blocks": code_blocks,
                "has_code": len(code_blocks) > 0,
                "success": True
            }
            
        except Exception as e:
            logger.error(f"Error creating visualization: {e}")
            return {
                "agent": self.name,
                "response": f"I encountered an error while creating the visualization: {str(e)}. Please try rephrasing your request.",
                "code_blocks": [],
                "has_code": False,
                "success": False
            }


class CodeExecutionAgent(BaseAgent):
    """Specialized agent for code execution and data analysis."""
    
    def __init__(self):
        super().__init__(
            name="Data Analyst",
            role="Analyze & Process Data",
            goal="Answer your questions by analyzing your data",
            backstory="I help you get answers from your data by performing calculations, finding patterns, and providing clear insights about what your data means for your business."
        )
    
    def generate_code(
        self, 
        session_id: str, 
        user_request: str, 
        file_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate executable Python code based on user request.
        
        Args:
            session_id: The session ID
            user_request: What the user wants to analyze
            file_id: Optional specific file ID
            
        Returns:
            Dictionary with response, code_blocks, and metadata
        """
        try:
            client = self._get_client()
            data_context = self.get_data_context(session_id, file_id)
            
            prompt = prompt_templates.get_code_generation_prompt(
                data_context=data_context,
                user_request=user_request
            )
            
            response = client.client.models.generate_content(
                model=settings.gemini_model,
                contents=f"{prompt_templates.DATA_ASSISTANT_SYSTEM}\n\n{prompt}"
            )
            
            code_blocks = text_processor.extract_code_blocks(response.text)
            clean_response = text_processor.clean_response_text(response.text)
            
            return {
                "agent": self.name,
                "response": clean_response,
                "code_blocks": code_blocks,
                "has_code": len(code_blocks) > 0,
                "success": True
            }
            
        except Exception as e:
            logger.error(f"Error generating code: {e}")
            return {
                "agent": self.name,
                "response": f"I encountered an error while generating the analysis: {str(e)}. Please try rephrasing your request.",
                "code_blocks": [],
                "has_code": False,
                "success": False
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
        """
        Recommend packages based on user needs.
        
        Args:
            user_request: What capabilities the user needs
            
        Returns:
            Dictionary with recommendations
        """
        try:
            client = self._get_client()
            
            prompt = f"""You are a helpful assistant for data analysis tools.

User Request: {user_request}

Based on the request, recommend appropriate Python packages. Focus on:
1. What capabilities they'll gain
2. How each package will help their analysis
3. Simple explanation of benefits

Common data science packages:
- pandas: Data manipulation
- numpy: Numerical computing
- matplotlib/seaborn: Visualization
- scikit-learn: Machine learning
- scipy: Scientific computing
- statsmodels: Statistical analysis
- plotly: Interactive visualizations

Provide clear, non-technical recommendations."""
            
            response = client.client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt
            )
            
            # Extract package names from the response
            recommendations = self._extract_package_recommendations(response.text)
            
            return {
                "agent": self.name,
                "response": response.text,
                "recommendations": recommendations,
                "success": True
            }
            
        except Exception as e:
            logger.error(f"Error recommending packages: {e}")
            return {
                "agent": self.name,
                "response": f"Error recommending packages: {str(e)}",
                "recommendations": [],
                "success": False
            }
    
    def _extract_package_recommendations(self, text: str) -> List[str]:
        """Extract package names from the response."""
        import re
        packages = re.findall(r'pip install ([a-zA-Z0-9\-_]+)', text)
        
        # Also look for common package names mentioned
        common_packages = [
            'pandas', 'numpy', 'matplotlib', 'seaborn', 'scikit-learn',
            'scipy', 'statsmodels', 'plotly', 'xgboost', 'lightgbm'
        ]
        
        for pkg in common_packages:
            if pkg.lower() in text.lower() and pkg not in packages:
                packages.append(pkg)
        
        return list(set(packages))


class InsightsAgent(BaseAgent):
    """Specialized agent for data insights and analysis."""
    
    def __init__(self):
        super().__init__(
            name="Business Insights",
            role="Generate Business Insights",
            goal="Discover key insights and opportunities in your data",
            backstory="I analyze your data to find important business insights, trends, and opportunities that can help you make better decisions and improve your business performance."
        )
    
    def generate_insights(
        self, 
        session_id: str, 
        file_id: Optional[str] = None, 
        focus_area: str = "general"
    ) -> Dict[str, Any]:
        """
        Generate comprehensive insights about the dataset.
        
        Args:
            session_id: The session ID
            file_id: Optional specific file ID
            focus_area: Area to focus insights on (e.g., "sales", "trends", "quality")
            
        Returns:
            Dictionary with insights, code_blocks, and metadata
        """
        try:
            client = self._get_client()
            data_context = self.get_data_context(session_id, file_id)
            
            prompt = prompt_templates.get_insights_prompt(
                data_context=data_context,
                focus_area=focus_area
            )
            
            response = client.client.models.generate_content(
                model=settings.gemini_model,
                contents=f"{prompt_templates.DATA_ASSISTANT_SYSTEM}\n\n{prompt}"
            )
            
            code_blocks = text_processor.extract_code_blocks(response.text)
            clean_response = text_processor.clean_response_text(response.text)
            
            return {
                "agent": self.name,
                "response": clean_response,
                "code_blocks": code_blocks,
                "has_code": len(code_blocks) > 0,
                "success": True
            }
            
        except Exception as e:
            logger.error(f"Error generating insights: {e}")
            return {
                "agent": self.name,
                "response": f"I encountered an error while generating insights: {str(e)}. Please try again.",
                "code_blocks": [],
                "has_code": False,
                "success": False
            }


class AgentOrchestrator:
    """
    Orchestrates requests between specialized agents.
    Enhanced with prediction, statistics, and EDA capabilities.
    """
    
    def __init__(self):
        self.visualization_agent = VisualizationAgent()
        self.code_execution_agent = CodeExecutionAgent()
        self.package_manager_agent = PackageManagerAgent()
        self.insights_agent = InsightsAgent()
        
        # Import new specialized agents
        try:
            from .prediction_agent import prediction_agent
            self.prediction_agent = prediction_agent
        except ImportError:
            self.prediction_agent = None
            logger.warning("PredictionAgent not available")
        
        try:
            from .statistics_agent import statistics_agent
            self.statistics_agent = statistics_agent
        except ImportError:
            self.statistics_agent = None
            logger.warning("StatisticsAgent not available")
        
        try:
            from .eda_agent import eda_agent
            self.eda_agent = eda_agent
        except ImportError:
            self.eda_agent = None
            logger.warning("EDAAgent not available")
        
        # Import SQL Agent for database queries
        try:
            from .sql_agent import sql_agent
            self.sql_agent = sql_agent
        except ImportError:
            self.sql_agent = None
            logger.warning("SQLAgent not available")
        
        self._agents = {
            'visualization': self.visualization_agent,
            'code-generation': self.code_execution_agent,
            'package-manager': self.package_manager_agent,
            'insights': self.insights_agent,
            'prediction': self.prediction_agent,
            'statistics': self.statistics_agent,
            'eda': self.eda_agent,
            'sql': self.sql_agent
        }
    
    def get_agent(self, agent_name: str):
        """Get an agent by name."""
        agent = self._agents.get(agent_name)
        if agent is None:
            return self.code_execution_agent
        return agent
    
    def route_request(self, user_request: str) -> Dict[str, Any]:
        """
        Route a request to the appropriate agent using enhanced keyword matching.
        
        Args:
            user_request: The user's request
            
        Returns:
            Dictionary with selected agent and routing info
        """
        request_lower = user_request.lower()
        
        # Enhanced keyword-based routing for accuracy
        routing_rules = [
            {
                'agent': 'sql',
                'keywords': ['database', 'sql', 'query', 'table', 'postgres', 'mysql', 
                            'select', 'from table', 'join', 'schema', 'records'],
                'confidence': 0.95
            },
            {
                'agent': 'prediction',
                'keywords': ['predict', 'forecast', 'projection', 'future', 'estimate', 
                            'by 2025', 'by 2026', 'by 2030', 'next year', 'will be'],
                'confidence': 0.9
            },
            {
                'agent': 'statistics',
                'keywords': ['significant', 'correlation', 't-test', 'test', 'p-value', 
                            'hypothesis', 'compare', 'anova', 'chi-square'],
                'confidence': 0.9
            },
            {
                'agent': 'eda',
                'keywords': ['explore', 'eda', 'exploratory', 'profile', 'overview', 
                            'summary', 'describe', 'distribution', 'missing values'],
                'confidence': 0.85
            },
            {
                'agent': 'visualization',
                'keywords': ['chart', 'plot', 'graph', 'visualiz', 'histogram', 
                            'scatter', 'bar chart', 'line chart', 'heatmap'],
                'confidence': 0.9
            },
            {
                'agent': 'insights',
                'keywords': ['insight', 'pattern', 'trend', 'finding', 'key', 'important'],
                'confidence': 0.8
            }
        ]
        
        # Check each routing rule
        for rule in routing_rules:
            if any(kw in request_lower for kw in rule['keywords']):
                return {
                    "agent": rule['agent'],
                    "confidence": rule['confidence'],
                    "reason": f"Keywords match {rule['agent']} capabilities"
                }
        
        # Fallback to AI-based routing
        try:
            client = get_gemini_client()
            # The new GeminiClient doesn't have route_to_agent method yet
            # For now, let's implement a simple prompt-based routing here directly
            
            prompt = f"""Analyze the following user request and determine the best specialized agent to handle it.
            
            User Request: {user_request}
            
            Available Agents:
            - sql: Database queries, SQL generation, schema questions
            - visualization: Charts, graphs, plots
            - prediction: Forecasting, future estimates
            - statistics: Hypothesis testing, correlation, statistical analysis
            - eda: Exploratory analysis, data profiling, summary
            - insights: Finding patterns, trends, general analysis
            - code-generation: Writing python code, data processing
            
            Return ONLY the agent name (lowercase)."""
            
            response = client.generate_response(
                session_id="routing_session",
                user_message=prompt,
                use_chat_history=False
            )
            
            agent_name = response.get("response", "").strip().lower()
            
            # Validate response
            valid_agents = ['sql', 'visualization', 'prediction', 'statistics', 'eda', 'insights', 'code-generation']
            if agent_name in valid_agents:
                return {
                    "agent": agent_name,
                    "confidence": 0.8,
                    "reason": "AI routed"
                }
            
            return {
                "agent": "code-generation",
                "confidence": 0.5,
                "reason": "Default fallback"
            }
            
        except Exception as e:
            logger.error(f"Error routing request: {e}")
            # Default fallback
            return {
                "agent": "code-generation",
                "confidence": 0.5,
                "reason": "Default routing"
            }

    
    def list_agents(self) -> List[Dict[str, Any]]:
        """List all available agents and their capabilities."""
        agents_list = [
            {
                "id": "sql",
                "name": "SQL Agent",
                "role": "Database Query Expert",
                "goal": "Answer questions about your database using natural language",
                "capabilities": [
                    "Natural language to SQL conversion",
                    "PostgreSQL, MySQL, SQLite support",
                    "Query explanation in plain English",
                    "Query optimization suggestions",
                    "Schema exploration and visualization",
                    "Auto-training from database schema"
                ]
            },
            {
                "id": "prediction",
                "name": "Prediction Agent",
                "role": "Forecast & Predict",
                "goal": "Make accurate predictions using multiple statistical models",
                "capabilities": [
                    "Linear regression predictions",
                    "Polynomial regression",
                    "Exponential growth/CAGR",
                    "Model comparison with R² scores",
                    "Confidence intervals"
                ]
            },
            {
                "id": "statistics",
                "name": "Statistics Agent",
                "role": "Statistical Analysis",
                "goal": "Perform rigorous hypothesis testing and statistical analysis",
                "capabilities": [
                    "T-tests (independent and paired)",
                    "Chi-square tests",
                    "ANOVA",
                    "Correlation analysis",
                    "A/B testing",
                    "Confidence intervals"
                ]
            },
            {
                "id": "eda",
                "name": "EDA Agent",
                "role": "Exploratory Analysis",
                "goal": "Comprehensive exploratory data analysis",
                "capabilities": [
                    "Univariate analysis",
                    "Bivariate analysis",
                    "Distribution analysis",
                    "Missing value detection",
                    "Outlier detection",
                    "Auto-generated insights"
                ]
            },
            {
                "id": "visualization",
                "name": self.visualization_agent.name,
                "role": self.visualization_agent.role,
                "goal": self.visualization_agent.goal,
                "capabilities": [
                    "Create matplotlib and seaborn visualizations",
                    "Generate statistical plots and charts",
                    "Design clear, informative figures",
                    "Recommend appropriate chart types"
                ]
            },
            {
                "id": "code-generation",
                "name": self.code_execution_agent.name,
                "role": self.code_execution_agent.role,
                "goal": self.code_execution_agent.goal,
                "capabilities": [
                    "Generate Python analysis code",
                    "Perform data calculations",
                    "Create data processing pipelines",
                    "Implement statistical analyses"
                ]
            },
            {
                "id": "insights",
                "name": self.insights_agent.name,
                "role": self.insights_agent.role,
                "goal": self.insights_agent.goal,
                "capabilities": [
                    "Identify patterns and trends",
                    "Generate business insights",
                    "Assess data quality",
                    "Provide actionable recommendations"
                ]
            },
            {
                "id": "package-manager",
                "name": self.package_manager_agent.name,
                "role": self.package_manager_agent.role,
                "goal": self.package_manager_agent.goal,
                "capabilities": [
                    "Recommend appropriate packages",
                    "Handle package installations",
                    "Suggest package alternatives"
                ]
            }
        ]
        return agents_list


# Create instances for backward compatibility
visualization_agent = VisualizationAgent()
code_execution_agent = CodeExecutionAgent()
package_manager_agent = PackageManagerAgent()
insights_agent = InsightsAgent()

# Export the orchestrator with all agents
agent_orchestrator = AgentOrchestrator()

