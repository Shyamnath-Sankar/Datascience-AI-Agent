"""
Gemini AI Client for the Data Science Platform.
Uses the new google-genai package for Gemini API interactions.
"""

from google import genai
from google.genai import types
from typing import Dict, List, Any, Optional
import logging
import json

from .config import settings
from .file_handler import get_dataframe
from .shared_utils import text_processor, data_context_builder, response_formatter
from .prompt_templates import prompt_templates

# Configure logging
logger = logging.getLogger(__name__)


class GeminiClient:
    """Production-grade Gemini AI client with the new google-genai package."""
    
    def __init__(self):
        self._client = None
        self._configured = False
        self.chat_sessions: Dict[str, Any] = {}
        self._initialize()
    
    def _initialize(self):
        """Initialize the Gemini client with API key."""
        try:
            api_key = settings.get_gemini_key()
            self._client = genai.Client(api_key=api_key)
            self._configured = True
            logger.info("Gemini client initialized successfully with google-genai")
        except ValueError as e:
            logger.warning(f"Gemini client not configured: {e}")
            self._configured = False
        except Exception as e:
            logger.error(f"Failed to initialize Gemini client: {e}")
            self._configured = False
    
    @property
    def is_configured(self) -> bool:
        """Check if the client is properly configured."""
        return self._configured
    
    @property
    def client(self):
        """Get the Gemini client, reinitializing if needed."""
        if not self._configured:
            self._initialize()
        if not self._configured:
            raise RuntimeError(
                "Gemini AI is not configured. Please set the GEMINI_API_KEY environment variable."
            )
        return self._client
    
    def get_data_context(self, session_id: str, file_id: Optional[str] = None) -> str:
        """Get comprehensive context about the available data."""
        try:
            df = get_dataframe(session_id, file_id)
            return data_context_builder.build_context(df, max_rows=5, include_stats=True)
        except Exception as e:
            logger.error(f"Error getting data context: {e}")
            return f"Error accessing data: {str(e)}"
    
    def generate_response(
        self, 
        session_id: str, 
        user_message: str, 
        file_id: Optional[str] = None,
        use_chat_history: bool = True
    ) -> Dict[str, Any]:
        """
        Generate an AI response with data context.
        
        Args:
            session_id: The session ID for data access
            user_message: The user's query
            file_id: Optional specific file to analyze
            use_chat_history: Whether to use conversation history
            
        Returns:
            Dictionary with response, code_blocks, and metadata
        """
        try:
            # Get data context
            data_context = self.get_data_context(session_id, file_id)
            
            # Create enhanced prompt - this now intelligently routes based on question type
            enhanced_prompt = prompt_templates.get_analysis_prompt(
                data_context=data_context,
                user_request=user_message
            )
            
            # Add system prompt with strict instructions
            full_prompt = f"{prompt_templates.DATA_ASSISTANT_SYSTEM}\n\n{enhanced_prompt}"
            
            # Generate response using new API
            response = self.client.models.generate_content(
                model=settings.gemini_model,
                contents=full_prompt
            )
            
            # Process response
            response_text = response.text
            code_blocks = text_processor.extract_code_blocks(response_text)
            clean_response = text_processor.clean_response_text(response_text)
            
            return response_formatter.success_response({
                "response": clean_response,
                "code_blocks": code_blocks,
                "has_code": len(code_blocks) > 0,
                "session_id": session_id,
                "file_id": file_id
            })
            
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            return response_formatter.error_response(
                f"Failed to generate response: {str(e)}",
                code="GENERATION_ERROR"
            )
    
    def generate_visualization(
        self,
        session_id: str,
        request: str,
        file_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate visualization code and explanation."""
        try:
            data_context = self.get_data_context(session_id, file_id)
            prompt = prompt_templates.get_visualization_prompt(
                data_context=data_context,
                user_request=request
            )
            
            response = self.client.models.generate_content(
                model=settings.gemini_model,
                contents=f"{prompt_templates.DATA_ASSISTANT_SYSTEM}\n\n{prompt}"
            )
            
            code_blocks = text_processor.extract_code_blocks(response.text)
            clean_response = text_processor.clean_response_text(response.text)
            
            return response_formatter.success_response({
                "response": clean_response,
                "code_blocks": code_blocks,
                "has_code": len(code_blocks) > 0,
                "session_id": session_id,
                "file_id": file_id
            })
            
        except Exception as e:
            logger.error(f"Error generating visualization: {e}")
            return response_formatter.error_response(
                f"Failed to generate visualization: {str(e)}",
                code="VISUALIZATION_ERROR"
            )
    
    def generate_insights(
        self, 
        session_id: str, 
        file_id: Optional[str] = None,
        focus_area: str = "general"
    ) -> Dict[str, Any]:
        """Generate comprehensive data insights."""
        try:
            data_context = self.get_data_context(session_id, file_id)
            prompt = prompt_templates.get_insights_prompt(
                data_context=data_context,
                focus_area=focus_area
            )
            
            response = self.client.models.generate_content(
                model=settings.gemini_model,
                contents=f"{prompt_templates.DATA_ASSISTANT_SYSTEM}\n\n{prompt}"
            )
            
            code_blocks = text_processor.extract_code_blocks(response.text)
            clean_response = text_processor.clean_response_text(response.text)
            
            return {
                "insights": clean_response,
                "code_blocks": code_blocks,
                "has_code": len(code_blocks) > 0,
                "session_id": session_id
            }
            
        except Exception as e:
            logger.error(f"Error generating insights: {e}")
            return {
                "insights": f"Error generating insights: {str(e)}",
                "code_blocks": [],
                "has_code": False,
                "session_id": session_id
            }
    
    def route_to_agent(self, user_request: str) -> Dict[str, Any]:
        """
        Use AI to intelligently route requests to the appropriate agent.
        
        Returns:
            Dictionary with agent name, confidence, and reason
        """
        try:
            from .prompt_templates import agent_router_prompt
            
            prompt = agent_router_prompt.get_router_prompt(user_request)
            response = self.client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt
            )
            
            # Parse the JSON response
            response_text = response.text.strip()
            # Handle markdown code blocks if present
            if '```' in response_text:
                blocks = text_processor.extract_code_blocks(response_text)
                if blocks:
                    response_text = blocks[0].get('code', '{}')
            
            try:
                result = json.loads(response_text)
                return {
                    "agent": result.get("agent", "code-generation"),
                    "confidence": result.get("confidence", 0.5),
                    "reason": result.get("reason", "Default routing")
                }
            except json.JSONDecodeError:
                # Fallback to keyword matching if JSON parsing fails
                return self._fallback_routing(user_request)
                
        except Exception as e:
            logger.error(f"Error in agent routing: {e}")
            return self._fallback_routing(user_request)
    
    def _fallback_routing(self, request: str) -> Dict[str, Any]:
        """Fallback keyword-based routing if AI routing fails."""
        request_lower = request.lower()
        
        if any(kw in request_lower for kw in ['plot', 'chart', 'graph', 'visualiz', 'histogram', 'scatter', 'bar']):
            return {"agent": "visualization", "confidence": 0.7, "reason": "Keywords suggest visualization"}
        elif any(kw in request_lower for kw in ['predict', 'forecast', 'future', 'estimate']):
            return {"agent": "prediction", "confidence": 0.8, "reason": "Keywords suggest prediction"}
        elif any(kw in request_lower for kw in ['insight', 'pattern', 'trend', 'summary', 'overview']):
            return {"agent": "insights", "confidence": 0.7, "reason": "Keywords suggest insights"}
        else:
            return {"agent": "code-generation", "confidence": 0.5, "reason": "Default routing"}
    
    def clear_chat_session(self, session_id: str):
        """Clear the chat history for a session."""
        if session_id in self.chat_sessions:
            del self.chat_sessions[session_id]
    
    def get_chat_history(self, session_id: str) -> List[Dict[str, str]]:
        """Get the chat history for a session."""
        if session_id not in self.chat_sessions:
            return []
        return self.chat_sessions.get(session_id, [])


# Global instance - lazy initialization
_gemini_client = None

def get_gemini_client() -> GeminiClient:
    """Get the global Gemini client instance."""
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = GeminiClient()
    return _gemini_client

# For backward compatibility
gemini_client = GeminiClient()
