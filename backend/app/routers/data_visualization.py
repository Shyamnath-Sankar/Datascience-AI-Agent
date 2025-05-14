from fastapi import APIRouter, HTTPException, Depends, Body
from typing import Optional, Dict, Any, List
import pandas as pd
import numpy as np
import json
from ..utils.session_manager import get_session_data
from ..utils.file_handler import get_dataframe

router = APIRouter()

@router.post("/chart-data")
async def generate_chart_data(
    session_id: str,
    chart_params: Dict[str, Any] = Body(...)
):
    """
    Generate data for various chart types.
    """
    try:
        df = get_dataframe(session_id)
        if df is None:
            raise HTTPException(status_code=404, detail="Dataset not found")

        # Extract parameters
        chart_type = chart_params.get("chart_type")
        x_column = chart_params.get("x_column")
        y_columns = chart_params.get("y_columns", [])
        group_by = chart_params.get("group_by")
        aggregation = chart_params.get("aggregation", "mean")

        # Validate parameters
        if not chart_type:
            raise HTTPException(status_code=400, detail="Chart type is required")

        # Check if columns exist in the dataframe
        if x_column and x_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Column '{x_column}' not found in the dataset")

        for col in y_columns:
            if col not in df.columns:
                raise HTTPException(status_code=400, detail=f"Column '{col}' not found in the dataset")

        if group_by and group_by not in df.columns:
            raise HTTPException(status_code=400, detail=f"Column '{group_by}' not found in the dataset")

        # Generate chart data based on chart type
        chart_data = {}

        if chart_type == "bar" or chart_type == "line":
            if not x_column or not y_columns:
                raise HTTPException(status_code=400, detail="X column and Y columns are required for bar/line charts")

            # Group by if specified
            if group_by:
                result = {}
                for group_val, group_df in df.groupby(group_by):
                    if aggregation == "mean":
                        agg_data = group_df.groupby(x_column)[y_columns].mean().reset_index()
                    elif aggregation == "sum":
                        agg_data = group_df.groupby(x_column)[y_columns].sum().reset_index()
                    elif aggregation == "count":
                        agg_data = group_df.groupby(x_column)[y_columns].count().reset_index()
                    else:
                        agg_data = group_df.groupby(x_column)[y_columns].mean().reset_index()

                    result[str(group_val)] = agg_data.to_dict(orient="records")

                chart_data = result
            else:
                # No grouping, but we should still aggregate the data
                if aggregation == "mean":
                    agg_data = df.groupby(x_column)[y_columns].mean().reset_index()
                elif aggregation == "sum":
                    agg_data = df.groupby(x_column)[y_columns].sum().reset_index()
                elif aggregation == "count":
                    agg_data = df.groupby(x_column)[y_columns].count().reset_index()
                else:
                    agg_data = df.groupby(x_column)[y_columns].sum().reset_index()

                chart_data = {
                    "x": agg_data[x_column].tolist(),
                    "y": {col: agg_data[col].tolist() for col in y_columns}
                }

        elif chart_type == "scatter":
            if len(y_columns) < 1:
                raise HTTPException(status_code=400, detail="At least one Y column is required for scatter plots")

            # For scatter plots, we need x and y values
            chart_data = {
                "data": [
                    {
                        "x": df[x_column].tolist(),
                        "y": df[y_columns[0]].tolist(),
                        "name": y_columns[0]
                    }
                ]
            }

            # If we have a second y column, use it for point size
            if len(y_columns) > 1:
                chart_data["data"][0]["size"] = df[y_columns[1]].tolist()

            # If we have a group by, create multiple series
            if group_by:
                chart_data["data"] = []
                for group_val, group_df in df.groupby(group_by):
                    series = {
                        "x": group_df[x_column].tolist(),
                        "y": group_df[y_columns[0]].tolist(),
                        "name": f"{y_columns[0]} - {group_val}"
                    }
                    if len(y_columns) > 1:
                        series["size"] = group_df[y_columns[1]].tolist()

                    chart_data["data"].append(series)

        elif chart_type == "pie":
            if not x_column or not y_columns or len(y_columns) != 1:
                raise HTTPException(status_code=400, detail="X column and exactly one Y column are required for pie charts")

            # For pie charts, we need categories and values
            if aggregation == "mean":
                agg_data = df.groupby(x_column)[y_columns[0]].mean().reset_index()
            elif aggregation == "sum":
                agg_data = df.groupby(x_column)[y_columns[0]].sum().reset_index()
            elif aggregation == "count":
                agg_data = df.groupby(x_column)[y_columns[0]].count().reset_index()
            else:
                agg_data = df.groupby(x_column)[y_columns[0]].sum().reset_index()

            chart_data = {
                "labels": agg_data[x_column].tolist(),
                "values": agg_data[y_columns[0]].tolist()
            }

        elif chart_type == "histogram":
            if not y_columns or len(y_columns) != 1:
                raise HTTPException(status_code=400, detail="Exactly one column is required for histograms")

            # For histograms, we need the data and bin information
            column = y_columns[0]
            bins = chart_params.get("bins", 10)

            if pd.api.types.is_numeric_dtype(df[column]):
                hist, bin_edges = np.histogram(df[column].dropna(), bins=bins)
                chart_data = {
                    "data": hist.tolist(),
                    "bins": bin_edges.tolist()
                }
            else:
                # For categorical data, use value counts
                value_counts = df[column].value_counts()
                chart_data = {
                    "labels": value_counts.index.tolist(),
                    "values": value_counts.values.tolist()
                }

        elif chart_type == "heatmap":
            if not y_columns or len(y_columns) < 2:
                raise HTTPException(status_code=400, detail="At least two columns are required for heatmaps")

            # For heatmaps, we typically use correlation matrices
            corr_matrix = df[y_columns].corr().round(2)

            chart_data = {
                "x": y_columns,
                "y": y_columns,
                "z": corr_matrix.values.tolist()
            }

        else:
            raise HTTPException(status_code=400, detail=f"Unsupported chart type: {chart_type}")

        return {
            "chart_type": chart_type,
            "chart_data": chart_data
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating chart data: {str(e)}")

@router.get("/available-charts")
async def get_available_charts(session_id: str):
    """
    Get information about available chart types based on the dataset.
    """
    try:
        df = get_dataframe(session_id)
        if df is None:
            raise HTTPException(status_code=404, detail="Dataset not found")

        # Identify numeric and categorical columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()

        # Determine suitable chart types based on data types
        available_charts = []

        if len(numeric_cols) >= 1 and len(categorical_cols) >= 1:
            available_charts.extend(["bar", "line"])

        if len(numeric_cols) >= 2:
            available_charts.extend(["scatter", "heatmap"])

        if len(numeric_cols) >= 1:
            available_charts.append("histogram")

        if len(categorical_cols) >= 1 and len(numeric_cols) >= 1:
            available_charts.append("pie")

        return {
            "available_charts": available_charts,
            "numeric_columns": numeric_cols,
            "categorical_columns": categorical_cols
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error determining available charts: {str(e)}")
