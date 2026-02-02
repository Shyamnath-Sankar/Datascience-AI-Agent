from fastapi import APIRouter, HTTPException, Body, Query
from typing import Optional, Dict, Any, List, Union
import pandas as pd
import numpy as np
from ..utils.session_manager import get_session_data, get_active_file_id
from ..utils.file_handler import get_dataframe, save_dataframe

router = APIRouter()

@router.get("/data")
async def get_data_for_editing(
    session_id: str,
    file_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000)
):
    """
    Get paginated data for editing with metadata.
    """
    try:
        # Get file_id from session if not provided
        if file_id is None:
            file_id = get_active_file_id(session_id)
        
        df = get_dataframe(session_id, file_id)
        if df is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        # Calculate pagination
        total_rows = len(df)
        start_idx = (page - 1) * page_size
        end_idx = min(start_idx + page_size, total_rows)
        
        # Get paginated data
        paginated_df = df.iloc[start_idx:end_idx]
        
        # Convert to records with row indices
        data_records = []
        for i, (idx, row) in enumerate(paginated_df.iterrows()):
            actual_row_index = start_idx + i
            record = {"_row_index": actual_row_index}
            for col in df.columns:
                value = row[col]
                # Handle NaN and other special values
                if pd.isna(value):
                    record[col] = None
                elif isinstance(value, (np.integer, np.floating)):
                    record[col] = float(value) if np.isfinite(value) else None
                else:
                    record[col] = str(value)
            data_records.append(record)
        
        return {
            "data": data_records,
            "columns": df.columns.tolist(),
            "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
            "total_rows": total_rows,
            "page": page,
            "page_size": page_size,
            "total_pages": (total_rows + page_size - 1) // page_size,
            "start_row": start_idx,
            "end_row": end_idx - 1
        }
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"DEBUG ERROR in get_data_for_editing: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving data: {str(e)}")

@router.put("/cell")
async def update_cell(
    session_id: str,
    cell_update: Dict[str, Any] = Body(...)
):
    """
    Update a single cell value.
    Expected body: {
        "file_id": "optional_file_id",
        "row_index": 0,
        "column": "column_name",
        "value": "new_value"
    }
    """
    try:
        file_id = cell_update.get("file_id")
        if file_id is None:
            file_id = get_active_file_id(session_id)
        
        df = get_dataframe(session_id, file_id)
        if df is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        row_index = cell_update.get("row_index")
        column = cell_update.get("column")
        new_value = cell_update.get("value")
        
        # Validate inputs
        if row_index is None or column is None:
            raise HTTPException(status_code=400, detail="row_index and column are required")
        
        if row_index < 0 or row_index >= len(df):
            raise HTTPException(status_code=400, detail="Invalid row_index")
        
        if column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Column '{column}' not found")
        
        # Convert value to appropriate type
        original_dtype = df[column].dtype
        try:
            if pd.api.types.is_numeric_dtype(original_dtype):
                if new_value is None or new_value == "":
                    converted_value = np.nan
                else:
                    converted_value = pd.to_numeric(new_value)
            elif pd.api.types.is_datetime64_any_dtype(original_dtype):
                if new_value is None or new_value == "":
                    converted_value = pd.NaT
                else:
                    converted_value = pd.to_datetime(new_value)
            else:
                converted_value = str(new_value) if new_value is not None else None
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail=f"Cannot convert '{new_value}' to {original_dtype}")
        
        # Update the cell
        df.iloc[row_index, df.columns.get_loc(column)] = converted_value
        
        # Save the updated dataframe
        save_dataframe(df, session_id, file_id=file_id)
        
        return {
            "message": "Cell updated successfully",
            "row_index": row_index,
            "column": column,
            "old_value": str(df.iloc[row_index, df.columns.get_loc(column)]) if not pd.isna(df.iloc[row_index, df.columns.get_loc(column)]) else None,
            "new_value": str(converted_value) if not pd.isna(converted_value) else None
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating cell: {str(e)}")

@router.post("/row")
async def add_row(
    session_id: str,
    row_data: Dict[str, Any] = Body(...)
):
    """
    Add a new row to the dataset.
    Expected body: {
        "file_id": "optional_file_id",
        "data": {"column1": "value1", "column2": "value2", ...},
        "position": "end" or row_index
    }
    """
    try:
        file_id = row_data.get("file_id")
        if file_id is None:
            file_id = get_active_file_id(session_id)
        
        df = get_dataframe(session_id, file_id)
        if df is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        new_row_data = row_data.get("data", {})
        position = row_data.get("position", "end")
        
        # Create new row with default values
        new_row = {}
        for col in df.columns:
            if col in new_row_data:
                new_row[col] = new_row_data[col]
            else:
                # Use appropriate default value based on column type
                if pd.api.types.is_numeric_dtype(df[col]):
                    new_row[col] = np.nan
                else:
                    new_row[col] = None
        
        # Convert to DataFrame row
        new_row_df = pd.DataFrame([new_row])
        
        # Insert at specified position
        if position == "end":
            df = pd.concat([df, new_row_df], ignore_index=True)
        else:
            try:
                pos = int(position)
                if pos < 0 or pos > len(df):
                    raise HTTPException(status_code=400, detail="Invalid position")
                
                # Split dataframe and insert new row
                df_before = df.iloc[:pos]
                df_after = df.iloc[pos:]
                df = pd.concat([df_before, new_row_df, df_after], ignore_index=True)
            except (ValueError, TypeError):
                raise HTTPException(status_code=400, detail="Position must be 'end' or a valid row index")
        
        # Save the updated dataframe
        save_dataframe(df, session_id, file_id=file_id)
        
        return {
            "message": "Row added successfully",
            "new_row_count": len(df),
            "inserted_at": len(df) - 1 if position == "end" else position
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding row: {str(e)}")

@router.delete("/row/{row_index}")
async def delete_row(
    session_id: str,
    row_index: int,
    file_id: Optional[str] = None
):
    """
    Delete a row from the dataset.
    """
    try:
        if file_id is None:
            file_id = get_active_file_id(session_id)
        
        df = get_dataframe(session_id, file_id)
        if df is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        if row_index < 0 or row_index >= len(df):
            raise HTTPException(status_code=400, detail="Invalid row_index")
        
        # Delete the row
        df = df.drop(df.index[row_index]).reset_index(drop=True)
        
        # Save the updated dataframe
        save_dataframe(df, session_id, file_id=file_id)
        
        return {
            "message": "Row deleted successfully",
            "deleted_row_index": row_index,
            "new_row_count": len(df)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting row: {str(e)}")

@router.post("/column")
async def add_column(
    session_id: str,
    column_data: Dict[str, Any] = Body(...)
):
    """
    Add a new column to the dataset.
    Expected body: {
        "file_id": "optional_file_id",
        "column_name": "new_column",
        "data_type": "string|number|boolean",
        "default_value": "default_value",
        "position": "end" or column_index
    }
    """
    try:
        file_id = column_data.get("file_id")
        if file_id is None:
            file_id = get_active_file_id(session_id)
        
        df = get_dataframe(session_id, file_id)
        if df is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        column_name = column_data.get("column_name")
        data_type = column_data.get("data_type", "string")
        default_value = column_data.get("default_value")
        position = column_data.get("position", "end")
        
        if not column_name:
            raise HTTPException(status_code=400, detail="column_name is required")
        
        if column_name in df.columns:
            raise HTTPException(status_code=400, detail=f"Column '{column_name}' already exists")
        
        # Determine default value based on data type
        if default_value is None:
            if data_type == "number":
                default_value = np.nan
            elif data_type == "boolean":
                default_value = False
            else:
                default_value = None
        
        # Add the new column
        if position == "end":
            df[column_name] = default_value
        else:
            try:
                pos = int(position)
                if pos < 0 or pos > len(df.columns):
                    raise HTTPException(status_code=400, detail="Invalid position")
                
                # Insert column at specified position
                df.insert(pos, column_name, default_value)
            except (ValueError, TypeError):
                raise HTTPException(status_code=400, detail="Position must be 'end' or a valid column index")
        
        # Convert to appropriate dtype
        if data_type == "number":
            df[column_name] = pd.to_numeric(df[column_name], errors='coerce')
        elif data_type == "boolean":
            df[column_name] = df[column_name].astype(bool)
        else:
            df[column_name] = df[column_name].astype(str)
        
        # Save the updated dataframe
        save_dataframe(df, session_id, file_id=file_id)
        
        return {
            "message": "Column added successfully",
            "column_name": column_name,
            "new_column_count": len(df.columns),
            "position": len(df.columns) - 1 if position == "end" else position
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding column: {str(e)}")

@router.delete("/column/{column_name}")
async def delete_column(
    session_id: str,
    column_name: str,
    file_id: Optional[str] = None
):
    """
    Delete a column from the dataset.
    """
    try:
        if file_id is None:
            file_id = get_active_file_id(session_id)
        
        df = get_dataframe(session_id, file_id)
        if df is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        if column_name not in df.columns:
            raise HTTPException(status_code=400, detail=f"Column '{column_name}' not found")
        
        # Delete the column
        df = df.drop(columns=[column_name])
        
        # Save the updated dataframe
        save_dataframe(df, session_id, file_id=file_id)
        
        return {
            "message": "Column deleted successfully",
            "deleted_column": column_name,
            "new_column_count": len(df.columns)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting column: {str(e)}")
