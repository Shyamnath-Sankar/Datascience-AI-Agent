"""
Advanced AI Agent Router with ReAct Processing and Real Streaming.
Implements SSE (Server-Sent Events) with actual Gemini streaming.
"""

from fastapi import APIRouter, Query, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, AsyncGenerator
import asyncio
import json
import logging
from datetime import datetime

from ..core.config import Container, get_settings, RateLimitError
from ..services.ai_service import AIService, CodeExecutionService, DataService
from ..prompts.system_prompts import (
    get_prompt_for_agent,
    AgentRole,
    MASTER_SYSTEM_PROMPT,
    build_optimized_context,
)


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/agent/v2", tags=["AI Agent V2"])


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================


class ChatRequest(BaseModel):
    """Enhanced chat request with more options."""

    message: str = Field(..., min_length=1, max_length=10000)
    file_id: Optional[str] = None
    connection_id: Optional[str] = None
    agent: Optional[str] = None
    auto_execute: bool = True
    streaming: bool = False
    include_reasoning: bool = True
    context_window: int = Field(default=4000, ge=1000, le=32000)


class CodeExecuteRequest(BaseModel):
    """Code execution request."""

    code: str = Field(..., min_length=1)
    file_id: Optional[str] = None
    auto_install: bool = True
    timeout: int = Field(default=30, ge=5, le=120)


class ChatResponse(BaseModel):
    """Enhanced chat response."""

    success: bool
    response: str
    agent: Optional[str] = None
    code_blocks: List[Dict[str, Any]] = []
    executed_code: Optional[str] = None
    execution_result: Optional[Dict[str, Any]] = None
    reasoning_trace: Optional[Dict[str, Any]] = None
    plots: List[str] = []
    metadata: Dict[str, Any] = {}


# =============================================================================
# REACT AGENT FACTORY
# =============================================================================


def _get_react_agent():
    """Create a ReActAgent wired to the GeminiClient."""
    from ..utils.gemini_client import get_gemini_client
    from ..agents.orchestration.react_agent import ReActAgent

    client = get_gemini_client()

    if not client.is_configured:
        raise HTTPException(
            status_code=503,
            detail="AI service not configured. Please set the GEMINI_API_KEY environment variable.",
        )

    return ReActAgent(
        llm_generate_fn=client.generate_async,
        max_iterations=8,
        verbose=True,
    )


# =============================================================================
# RATE LIMITING MIDDLEWARE
# =============================================================================


async def check_rate_limit(request: Request, session_id: str):
    """Check rate limit for a session."""
    settings = get_settings()
    if not settings.rate_limit_enabled:
        return

    rate_limiter = Container.get("rate_limiter")
    if not rate_limiter.is_allowed(session_id):
        retry_after = rate_limiter.get_retry_after(session_id)
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Retry after {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )


# =============================================================================
# STREAMING HELPERS
# =============================================================================


async def stream_response_react(
    session_id: str,
    message: str,
    file_id: Optional[str],
    agent: Optional[str],
    auto_execute: bool,
) -> AsyncGenerator[str, None]:
    """
    Stream AI response using ReAct agent with real Gemini streaming.
    Falls back to chunked response if streaming API is unavailable.
    """
    from ..utils.gemini_client import get_gemini_client

    client = get_gemini_client()
    data_service = DataService()

    try:
        # Send start event
        yield f"data: {json.dumps({'type': 'start', 'timestamp': datetime.now().isoformat()})}\n\n"
        await asyncio.sleep(0.01)

        # Get data context
        context = await data_service.get_data_context(session_id, file_id)
        yield f"data: {json.dumps({'type': 'context_loaded'})}\n\n"
        await asyncio.sleep(0.01)

        # Build prompt with system instructions
        from ..prompts.system_prompts import MASTER_SYSTEM_PROMPT

        full_prompt = f"""{MASTER_SYSTEM_PROMPT}

## DATA CONTEXT
{context}

## USER REQUEST
{message}

Provide a thorough analysis:"""

        # Try real streaming first
        try:
            yield f"data: {json.dumps({'type': 'streaming_start', 'method': 'native'})}\n\n"
            full_response = ""

            async for chunk in client.generate_stream_async(full_prompt, session_id):
                full_response += chunk
                yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"

        except Exception as stream_error:
            # Fallback to non-streaming
            logger.warning(f"Streaming unavailable, falling back: {stream_error}")
            yield f"data: {json.dumps({'type': 'streaming_fallback'})}\n\n"

            response_text = await client.generate_async(full_prompt, session_id)
            full_response = response_text

            # Stream in chunks
            chunk_size = 80
            for i in range(0, len(full_response), chunk_size):
                chunk = full_response[i: i + chunk_size]
                yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
                await asyncio.sleep(0.01)

        # Track in history
        client._history.setdefault(session_id, [])
        client._history[session_id].append({"role": "user", "content": message})
        client._history[session_id].append({"role": "assistant", "content": full_response})

        # Extract code blocks
        from ..utils.shared_utils import text_processor

        code_blocks = text_processor.extract_code_blocks(full_response)

        if code_blocks:
            yield f"data: {json.dumps({'type': 'code_blocks', 'blocks': code_blocks})}\n\n"
            await asyncio.sleep(0.01)

            # Auto-execute if requested
            if auto_execute:
                python_code = next(
                    (b["code"] for b in code_blocks if b.get("language") == "python"),
                    None,
                )

                if python_code:
                    yield f"data: {json.dumps({'type': 'execution_start'})}\n\n"
                    await asyncio.sleep(0.01)

                    code_service = CodeExecutionService()
                    exec_result = await code_service.execute(
                        code=python_code,
                        session_id=session_id,
                        file_id=file_id,
                    )

                    yield f"data: {json.dumps({'type': 'execution_result', 'result': exec_result.to_dict()})}\n\n"

        # Send completion event
        yield f"data: {json.dumps({'type': 'done', 'timestamp': datetime.now().isoformat()})}\n\n"

    except Exception as e:
        logger.error(f"Streaming error: {e}")
        yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"


# =============================================================================
# ENDPOINTS
# =============================================================================


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: Request,
    body: ChatRequest,
    session_id: str = Query(..., description="Session ID"),
):
    """
    Enhanced chat endpoint with ReAct reasoning and optional streaming.
    """
    await check_rate_limit(request, session_id)

    # Track metrics
    metrics = Container.get("metrics")
    metrics.increment("chat_requests", tags={"agent": body.agent or "auto"})

    start_time = datetime.now()

    # Streaming path
    if body.streaming:
        return StreamingResponse(
            stream_response_react(
                session_id=session_id,
                message=body.message,
                file_id=body.file_id,
                agent=body.agent,
                auto_execute=body.auto_execute,
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    # Non-streaming path: Use ReAct agent for reasoning, or simple for Q&A
    try:
        data_service = DataService()
        context = await data_service.get_data_context(
            session_id=session_id,
            file_id=body.file_id,
        )

        if body.include_reasoning:
            # ============================================
            # PRIMARY PATH: ReAct Agent with real tools
            # ============================================
            react_agent = _get_react_agent()

            result = await react_agent.process(
                user_request=body.message,
                data_context=context,
                session_id=session_id,
            )

            text = result.get("response", "")
            code_blocks = result.get("code_blocks", [])
            plots = result.get("plots", [])
            reasoning_trace = result.get("reasoning_trace")

            # Auto-execute remaining code blocks if not already executed by the agent
            execution_result = None
            executed_code = None

            if body.auto_execute and code_blocks and not plots:
                # Only auto-execute if the agent didn't already produce plots
                python_code = next(
                    (b["code"] for b in code_blocks if b.get("language") == "python"),
                    None,
                )
                if python_code:
                    executed_code = python_code
                    code_service = CodeExecutionService()
                    exec_response = await code_service.execute(
                        code=python_code,
                        session_id=session_id,
                        file_id=body.file_id,
                    )
                    execution_result = exec_response.to_dict()

                    # Collect plots from execution
                    exec_data = execution_result.get("data", {}) if execution_result else {}
                    if exec_data and exec_data.get("plots"):
                        plots.extend(exec_data["plots"])

            from ..utils.shared_utils import text_processor

            clean_response = text_processor.clean_response_text(text)

        else:
            # ============================================
            # SIMPLE PATH: Direct LLM call (no reasoning)
            # ============================================
            ai_service = AIService()
            response = await ai_service.chat(
                session_id=session_id,
                message=body.message,
                data_context=context,
                agent_type=body.agent,
            )

            if not response.success:
                raise HTTPException(status_code=500, detail=response.error)

            text = response.data.get("text", "")

            from ..utils.shared_utils import text_processor

            code_blocks = text_processor.extract_code_blocks(text)
            clean_response = text_processor.clean_response_text(text)
            reasoning_trace = None
            plots = []

            # Auto-execute
            execution_result = None
            executed_code = None

            if body.auto_execute and code_blocks:
                python_code = next(
                    (b["code"] for b in code_blocks if b.get("language") == "python"),
                    None,
                )
                if python_code:
                    executed_code = python_code
                    code_service = CodeExecutionService()
                    exec_response = await code_service.execute(
                        code=python_code,
                        session_id=session_id,
                        file_id=body.file_id,
                    )
                    execution_result = exec_response.to_dict()

        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        metrics.histogram("chat_processing_time_ms", processing_time)

        return ChatResponse(
            success=True,
            response=clean_response,
            agent=body.agent or "react",
            code_blocks=code_blocks,
            executed_code=executed_code,
            execution_result=execution_result,
            reasoning_trace=reasoning_trace,
            plots=plots,
            metadata={
                "processing_time_ms": int(processing_time),
                "model": get_settings().gemini_model,
                "reasoning_enabled": body.include_reasoning,
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/execute")
async def execute_code(
    request: Request,
    body: CodeExecuteRequest,
    session_id: str = Query(..., description="Session ID"),
):
    """
    Execute Python code with enhanced features.
    """
    await check_rate_limit(request, session_id)

    metrics = Container.get("metrics")
    metrics.increment("code_executions")

    code_service = CodeExecutionService()

    result = await code_service.execute(
        code=body.code,
        session_id=session_id,
        file_id=body.file_id,
        timeout=body.timeout,
        auto_install=body.auto_install,
    )

    return result.to_dict()


@router.get("/stream-test")
async def stream_test():
    """Test endpoint for streaming."""

    async def generate():
        for i in range(10):
            yield f"data: {json.dumps({'count': i})}\n\n"
            await asyncio.sleep(0.5)
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/agents")
async def list_agents():
    """
    List all available specialized agents.
    """
    agents = [
        {
            "id": "react",
            "name": "ReAct Agent",
            "role": "Iterative Reasoning & Analysis",
            "icon": "brain",
            "keywords": ["analyze", "investigate", "explore", "find"],
            "capabilities": [
                "Multi-step reasoning with Think/Plan/Act/Observe/Reflect",
                "Real Python code execution with error recovery",
                "Statistical tests, ML training, visualization generation",
                "Self-healing: retries failed operations with corrected approach",
            ],
            "default": True,
        },
        {
            "id": "visualization",
            "name": "Chart Creator",
            "role": "Create Charts & Graphs",
            "icon": "chart-bar",
            "keywords": ["chart", "plot", "graph", "visualize", "show"],
            "capabilities": [
                "Create publication-quality visualizations",
                "Recommend appropriate chart types",
                "Generate matplotlib/seaborn code",
            ],
        },
        {
            "id": "prediction",
            "name": "Prediction Expert",
            "role": "Forecast & Predict",
            "icon": "trending-up",
            "keywords": ["predict", "forecast", "future", "estimate"],
            "capabilities": [
                "Multi-model comparison (Linear, Polynomial, Exponential)",
                "Confidence intervals",
                "Time series analysis",
            ],
        },
        {
            "id": "statistics",
            "name": "Statistics Expert",
            "role": "Statistical Analysis",
            "icon": "calculator",
            "keywords": ["test", "correlation", "significant", "hypothesis"],
            "capabilities": [
                "Hypothesis testing (t-test, ANOVA, chi-square)",
                "Effect size calculation",
                "Assumption checking",
            ],
        },
        {
            "id": "eda",
            "name": "EDA Expert",
            "role": "Exploratory Analysis",
            "icon": "search",
            "keywords": ["explore", "summary", "overview", "profile"],
            "capabilities": [
                "Comprehensive data profiling",
                "Distribution analysis",
                "Missing value detection",
                "Correlation discovery",
            ],
        },
        {
            "id": "ml",
            "name": "ML Engineer",
            "role": "Machine Learning",
            "icon": "cpu",
            "keywords": ["train", "model", "classify", "cluster"],
            "capabilities": [
                "Model training and evaluation",
                "Feature importance analysis",
                "Cross-validation",
            ],
        },
        {
            "id": "sql",
            "name": "SQL Expert",
            "role": "Database Queries",
            "icon": "database",
            "keywords": ["sql", "query", "database", "table"],
            "capabilities": [
                "Natural language to SQL",
                "Query optimization",
                "Schema exploration",
            ],
        },
        {
            "id": "insights",
            "name": "Business Insights",
            "role": "Generate Insights",
            "icon": "lightbulb",
            "keywords": ["insight", "pattern", "trend", "finding"],
            "capabilities": [
                "Key insight extraction",
                "Actionable recommendations",
                "Business-focused analysis",
            ],
        },
    ]

    return {"agents": agents}


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    settings = get_settings()

    return {
        "status": "healthy",
        "version": "2.1.0",
        "ai_configured": bool(settings.gemini_api_key),
        "environment": settings.environment.value,
        "features": {
            "react_reasoning": True,
            "real_tool_execution": True,
            "error_recovery": True,
            "streaming": True,
        },
    }


@router.get("/observability")
async def get_observability():
    """Get agent observability data — structured traces and per-agent metrics."""
    try:
        from ..utils.observability import observer

        return {
            "metrics": observer.get_metrics(),
            "recent_traces": observer.get_recent_traces(limit=20),
        }
    except ImportError:
        return {"error": "Observability module not available"}


@router.get("/metrics")
async def get_metrics():
    """Get application metrics (for monitoring)."""
    metrics = Container.get("metrics")
    return metrics.get_stats()
