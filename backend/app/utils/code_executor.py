"""
Secure Python Code Executor for the Data Science Platform.
Executes user-generated Python code with proper sandboxing, timeouts, and security controls.
"""

import subprocess
import sys
import os
import io
import base64
import signal
import threading
import traceback
from typing import Dict, Any, List, Optional
from contextlib import contextmanager
import logging

import pandas as pd
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt

from .file_handler import get_dataframe
from .config import settings
from .shared_utils import code_validator

# Configure logging
logger = logging.getLogger(__name__)


class ExecutionError(Exception):
    """Custom exception for code execution errors."""
    pass


class TimeoutError(Exception):
    """Custom exception for execution timeouts."""
    pass


class CodeExecutor:
    """
    Production-grade code executor with security controls.
    
    Features:
    - Execution timeout limits
    - Output size limits
    - Security validation (blocked patterns)
    - Reliable plot capture
    - State management between executions
    """
    
    def __init__(self):
        self.execution_environment: Dict[str, Any] = {}
        self._setup_base_environment()
        
        # Configuration
        self.timeout = settings.code_execution_timeout
        self.max_output_size = settings.max_output_size
        self.max_plot_count = settings.max_plot_count
        
        # Configure matplotlib for better plot handling
        plt.ioff()
    
    def _setup_base_environment(self):
        """Setup the base execution environment with safe imports."""
        self.execution_environment = {
            'pd': pd,
            'pandas': pd,
            'plt': plt,
            'matplotlib': matplotlib,
        }
        
        # Try to import common libraries
        try:
            import numpy as np
            self.execution_environment['np'] = np
            self.execution_environment['numpy'] = np
        except ImportError:
            pass
        
        try:
            import seaborn as sns
            self.execution_environment['sns'] = sns
            self.execution_environment['seaborn'] = sns
        except ImportError:
            pass
        
        try:
            import scipy
            from scipy import stats
            self.execution_environment['scipy'] = scipy
            self.execution_environment['stats'] = stats
        except ImportError:
            pass
        
        try:
            from sklearn.linear_model import LinearRegression
            from sklearn.preprocessing import PolynomialFeatures
            self.execution_environment['LinearRegression'] = LinearRegression
            self.execution_environment['PolynomialFeatures'] = PolynomialFeatures
        except ImportError:
            pass
    
    def install_package(self, package_name: str) -> Dict[str, Any]:
        """
        Install a Python package using pip.
        
        Args:
            package_name: Name of the package to install
            
        Returns:
            Dictionary with success status and message
        """
        # Validate package name (basic security check)
        if not package_name.replace('-', '').replace('_', '').isalnum():
            return {
                "success": False,
                "message": f"Invalid package name: {package_name}",
                "error": "Package name contains invalid characters"
            }
        
        try:
            result = subprocess.run(
                [sys.executable, "-m", "pip", "install", package_name],
                capture_output=True,
                text=True,
                timeout=120  # 2 minute timeout for installations
            )
            
            if result.returncode == 0:
                return {
                    "success": True,
                    "message": f"Successfully installed {package_name}",
                    "output": result.stdout[-500:] if len(result.stdout) > 500 else result.stdout
                }
            else:
                return {
                    "success": False,
                    "message": f"Failed to install {package_name}",
                    "error": result.stderr[-500:] if len(result.stderr) > 500 else result.stderr
                }
                
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "message": f"Installation of {package_name} timed out",
                "error": "Installation took too long"
            }
        except Exception as e:
            logger.error(f"Error installing package {package_name}: {e}")
            return {
                "success": False,
                "message": f"Error installing {package_name}",
                "error": str(e)
            }
    
    def setup_environment(self, session_id: str, file_id: Optional[str] = None) -> bool:
        """
        Setup the execution environment with the dataset.
        
        Args:
            session_id: The session ID
            file_id: Optional specific file ID
            
        Returns:
            True if setup successful, False otherwise
        """
        try:
            # Reset to base environment
            self._setup_base_environment()
            
            # Load the dataset
            df = get_dataframe(session_id, file_id)
            if df is not None:
                self.execution_environment['df'] = df
                logger.info(f"Loaded DataFrame with shape {df.shape}")
            else:
                logger.warning("No DataFrame available for session")
            
            return True
            
        except Exception as e:
            logger.error(f"Error setting up environment: {e}")
            return False
    
    def execute_code(
        self, 
        code: str, 
        session_id: str, 
        file_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Execute Python code with security controls and capture results.
        
        Args:
            code: The Python code to execute
            session_id: The session ID for data access
            file_id: Optional specific file ID
            
        Returns:
            Dictionary with success, output, error, plots, and variables
        """
        # Validate code security
        is_valid, error_message = code_validator.validate(code)
        if not is_valid:
            return {
                "success": False,
                "output": "",
                "error": f"Security violation: {error_message}",
                "plots": [],
                "variables": {}
            }
        
        # Sanitize the code
        code = code_validator.sanitize_code(code)
        
        # Setup environment
        self.setup_environment(session_id, file_id)
        
        # Prepare for output capture
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()
        
        # Clear any existing plots
        plt.clf()
        plt.close('all')
        
        result = {
            "success": False,
            "output": "",
            "error": None,
            "plots": [],
            "variables": {}
        }
        
        try:
            sys.stdout = stdout_capture
            sys.stderr = stderr_capture
            
            # Execute with timeout using threading
            execution_complete = threading.Event()
            execution_error = [None]
            
            def execute():
                try:
                    exec(code, self.execution_environment)
                except Exception as e:
                    execution_error[0] = e
                finally:
                    execution_complete.set()
            
            thread = threading.Thread(target=execute)
            thread.start()
            thread.join(timeout=self.timeout)
            
            if not execution_complete.is_set():
                result["error"] = f"Execution timed out after {self.timeout} seconds"
                return result
            
            if execution_error[0]:
                raise execution_error[0]
            
            # Capture output
            output = stdout_capture.getvalue()
            error_output = stderr_capture.getvalue()
            
            # Truncate if too large
            if len(output) > self.max_output_size:
                output = output[:self.max_output_size] + f"\n... (output truncated, showing first {self.max_output_size} characters)"
            
            # Capture plots
            plots = self._capture_plots()
            
            # Get variable info
            variables = self._get_variable_info()
            
            result = {
                "success": True,
                "output": output,
                "error": error_output if error_output else None,
                "plots": plots,
                "variables": variables
            }
            
        except Exception as e:
            tb = traceback.format_exc()
            # Simplify error message for users
            error_msg = self._format_error(str(e), tb)
            result = {
                "success": False,
                "output": stdout_capture.getvalue()[:1000],
                "error": error_msg,
                "plots": self._capture_plots(),  # Capture any plots generated before error
                "variables": {}
            }
            
        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr
        
        return result
    
    def _capture_plots(self) -> List[str]:
        """
        Capture all matplotlib figures as base64 encoded images.
        
        Returns:
            List of base64-encoded image strings
        """
        plots = []
        fig_nums = plt.get_fignums()
        
        if len(fig_nums) > self.max_plot_count:
            logger.warning(f"Too many plots ({len(fig_nums)}), limiting to {self.max_plot_count}")
            fig_nums = fig_nums[:self.max_plot_count]
        
        for fig_num in fig_nums:
            try:
                fig = plt.figure(fig_num)
                
                # Ensure the figure is properly rendered
                fig.canvas.draw()
                
                # Save plot to bytes with high quality
                img_buffer = io.BytesIO()
                fig.savefig(
                    img_buffer, 
                    format='png', 
                    bbox_inches='tight', 
                    dpi=150,
                    facecolor='white',
                    edgecolor='none'
                )
                img_buffer.seek(0)
                
                # Encode as base64
                img_base64 = base64.b64encode(img_buffer.getvalue()).decode('utf-8')
                plots.append(f"data:image/png;base64,{img_base64}")
                
                img_buffer.close()
                
            except Exception as e:
                logger.error(f"Error capturing plot {fig_num}: {e}")
        
        # Clear all figures
        plt.close('all')
        
        return plots
    
    def _get_variable_info(self) -> Dict[str, Any]:
        """
        Get information about variables in the execution environment.
        
        Returns:
            Dictionary with variable names and their metadata
        """
        variables = {}
        
        # Items to skip
        skip_items = {
            'pd', 'pandas', 'plt', 'matplotlib', 'np', 'numpy', 
            'sns', 'seaborn', 'scipy', 'df', '__builtins__'
        }
        
        for name, value in self.execution_environment.items():
            if name.startswith('_') or name in skip_items:
                continue
            
            try:
                if isinstance(value, pd.DataFrame):
                    variables[name] = {
                        "type": "DataFrame",
                        "shape": list(value.shape),
                        "columns": value.columns.tolist()[:10],  # Limit columns shown
                        "memory": f"{value.memory_usage(deep=True).sum() / 1024:.1f} KB"
                    }
                elif isinstance(value, pd.Series):
                    variables[name] = {
                        "type": "Series",
                        "length": len(value),
                        "dtype": str(value.dtype),
                        "name": value.name
                    }
                elif hasattr(value, '__len__') and not isinstance(value, (str, dict)):
                    variables[name] = {
                        "type": type(value).__name__,
                        "length": len(value)
                    }
                elif isinstance(value, (int, float, bool)):
                    variables[name] = {
                        "type": type(value).__name__,
                        "value": str(value)
                    }
                elif isinstance(value, str):
                    variables[name] = {
                        "type": "str",
                        "length": len(value),
                        "value": value[:100] + "..." if len(value) > 100 else value
                    }
                else:
                    variables[name] = {
                        "type": type(value).__name__
                    }
                    
            except Exception:
                variables[name] = {
                    "type": type(value).__name__,
                    "value": "Unable to display"
                }
        
        return variables
    
    def _format_error(self, error: str, traceback_str: str) -> str:
        """
        Format error message to be more user-friendly.
        
        Args:
            error: The error message
            traceback_str: The full traceback
            
        Returns:
            Formatted error message
        """
        # Extract the most relevant part of the error
        lines = traceback_str.strip().split('\n')
        
        # Find the actual error line
        error_line = lines[-1] if lines else error
        
        # Try to find relevant code context
        relevant_lines = []
        for line in lines:
            if 'File "<string>"' in line or 'line' in line.lower():
                relevant_lines.append(line.strip())
        
        if relevant_lines:
            context = '\n'.join(relevant_lines[-3:])
            return f"{error_line}\n\nContext:\n{context}"
        
        return error_line
    
    def check_required_packages(self, code: str) -> List[str]:
        """
        Check what packages might be needed for the code.
        
        Args:
            code: The Python code to analyze
            
        Returns:
            List of package names that may need to be installed
        """
        package_mapping = {
            'sklearn': 'scikit-learn',
            'cv2': 'opencv-python',
            'PIL': 'Pillow',
            'plotly': 'plotly',
            'bokeh': 'bokeh',
            'altair': 'altair',
            'xgboost': 'xgboost',
            'lightgbm': 'lightgbm',
            'tensorflow': 'tensorflow',
            'torch': 'torch',
            'transformers': 'transformers',
            'statsmodels': 'statsmodels',
        }
        
        required_packages = []
        
        for package, pip_name in package_mapping.items():
            if f'import {package}' in code or f'from {package}' in code:
                # Check if already installed
                try:
                    __import__(package)
                except ImportError:
                    required_packages.append(pip_name)
        
        return required_packages


# Global instance
code_executor = CodeExecutor()
