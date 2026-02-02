"""
Base Agent class for the Data Science Platform.
"""

import logging
from typing import Optional
from .config import settings
from .file_handler import get_dataframe
from .shared_utils import data_context_builder
from .gemini_client import get_gemini_client

logger = logging.getLogger(__name__)

class BaseAgent:
    """Base class for all specialized agents."""
    
    def __init__(self, name: str, role: str, goal: str, backstory: str):
        self.name = name
        self.role = role
        self.goal = goal
        self.backstory = backstory
    
    def get_data_context(self, session_id: str, file_id: Optional[str] = None) -> str:
        """Get context about the available data for the session."""
        try:
            df = get_dataframe(session_id, file_id)
            return data_context_builder.build_context(df, max_rows=5, include_stats=True)
        except Exception as e:
            logger.error(f"Error getting data context: {e}")
            return f"Error accessing data: {str(e)}"
    
    def _get_client(self):
        """Get the Gemini client instance."""
        return get_gemini_client()
