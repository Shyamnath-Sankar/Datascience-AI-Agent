from fastapi import APIRouter, HTTPException, Depends, Body
from typing import Optional, Dict, Any, List
import pandas as pd
import numpy as np
from ..utils.session_manager import get_session_data
from ..utils.file_handler import get_dataframe, save_dataframe

router = APIRouter()

@router.post("/missing-values")
async def handle_missing_values(
    session_id: str,
    operations: Dict[str, Any] = Body(...)
):
    """
    Handle missing values in the dataset.
    Operations can include:
    - drop_rows: Drop rows with missing values
    - drop_columns: Drop columns with missing values
    - fill_mean: Fill missing values with mean
    - fill_median: Fill missing values with median
    - fill_mode: Fill missing values with mode
    - fill_value: Fill missing values with a specific value
    """
    try:
        df = get_dataframe(session_id)
        if df is None:
            raise HTTPException(status_code=404, detail="Dataset not found")

        # Make a copy to avoid modifying the original
        df_cleaned = df.copy()

        # Process each operation
        for operation, params in operations.items():
            if operation == "drop_rows":
                # Drop rows with missing values in specified columns
                columns = params.get("columns", None)
                if columns:
                    df_cleaned = df_cleaned.dropna(subset=columns)
                else:
                    df_cleaned = df_cleaned.dropna()

            elif operation == "drop_columns":
                # Drop columns with missing values exceeding threshold
                threshold = params.get("threshold", 0.5)  # Default: drop if 50% or more values are missing
                columns_to_drop = df_cleaned.columns[df_cleaned.isnull().mean() > threshold]
                df_cleaned = df_cleaned.drop(columns=columns_to_drop)

            elif operation == "fill_mean":
                # Fill missing values with mean for specified columns
                columns = params.get("columns", [])
                for col in columns:
                    if col in df_cleaned.columns and pd.api.types.is_numeric_dtype(df_cleaned[col]):
                        df_cleaned[col] = df_cleaned[col].fillna(df_cleaned[col].mean())

            elif operation == "fill_median":
                # Fill missing values with median for specified columns
                columns = params.get("columns", [])
                for col in columns:
                    if col in df_cleaned.columns and pd.api.types.is_numeric_dtype(df_cleaned[col]):
                        df_cleaned[col] = df_cleaned[col].fillna(df_cleaned[col].median())

            elif operation == "fill_mode":
                # Fill missing values with mode for specified columns
                columns = params.get("columns", [])
                for col in columns:
                    if col in df_cleaned.columns:
                        mode_value = df_cleaned[col].mode()[0] if not df_cleaned[col].mode().empty else None
                        if mode_value is not None:
                            df_cleaned[col] = df_cleaned[col].fillna(mode_value)

            elif operation == "fill_value":
                # Fill missing values with a specific value
                columns = params.get("columns", [])
                value = params.get("value")
                if value is not None:
                    for col in columns:
                        if col in df_cleaned.columns:
                            df_cleaned[col] = df_cleaned[col].fillna(value)

        # Save the cleaned dataframe
        save_dataframe(df_cleaned, session_id)

        # Return summary of changes
        return {
            "original_rows": len(df),
            "cleaned_rows": len(df_cleaned),
            "original_missing": df.isnull().sum().sum(),
            "cleaned_missing": df_cleaned.isnull().sum().sum(),
            "operations_applied": list(operations.keys())
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error handling missing values: {str(e)}")

@router.post("/outliers")
async def handle_outliers(
    session_id: str,
    operations: Dict[str, Any] = Body(...)
):
    """
    Handle outliers in the dataset.
    Operations can include:
    - z_score: Remove outliers based on Z-score
    - iqr: Remove outliers based on IQR
    - percentile: Remove outliers based on percentiles
    - clip: Clip values to min/max thresholds
    """
    try:
        df = get_dataframe(session_id)
        if df is None:
            raise HTTPException(status_code=404, detail="Dataset not found")

        # Make a copy to avoid modifying the original
        df_cleaned = df.copy()

        # Process each operation
        for operation, params in operations.items():
            columns = params.get("columns", [])

            if operation == "z_score":
                # Remove outliers based on Z-score
                threshold = params.get("threshold", 3.0)
                for col in columns:
                    if col in df_cleaned.columns and pd.api.types.is_numeric_dtype(df_cleaned[col]):
                        z_scores = np.abs((df_cleaned[col] - df_cleaned[col].mean()) / df_cleaned[col].std())
                        df_cleaned = df_cleaned[z_scores < threshold]

            elif operation == "iqr":
                # Remove outliers based on IQR
                factor = params.get("factor", 1.5)
                for col in columns:
                    if col in df_cleaned.columns and pd.api.types.is_numeric_dtype(df_cleaned[col]):
                        Q1 = df_cleaned[col].quantile(0.25)
                        Q3 = df_cleaned[col].quantile(0.75)
                        IQR = Q3 - Q1
                        lower_bound = Q1 - factor * IQR
                        upper_bound = Q3 + factor * IQR
                        df_cleaned = df_cleaned[(df_cleaned[col] >= lower_bound) & (df_cleaned[col] <= upper_bound)]

            elif operation == "percentile":
                # Remove outliers based on percentiles
                lower = params.get("lower", 0.01)
                upper = params.get("upper", 0.99)
                for col in columns:
                    if col in df_cleaned.columns and pd.api.types.is_numeric_dtype(df_cleaned[col]):
                        lower_bound = df_cleaned[col].quantile(lower)
                        upper_bound = df_cleaned[col].quantile(upper)
                        df_cleaned = df_cleaned[(df_cleaned[col] >= lower_bound) & (df_cleaned[col] <= upper_bound)]

            elif operation == "clip":
                # Clip values to min/max thresholds
                for col in columns:
                    if col in df_cleaned.columns and pd.api.types.is_numeric_dtype(df_cleaned[col]):
                        min_val = params.get("min")
                        max_val = params.get("max")
                        if min_val is not None and max_val is not None:
                            df_cleaned[col] = df_cleaned[col].clip(min_val, max_val)
                        elif min_val is not None:
                            df_cleaned[col] = df_cleaned[col].clip(lower=min_val)
                        elif max_val is not None:
                            df_cleaned[col] = df_cleaned[col].clip(upper=max_val)

        # Save the cleaned dataframe
        save_dataframe(df_cleaned, session_id)

        # Return summary of changes
        return {
            "original_rows": len(df),
            "cleaned_rows": len(df_cleaned),
            "rows_removed": len(df) - len(df_cleaned),
            "operations_applied": list(operations.keys())
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error handling outliers: {str(e)}")

@router.post("/transform")
async def transform_data(
    session_id: str,
    operations: Dict[str, Any] = Body(...)
):
    """
    Transform data in various ways.
    Operations can include:
    - normalize: Normalize data to [0,1] range
    - standardize: Standardize data (mean=0, std=1)
    - log_transform: Apply log transformation
    - one_hot_encode: One-hot encode categorical variables
    - bin: Bin continuous variables into categories
    """
    try:
        df = get_dataframe(session_id)
        if df is None:
            raise HTTPException(status_code=404, detail="Dataset not found")

        # Make a copy to avoid modifying the original
        df_transformed = df.copy()

        # Track transformations applied
        transformations_applied = []

        # Process each operation
        for operation, params in operations.items():
            columns = params.get("columns", [])

            if operation == "normalize":
                # Min-Max normalization to [0,1] range
                for col in columns:
                    if col in df_transformed.columns and pd.api.types.is_numeric_dtype(df_transformed[col]):
                        min_val = df_transformed[col].min()
                        max_val = df_transformed[col].max()
                        if max_val > min_val:  # Avoid division by zero
                            df_transformed[col] = (df_transformed[col] - min_val) / (max_val - min_val)
                transformations_applied.append("normalize")

            elif operation == "standardize":
                # Standardize to mean=0, std=1
                for col in columns:
                    if col in df_transformed.columns and pd.api.types.is_numeric_dtype(df_transformed[col]):
                        mean_val = df_transformed[col].mean()
                        std_val = df_transformed[col].std()
                        if std_val > 0:  # Avoid division by zero
                            df_transformed[col] = (df_transformed[col] - mean_val) / std_val
                transformations_applied.append("standardize")

            elif operation == "log_transform":
                # Apply log transformation (log(x+1) to handle zeros)
                for col in columns:
                    if col in df_transformed.columns and pd.api.types.is_numeric_dtype(df_transformed[col]):
                        # Check if all values are non-negative
                        if df_transformed[col].min() >= 0:
                            df_transformed[col] = np.log1p(df_transformed[col])
                transformations_applied.append("log_transform")

            elif operation == "one_hot_encode":
                # One-hot encode categorical variables
                for col in columns:
                    if col in df_transformed.columns and not pd.api.types.is_numeric_dtype(df_transformed[col]):
                        # Get one-hot encoded columns
                        one_hot = pd.get_dummies(df_transformed[col], prefix=col)

                        # Drop the original column
                        df_transformed = df_transformed.drop(columns=[col])

                        # Join the one-hot encoded columns
                        df_transformed = pd.concat([df_transformed, one_hot], axis=1)
                transformations_applied.append("one_hot_encode")

            elif operation == "bin":
                # Bin continuous variables into categories
                bins = params.get("bins", 5)
                for col in columns:
                    if col in df_transformed.columns and pd.api.types.is_numeric_dtype(df_transformed[col]):
                        # Create bin labels
                        labels = [f"{col}_bin_{i+1}" for i in range(bins)]

                        # Create a new column with binned values
                        df_transformed[f"{col}_binned"] = pd.cut(
                            df_transformed[col],
                            bins=bins,
                            labels=labels
                        )
                transformations_applied.append("bin")

        # Save the transformed dataframe
        save_dataframe(df_transformed, session_id)

        # Return summary of changes
        return {
            "rows": len(df_transformed),
            "columns_before": len(df.columns),
            "columns_after": len(df_transformed.columns),
            "transformations_applied": transformations_applied
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error transforming data: {str(e)}")
