"""
AI Agent Router for the Data Science Platform.
Handles chat requests and routes them to appropriate agents.
"""

from fastapi import APIRouter, HTTPException, Body
from typing import Optional, Dict, Any
import logging

from ..utils.gemini_client import gemini_client, get_gemini_client
from ..utils.code_executor import code_executor
from ..utils.session_manager import get_session_data, get_active_file_id

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/chat")
async def chat_with_agent(
    session_id: str,
    message: str = Body(..., embed=True),
    file_id: Optional[str] = Body(None, embed=True),
    auto_execute: bool = Body(True, embed=True)
):
    """
    Send a message to the AI agent and get a response with optional auto-execution.
    
    Args:
        session_id: The session ID for data access
        message: The user's message
        file_id: Optional specific file to analyze
        auto_execute: Whether to automatically execute generated code
        
    Returns:
        AI response with optional code execution results
    """
    try:
        # Validate session
        if not session_id:
            raise HTTPException(status_code=400, detail="Session ID is required")
        
        # Use active file if no specific file_id provided
        if file_id is None:
            file_id = get_active_file_id(session_id)
        
        # Get the Gemini client
        client = get_gemini_client()
        
        if not client.is_configured:
            raise HTTPException(
                status_code=503, 
                detail="AI service is not configured. Please set the GEMINI_API_KEY environment variable."
            )
        
        # Generate response using Gemini
        ai_response = client.generate_response(session_id, message, file_id)
        
        # Check for errors
        if not ai_response.get("success", False):
            return {
                "success": False,
                "response": ai_response.get("error", "An error occurred"),
                "code_blocks": [],
                "has_code": False,
                "session_id": session_id,
                "file_id": file_id,
                "execution_result": None
            }
        
        # Prepare the response
        response_data = {
            "success": True,
            "response": ai_response.get("response", ""),
            "code_blocks": ai_response.get("code_blocks", []),
            "has_code": ai_response.get("has_code", False),
            "session_id": session_id,
            "file_id": file_id,
            "execution_result": None
        }
        
        # Auto-execute code if there are Python code blocks and auto_execute is True
        if auto_execute and ai_response.get("has_code", False) and ai_response.get("code_blocks"):
            python_blocks = [
                block for block in ai_response["code_blocks"] 
                if block.get("language", "").lower() == "python"
            ]
            if python_blocks:
                # Execute the first Python code block
                code_to_execute = python_blocks[0]["code"]
                execution_result = code_executor.execute_code(
                    code_to_execute, 
                    session_id, 
                    file_id
                )
                response_data["execution_result"] = execution_result
                response_data["executed_code"] = code_to_execute
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat: {e}")
        raise HTTPException(status_code=500, detail=f"Error in chat: {str(e)}")


@router.post("/execute-code")
async def execute_code(
    session_id: str,
    code: str = Body(..., embed=True),
    file_id: Optional[str] = Body(None, embed=True),
    auto_install: bool = Body(True, embed=True)
):
    """
    Execute Python code and return results.
    
    Args:
        session_id: The session ID for data access
        code: The Python code to execute
        file_id: Optional specific file ID
        auto_install: Whether to auto-install missing packages
        
    Returns:
        Execution results including output, plots, and variables
    """
    try:
        # Validate inputs
        if not session_id:
            raise HTTPException(status_code=400, detail="Session ID is required")
        if not code or not code.strip():
            raise HTTPException(status_code=400, detail="Code is required")
        
        # Use active file if no specific file_id provided
        if file_id is None:
            file_id = get_active_file_id(session_id)
        
        # Check for required packages and install if needed
        installation_results = []
        if auto_install:
            required_packages = code_executor.check_required_packages(code)
            
            for package in required_packages:
                install_result = code_executor.install_package(package)
                installation_results.append({
                    "package": package,
                    "success": install_result["success"],
                    "message": install_result["message"]
                })
        
        # Execute the code
        execution_result = code_executor.execute_code(code, session_id, file_id)
        
        return {
            "success": execution_result["success"],
            "output": execution_result["output"],
            "error": execution_result["error"],
            "plots": execution_result["plots"],
            "variables": execution_result["variables"],
            "installations": installation_results,
            "session_id": session_id,
            "file_id": file_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing code: {e}")
        raise HTTPException(status_code=500, detail=f"Error executing code: {str(e)}")


@router.post("/install-package")
async def install_package(
    package_name: str = Body(..., embed=True)
):
    """
    Install a Python package.
    
    Args:
        package_name: Name of the package to install
        
    Returns:
        Installation result
    """
    try:
        if not package_name or not package_name.strip():
            raise HTTPException(status_code=400, detail="Package name is required")
        
        result = code_executor.install_package(package_name.strip())
        
        return {
            "success": result["success"],
            "message": result["message"],
            "output": result.get("output", ""),
            "error": result.get("error", "")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error installing package: {e}")
        raise HTTPException(status_code=500, detail=f"Error installing package: {str(e)}")


@router.post("/generate-insights")
async def generate_insights(
    session_id: str,
    file_id: Optional[str] = Body(None, embed=True)
):
    """
    Generate automatic insights about the dataset.
    
    Args:
        session_id: The session ID
        file_id: Optional specific file ID
        
    Returns:
        Generated insights with optional code blocks
    """
    try:
        if not session_id:
            raise HTTPException(status_code=400, detail="Session ID is required")
        
        # Use active file if no specific file_id provided
        if file_id is None:
            file_id = get_active_file_id(session_id)
        
        # Get the Gemini client
        client = get_gemini_client()
        
        if not client.is_configured:
            raise HTTPException(
                status_code=503, 
                detail="AI service is not configured"
            )
        
        # Generate insights using Gemini
        insights = client.generate_insights(session_id, file_id)
        
        return {
            "success": True,
            "insights": insights.get("insights", ""),
            "code_blocks": insights.get("code_blocks", []),
            "session_id": session_id,
            "file_id": file_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating insights: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating insights: {str(e)}")


@router.get("/chat-history")
async def get_chat_history(session_id: str):
    """
    Get chat history for a session.
    
    Args:
        session_id: The session ID
        
    Returns:
        Chat history
    """
    try:
        if not session_id:
            raise HTTPException(status_code=400, detail="Session ID is required")
        
        client = get_gemini_client()
        history = client.get_chat_history(session_id)
        
        return {
            "success": True,
            "history": history,
            "session_id": session_id
        }
        
    except Exception as e:
        logger.error(f"Error getting chat history: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting chat history: {str(e)}")


@router.delete("/clear-chat")
async def clear_chat_history(session_id: str):
    """
    Clear chat history for a session.
    
    Args:
        session_id: The session ID
        
    Returns:
        Confirmation message
    """
    try:
        if not session_id:
            raise HTTPException(status_code=400, detail="Session ID is required")
        
        client = get_gemini_client()
        client.clear_chat_session(session_id)
        
        return {
            "success": True,
            "message": "Chat history cleared",
            "session_id": session_id
        }
        
    except Exception as e:
        logger.error(f"Error clearing chat history: {e}")
        raise HTTPException(status_code=500, detail=f"Error clearing chat history: {str(e)}")


@router.get("/available-data")
async def get_available_data(session_id: str):
    """
    Get information about available data files for the session.
    
    Args:
        session_id: The session ID
        
    Returns:
        Data context information
    """
    try:
        if not session_id:
            raise HTTPException(status_code=400, detail="Session ID is required")
        
        client = get_gemini_client()
        data_context = client.get_data_context(session_id)
        
        return {
            "success": True,
            "data_context": data_context,
            "session_id": session_id
        }
        
    except Exception as e:
        logger.error(f"Error getting available data: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting available data: {str(e)}")


@router.get("/status")
async def get_agent_status():
    """
    Get the status of the AI agent service.
    
    Returns:
        Service status and configuration info
    """
    try:
        client = get_gemini_client()
        
        return {
            "success": True,
            "configured": client.is_configured,
            "model": "gemini-2.0-flash-exp" if client.is_configured else None,
            "active_sessions": len(client.chat_sessions)
        }
        
    except Exception as e:
        return {
            "success": False,
            "configured": False,
            "error": str(e)
        }
