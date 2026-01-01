"""
Data Visualization Router for the Data Science Platform.
Provides endpoints for generating chart data and visualization recommendations.
"""

from fastapi import APIRouter, HTTPException, Depends, Body
from typing import Optional, Dict, Any, List
import pandas as pd
import numpy as np
import json
import logging

from ..utils.session_manager import get_session_data, get_active_file_id
from ..utils.file_handler import get_dataframe

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()


class ChartRecommender:
    """Recommends appropriate chart types based on data characteristics."""
    
    @staticmethod
    def recommend_charts(df: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Recommend chart types based on the dataset characteristics.
        
        Args:
            df: The pandas DataFrame
            
        Returns:
            List of recommended charts with reasons
        """
        recommendations = []
        
        # Identify column types
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
        datetime_cols = df.select_dtypes(include=['datetime64']).columns.tolist()
        
        num_numeric = len(numeric_cols)
        num_categorical = len(categorical_cols)
        num_datetime = len(datetime_cols)
        
        # Recommend based on data types
        if num_numeric >= 1:
            recommendations.append({
                "chart_type": "histogram",
                "priority": "high",
                "reason": "Understand the distribution of numeric values",
                "suggested_columns": numeric_cols[:3],
                "description": "Shows how values are distributed across different ranges"
            })
        
        if num_numeric >= 2:
            recommendations.append({
                "chart_type": "scatter",
                "priority": "high",
                "reason": "Find relationships between numeric variables",
                "suggested_columns": numeric_cols[:2],
                "description": "Helps identify correlations and patterns between two variables"
            })
            
            recommendations.append({
                "chart_type": "heatmap",
                "priority": "medium",
                "reason": "View correlations between all numeric variables",
                "suggested_columns": numeric_cols,
                "description": "Shows strength of relationships between multiple variables"
            })
        
        if num_categorical >= 1 and num_numeric >= 1:
            recommendations.append({
                "chart_type": "bar",
                "priority": "high",
                "reason": "Compare values across categories",
                "suggested_columns": {"x": categorical_cols[0], "y": numeric_cols[0]},
                "description": "Best for comparing quantities across different groups"
            })
            
            recommendations.append({
                "chart_type": "pie",
                "priority": "medium",
                "reason": "Show proportions of a whole",
                "suggested_columns": {"labels": categorical_cols[0], "values": numeric_cols[0]},
                "description": "Shows how parts contribute to the whole"
            })
        
        if num_datetime >= 1 and num_numeric >= 1:
            recommendations.append({
                "chart_type": "line",
                "priority": "high",
                "reason": "Track changes over time",
                "suggested_columns": {"x": datetime_cols[0], "y": numeric_cols[0]},
                "description": "Best for showing trends and patterns over time"
            })
        
        if num_numeric >= 1 and num_categorical >= 1:
            recommendations.append({
                "chart_type": "box",
                "priority": "medium",
                "reason": "Compare distributions across categories",
                "suggested_columns": {"x": categorical_cols[0], "y": numeric_cols[0]},
                "description": "Shows distribution, median, and outliers for each category"
            })
        
        # Sort by priority
        priority_order = {"high": 0, "medium": 1, "low": 2}
        recommendations.sort(key=lambda x: priority_order.get(x["priority"], 2))
        
        return recommendations


@router.post("/chart-data")
async def generate_chart_data(
    session_id: str,
    chart_params: Dict[str, Any] = Body(...)
):
    """
    Generate data for various chart types.
    
    Args:
        session_id: The session ID
        chart_params: Parameters for chart generation including:
            - chart_type: Type of chart (bar, line, scatter, pie, histogram, heatmap, box)
            - x_column: Column for X axis
            - y_columns: Column(s) for Y axis
            - group_by: Optional grouping column
            - aggregation: Aggregation method (mean, sum, count, min, max)
            - bins: Number of bins for histogram
            
    Returns:
        Chart data formatted for the frontend
    """
    try:
        # Get the active file ID for the session
        active_file_id = get_active_file_id(session_id)
        
        # Get the dataframe for the active file
        df = get_dataframe(session_id, active_file_id)
        if df is None:
            raise HTTPException(
                status_code=404, 
                detail="Dataset not found or no active file selected"
            )
        
        # Extract parameters
        chart_type = chart_params.get("chart_type")
        x_column = chart_params.get("x_column")
        y_columns = chart_params.get("y_columns", [])
        group_by = chart_params.get("group_by")
        aggregation = chart_params.get("aggregation", "mean")
        bins = chart_params.get("bins", 10)
        
        # Ensure y_columns is a list
        if isinstance(y_columns, str):
            y_columns = [y_columns]
        
        # Validate parameters
        if not chart_type:
            raise HTTPException(status_code=400, detail="Chart type is required")
        
        # Validate columns exist
        if x_column and x_column not in df.columns:
            raise HTTPException(
                status_code=400, 
                detail=f"Column '{x_column}' not found. Available: {df.columns.tolist()}"
            )
        
        for col in y_columns:
            if col not in df.columns:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Column '{col}' not found. Available: {df.columns.tolist()}"
                )
        
        if group_by and group_by not in df.columns:
            raise HTTPException(
                status_code=400, 
                detail=f"Column '{group_by}' not found. Available: {df.columns.tolist()}"
            )
        
        # Generate chart data based on chart type
        chart_data = _generate_chart_data(
            df, chart_type, x_column, y_columns, group_by, aggregation, bins
        )
        
        return {
            "success": True,
            "chart_type": chart_type,
            "chart_data": chart_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating chart data: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating chart data: {str(e)}")


def _generate_chart_data(
    df: pd.DataFrame,
    chart_type: str,
    x_column: str,
    y_columns: List[str],
    group_by: Optional[str],
    aggregation: str,
    bins: int
) -> Dict[str, Any]:
    """Generate chart data based on chart type."""
    
    aggregation_funcs = {
        "mean": "mean",
        "sum": "sum",
        "count": "count",
        "min": "min",
        "max": "max",
        "median": "median",
        "std": "std"
    }
    
    agg_func = aggregation_funcs.get(aggregation, "mean")
    
    if chart_type in ["bar", "line"]:
        if not x_column or not y_columns:
            raise HTTPException(
                status_code=400, 
                detail="X column and Y columns are required for bar/line charts"
            )
        
        if group_by:
            # Grouped data
            result = {}
            for group_val, group_df in df.groupby(group_by):
                agg_data = group_df.groupby(x_column)[y_columns].agg(agg_func).reset_index()
                result[str(group_val)] = agg_data.to_dict(orient="records")
            return result
        else:
            # Aggregated data
            agg_data = df.groupby(x_column)[y_columns].agg(agg_func).reset_index()
            return {
                "x": agg_data[x_column].tolist(),
                "y": {col: agg_data[col].tolist() for col in y_columns}
            }
    
    elif chart_type == "scatter":
        if len(y_columns) < 1:
            raise HTTPException(
                status_code=400, 
                detail="At least one Y column is required for scatter plots"
            )
        
        if group_by:
            # Multiple series
            data = []
            for group_val, group_df in df.groupby(group_by):
                series = {
                    "x": group_df[x_column].dropna().tolist(),
                    "y": group_df[y_columns[0]].dropna().tolist(),
                    "name": f"{y_columns[0]} - {group_val}"
                }
                if len(y_columns) > 1:
                    series["size"] = group_df[y_columns[1]].dropna().tolist()
                data.append(series)
            return {"data": data}
        else:
            data = [{
                "x": df[x_column].dropna().tolist(),
                "y": df[y_columns[0]].dropna().tolist(),
                "name": y_columns[0]
            }]
            if len(y_columns) > 1:
                data[0]["size"] = df[y_columns[1]].dropna().tolist()
            return {"data": data}
    
    elif chart_type == "pie":
        if not x_column or len(y_columns) != 1:
            raise HTTPException(
                status_code=400, 
                detail="X column and exactly one Y column are required for pie charts"
            )
        
        agg_data = df.groupby(x_column)[y_columns[0]].agg(agg_func).reset_index()
        return {
            "labels": agg_data[x_column].tolist(),
            "values": agg_data[y_columns[0]].tolist()
        }
    
    elif chart_type == "histogram":
        if not y_columns or len(y_columns) != 1:
            raise HTTPException(
                status_code=400, 
                detail="Exactly one column is required for histograms"
            )
        
        column = y_columns[0]
        
        if pd.api.types.is_numeric_dtype(df[column]):
            hist, bin_edges = np.histogram(df[column].dropna(), bins=bins)
            return {
                "data": hist.tolist(),
                "bins": bin_edges.tolist(),
                "column": column
            }
        else:
            # Categorical histogram
            value_counts = df[column].value_counts()
            return {
                "labels": value_counts.index.tolist(),
                "values": value_counts.values.tolist(),
                "column": column
            }
    
    elif chart_type == "heatmap":
        if not y_columns or len(y_columns) < 2:
            raise HTTPException(
                status_code=400, 
                detail="At least two columns are required for heatmaps"
            )
        
        # Correlation matrix
        corr_matrix = df[y_columns].corr().round(3)
        return {
            "x": y_columns,
            "y": y_columns,
            "z": corr_matrix.values.tolist()
        }
    
    elif chart_type == "box":
        if not x_column or not y_columns or len(y_columns) != 1:
            raise HTTPException(
                status_code=400, 
                detail="X column and exactly one Y column are required for box plots"
            )
        
        box_data = []
        for category in df[x_column].dropna().unique():
            values = df[df[x_column] == category][y_columns[0]].dropna().tolist()
            if values:
                q1 = np.percentile(values, 25)
                median = np.percentile(values, 50)
                q3 = np.percentile(values, 75)
                iqr = q3 - q1
                whisker_low = max(min(values), q1 - 1.5 * iqr)
                whisker_high = min(max(values), q3 + 1.5 * iqr)
                outliers = [v for v in values if v < whisker_low or v > whisker_high]
                
                box_data.append({
                    "category": str(category),
                    "min": whisker_low,
                    "q1": q1,
                    "median": median,
                    "q3": q3,
                    "max": whisker_high,
                    "outliers": outliers
                })
        
        return {"data": box_data}
    
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported chart type: {chart_type}")


@router.get("/available-charts")
async def get_available_charts(session_id: str):
    """
    Get information about available chart types based on the dataset.
    
    Args:
        session_id: The session ID
        
    Returns:
        Available chart types with column recommendations
    """
    try:
        active_file_id = get_active_file_id(session_id)
        df = get_dataframe(session_id, active_file_id)
        
        if df is None:
            raise HTTPException(
                status_code=404, 
                detail="Dataset not found or no active file selected"
            )
        
        # Identify column types
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
        datetime_cols = df.select_dtypes(include=['datetime64']).columns.tolist()
        
        # Determine suitable chart types
        available_charts = []
        
        if len(numeric_cols) >= 1 and len(categorical_cols) >= 1:
            available_charts.extend(["bar", "line"])
        
        if len(numeric_cols) >= 2:
            available_charts.extend(["scatter", "heatmap"])
        
        if len(numeric_cols) >= 1:
            available_charts.append("histogram")
        
        if len(categorical_cols) >= 1 and len(numeric_cols) >= 1:
            available_charts.extend(["pie", "box"])
        
        return {
            "success": True,
            "available_charts": list(set(available_charts)),
            "numeric_columns": numeric_cols,
            "categorical_columns": categorical_cols,
            "datetime_columns": datetime_cols,
            "total_rows": len(df),
            "total_columns": len(df.columns)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error determining available charts: {e}")
        raise HTTPException(status_code=500, detail=f"Error determining available charts: {str(e)}")


@router.get("/chart-recommendations")
async def get_chart_recommendations(session_id: str):
    """
    Get AI-powered chart recommendations based on the dataset.
    
    Args:
        session_id: The session ID
        
    Returns:
        List of recommended charts with reasons and suggested columns
    """
    try:
        active_file_id = get_active_file_id(session_id)
        df = get_dataframe(session_id, active_file_id)
        
        if df is None:
            raise HTTPException(
                status_code=404, 
                detail="Dataset not found or no active file selected"
            )
        
        recommendations = ChartRecommender.recommend_charts(df)
        
        return {
            "success": True,
            "recommendations": recommendations,
            "dataset_info": {
                "rows": len(df),
                "columns": len(df.columns),
                "numeric_columns": df.select_dtypes(include=[np.number]).columns.tolist(),
                "categorical_columns": df.select_dtypes(include=['object', 'category']).columns.tolist()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating chart recommendations: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating chart recommendations: {str(e)}")


@router.get("/quick-stats")
async def get_quick_stats(session_id: str, column: Optional[str] = None):
    """
    Get quick statistics for visualization purposes.
    
    Args:
        session_id: The session ID
        column: Optional specific column to get stats for
        
    Returns:
        Quick statistics for the dataset or column
    """
    try:
        active_file_id = get_active_file_id(session_id)
        df = get_dataframe(session_id, active_file_id)
        
        if df is None:
            raise HTTPException(
                status_code=404, 
                detail="Dataset not found or no active file selected"
            )
        
        if column:
            if column not in df.columns:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Column '{column}' not found"
                )
            
            col_data = df[column]
            
            if pd.api.types.is_numeric_dtype(col_data):
                return {
                    "success": True,
                    "column": column,
                    "type": "numeric",
                    "stats": {
                        "mean": float(col_data.mean()) if not pd.isna(col_data.mean()) else None,
                        "median": float(col_data.median()) if not pd.isna(col_data.median()) else None,
                        "std": float(col_data.std()) if not pd.isna(col_data.std()) else None,
                        "min": float(col_data.min()) if not pd.isna(col_data.min()) else None,
                        "max": float(col_data.max()) if not pd.isna(col_data.max()) else None,
                        "missing": int(col_data.isna().sum()),
                        "unique": int(col_data.nunique())
                    }
                }
            else:
                value_counts = col_data.value_counts().head(10)
                return {
                    "success": True,
                    "column": column,
                    "type": "categorical",
                    "stats": {
                        "unique": int(col_data.nunique()),
                        "missing": int(col_data.isna().sum()),
                        "top_values": value_counts.to_dict()
                    }
                }
        else:
            # Overall dataset stats
            return {
                "success": True,
                "dataset": {
                    "rows": len(df),
                    "columns": len(df.columns),
                    "memory_mb": round(df.memory_usage(deep=True).sum() / (1024 * 1024), 2),
                    "missing_total": int(df.isna().sum().sum()),
                    "numeric_columns": len(df.select_dtypes(include=[np.number]).columns),
                    "categorical_columns": len(df.select_dtypes(include=['object', 'category']).columns)
                }
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting quick stats: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting quick stats: {str(e)}")
