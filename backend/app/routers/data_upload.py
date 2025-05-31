from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from fastapi.responses import JSONResponse
import pandas as pd
import numpy as np
import io
import os
import uuid
from typing import List, Optional, Dict, Any
import json

from ..utils.session_manager import create_session, get_session_data, add_file_to_session, set_active_file, remove_file_from_session
from ..utils.file_handler import save_dataframe, get_dataframe, list_files, get_file_metadata, delete_file, rename_file

router = APIRouter()

@router.post("/")
async def upload_file(
    file: UploadFile = File(...),
    session_id: Optional[str] = Form(None)
):
    """
    Upload a CSV or Excel file and return basic information about the data.
    """
    # Check file extension
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only CSV and Excel files are supported")

    try:
        # Read the file content
        contents = await file.read()

        # Parse the file based on its extension
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))

        # Create a new session or use existing one
        if not session_id:
            session_id = create_session()

        # Save the dataframe with multi-file support
        file_id = save_dataframe(df, session_id, file.filename)

        if not file_id:
            raise HTTPException(status_code=500, detail="Failed to save file")

        # Add file to session tracking
        add_file_to_session(session_id, file_id)

        # Generate basic data summary
        summary = {
            "session_id": session_id,
            "file_id": file_id,
            "filename": file.filename,
            "rows": len(df),
            "columns": len(df.columns),
            "column_names": df.columns.tolist(),
            "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
            "preview": df.head(5).replace({np.nan: None}).to_dict(orient="records")
        }

        return JSONResponse(content=summary)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@router.get("/files")
async def list_session_files(session_id: str):
    """
    List all files in a session.
    """
    try:
        files = list_files(session_id)
        return JSONResponse(content={"files": files})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing files: {str(e)}")

@router.post("/files/select")
async def select_active_file(session_id: str = Form(...), file_id: str = Form(...)):
    """
    Set the active file for a session.
    """
    try:
        success = set_active_file(session_id, file_id)
        if success:
            return JSONResponse(content={"message": "Active file set successfully"})
        else:
            raise HTTPException(status_code=404, detail="Session not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error setting active file: {str(e)}")

@router.delete("/files/{file_id}")
async def delete_session_file(file_id: str, session_id: str):
    """
    Delete a specific file from a session.
    """
    try:
        # Delete from file storage
        file_deleted = delete_file(session_id, file_id)
        # Remove from session tracking
        session_updated = remove_file_from_session(session_id, file_id)

        if file_deleted and session_updated:
            return JSONResponse(content={"message": "File deleted successfully"})
        else:
            raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting file: {str(e)}")

@router.put("/files/{file_id}/rename")
async def rename_session_file(file_id: str, session_id: str = Form(...), new_filename: str = Form(...)):
    """
    Rename a file in a session.
    """
    try:
        success = rename_file(session_id, file_id, new_filename)
        if success:
            return JSONResponse(content={"message": "File renamed successfully"})
        else:
            raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error renaming file: {str(e)}")

@router.get("/files/{file_id}/metadata")
async def get_file_info(file_id: str, session_id: str):
    """
    Get metadata for a specific file.
    """
    try:
        metadata = get_file_metadata(session_id, file_id)
        if metadata:
            return JSONResponse(content=metadata)
        else:
            raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting file metadata: {str(e)}")

@router.get("/sessions")
async def list_sessions():
    """
    List all available data sessions.
    """
    # Implementation would depend on your session storage mechanism
    # This is a placeholder
    return {"sessions": ["session1", "session2"]}  # Replace with actual implementation
