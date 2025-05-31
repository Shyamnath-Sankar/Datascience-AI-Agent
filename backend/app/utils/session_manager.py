import os
import uuid
import json
from typing import Dict, Any, Optional

# In-memory session storage (for simplicity)
# In a production environment, you would use a database
_sessions = {}

def create_session() -> str:
    """
    Create a new session and return the session ID.
    """
    session_id = str(uuid.uuid4())
    _sessions[session_id] = {
        "created_at": str(uuid.uuid1()),  # Use uuid1 for timestamp
        "data": {},
        "active_file_id": None,  # Track currently active file
        "files": []  # List of uploaded file IDs
    }
    return session_id

def get_session_data(session_id: str) -> Optional[Dict[str, Any]]:
    """
    Get data for a specific session.
    """
    if session_id in _sessions:
        return _sessions[session_id]
    return None

def update_session_data(session_id: str, key: str, value: Any) -> bool:
    """
    Update data for a specific session.
    """
    if session_id in _sessions:
        _sessions[session_id]["data"][key] = value
        return True
    return False

def delete_session(session_id: str) -> bool:
    """
    Delete a session.
    """
    if session_id in _sessions:
        del _sessions[session_id]
        return True
    return False

def set_active_file(session_id: str, file_id: str) -> bool:
    """
    Set the active file for a session.
    """
    if session_id in _sessions:
        _sessions[session_id]["active_file_id"] = file_id
        return True
    return False

def get_active_file_id(session_id: str) -> Optional[str]:
    """
    Get the active file ID for a session.
    """
    if session_id in _sessions:
        return _sessions[session_id].get("active_file_id")
    return None

def add_file_to_session(session_id: str, file_id: str) -> bool:
    """
    Add a file ID to the session's file list.
    """
    if session_id in _sessions:
        if file_id not in _sessions[session_id]["files"]:
            _sessions[session_id]["files"].append(file_id)
        # Set as active if it's the first file
        if _sessions[session_id]["active_file_id"] is None:
            _sessions[session_id]["active_file_id"] = file_id
        return True
    return False

def remove_file_from_session(session_id: str, file_id: str) -> bool:
    """
    Remove a file ID from the session's file list.
    """
    if session_id in _sessions:
        if file_id in _sessions[session_id]["files"]:
            _sessions[session_id]["files"].remove(file_id)
        # Clear active file if it was the deleted file
        if _sessions[session_id]["active_file_id"] == file_id:
            # Set to first available file or None
            files = _sessions[session_id]["files"]
            _sessions[session_id]["active_file_id"] = files[0] if files else None
        return True
    return False

def list_sessions() -> Dict[str, Any]:
    """
    List all sessions.
    """
    return {
        session_id: {
            "created_at": session["created_at"],
            "file_count": len(session.get("files", [])),
            "active_file_id": session.get("active_file_id")
        }
        for session_id, session in _sessions.items()
    }
