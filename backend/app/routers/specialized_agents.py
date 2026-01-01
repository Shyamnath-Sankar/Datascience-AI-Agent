"""
Specialized Agents Router for the Data Science Platform.
Provides endpoints for interacting with specialized AI agents.
"""

from fastapi import APIRouter, HTTPException, Body
from typing import Optional, Dict, Any, List
import logging

from ..utils.specialized_agents import (
    visualization_agent,
    code_execution_agent,
    package_manager_agent,
    insights_agent,
    agent_orchestrator
)
from ..utils.code_executor import code_executor
from ..utils.session_manager import get_active_file_id
from ..utils.gemini_client import get_gemini_client

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/visualization")
async def create_visualization(
    session_id: str,
    request: str = Body(..., embed=True),
    file_id: Optional[str] = Body(None, embed=True),
    auto_execute: bool = Body(True, embed=True)
):
    """
    Create visualizations using the specialized visualization agent.
    
    Args:
        session_id: The session ID
        request: The visualization request
        file_id: Optional specific file ID
        auto_execute: Whether to auto-execute the generated code
        
    Returns:
        Visualization response with optional execution results
    """
    try:
        if not session_id:
            raise HTTPException(status_code=400, detail="Session ID is required")
        if not request or not request.strip():
            raise HTTPException(status_code=400, detail="Request is required")
        
        # Use active file if no specific file_id provided
        if file_id is None:
            file_id = get_active_file_id(session_id)
        
        # Generate visualization using specialized agent
        agent_response = visualization_agent.create_visualization(session_id, request, file_id)
        
        # Prepare the response
        response_data = {
            "success": agent_response.get("success", True),
            "agent": agent_response.get("agent", visualization_agent.name),
            "response": agent_response.get("response", ""),
            "code_blocks": agent_response.get("code_blocks", []),
            "has_code": agent_response.get("has_code", False),
            "session_id": session_id,
            "file_id": file_id,
            "execution_result": None
        }
        
        # Auto-execute code if there are Python code blocks and auto_execute is True
        if auto_execute and agent_response.get("has_code", False) and agent_response.get("code_blocks"):
            python_blocks = [
                block for block in agent_response["code_blocks"] 
                if block.get("language", "").lower() == "python"
            ]
            if python_blocks:
                code_to_execute = python_blocks[0]["code"]
                execution_result = code_executor.execute_code(code_to_execute, session_id, file_id)
                response_data["execution_result"] = execution_result
                response_data["executed_code"] = code_to_execute
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in visualization agent: {e}")
        raise HTTPException(status_code=500, detail=f"Error in visualization agent: {str(e)}")


@router.post("/code-generation")
async def generate_code(
    session_id: str,
    request: str = Body(..., embed=True),
    file_id: Optional[str] = Body(None, embed=True),
    auto_execute: bool = Body(True, embed=True)
):
    """
    Generate code using the specialized code execution agent.
    
    Args:
        session_id: The session ID
        request: The analysis request
        file_id: Optional specific file ID
        auto_execute: Whether to auto-execute the generated code
        
    Returns:
        Code generation response with optional execution results
    """
    try:
        if not session_id:
            raise HTTPException(status_code=400, detail="Session ID is required")
        if not request or not request.strip():
            raise HTTPException(status_code=400, detail="Request is required")
        
        # Use active file if no specific file_id provided
        if file_id is None:
            file_id = get_active_file_id(session_id)
        
        # Generate code using specialized agent
        agent_response = code_execution_agent.generate_code(session_id, request, file_id)
        
        # Prepare the response
        response_data = {
            "success": agent_response.get("success", True),
            "agent": agent_response.get("agent", code_execution_agent.name),
            "response": agent_response.get("response", ""),
            "code_blocks": agent_response.get("code_blocks", []),
            "has_code": agent_response.get("has_code", False),
            "session_id": session_id,
            "file_id": file_id,
            "execution_result": None
        }
        
        # Auto-execute code if there are Python code blocks and auto_execute is True
        if auto_execute and agent_response.get("has_code", False) and agent_response.get("code_blocks"):
            python_blocks = [
                block for block in agent_response["code_blocks"] 
                if block.get("language", "").lower() == "python"
            ]
            if python_blocks:
                code_to_execute = python_blocks[0]["code"]
                execution_result = code_executor.execute_code(code_to_execute, session_id, file_id)
                response_data["execution_result"] = execution_result
                response_data["executed_code"] = code_to_execute
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in code generation agent: {e}")
        raise HTTPException(status_code=500, detail=f"Error in code generation agent: {str(e)}")


@router.post("/package-recommendations")
async def get_package_recommendations(
    request: str = Body(..., embed=True)
):
    """
    Get package recommendations using the specialized package manager agent.
    
    Args:
        request: The package recommendation request
        
    Returns:
        Package recommendations
    """
    try:
        if not request or not request.strip():
            raise HTTPException(status_code=400, detail="Request is required")
        
        # Generate recommendations using specialized agent
        agent_response = package_manager_agent.recommend_packages(request)
        
        return {
            "success": agent_response.get("success", True),
            "agent": agent_response.get("agent", package_manager_agent.name),
            "response": agent_response.get("response", ""),
            "recommendations": agent_response.get("recommendations", [])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in package manager agent: {e}")
        raise HTTPException(status_code=500, detail=f"Error in package manager agent: {str(e)}")


@router.post("/insights")
async def generate_insights(
    session_id: str,
    file_id: Optional[str] = Body(None, embed=True),
    focus_area: str = Body("general", embed=True),
    auto_execute: bool = Body(True, embed=True)
):
    """
    Generate insights using the specialized insights agent.
    
    Args:
        session_id: The session ID
        file_id: Optional specific file ID
        focus_area: Area to focus insights on (e.g., "sales", "trends")
        auto_execute: Whether to auto-execute the generated code
        
    Returns:
        Insights response with optional execution results
    """
    try:
        if not session_id:
            raise HTTPException(status_code=400, detail="Session ID is required")
        
        # Use active file if no specific file_id provided
        if file_id is None:
            file_id = get_active_file_id(session_id)
        
        # Generate insights using specialized agent
        agent_response = insights_agent.generate_insights(session_id, file_id, focus_area)
        
        # Prepare the response
        response_data = {
            "success": agent_response.get("success", True),
            "agent": agent_response.get("agent", insights_agent.name),
            "response": agent_response.get("response", ""),
            "code_blocks": agent_response.get("code_blocks", []),
            "has_code": agent_response.get("has_code", False),
            "session_id": session_id,
            "file_id": file_id,
            "execution_result": None
        }
        
        # Auto-execute code if there are Python code blocks and auto_execute is True
        if auto_execute and agent_response.get("has_code", False) and agent_response.get("code_blocks"):
            python_blocks = [
                block for block in agent_response["code_blocks"] 
                if block.get("language", "").lower() == "python"
            ]
            if python_blocks:
                code_to_execute = python_blocks[0]["code"]
                execution_result = code_executor.execute_code(code_to_execute, session_id, file_id)
                response_data["execution_result"] = execution_result
                response_data["executed_code"] = code_to_execute
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in insights agent: {e}")
        raise HTTPException(status_code=500, detail=f"Error in insights agent: {str(e)}")


@router.get("/agents/list")
async def list_available_agents():
    """
    List all available specialized agents and their capabilities.
    
    Returns:
        List of agents with their details
    """
    try:
        agents = agent_orchestrator.list_agents()
        
        return {
            "success": True,
            "agents": agents,
            "total_agents": len(agents)
        }
        
    except Exception as e:
        logger.error(f"Error listing agents: {e}")
        raise HTTPException(status_code=500, detail=f"Error listing agents: {str(e)}")


@router.post("/agent-selector")
async def select_best_agent(
    request: str = Body(..., embed=True)
):
    """
    Automatically select the best agent for a given request using AI.
    
    Args:
        request: The user's request
        
    Returns:
        Selected agent with confidence score and reason
    """
    try:
        if not request or not request.strip():
            raise HTTPException(status_code=400, detail="Request is required")
        
        # Use AI-powered agent routing
        routing_result = agent_orchestrator.route_request(request)
        
        return {
            "success": True,
            "selected_agent": routing_result,
            "request": request,
            "agent_details": next(
                (a for a in agent_orchestrator.list_agents() if a["id"] == routing_result["agent"]),
                None
            )
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error selecting agent: {e}")
        raise HTTPException(status_code=500, detail=f"Error selecting agent: {str(e)}")


@router.post("/smart-analyze")
async def smart_analyze(
    session_id: str,
    request: str = Body(..., embed=True),
    file_id: Optional[str] = Body(None, embed=True),
    auto_execute: bool = Body(True, embed=True)
):
    """
    Intelligently route and execute a request using the best agent.
    
    This endpoint automatically selects the best agent and executes the request.
    
    Args:
        session_id: The session ID
        request: The user's request
        file_id: Optional specific file ID
        auto_execute: Whether to auto-execute the generated code
        
    Returns:
        Analysis results from the selected agent
    """
    try:
        if not session_id:
            raise HTTPException(status_code=400, detail="Session ID is required")
        if not request or not request.strip():
            raise HTTPException(status_code=400, detail="Request is required")
        
        # Use active file if no specific file_id provided
        if file_id is None:
            file_id = get_active_file_id(session_id)
        
        # Route to the best agent
        routing_result = agent_orchestrator.route_request(request)
        selected_agent_id = routing_result["agent"]
        
        # Get the selected agent and execute
        agent = agent_orchestrator.get_agent(selected_agent_id)
        
        # Execute based on agent type
        if selected_agent_id == "visualization":
            agent_response = visualization_agent.create_visualization(session_id, request, file_id)
        elif selected_agent_id == "insights":
            agent_response = insights_agent.generate_insights(session_id, file_id, "general")
        elif selected_agent_id == "package-manager":
            agent_response = package_manager_agent.recommend_packages(request)
        else:
            agent_response = code_execution_agent.generate_code(session_id, request, file_id)
        
        # Prepare the response
        response_data = {
            "success": agent_response.get("success", True),
            "routing": routing_result,
            "agent": agent_response.get("agent", agent.name),
            "response": agent_response.get("response", ""),
            "code_blocks": agent_response.get("code_blocks", []),
            "has_code": agent_response.get("has_code", False),
            "session_id": session_id,
            "file_id": file_id,
            "execution_result": None
        }
        
        # Auto-execute code if there are Python code blocks
        if auto_execute and agent_response.get("has_code", False) and agent_response.get("code_blocks"):
            python_blocks = [
                block for block in agent_response["code_blocks"] 
                if block.get("language", "").lower() == "python"
            ]
            if python_blocks:
                code_to_execute = python_blocks[0]["code"]
                execution_result = code_executor.execute_code(code_to_execute, session_id, file_id)
                response_data["execution_result"] = execution_result
                response_data["executed_code"] = code_to_execute
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in smart analyze: {e}")
        raise HTTPException(status_code=500, detail=f"Error in smart analyze: {str(e)}")
