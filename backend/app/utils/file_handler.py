import os
import pandas as pd
import numpy as np
import uuid
import joblib
from typing import Dict, Any, Optional, Union

# In-memory storage for dataframes and models (for simplicity)
# In a production environment, you would use a database or file storage
_dataframes = {}
_models = {}

# Create necessary directories
os.makedirs("data", exist_ok=True)
os.makedirs("models", exist_ok=True)

def save_dataframe(df: pd.DataFrame, session_id: str) -> bool:
    """
    Save a dataframe for a specific session.
    """
    try:
        _dataframes[session_id] = df.copy()
        return True
    except Exception as e:
        print(f"Error saving dataframe: {str(e)}")
        return False

def get_dataframe(session_id: str) -> Optional[pd.DataFrame]:
    """
    Get a dataframe for a specific session.
    """
    if session_id in _dataframes:
        return _dataframes[session_id].copy()
    return None

def save_model(model: Any, session_id: str, model_type: str) -> str:
    """
    Save a trained model.
    """
    try:
        model_id = f"{session_id}_{model_type}_{str(uuid.uuid4())[:8]}"
        _models[model_id] = model
        
        # Save to disk as well (optional)
        model_path = os.path.join("models", f"{model_id}.joblib")
        joblib.dump(model, model_path)
        
        return model_id
    except Exception as e:
        print(f"Error saving model: {str(e)}")
        return None

def get_model(model_id: str) -> Any:
    """
    Get a trained model.
    """
    if model_id in _models:
        return _models[model_id]
    
    # Try to load from disk if not in memory
    model_path = os.path.join("models", f"{model_id}.joblib")
    if os.path.exists(model_path):
        try:
            model = joblib.load(model_path)
            _models[model_id] = model  # Cache in memory
            return model
        except Exception as e:
            print(f"Error loading model from disk: {str(e)}")
    
    return None

def delete_model(model_id: str) -> bool:
    """
    Delete a trained model.
    """
    if model_id in _models:
        del _models[model_id]
        
        # Delete from disk as well
        model_path = os.path.join("models", f"{model_id}.joblib")
        if os.path.exists(model_path):
            os.remove(model_path)
        
        return True
    return False

def list_models(session_id: Optional[str] = None) -> Dict[str, Any]:
    """
    List all models, optionally filtered by session_id.
    """
    if session_id:
        return {
            model_id: model
            for model_id, model in _models.items()
            if model_id.startswith(session_id)
        }
    return _models
