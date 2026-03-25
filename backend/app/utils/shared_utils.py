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
        # Process execution
        r'\bos\.system\b',
        r'\bsubprocess\.',
        r'\beval\s*\(',
        r'\bexec\s*\(',
        r'__import__\s*\(',
        r'\bcompile\s*\([^)]*["\']exec["\']',
        # File system destructive ops
        r'\bopen\s*\([^)]*["\']w["\']',
        r'\bopen\s*\([^)]*["\']a["\']',
        r'\brmtree\b',
        r'\bremove\b',
        r'\bunlink\b',
        r'\brm\s+-',
        r'\bdel\s+\/',
        r'\bshutil\.(rmtree|move|copy)',
        r'\bos\.(remove|unlink|rmdir|makedirs|rename)',
        # Network access
        r'import\s+socket\b',
        r'from\s+socket\b',
        r'import\s+requests\b',
        r'from\s+requests\b',
        r'urllib\.request',
        r'httplib',
        r'import\s+http\.',
        r'from\s+http\.',
        r'import\s+urllib\b',
        r'from\s+urllib\b',
        r'import\s+aiohttp\b',
        r'from\s+aiohttp\b',
        # Dangerous builtins
        r'\bglobals\s*\(\s*\)',
        r'\blocals\s*\(\s*\)',
        r'\b__builtins__\b',
        r'\b__class__\b',
        r'\b__subclasses__\b',
        r'\bgetattr\s*\(\s*__',
        # System info / env
        r'\bos\.environ\b',
        r'\bos\.getenv\b',
        r'\bos\.path\.expanduser\b',
        r'\bsys\.exit\b',
        r'\bexit\s*\(',
        r'\bquit\s*\(',
    ]
    
    # Modules that are completely blocked from import
    BLOCKED_MODULES = [
        'socket', 'http', 'urllib', 'requests', 'aiohttp', 'httpx',
        'subprocess', 'shutil', 'tempfile', 'ctypes', 'multiprocessing',
        'signal', 'pty', 'fcntl', 'resource', 'grp', 'pwd',
        'webbrowser', 'antigravity', 'turtle', 'tkinter',
        'smtplib', 'imaplib', 'poplib', 'ftplib', 'telnetlib',
        'xmlrpc', 'pickle', 'shelve', 'marshal',
    ]
    
    # Safe imports that should always be available
    SAFE_IMPORTS = [
        'pandas', 'numpy', 'matplotlib', 'seaborn', 'sklearn',
        'scipy', 'statsmodels', 'plotly', 'math', 'statistics',
        'datetime', 'collections', 'itertools', 'functools',
        'json', 'csv', 're', 'string', 'textwrap',
        'warnings', 'copy', 'operator', 'decimal', 'fractions',
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
        # Check blocked patterns
        for pattern in cls.BLOCKED_PATTERNS:
            if re.search(pattern, code, re.IGNORECASE):
                return False, f"Blocked pattern detected: {pattern}"
        
        # Check blocked module imports
        import_pattern = r'(?:import|from)\s+([\w.]+)'
        for match in re.finditer(import_pattern, code):
            module = match.group(1).split('.')[0]
            if module in cls.BLOCKED_MODULES:
                return False, f"Blocked module: {module}"
        
        # Check for excessive code length (potential DoS)
        if len(code) > 50000:
            return False, "Code exceeds maximum length (50,000 characters)"
        
        # Check for infinite loop patterns (basic heuristic)
        if re.search(r'while\s+True\s*:', code) and 'break' not in code:
            return False, "Potential infinite loop detected (while True without break)"
        
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
        code = re.sub(r"pd\.read_json\(['\"][^'\"]*['\"]", "df  # Using pre-loaded data", code)
        code = re.sub(r"pd\.read_parquet\(['\"][^'\"]*['\"]", "df  # Using pre-loaded data", code)
        
        # Remove attempts to save files
        code = re.sub(r"\.to_csv\(['\"][^'\"]*['\"]", ".to_string()", code)
        code = re.sub(r"\.to_excel\(['\"][^'\"]*['\"]", ".to_string()", code)
        code = re.sub(r"plt\.savefig\([^)]*\)", "plt.show()", code)
        
        return code


# Export commonly used instances
text_processor = TextProcessor()
data_context_builder = DataContextBuilder()
response_formatter = ResponseFormatter()
code_validator = CodeValidator()
