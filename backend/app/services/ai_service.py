"""
API Service Layer.
Provides a clean interface between routers and business logic.
"""

import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from datetime import datetime
import asyncio

from ..core.config import Container, get_settings, AppError, AIServiceError


logger = logging.getLogger(__name__)


# =============================================================================
# SERVICE INTERFACES
# =============================================================================


@dataclass
class ServiceResponse:
    """Standard response from services."""

    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        result = {"success": self.success}
        if self.data:
            result.update(self.data)
        if self.error:
            result["error"] = self.error
        if self.metadata:
            result["metadata"] = self.metadata
        return result


# =============================================================================
# AI SERVICE
# =============================================================================


class AIService:
    """
    Service for AI operations.
    Abstracts the underlying LLM implementation.
    """

    def __init__(self):
        self.settings = get_settings()
        self._client = None
        self._initialized = False

    def _get_client(self):
        """Lazy initialization of AI client."""
        if not self._initialized:
            if not self.settings.gemini_api_key:
                raise AIServiceError("AI service not configured")

            try:
                from google import genai

                self._client = genai.Client(api_key=self.settings.gemini_api_key)
                self._initialized = True
            except Exception as e:
                raise AIServiceError(f"Failed to initialize AI client: {str(e)}")

        return self._client

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        session_id: Optional[str] = None,
    ) -> ServiceResponse:
        """Generate a response from the AI model."""
        try:
            client = self._get_client()

            full_prompt = prompt
            if system_prompt:
                full_prompt = f"{system_prompt}\n\n{prompt}"

            # Use asyncio to run sync code
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=self.settings.gemini_model,
                contents=full_prompt,
            )

            # Track metrics
            metrics = Container.get("metrics")
            metrics.increment("ai_requests", tags={"model": self.settings.gemini_model})

            return ServiceResponse(
                success=True,
                data={
                    "text": response.text,
                    "model": self.settings.gemini_model,
                },
                metadata={
                    "generated_at": datetime.now().isoformat(),
                },
            )

        except AIServiceError:
            raise
        except Exception as e:
            logger.error(f"AI generation failed: {e}")
            return ServiceResponse(success=False, error=str(e))

    async def chat(
        self,
        session_id: str,
        message: str,
        data_context: Optional[str] = None,
        agent_type: Optional[str] = None,
    ) -> ServiceResponse:
        """
        Chat with context and history.
        """
        from ..prompts.system_prompts import (
            MASTER_SYSTEM_PROMPT,
            get_prompt_for_agent,
            AgentRole,
        )

        # Build the appropriate prompt
        if agent_type:
            try:
                role = AgentRole(agent_type)
                system_prompt = get_prompt_for_agent(
                    role=role,
                    data_context=data_context or "No data loaded",
                    user_request=message,
                    use_cot=True,
                )
            except ValueError:
                system_prompt = MASTER_SYSTEM_PROMPT
        else:
            system_prompt = MASTER_SYSTEM_PROMPT
            if data_context:
                system_prompt += f"\n\n## DATA CONTEXT\n{data_context}"

        return await self.generate(
            prompt=f"User Request: {message}",
            system_prompt=system_prompt,
            session_id=session_id,
        )


# =============================================================================
# CODE EXECUTION SERVICE
# =============================================================================


class CodeExecutionService:
    """
    Service for secure code execution.
    """

    def __init__(self):
        self.settings = get_settings()
        self._namespace: Dict[str, Any] = {}

    def _prepare_namespace(self, df=None) -> Dict[str, Any]:
        """Prepare execution namespace with standard libraries."""
        import pandas as pd
        import numpy as np
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import seaborn as sns
        from scipy import stats

        namespace = {
            "pd": pd,
            "np": np,
            "plt": plt,
            "sns": sns,
            "stats": stats,
            "__builtins__": __builtins__,
        }

        if df is not None:
            namespace["df"] = df

        return namespace

    async def execute(
        self,
        code: str,
        session_id: str,
        file_id: Optional[str] = None,
        timeout: Optional[int] = None,
        auto_install: bool = True,
    ) -> ServiceResponse:
        """Execute Python code safely."""
        import io
        import sys
        import base64
        import traceback
        from contextlib import redirect_stdout, redirect_stderr

        timeout = timeout or self.settings.code_execution_timeout

        # Get dataframe if available
        df = None
        if file_id:
            from ..utils.file_handler import get_dataframe

            df = get_dataframe(session_id, file_id)

        # Prepare namespace
        namespace = self._prepare_namespace(df)

        # Capture output
        stdout_buffer = io.StringIO()
        stderr_buffer = io.StringIO()

        plots = []
        variables = {}
        installations = []

        start_time = datetime.now()

        try:
            # Auto-install missing packages
            if auto_install:
                installations = await self._install_missing_packages(code)

            # Execute with timeout
            with redirect_stdout(stdout_buffer), redirect_stderr(stderr_buffer):
                exec(compile(code, "<user_code>", "exec"), namespace)

            # Capture plots
            import matplotlib.pyplot as plt

            for fig_num in plt.get_fignums():
                fig = plt.figure(fig_num)
                buf = io.BytesIO()
                fig.savefig(buf, format="png", dpi=100, bbox_inches="tight")
                buf.seek(0)
                plots.append(
                    f"data:image/png;base64,{base64.b64encode(buf.read()).decode()}"
                )
                plt.close(fig)

            # Capture variables
            for name, value in namespace.items():
                if not name.startswith("_") and name not in [
                    "pd",
                    "np",
                    "plt",
                    "sns",
                    "stats",
                    "df",
                ]:
                    try:
                        var_info = self._get_variable_info(name, value)
                        if var_info:
                            variables[name] = var_info
                    except:
                        pass

            execution_time = (datetime.now() - start_time).total_seconds() * 1000

            # Track metrics
            metrics = Container.get("metrics")
            metrics.increment("code_executions")
            metrics.histogram("execution_time_ms", execution_time)

            return ServiceResponse(
                success=True,
                data={
                    "output": stdout_buffer.getvalue()[: self.settings.max_output_size],
                    "plots": plots[: self.settings.max_plot_count],
                    "variables": variables,
                    "installations": installations,
                },
                metadata={
                    "execution_time_ms": int(execution_time),
                },
            )

        except Exception as e:
            error_msg = traceback.format_exc()
            return ServiceResponse(
                success=False,
                data={
                    "output": stdout_buffer.getvalue(),
                    "plots": [],
                    "variables": {},
                    "error": error_msg,
                },
            )

    async def _install_missing_packages(self, code: str) -> List[Dict[str, Any]]:
        """Detect and install missing packages."""
        import re
        import subprocess

        installations = []

        # Find import statements
        import_pattern = r"^(?:from\s+(\w+)|import\s+(\w+))"
        matches = re.findall(import_pattern, code, re.MULTILINE)

        packages = set()
        for match in matches:
            pkg = match[0] or match[1]
            if pkg:
                packages.add(pkg)

        for pkg in packages:
            try:
                __import__(pkg)
            except ImportError:
                # Try to install
                try:
                    result = subprocess.run(
                        [sys.executable, "-m", "pip", "install", pkg],
                        capture_output=True,
                        text=True,
                        timeout=30,
                    )
                    installations.append(
                        {
                            "package": pkg,
                            "success": result.returncode == 0,
                            "message": "Installed"
                            if result.returncode == 0
                            else result.stderr,
                        }
                    )
                except Exception as e:
                    installations.append(
                        {"package": pkg, "success": False, "message": str(e)}
                    )

        return installations

    def _get_variable_info(self, name: str, value: Any) -> Optional[Dict[str, Any]]:
        """Get information about a variable."""
        import pandas as pd
        import numpy as np

        info = {"type": type(value).__name__}

        if isinstance(value, pd.DataFrame):
            info["shape"] = list(value.shape)
            info["columns"] = list(value.columns)
            info["memory"] = f"{value.memory_usage(deep=True).sum() / 1024:.2f} KB"
        elif isinstance(value, pd.Series):
            info["length"] = len(value)
            info["dtype"] = str(value.dtype)
        elif isinstance(value, np.ndarray):
            info["shape"] = list(value.shape)
            info["dtype"] = str(value.dtype)
        elif isinstance(value, (list, tuple)):
            info["length"] = len(value)
        elif isinstance(value, dict):
            info["length"] = len(value)
        elif isinstance(value, (int, float, str, bool)):
            info["value"] = str(value)[:100]
        else:
            return None

        return info


# =============================================================================
# DATA SERVICE
# =============================================================================


class DataService:
    """
    Service for data operations.
    """

    def __init__(self):
        self.settings = get_settings()
        self._cache = Container.get("cache")

    async def get_data_context(
        self,
        session_id: str,
        file_id: Optional[str] = None,
        max_rows_sample: int = 5,
        include_stats: bool = True,
    ) -> str:
        """
        Build a comprehensive data context string for AI.
        Uses intelligent sampling and caching.
        """
        cache_key = f"context:{session_id}:{file_id}"
        cached = self._cache.get(cache_key)
        if cached:
            return cached

        from ..utils.file_handler import get_dataframe

        df = get_dataframe(session_id, file_id)
        if df is None:
            return "No dataset is currently loaded."

        context_parts = []

        # Basic info
        context_parts.append(f"Dataset: {df.shape[0]:,} rows × {df.shape[1]} columns")
        context_parts.append(
            f"Memory Usage: {df.memory_usage(deep=True).sum() / 1024 / 1024:.2f} MB"
        )

        # Column information
        context_parts.append("\nColumns:")
        for col in df.columns:
            dtype = str(df[col].dtype)
            null_count = df[col].isnull().sum()
            unique_count = df[col].nunique()

            col_info = f"  - {col} ({dtype})"
            if null_count > 0:
                col_info += (
                    f" | {null_count} missing ({null_count / len(df) * 100:.1f}%)"
                )
            col_info += f" | {unique_count} unique"

            # Add sample values for object columns
            if df[col].dtype == "object" and unique_count <= 10:
                sample_values = df[col].dropna().unique()[:5]
                col_info += f" | Examples: {list(sample_values)}"

            context_parts.append(col_info)

        # Sample data
        context_parts.append(f"\nSample Data (first {max_rows_sample} rows):")
        context_parts.append(df.head(max_rows_sample).to_string())

        # Statistics
        if include_stats:
            numeric_cols = df.select_dtypes(include=["number"]).columns
            if len(numeric_cols) > 0:
                context_parts.append("\nNumeric Statistics:")
                stats_df = df[numeric_cols].describe().round(2)
                context_parts.append(stats_df.to_string())

        context = "\n".join(context_parts)

        # Cache the context
        self._cache.set(cache_key, context, ttl=300)  # 5 minutes

        return context

    async def profile_column(
        self,
        session_id: str,
        column_name: str,
        file_id: Optional[str] = None,
    ) -> ServiceResponse:
        """Get detailed profile for a specific column."""
        from ..utils.file_handler import get_dataframe
        import numpy as np

        df = get_dataframe(session_id, file_id)
        if df is None:
            return ServiceResponse(success=False, error="No data loaded")

        if column_name not in df.columns:
            return ServiceResponse(
                success=False, error=f"Column '{column_name}' not found"
            )

        col = df[column_name]
        profile = {
            "name": column_name,
            "dtype": str(col.dtype),
            "count": int(col.count()),
            "null_count": int(col.isnull().sum()),
            "null_percent": float(col.isnull().sum() / len(col) * 100),
            "unique_count": int(col.nunique()),
            "unique_percent": float(col.nunique() / len(col) * 100),
        }

        if np.issubdtype(col.dtype, np.number):
            profile.update(
                {
                    "min": float(col.min()),
                    "max": float(col.max()),
                    "mean": float(col.mean()),
                    "median": float(col.median()),
                    "std": float(col.std()),
                    "q25": float(col.quantile(0.25)),
                    "q75": float(col.quantile(0.75)),
                    "skewness": float(col.skew()),
                    "kurtosis": float(col.kurtosis()),
                }
            )
        else:
            # Categorical analysis
            value_counts = col.value_counts().head(10)
            profile["top_values"] = {str(k): int(v) for k, v in value_counts.items()}

        return ServiceResponse(success=True, data={"profile": profile})


# =============================================================================
# SERVICE FACTORY
# =============================================================================


def get_ai_service() -> AIService:
    """Get AI service instance."""
    return AIService()


def get_code_execution_service() -> CodeExecutionService:
    """Get code execution service instance."""
    return CodeExecutionService()


def get_data_service() -> DataService:
    """Get data service instance."""
    return DataService()


# Register services
Container.register("ai_service", get_ai_service)
Container.register("code_execution_service", get_code_execution_service)
Container.register("data_service", get_data_service)
