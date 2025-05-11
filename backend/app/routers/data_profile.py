from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, Dict, Any, List
import pandas as pd
import numpy as np
from ..utils.session_manager import get_session_data
from ..utils.file_handler import get_dataframe

router = APIRouter()

@router.get("/summary")
async def get_data_summary(session_id: str):
    """
    Get a comprehensive summary of the dataset.
    """
    try:
        df = get_dataframe(session_id)
        if df is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        # Basic statistics
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
        datetime_cols = df.select_dtypes(include=['datetime']).columns.tolist()
        
        # Calculate missing values
        missing_values = df.isnull().sum().to_dict()
        missing_percentage = (df.isnull().sum() / len(df) * 100).to_dict()
        
        # Calculate basic statistics for numeric columns
        numeric_stats = {}
        if numeric_cols:
            numeric_stats = df[numeric_cols].describe().to_dict()
        
        # Calculate value counts for categorical columns (top 5 values)
        categorical_stats = {}
        for col in categorical_cols:
            if df[col].nunique() < 20:  # Only for columns with reasonable number of unique values
                categorical_stats[col] = df[col].value_counts().head(5).to_dict()
        
        # Correlation matrix for numeric columns
        correlation = None
        if len(numeric_cols) > 1:
            correlation = df[numeric_cols].corr().to_dict()
        
        summary = {
            "session_id": session_id,
            "rows": len(df),
            "columns": len(df.columns),
            "column_names": df.columns.tolist(),
            "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
            "numeric_columns": numeric_cols,
            "categorical_columns": categorical_cols,
            "datetime_columns": datetime_cols,
            "missing_values": missing_values,
            "missing_percentage": missing_percentage,
            "numeric_statistics": numeric_stats,
            "categorical_statistics": categorical_stats,
            "correlation": correlation
        }
        
        return summary
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating data profile: {str(e)}")

@router.get("/column/{column_name}")
async def get_column_profile(session_id: str, column_name: str):
    """
    Get detailed profile for a specific column.
    """
    try:
        df = get_dataframe(session_id)
        if df is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        if column_name not in df.columns:
            raise HTTPException(status_code=404, detail=f"Column '{column_name}' not found")
        
        column_data = df[column_name]
        dtype = str(column_data.dtype)
        
        profile = {
            "name": column_name,
            "dtype": dtype,
            "missing_count": column_data.isnull().sum(),
            "missing_percentage": column_data.isnull().sum() / len(df) * 100,
            "unique_values": column_data.nunique()
        }
        
        # Add type-specific statistics
        if np.issubdtype(column_data.dtype, np.number):
            profile.update({
                "min": float(column_data.min()) if not pd.isna(column_data.min()) else None,
                "max": float(column_data.max()) if not pd.isna(column_data.max()) else None,
                "mean": float(column_data.mean()) if not pd.isna(column_data.mean()) else None,
                "median": float(column_data.median()) if not pd.isna(column_data.median()) else None,
                "std": float(column_data.std()) if not pd.isna(column_data.std()) else None,
                "histogram": column_data.value_counts(bins=10, sort=False).to_dict()
            })
        elif column_data.dtype == 'object' or column_data.dtype.name == 'category':
            # For categorical data, return value counts
            if column_data.nunique() < 50:  # Only if reasonable number of categories
                profile["value_counts"] = column_data.value_counts().head(20).to_dict()
        
        return profile
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating column profile: {str(e)}")
