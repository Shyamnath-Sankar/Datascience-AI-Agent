"""
Configuration module for the Data Science Platform.
Handles environment variables and application settings.
"""

import os
from typing import Optional
from functools import lru_cache
import logging

# Try to load dotenv, but don't fail if not installed
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

logger = logging.getLogger(__name__)


class Settings:
    """Application settings loaded from environment variables."""
    
    def __init__(self):
        # API Keys
        self.gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
        
        # Server Configuration
        self.host: str = os.getenv("HOST", "0.0.0.0")
        self.port: int = int(os.getenv("PORT", "8000"))
        
        # Code Execution Settings
        self.code_execution_timeout: int = int(os.getenv("CODE_EXECUTION_TIMEOUT", "30"))
        self.max_output_size: int = int(os.getenv("MAX_OUTPUT_SIZE", "100000"))
        self.max_plot_count: int = int(os.getenv("MAX_PLOT_COUNT", "10"))
        
        # Session Settings
        self.session_expiry_hours: int = int(os.getenv("SESSION_EXPIRY_HOURS", "24"))
        self.max_sessions: int = int(os.getenv("MAX_SESSIONS", "100"))
        
        # Data Settings
        self.max_file_size_mb: int = int(os.getenv("MAX_FILE_SIZE_MB", "50"))
        self.max_dataframe_rows: int = int(os.getenv("MAX_DATAFRAME_ROWS", "100000"))
        
        # Model Settings
        self.gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        
        # Validate critical settings
        self._validate()
    
    def _validate(self):
        """Validate that all required settings are present."""
        if not self.gemini_api_key:
            logger.warning(
                "GEMINI_API_KEY not set! Set it via environment variable or .env file. "
                "AI features will not work without it."
            )
    
    @property
    def is_configured(self) -> bool:
        """Check if the application is properly configured."""
        return bool(self.gemini_api_key)
    
    def get_gemini_key(self) -> str:
        """Get the Gemini API key with validation."""
        if not self.gemini_api_key:
            raise ValueError(
                "GEMINI_API_KEY is not configured. Please set it in your environment "
                "variables or .env file."
            )
        return self.gemini_api_key


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Convenience function for getting settings
settings = get_settings()
