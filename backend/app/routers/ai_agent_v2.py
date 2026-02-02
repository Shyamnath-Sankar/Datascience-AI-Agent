"""
Advanced AI Agent Router with Streaming Support.
Implements SSE (Server-Sent Events) for real-time responses.
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
    metadata: Dict[str, Any] = {}


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


async def stream_response(
    session_id: str,
    message: str,
    file_id: Optional[str],
    agent: Optional[str],
    auto_execute: bool,
) -> AsyncGenerator[str, None]:
    """
    Stream AI response using Server-Sent Events format.
    """
    ai_service = AIService()
    data_service = DataService()
    code_service = CodeExecutionService()

    try:
        # Send start event
        yield f"data: {json.dumps({'type': 'start', 'timestamp': datetime.now().isoformat()})}\n\n"
        await asyncio.sleep(0.01)

        # Get data context
        context = await data_service.get_data_context(session_id, file_id)
        yield f"data: {json.dumps({'type': 'context_loaded'})}\n\n"
        await asyncio.sleep(0.01)

        # Generate AI response
        response = await ai_service.chat(
            session_id=session_id,
            message=message,
            data_context=context,
            agent_type=agent,
        )

        if not response.success:
            yield f"data: {json.dumps({'type': 'error', 'error': response.error})}\n\n"
            return

        # Stream the response text in chunks (simulating token streaming)
        text = response.data.get("text", "")
        chunk_size = 50  # Characters per chunk

        for i in range(0, len(text), chunk_size):
            chunk = text[i : i + chunk_size]
            yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
            await asyncio.sleep(0.02)  # Small delay for smooth streaming

        # Extract code blocks
        from ..utils.shared_utils import text_processor

        code_blocks = text_processor.extract_code_blocks(text)

        if code_blocks:
            yield f"data: {json.dumps({'type': 'code_blocks', 'blocks': code_blocks})}\n\n"
            await asyncio.sleep(0.01)

            # Auto-execute if requested
            if auto_execute and code_blocks:
                python_code = next(
                    (b["code"] for b in code_blocks if b.get("language") == "python"),
                    None,
                )

                if python_code:
                    yield f"data: {json.dumps({'type': 'execution_start'})}\n\n"
                    await asyncio.sleep(0.01)

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
    Enhanced chat endpoint with optional streaming.
    """
    await check_rate_limit(request, session_id)

    # Track metrics
    metrics = Container.get("metrics")
    metrics.increment("chat_requests", tags={"agent": body.agent or "auto"})

    start_time = datetime.now()

    if body.streaming:
        return StreamingResponse(
            stream_response(
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

    # Non-streaming response
    ai_service = AIService()
    data_service = DataService()
    code_service = CodeExecutionService()

    try:
        # Get data context
        context = await data_service.get_data_context(
            session_id=session_id,
            file_id=body.file_id,
        )

        # Generate response
        response = await ai_service.chat(
            session_id=session_id,
            message=body.message,
            data_context=context,
            agent_type=body.agent,
        )

        if not response.success:
            raise HTTPException(status_code=500, detail=response.error)

        text = response.data.get("text", "")

        # Extract code blocks
        from ..utils.shared_utils import text_processor

        code_blocks = text_processor.extract_code_blocks(text)
        clean_response = text_processor.clean_response_text(text)

        # Auto-execute if requested
        execution_result = None
        executed_code = None

        if body.auto_execute and code_blocks:
            python_code = next(
                (b["code"] for b in code_blocks if b.get("language") == "python"), None
            )

            if python_code:
                executed_code = python_code
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
            agent=body.agent,
            code_blocks=code_blocks,
            executed_code=executed_code,
            execution_result=execution_result,
            metadata={
                "processing_time_ms": int(processing_time),
                "model": get_settings().gemini_model,
            },
        )

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
        "version": "2.0.0",
        "ai_configured": bool(settings.gemini_api_key),
        "environment": settings.environment.value,
    }


@router.get("/metrics")
async def get_metrics():
    """Get application metrics (for monitoring)."""
    metrics = Container.get("metrics")
    return metrics.get_stats()
