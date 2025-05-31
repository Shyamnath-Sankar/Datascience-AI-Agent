import os
import pandas as pd
import numpy as np
import uuid
import joblib
from typing import Dict, Any, Optional, Union, List
from datetime import datetime

# In-memory storage for dataframes and models (for simplicity)
# In a production environment, you would use a database or file storage
_dataframes = {}  # Structure: {session_id: {file_id: dataframe}}
_file_metadata = {}  # Structure: {session_id: {file_id: metadata}}
_models = {}

# Create necessary directories
os.makedirs("data", exist_ok=True)
os.makedirs("models", exist_ok=True)

def save_dataframe(df: pd.DataFrame, session_id: str, filename: str = None, file_id: str = None) -> str:
    """
    Save a dataframe for a specific session with multi-file support.
    Returns the file_id of the saved dataframe.
    """
    try:
        # Generate file_id if not provided
        if not file_id:
            file_id = str(uuid.uuid4())

        # Initialize session storage if needed
        if session_id not in _dataframes:
            _dataframes[session_id] = {}
            _file_metadata[session_id] = {}

        # Save dataframe
        _dataframes[session_id][file_id] = df.copy()

        # Save metadata
        _file_metadata[session_id][file_id] = {
            "filename": filename or f"file_{file_id[:8]}",
            "upload_timestamp": datetime.now().isoformat(),
            "rows": len(df),
            "columns": len(df.columns),
            "column_names": df.columns.tolist(),
            "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
            "file_id": file_id
        }

        return file_id
    except Exception as e:
        print(f"Error saving dataframe: {str(e)}")
        return None

def get_dataframe(session_id: str, file_id: str = None) -> Optional[pd.DataFrame]:
    """
    Get a dataframe for a specific session and file.
    If file_id is None, returns the first available dataframe (backward compatibility).
    """
    if session_id not in _dataframes:
        return None

    session_files = _dataframes[session_id]

    if not session_files:
        return None

    if file_id is None:
        # Return first available file for backward compatibility
        file_id = list(session_files.keys())[0]

    if file_id in session_files:
        return session_files[file_id].copy()

    return None

def list_files(session_id: str) -> List[Dict[str, Any]]:
    """
    List all files for a specific session.
    """
    if session_id not in _file_metadata:
        return []

    return list(_file_metadata[session_id].values())

def get_file_metadata(session_id: str, file_id: str) -> Optional[Dict[str, Any]]:
    """
    Get metadata for a specific file.
    """
    if session_id in _file_metadata and file_id in _file_metadata[session_id]:
        return _file_metadata[session_id][file_id].copy()
    return None

def delete_file(session_id: str, file_id: str) -> bool:
    """
    Delete a specific file from a session.
    """
    try:
        if session_id in _dataframes and file_id in _dataframes[session_id]:
            del _dataframes[session_id][file_id]

        if session_id in _file_metadata and file_id in _file_metadata[session_id]:
            del _file_metadata[session_id][file_id]

        return True
    except Exception as e:
        print(f"Error deleting file: {str(e)}")
        return False

def rename_file(session_id: str, file_id: str, new_filename: str) -> bool:
    """
    Rename a file in a session.
    """
    try:
        if session_id in _file_metadata and file_id in _file_metadata[session_id]:
            _file_metadata[session_id][file_id]["filename"] = new_filename
            return True
        return False
    except Exception as e:
        print(f"Error renaming file: {str(e)}")
        return False

def get_combined_dataframe(session_id: str, file_ids: List[str] = None) -> Optional[pd.DataFrame]:
    """
    Combine multiple dataframes from a session.
    If file_ids is None, combines all files in the session.
    """
    try:
        if session_id not in _dataframes:
            return None

        session_files = _dataframes[session_id]

        if not session_files:
            return None

        if file_ids is None:
            file_ids = list(session_files.keys())

        dataframes = []
        for file_id in file_ids:
            if file_id in session_files:
                df = session_files[file_id].copy()
                # Add source file column
                df['_source_file'] = _file_metadata[session_id][file_id]["filename"]
                dataframes.append(df)

        if not dataframes:
            return None

        # Combine dataframes
        combined_df = pd.concat(dataframes, ignore_index=True, sort=False)
        return combined_df

    except Exception as e:
        print(f"Error combining dataframes: {str(e)}")
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
