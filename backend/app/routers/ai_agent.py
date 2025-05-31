from fastapi import APIRouter, HTTPException, Body
from typing import Optional, Dict, Any, List
import json
from ..utils.gemini_client import gemini_client
from ..utils.code_executor import code_executor
from ..utils.session_manager import get_session_data, get_active_file_id

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
    """
    try:
        # Use active file if no specific file_id provided
        if file_id is None:
            file_id = get_active_file_id(session_id)

        # Generate response using Gemini
        ai_response = gemini_client.generate_response(session_id, message, file_id)

        # Prepare the response
        response_data = {
            "success": True,
            "response": ai_response["response"],
            "code_blocks": ai_response["code_blocks"],
            "has_code": ai_response.get("has_code", False),
            "session_id": session_id,
            "file_id": file_id,
            "execution_result": None
        }

        # Auto-execute code if there are Python code blocks and auto_execute is True
        if auto_execute and ai_response.get("has_code", False) and ai_response["code_blocks"]:
            python_blocks = [block for block in ai_response["code_blocks"] if block["language"] == "python"]
            if python_blocks:
                # Execute the first Python code block
                code_to_execute = python_blocks[0]["code"]
                execution_result = code_executor.execute_code(code_to_execute, session_id, file_id)
                response_data["execution_result"] = execution_result
                response_data["executed_code"] = code_to_execute

        return response_data

    except Exception as e:
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
    """
    try:
        # Use active file if no specific file_id provided
        if file_id is None:
            file_id = get_active_file_id(session_id)
        
        # Check for required packages and install if needed
        if auto_install:
            required_packages = code_executor.check_required_packages(code)
            installation_results = []
            
            for package in required_packages:
                install_result = code_executor.install_package(package)
                installation_results.append({
                    "package": package,
                    "success": install_result["success"],
                    "message": install_result["message"]
                })
        else:
            installation_results = []
        
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
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error executing code: {str(e)}")

@router.post("/install-package")
async def install_package(
    package_name: str = Body(..., embed=True)
):
    """
    Install a Python package.
    """
    try:
        result = code_executor.install_package(package_name)
        
        return {
            "success": result["success"],
            "message": result["message"],
            "output": result.get("output", ""),
            "error": result.get("error", "")
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error installing package: {str(e)}")

@router.post("/generate-insights")
async def generate_insights(
    session_id: str,
    file_id: Optional[str] = Body(None, embed=True)
):
    """
    Generate automatic insights about the dataset.
    """
    try:
        # Use active file if no specific file_id provided
        if file_id is None:
            file_id = get_active_file_id(session_id)
        
        # Generate insights using Gemini
        insights = gemini_client.generate_insights(session_id, file_id)
        
        return {
            "success": True,
            "insights": insights["insights"],
            "code_blocks": insights["code_blocks"],
            "session_id": session_id,
            "file_id": file_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating insights: {str(e)}")

@router.get("/chat-history")
async def get_chat_history(session_id: str):
    """
    Get chat history for a session.
    """
    try:
        # Check if chat session exists
        if session_id in gemini_client.chat_sessions:
            chat = gemini_client.chat_sessions[session_id]
            
            # Extract history from chat session
            history = []
            for message in chat.history:
                history.append({
                    "role": message.role,
                    "content": message.parts[0].text if message.parts else ""
                })
            
            return {
                "success": True,
                "history": history,
                "session_id": session_id
            }
        else:
            return {
                "success": True,
                "history": [],
                "session_id": session_id
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting chat history: {str(e)}")

@router.delete("/clear-chat")
async def clear_chat_history(session_id: str):
    """
    Clear chat history for a session.
    """
    try:
        if session_id in gemini_client.chat_sessions:
            del gemini_client.chat_sessions[session_id]
        
        return {
            "success": True,
            "message": "Chat history cleared",
            "session_id": session_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing chat history: {str(e)}")

@router.get("/available-data")
async def get_available_data(session_id: str):
    """
    Get information about available data files for the session.
    """
    try:
        # Get data context
        data_context = gemini_client.get_data_context(session_id)
        
        return {
            "success": True,
            "data_context": data_context,
            "session_id": session_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting available data: {str(e)}")
