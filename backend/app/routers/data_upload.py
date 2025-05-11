from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from fastapi.responses import JSONResponse
import pandas as pd
import numpy as np
import io
import os
import uuid
from typing import List, Optional, Dict, Any
import json

from ..utils.session_manager import create_session, get_session_data
from ..utils.file_handler import save_dataframe, get_dataframe

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
        
        # Save the dataframe
        save_dataframe(df, session_id)
        
        # Generate basic data summary
        summary = {
            "session_id": session_id,
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

@router.get("/sessions")
async def list_sessions():
    """
    List all available data sessions.
    """
    # Implementation would depend on your session storage mechanism
    # This is a placeholder
    return {"sessions": ["session1", "session2"]}  # Replace with actual implementation
