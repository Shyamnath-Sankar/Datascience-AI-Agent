"""
Agent Observability Module.
Provides structured logging of reasoning traces, per-agent performance metrics,
and debugging tools for the AI agent system.
"""

import logging
import time
import json
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime
from collections import defaultdict

logger = logging.getLogger("agent.observability")


@dataclass
class AgentMetrics:
    """Per-agent performance metrics."""

    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    total_tool_calls: int = 0
    tool_errors: int = 0
    retries: int = 0
    total_latency_ms: float = 0.0
    latency_samples: List[float] = field(default_factory=list)

    @property
    def success_rate(self) -> float:
        return self.successful_requests / max(self.total_requests, 1)

    @property
    def avg_latency_ms(self) -> float:
        return self.total_latency_ms / max(self.total_requests, 1)

    @property
    def p95_latency_ms(self) -> float:
        if not self.latency_samples:
            return 0.0
        sorted_samples = sorted(self.latency_samples)
        idx = int(len(sorted_samples) * 0.95)
        return sorted_samples[min(idx, len(sorted_samples) - 1)]

    def record_request(self, success: bool, latency_ms: float, tool_calls: int = 0, errors: int = 0, retries: int = 0):
        """Record metrics for a single request."""
        self.total_requests += 1
        if success:
            self.successful_requests += 1
        else:
            self.failed_requests += 1
        self.total_tool_calls += tool_calls
        self.tool_errors += errors
        self.retries += retries
        self.total_latency_ms += latency_ms
        self.latency_samples.append(latency_ms)
        # Keep only last 500 samples
        if len(self.latency_samples) > 500:
            self.latency_samples = self.latency_samples[-500:]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_requests": self.total_requests,
            "successful_requests": self.successful_requests,
            "failed_requests": self.failed_requests,
            "success_rate": round(self.success_rate, 4),
            "total_tool_calls": self.total_tool_calls,
            "tool_errors": self.tool_errors,
            "retries": self.retries,
            "avg_latency_ms": round(self.avg_latency_ms, 1),
            "p95_latency_ms": round(self.p95_latency_ms, 1),
        }


class AgentObserver:
    """
    Central observability hub for agent operations.
    Captures structured reasoning traces and performance metrics.
    """

    _instance: Optional["AgentObserver"] = None
    _metrics: Dict[str, AgentMetrics] = {}
    _recent_traces: List[Dict[str, Any]] = []
    _max_traces: int = 100

    @classmethod
    def get_instance(cls) -> "AgentObserver":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def record_trace(
        self,
        agent_name: str,
        session_id: str,
        user_request: str,
        reasoning_trace: Dict[str, Any],
        success: bool,
        latency_ms: float,
    ):
        """Record a complete reasoning trace."""
        # Structured log entry
        trace_entry = {
            "timestamp": datetime.now().isoformat(),
            "agent": agent_name,
            "session_id": session_id,
            "request_preview": user_request[:200],
            "success": success,
            "latency_ms": round(latency_ms, 1),
            "iterations": len(reasoning_trace.get("steps", [])),
            "steps_summary": [
                {
                    "step": s.get("step"),
                    "content_length": len(s.get("content", "")),
                    "has_tool_call": s.get("tool_call") is not None,
                    "confidence": s.get("confidence", 1.0),
                }
                for s in reasoning_trace.get("steps", [])
            ],
        }

        # Log as structured JSON
        logger.info(f"AGENT_TRACE: {json.dumps(trace_entry)}")

        # Store in memory
        self._recent_traces.append(trace_entry)
        if len(self._recent_traces) > self._max_traces:
            self._recent_traces = self._recent_traces[-self._max_traces:]

        # Update per-agent metrics
        if agent_name not in self._metrics:
            self._metrics[agent_name] = AgentMetrics()

        tool_calls = sum(1 for s in reasoning_trace.get("steps", []) if s.get("tool_call"))
        errors = sum(
            1 for s in reasoning_trace.get("steps", [])
            if s.get("step") == "observe" and "error" in str(s.get("observation", "")).lower()
        )
        retries = sum(
            1 for s in reasoning_trace.get("steps", [])
            if s.get("step") == "reflect" and "retry" in str(s.get("content", "")).lower()
        )

        self._metrics[agent_name].record_request(
            success=success,
            latency_ms=latency_ms,
            tool_calls=tool_calls,
            errors=errors,
            retries=retries,
        )

    def record_tool_execution(
        self,
        tool_name: str,
        session_id: str,
        success: bool,
        latency_ms: float,
        error: Optional[str] = None,
    ):
        """Record a single tool execution for per-tool metrics."""
        tool_key = f"tool:{tool_name}"
        if tool_key not in self._metrics:
            self._metrics[tool_key] = AgentMetrics()
        self._metrics[tool_key].record_request(success=success, latency_ms=latency_ms)

        if error:
            logger.warning(
                f"TOOL_ERROR: tool={tool_name} session={session_id} error={error[:200]}"
            )

    def get_metrics(self) -> Dict[str, Any]:
        """Get all collected metrics."""
        return {
            "agents": {k: v.to_dict() for k, v in self._metrics.items() if not k.startswith("tool:")},
            "tools": {k: v.to_dict() for k, v in self._metrics.items() if k.startswith("tool:")},
            "recent_traces_count": len(self._recent_traces),
        }

    def get_recent_traces(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get recent reasoning traces for debugging."""
        return self._recent_traces[-limit:]

    def reset(self):
        """Reset all metrics (for testing)."""
        self._metrics.clear()
        self._recent_traces.clear()


# Convenience singleton
observer = AgentObserver.get_instance()
