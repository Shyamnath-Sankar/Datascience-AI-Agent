"""
Shared utilities for text processing, code extraction, and common operations.
These utilities are used across multiple agents and modules.
"""

import re
from typing import Dict, List, Any, Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TextProcessor:
    """Handles text processing operations like code block extraction and cleaning."""
    
    @staticmethod
    def extract_code_blocks(text: str) -> List[Dict[str, str]]:
        """
        Extract code blocks from markdown-formatted text.
        
        Args:
            text: The text containing markdown code blocks
            
        Returns:
            List of dictionaries with 'language' and 'code' keys
        """
        code_blocks = []
        lines = text.split('\n')
        in_code_block = False
        current_code = []
        current_language = ""
        
        for line in lines:
            if line.strip().startswith('```'):
                if in_code_block:
                    # End of code block
                    code_blocks.append({
                        "language": current_language or "python",
                        "code": '\n'.join(current_code)
                    })
                    current_code = []
                    in_code_block = False
                else:
                    # Start of code block
                    current_language = line.strip()[3:].strip() or "python"
                    in_code_block = True
            elif in_code_block:
                current_code.append(line)
        
        return code_blocks
    
    @staticmethod
    def clean_response_text(text: str) -> str:
        """
        Remove code blocks from response text to keep only explanations.
        
        Args:
            text: The text containing markdown code blocks
            
        Returns:
            Cleaned text without code blocks
        """
        lines = text.split('\n')
        cleaned_lines = []
        in_code_block = False
        
        for line in lines:
            if line.strip().startswith('```'):
                in_code_block = not in_code_block
                continue
            elif not in_code_block:
                cleaned_lines.append(line)
        
        # Clean up extra whitespace
        cleaned_text = '\n'.join(cleaned_lines).strip()
        # Remove multiple consecutive newlines
        cleaned_text = re.sub(r'\n\s*\n\s*\n', '\n\n', cleaned_text)
        
        return cleaned_text
    
    @staticmethod
    def extract_python_blocks(code_blocks: List[Dict[str, str]]) -> List[Dict[str, str]]:
        """Extract only Python code blocks."""
        return [block for block in code_blocks if block['language'].lower() == 'python']


class DataContextBuilder:
    """Builds context strings from dataframes for AI prompts."""
    
    @staticmethod
    def build_context(df, max_rows: int = 5, include_stats: bool = True) -> str:
        """
        Build a comprehensive context string from a DataFrame.
        
        Args:
            df: Pandas DataFrame
            max_rows: Maximum number of sample rows to include
            include_stats: Whether to include statistical summary
            
        Returns:
            Formatted context string
        """
        if df is None:
            return "No data available in the current session."
        
        try:
            context_parts = [
                "## Available Dataset Information",
                f"- **Shape**: {df.shape[0]:,} rows × {df.shape[1]} columns",
                f"- **Columns**: {', '.join(df.columns.tolist())}",
                "",
                "### Data Types",
            ]
            
            # Add data types
            for col, dtype in df.dtypes.items():
                context_parts.append(f"- `{col}`: {dtype}")
            
            # Add missing values info
            missing = df.isnull().sum()
            if missing.sum() > 0:
                context_parts.append("")
                context_parts.append("### Missing Values")
                for col, count in missing.items():
                    if count > 0:
                        pct = (count / len(df)) * 100
                        context_parts.append(f"- `{col}`: {count:,} ({pct:.1f}%)")
            
            # Add sample data
            context_parts.append("")
            context_parts.append(f"### Sample Data (first {min(max_rows, len(df))} rows)")
            context_parts.append("```")
            context_parts.append(df.head(max_rows).to_string())
            context_parts.append("```")
            
            # Add statistical summary for numeric columns
            if include_stats:
                numeric_cols = df.select_dtypes(include=['number']).columns
                if len(numeric_cols) > 0:
                    context_parts.append("")
                    context_parts.append("### Statistical Summary")
                    context_parts.append("```")
                    context_parts.append(df[numeric_cols].describe().to_string())
                    context_parts.append("```")
            
            return '\n'.join(context_parts)
            
        except Exception as e:
            logger.error(f"Error building data context: {e}")
            return f"Error accessing data: {str(e)}"


class ResponseFormatter:
    """Formats responses for consistent API output."""
    
    @staticmethod
    def success_response(data: Dict[str, Any], message: str = None) -> Dict[str, Any]:
        """Create a standardized success response."""
        response = {
            "success": True,
            **data
        }
        if message:
            response["message"] = message
        return response
    
    @staticmethod
    def error_response(error: str, code: str = None, details: Dict = None) -> Dict[str, Any]:
        """Create a standardized error response."""
        response = {
            "success": False,
            "error": error
        }
        if code:
            response["error_code"] = code
        if details:
            response["details"] = details
        return response


class CodeValidator:
    """Validates code before execution for security and correctness."""
    
    # Patterns that are blocked for security
    BLOCKED_PATTERNS = [
        r'\bos\.system\b',
        r'\bsubprocess\.',
        r'\beval\s*\(',
        r'\bexec\s*\(',
        r'__import__\s*\(',
        r'\bopen\s*\([^)]*["\']w["\']',  # Writing to files
        r'\brmtree\b',
        r'\bremove\b',
        r'\bunlink\b',
        r'\brm\s+-',
        r'\bdel\s+\/',
        r'import\s+socket\b',
        r'from\s+socket\b',
        r'import\s+requests\b',  # Block network requests for security
        r'from\s+requests\b',
        r'urllib\.request',
        r'httplib',
    ]
    
    # Safe imports that should always be available
    SAFE_IMPORTS = [
        'pandas', 'numpy', 'matplotlib', 'seaborn', 'sklearn',
        'scipy', 'statsmodels', 'plotly', 'math', 'statistics',
        'datetime', 'collections', 'itertools', 'functools',
        'json', 'csv', 're', 'string'
    ]
    
    @classmethod
    def validate(cls, code: str) -> tuple[bool, str]:
        """
        Validate code for security issues.
        
        Args:
            code: The Python code to validate
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        for pattern in cls.BLOCKED_PATTERNS:
            if re.search(pattern, code, re.IGNORECASE):
                return False, f"Blocked pattern detected: {pattern}"
        
        return True, ""
    
    @classmethod
    def sanitize_code(cls, code: str) -> str:
        """
        Sanitize code by removing potentially dangerous operations.
        Returns the sanitized code.
        """
        # Remove any attempts to load external files
        code = re.sub(r"pd\.read_csv\(['\"][^'\"]*['\"]", "df  # Using pre-loaded data", code)
        code = re.sub(r"pd\.read_excel\(['\"][^'\"]*['\"]", "df  # Using pre-loaded data", code)
        
        return code


# Export commonly used instances
text_processor = TextProcessor()
data_context_builder = DataContextBuilder()
response_formatter = ResponseFormatter()
code_validator = CodeValidator()
