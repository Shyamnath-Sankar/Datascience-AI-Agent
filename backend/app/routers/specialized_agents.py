from fastapi import APIRouter, HTTPException, Body
from typing import Optional, Dict, Any, List
from ..utils.specialized_agents import (
    visualization_agent,
    code_execution_agent,
    package_manager_agent,
    insights_agent
)
from ..utils.code_executor import code_executor
from ..utils.session_manager import get_active_file_id

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
    """
    try:
        # Use active file if no specific file_id provided
        if file_id is None:
            file_id = get_active_file_id(session_id)
        
        # Generate visualization using specialized agent
        agent_response = visualization_agent.create_visualization(session_id, request, file_id)
        
        # Prepare the response
        response_data = {
            "success": True,
            "agent": agent_response["agent"],
            "response": agent_response["response"],
            "code_blocks": agent_response["code_blocks"],
            "has_code": agent_response.get("has_code", False),
            "session_id": session_id,
            "file_id": file_id,
            "execution_result": None
        }
        
        # Auto-execute code if there are Python code blocks and auto_execute is True
        if auto_execute and agent_response.get("has_code", False) and agent_response["code_blocks"]:
            python_blocks = [block for block in agent_response["code_blocks"] if block["language"] == "python"]
            if python_blocks:
                # Execute the first Python code block
                code_to_execute = python_blocks[0]["code"]
                execution_result = code_executor.execute_code(code_to_execute, session_id, file_id)
                response_data["execution_result"] = execution_result
                response_data["executed_code"] = code_to_execute
        
        return response_data
        
    except Exception as e:
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
    """
    try:
        # Use active file if no specific file_id provided
        if file_id is None:
            file_id = get_active_file_id(session_id)
        
        # Generate code using specialized agent
        agent_response = code_execution_agent.generate_code(session_id, request, file_id)
        
        # Prepare the response
        response_data = {
            "success": True,
            "agent": agent_response["agent"],
            "response": agent_response["response"],
            "code_blocks": agent_response["code_blocks"],
            "has_code": agent_response.get("has_code", False),
            "session_id": session_id,
            "file_id": file_id,
            "execution_result": None
        }
        
        # Auto-execute code if there are Python code blocks and auto_execute is True
        if auto_execute and agent_response.get("has_code", False) and agent_response["code_blocks"]:
            python_blocks = [block for block in agent_response["code_blocks"] if block["language"] == "python"]
            if python_blocks:
                # Execute the first Python code block
                code_to_execute = python_blocks[0]["code"]
                execution_result = code_executor.execute_code(code_to_execute, session_id, file_id)
                response_data["execution_result"] = execution_result
                response_data["executed_code"] = code_to_execute
        
        return response_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in code generation agent: {str(e)}")

@router.post("/package-recommendations")
async def get_package_recommendations(
    request: str = Body(..., embed=True)
):
    """
    Get package recommendations using the specialized package manager agent.
    """
    try:
        # Generate recommendations using specialized agent
        agent_response = package_manager_agent.recommend_packages(request)
        
        return {
            "success": True,
            "agent": agent_response["agent"],
            "response": agent_response["response"],
            "recommendations": agent_response.get("recommendations", [])
        }
        
    except Exception as e:
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
    """
    try:
        # Use active file if no specific file_id provided
        if file_id is None:
            file_id = get_active_file_id(session_id)
        
        # Generate insights using specialized agent
        agent_response = insights_agent.generate_insights(session_id, file_id, focus_area)
        
        # Prepare the response
        response_data = {
            "success": True,
            "agent": agent_response["agent"],
            "response": agent_response["response"],
            "code_blocks": agent_response["code_blocks"],
            "has_code": agent_response.get("has_code", False),
            "session_id": session_id,
            "file_id": file_id,
            "execution_result": None
        }
        
        # Auto-execute code if there are Python code blocks and auto_execute is True
        if auto_execute and agent_response.get("has_code", False) and agent_response["code_blocks"]:
            python_blocks = [block for block in agent_response["code_blocks"] if block["language"] == "python"]
            if python_blocks:
                # Execute the first Python code block
                code_to_execute = python_blocks[0]["code"]
                execution_result = code_executor.execute_code(code_to_execute, session_id, file_id)
                response_data["execution_result"] = execution_result
                response_data["executed_code"] = code_to_execute
        
        return response_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in insights agent: {str(e)}")

@router.get("/agents/list")
async def list_available_agents():
    """
    List all available specialized agents and their capabilities.
    """
    try:
        agents = [
            {
                "name": visualization_agent.name,
                "role": visualization_agent.role,
                "goal": visualization_agent.goal,
                "capabilities": [
                    "Create matplotlib and seaborn visualizations",
                    "Generate statistical plots and charts",
                    "Design publication-ready figures",
                    "Create interactive visualizations",
                    "Recommend appropriate chart types"
                ]
            },
            {
                "name": code_execution_agent.name,
                "role": code_execution_agent.role,
                "goal": code_execution_agent.goal,
                "capabilities": [
                    "Generate clean Python code",
                    "Debug and optimize code",
                    "Create data processing pipelines",
                    "Implement statistical analyses",
                    "Handle error cases gracefully"
                ]
            },
            {
                "name": package_manager_agent.name,
                "role": package_manager_agent.role,
                "goal": package_manager_agent.goal,
                "capabilities": [
                    "Recommend appropriate packages",
                    "Handle package installations",
                    "Resolve dependency conflicts",
                    "Suggest package alternatives",
                    "Optimize environment setup"
                ]
            },
            {
                "name": insights_agent.name,
                "role": insights_agent.role,
                "goal": insights_agent.goal,
                "capabilities": [
                    "Perform statistical analysis",
                    "Identify patterns and trends",
                    "Generate business insights",
                    "Assess data quality",
                    "Provide actionable recommendations"
                ]
            }
        ]
        
        return {
            "success": True,
            "agents": agents,
            "total_agents": len(agents)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing agents: {str(e)}")

@router.post("/agent-selector")
async def select_best_agent(
    request: str = Body(..., embed=True)
):
    """
    Automatically select the best agent for a given request.
    """
    try:
        # Simple keyword-based agent selection
        request_lower = request.lower()
        
        if any(keyword in request_lower for keyword in ['plot', 'chart', 'graph', 'visualiz', 'histogram', 'scatter', 'bar chart']):
            selected_agent = {
                "agent": "visualization",
                "name": visualization_agent.name,
                "reason": "Request involves data visualization"
            }
        elif any(keyword in request_lower for keyword in ['install', 'package', 'import', 'dependency', 'library']):
            selected_agent = {
                "agent": "package-manager",
                "name": package_manager_agent.name,
                "reason": "Request involves package management"
            }
        elif any(keyword in request_lower for keyword in ['insight', 'analysis', 'pattern', 'trend', 'summary', 'overview']):
            selected_agent = {
                "agent": "insights",
                "name": insights_agent.name,
                "reason": "Request involves data insights and analysis"
            }
        else:
            selected_agent = {
                "agent": "code-generation",
                "name": code_execution_agent.name,
                "reason": "General code generation request"
            }
        
        return {
            "success": True,
            "selected_agent": selected_agent,
            "request": request
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error selecting agent: {str(e)}")
