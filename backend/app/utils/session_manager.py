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
        "data": {}
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

def list_sessions() -> Dict[str, Any]:
    """
    List all sessions.
    """
    return {
        session_id: {
            "created_at": session["created_at"]
        }
        for session_id, session in _sessions.items()
    }
