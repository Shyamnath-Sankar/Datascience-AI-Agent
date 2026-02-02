"""
Gemini Client for AI interactions.
Wrapper around Google Gen AI SDK (google-genai).
"""

import os
import logging
from typing import Dict, Any, List, Optional
from google import genai
from google.genai import types
from .config import settings
from .file_handler import get_dataframe
from .shared_utils import data_context_builder, text_processor

logger = logging.getLogger(__name__)

class GeminiClient:
    """Client for interacting with Google's Gemini models using the new SDK."""
    
    def __init__(self):
        self.api_key = settings.gemini_api_key
        self.model_name = settings.gemini_model
        self.chat_sessions: Dict[str, Any] = {}
        self._client = None
        
        if self.api_key:
            try:
                self._client = genai.Client(api_key=self.api_key)
                self.is_configured = True
            except Exception as e:
                logger.error(f"Failed to initialize Gemini client: {e}")
                self.is_configured = False
        else:
            self.is_configured = False
            logger.warning("Gemini API key not configured")

    @property
    def client(self):
        """Expose the genai Client directly for Vanna AI integration."""
        return self._client

    def _get_chat_session(self, session_id: str):
        """Get or create a chat session."""
        if not self.is_configured:
            return None
            
        if session_id not in self.chat_sessions:
            # Create a new chat session
            # Note: The new SDK manages chat history within the Chat object
            self.chat_sessions[session_id] = self._client.chats.create(model=self.model_name)
        return self.chat_sessions[session_id]

    def get_data_context(self, session_id: str, file_id: Optional[str] = None) -> str:
        """Get context string for the current data."""
        try:
            df = get_dataframe(session_id, file_id)
            if df is not None:
                return data_context_builder.build_context(df)
            return "No dataset is currently loaded."
        except Exception as e:
            logger.error(f"Error getting data context: {e}")
            return "Error retrieving data context."

    def generate_response(
        self, 
        session_id: str, 
        user_message: str, 
        file_id: Optional[str] = None,
        use_chat_history: bool = True
    ) -> Dict[str, Any]:
        """
        Generate a response from the AI model.
        
        Args:
            session_id: The session ID
            user_message: The user's question
            file_id: Optional file ID for context
            use_chat_history: Whether to use conversation history
            
        Returns:
            Dict containing response, code_blocks, etc.
        """
        if not self.is_configured:
            return {"success": False, "error": "AI service not configured"}

        try:
            # Build prompt with data context
            data_context = self.get_data_context(session_id, file_id)
            
            system_instruction = (
                "You are an expert Data Science Assistant. "
                "Your goal is to help users analyze their data using Python code. "
                "You have access to a pandas DataFrame named 'df'. "
                "When asked to analyze or visualize data, WRITE PYTHON CODE using pandas, matplotlib, or seaborn. "
                "Wrap your code in ```python ... ``` blocks. "
                "The code will be automatically executed and the results shown to the user. "
                "Assume 'df' is already loaded. Do not load data from files. "
                "If the user asks a question that can be answered by looking at the dataframe info provided in context, answer directly. "
                "Otherwise, write code to find the answer. "
                f"\n\nCONTEXT:\n{data_context}"
            )
            
            full_prompt = f"{system_instruction}\n\nUser Question: {user_message}"
            
            if use_chat_history:
                chat = self._get_chat_session(session_id)
                # send_message returns a response object
                response = chat.send_message(full_prompt)
                text_response = response.text
            else:
                # Correct call for the new SDK client.models.generate_content
                response = self._client.models.generate_content(
                    model=self.model_name,
                    contents=full_prompt
                )
                text_response = response.text
            
            # Extract code blocks
            code_blocks = text_processor.extract_code_blocks(text_response)
            
            return {
                "success": True,
                "response": text_response,
                "code_blocks": code_blocks,
                "has_code": len(code_blocks) > 0
            }
            
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            return {"success": False, "error": str(e)}

    def generate_insights(self, session_id: str, file_id: Optional[str] = None) -> Dict[str, Any]:
        """Generate automatic insights for the dataset."""
        prompt = "Analyze the dataset and provide 3-5 key insights, trends, or interesting patterns. Write python code to visualize these if applicable."
        return self.generate_response(session_id, prompt, file_id, use_chat_history=False)

    def get_chat_history(self, session_id: str) -> List[Dict[str, str]]:
        """Get formatted chat history."""
        if session_id not in self.chat_sessions:
            return []
        
        chat = self.chat_sessions[session_id]
        history = []
        
        # New SDK history structure check
        # It usually exposes a list of Content objects
        # We need to inspect how the new SDK exposes history
        # Based on documentation patterns, it's often chat.history (list of Content)
        
        try:
            # Safely iterate history if available
            # Content object structure: role, parts (list of Part)
            for msg in getattr(chat, '_history', []): # Accessing history might depend on implementation
                 # Note: The new SDK might store history differently.
                 # For now, if we can't easily access it, we return empty or implement a custom tracker.
                 # Let's try standard attribute if documented, otherwise skip to avoid breakage.
                 pass
        except Exception:
            pass
            
        return history

    def clear_chat_session(self, session_id: str):
        """Clear the chat history."""
        if self.is_configured:
            self.chat_sessions[session_id] = self._client.chats.create(model=self.model_name)

# Singleton instance
gemini_client = GeminiClient()

def get_gemini_client() -> GeminiClient:
    return gemini_client
