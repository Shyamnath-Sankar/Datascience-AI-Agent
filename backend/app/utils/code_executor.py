import subprocess
import sys
import os
import tempfile
import pandas as pd
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
import io
import base64
from typing import Dict, Any, List, Optional
from .file_handler import get_dataframe
import traceback

class CodeExecutor:
    def __init__(self):
        self.execution_environment = {
            'pd': pd,
            'pandas': pd,
            'plt': plt,
            'matplotlib': matplotlib,
            'np': None,  # Will be imported if needed
            'numpy': None,
            'sns': None,  # Will be imported if needed
            'seaborn': None,
        }
        # Configure matplotlib for better plot handling
        plt.ioff()  # Turn off interactive mode
    
    def install_package(self, package_name: str) -> Dict[str, Any]:
        """Install a Python package using pip."""
        try:
            result = subprocess.run(
                [sys.executable, "-m", "pip", "install", package_name],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode == 0:
                return {
                    "success": True,
                    "message": f"Successfully installed {package_name}",
                    "output": result.stdout
                }
            else:
                return {
                    "success": False,
                    "message": f"Failed to install {package_name}",
                    "error": result.stderr
                }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "message": f"Installation of {package_name} timed out",
                "error": "Installation timeout"
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Error installing {package_name}",
                "error": str(e)
            }
    
    def setup_environment(self, session_id: str, file_id: Optional[str] = None):
        """Setup the execution environment with the dataset."""
        try:
            # Import commonly used libraries
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
            
            # Load the dataset
            df = get_dataframe(session_id, file_id)
            if df is not None:
                self.execution_environment['df'] = df
            
            return True
        except Exception as e:
            print(f"Error setting up environment: {e}")
            return False
    
    def execute_code(self, code: str, session_id: str, file_id: Optional[str] = None) -> Dict[str, Any]:
        """Execute Python code and return results."""
        try:
            # Setup environment
            self.setup_environment(session_id, file_id)
            
            # Capture stdout and stderr
            old_stdout = sys.stdout
            old_stderr = sys.stderr
            stdout_capture = io.StringIO()
            stderr_capture = io.StringIO()
            
            # Clear any existing plots
            plt.clf()
            plt.close('all')
            
            try:
                sys.stdout = stdout_capture
                sys.stderr = stderr_capture
                
                # Execute the code
                exec(code, self.execution_environment)
                
                # Capture any plots
                plots = self._capture_plots()
                
                output = stdout_capture.getvalue()
                error_output = stderr_capture.getvalue()
                
                return {
                    "success": True,
                    "output": output,
                    "error": error_output if error_output else None,
                    "plots": plots,
                    "variables": self._get_variable_info()
                }
                
            finally:
                sys.stdout = old_stdout
                sys.stderr = old_stderr
                
        except Exception as e:
            return {
                "success": False,
                "output": "",
                "error": f"Execution error: {str(e)}\n{traceback.format_exc()}",
                "plots": [],
                "variables": {}
            }
    
    def _capture_plots(self) -> List[str]:
        """Capture matplotlib plots as base64 encoded images."""
        plots = []
        
        # Get all figure numbers
        fig_nums = plt.get_fignums()
        
        for fig_num in fig_nums:
            try:
                fig = plt.figure(fig_num)
                
                # Save plot to bytes
                img_buffer = io.BytesIO()
                fig.savefig(img_buffer, format='png', bbox_inches='tight', dpi=150)
                img_buffer.seek(0)
                
                # Encode as base64
                img_base64 = base64.b64encode(img_buffer.getvalue()).decode('utf-8')
                plots.append(f"data:image/png;base64,{img_base64}")
                
                img_buffer.close()
                
            except Exception as e:
                print(f"Error capturing plot {fig_num}: {e}")
        
        # Clear all figures
        plt.close('all')
        
        return plots
    
    def _get_variable_info(self) -> Dict[str, Any]:
        """Get information about variables in the execution environment."""
        variables = {}
        
        for name, value in self.execution_environment.items():
            if not name.startswith('_') and name not in ['pd', 'pandas', 'plt', 'matplotlib', 'np', 'numpy', 'sns', 'seaborn']:
                try:
                    if isinstance(value, pd.DataFrame):
                        variables[name] = {
                            "type": "DataFrame",
                            "shape": value.shape,
                            "columns": value.columns.tolist()
                        }
                    elif isinstance(value, pd.Series):
                        variables[name] = {
                            "type": "Series",
                            "length": len(value),
                            "dtype": str(value.dtype)
                        }
                    elif hasattr(value, '__len__') and not isinstance(value, str):
                        variables[name] = {
                            "type": type(value).__name__,
                            "length": len(value)
                        }
                    else:
                        variables[name] = {
                            "type": type(value).__name__,
                            "value": str(value)[:100]  # Truncate long values
                        }
                except Exception:
                    variables[name] = {
                        "type": type(value).__name__,
                        "value": "Unable to display"
                    }
        
        return variables
    
    def check_required_packages(self, code: str) -> List[str]:
        """Check what packages might be needed for the code."""
        required_packages = []
        
        # Common package imports and their pip names
        package_mapping = {
            'sklearn': 'scikit-learn',
            'cv2': 'opencv-python',
            'PIL': 'Pillow',
            'plotly': 'plotly',
            'bokeh': 'bokeh',
            'altair': 'altair',
            'streamlit': 'streamlit',
            'dash': 'dash',
            'xgboost': 'xgboost',
            'lightgbm': 'lightgbm',
            'tensorflow': 'tensorflow',
            'torch': 'torch',
            'transformers': 'transformers',
        }
        
        for package, pip_name in package_mapping.items():
            if f'import {package}' in code or f'from {package}' in code:
                required_packages.append(pip_name)
        
        return required_packages

# Global instance
code_executor = CodeExecutor()
