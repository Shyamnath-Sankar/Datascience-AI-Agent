from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, Dict, Any, List
import pandas as pd
import numpy as np
from scipy import stats
from ..utils.session_manager import get_session_data, get_active_file_id
from ..utils.file_handler import get_dataframe

router = APIRouter()

@router.get("/summary")
async def get_data_summary(session_id: str, file_id: Optional[str] = None):
    """
    Get a comprehensive summary of the dataset.
    If file_id is not provided, uses the active file for the session.
    """
    try:
        # Get file_id from session if not provided
        if file_id is None:
            file_id = get_active_file_id(session_id)

        df = get_dataframe(session_id, file_id)
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
            "file_id": file_id,
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
async def get_column_profile(session_id: str, column_name: str, file_id: Optional[str] = None):
    """
    Get detailed profile for a specific column.
    If file_id is not provided, uses the active file for the session.
    """
    try:
        # Get file_id from session if not provided
        if file_id is None:
            file_id = get_active_file_id(session_id)

        df = get_dataframe(session_id, file_id)
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


# ==================== NEW ENHANCED ENDPOINTS ====================

@router.get("/auto-profile")
async def auto_profile(session_id: str, file_id: Optional[str] = None):
    """
    Generate comprehensive auto-profile including data quality metrics,
    distribution analysis, outlier detection, and recommendations.
    """
    try:
        if file_id is None:
            file_id = get_active_file_id(session_id)

        df = get_dataframe(session_id, file_id)
        if df is None:
            raise HTTPException(status_code=404, detail="Dataset not found")

        # Overview
        overview = {
            "n_rows": len(df),
            "n_columns": len(df.columns),
            "memory_usage_mb": float(df.memory_usage(deep=True).sum() / 1024 / 1024),
            "duplicate_rows": int(df.duplicated().sum()),
            "duplicate_pct": float(df.duplicated().sum() / len(df) * 100) if len(df) > 0 else 0,
            "columns_with_missing": int((df.isna().sum() > 0).sum()),
            "total_missing_values": int(df.isna().sum().sum())
        }

        # Column types
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
        
        # Data quality score (0-100)
        completeness = 1 - (df.isna().sum().sum() / df.size) if df.size > 0 else 1
        uniqueness = 1 - (df.duplicated().sum() / len(df)) if len(df) > 0 else 1
        data_quality_score = round((completeness * 0.7 + uniqueness * 0.3) * 100, 1)
        overview["data_quality_score"] = data_quality_score

        # Column details
        columns = {}
        for col in df.columns[:30]:  # Limit to first 30 columns
            col_data = df[col]
            col_info = {
                "dtype": str(col_data.dtype),
                "missing_count": int(col_data.isna().sum()),
                "missing_pct": float(col_data.isna().sum() / len(df) * 100),
                "unique_count": int(col_data.nunique())
            }
            
            if np.issubdtype(col_data.dtype, np.number):
                clean_data = col_data.dropna()
                if len(clean_data) > 0:
                    col_info.update({
                        "min": float(clean_data.min()),
                        "max": float(clean_data.max()),
                        "mean": float(clean_data.mean()),
                        "median": float(clean_data.median()),
                        "std": float(clean_data.std()),
                        "skewness": float(stats.skew(clean_data)),
                        "kurtosis": float(stats.kurtosis(clean_data))
                    })
                    
                    # Outlier detection (IQR method)
                    q1, q3 = clean_data.quantile(0.25), clean_data.quantile(0.75)
                    iqr = q3 - q1
                    outliers = clean_data[(clean_data < q1 - 1.5*iqr) | (clean_data > q3 + 1.5*iqr)]
                    col_info["outlier_count"] = len(outliers)
                    col_info["outlier_pct"] = float(len(outliers) / len(clean_data) * 100)
            
            columns[col] = col_info

        # Top correlations
        correlations = {}
        if len(numeric_cols) >= 2:
            corr_matrix = df[numeric_cols].corr()
            top_correlations = []
            for i in range(len(numeric_cols)):
                for j in range(i+1, len(numeric_cols)):
                    corr_val = corr_matrix.iloc[i, j]
                    if abs(corr_val) > 0.3:
                        top_correlations.append({
                            "column1": numeric_cols[i],
                            "column2": numeric_cols[j],
                            "correlation": float(corr_val)
                        })
            top_correlations.sort(key=lambda x: abs(x['correlation']), reverse=True)
            correlations["top_pairs"] = top_correlations[:10]

        # Generate insights
        insights = []
        if overview["duplicate_pct"] > 1:
            insights.append(f"⚠️ {overview['duplicate_pct']:.1f}% duplicate rows detected")
        if overview["columns_with_missing"] > 0:
            insights.append(f"⚠️ {overview['columns_with_missing']} columns have missing values")
        if data_quality_score >= 90:
            insights.append(f"✅ Excellent data quality score: {data_quality_score}%")
        elif data_quality_score < 70:
            insights.append(f"⚠️ Low data quality score: {data_quality_score}%")

        # Recommendations
        recommendations = []
        if overview["duplicate_pct"] > 1:
            recommendations.append("🔧 Consider removing duplicate rows")
        if overview["columns_with_missing"] > 0:
            recommendations.append("🔧 Handle missing values before analysis")

        return {
            "overview": overview,
            "columns": columns,
            "correlations": correlations,
            "insights": insights,
            "recommendations": recommendations
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating auto-profile: {str(e)}")


@router.get("/correlation-analysis")
async def correlation_analysis(session_id: str, method: str = "pearson", file_id: Optional[str] = None):
    """
    Full correlation analysis with p-values and significant pairs.
    Method can be 'pearson', 'spearman', or 'kendall'.
    """
    try:
        if file_id is None:
            file_id = get_active_file_id(session_id)

        df = get_dataframe(session_id, file_id)
        if df is None:
            raise HTTPException(status_code=404, detail="Dataset not found")

        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        
        if len(numeric_cols) < 2:
            raise HTTPException(status_code=400, detail="Need at least 2 numeric columns for correlation analysis")

        # Calculate correlation matrix
        corr_matrix = df[numeric_cols].corr(method=method)
        
        # Calculate p-values for each pair
        significant_pairs = []
        p_values = {}
        
        for i, col1 in enumerate(numeric_cols):
            p_values[col1] = {}
            for j, col2 in enumerate(numeric_cols):
                if i < j:
                    x = df[col1].dropna()
                    y = df[col2].dropna()
                    
                    # Get common indices
                    common_idx = x.index.intersection(y.index)
                    x_clean = x.loc[common_idx]
                    y_clean = y.loc[common_idx]
                    
                    if len(x_clean) >= 3:
                        if method == 'pearson':
                            _, p = stats.pearsonr(x_clean, y_clean)
                        elif method == 'spearman':
                            _, p = stats.spearmanr(x_clean, y_clean)
                        else:
                            _, p = stats.kendalltau(x_clean, y_clean)
                        
                        p_values[col1][col2] = float(p)
                        p_values.setdefault(col2, {})[col1] = float(p)
                        
                        corr_val = corr_matrix.loc[col1, col2]
                        if p < 0.05 and abs(corr_val) > 0.3:
                            significant_pairs.append({
                                "column1": col1,
                                "column2": col2,
                                "correlation": float(corr_val),
                                "p_value": float(p),
                                "strength": "strong" if abs(corr_val) > 0.7 else "moderate" if abs(corr_val) > 0.5 else "weak"
                            })

        significant_pairs.sort(key=lambda x: abs(x['correlation']), reverse=True)

        return {
            "method": method,
            "correlation_matrix": corr_matrix.to_dict(),
            "p_values": p_values,
            "significant_pairs": significant_pairs[:15],
            "columns": numeric_cols,
            "n_columns": len(numeric_cols)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in correlation analysis: {str(e)}")


@router.get("/distribution-analysis/{column_name}")
async def distribution_analysis(session_id: str, column_name: str, file_id: Optional[str] = None):
    """
    Analyze column distribution including normality test and best fitting distribution.
    """
    try:
        if file_id is None:
            file_id = get_active_file_id(session_id)

        df = get_dataframe(session_id, file_id)
        if df is None:
            raise HTTPException(status_code=404, detail="Dataset not found")

        if column_name not in df.columns:
            raise HTTPException(status_code=404, detail=f"Column '{column_name}' not found")

        col_data = df[column_name].dropna()
        
        if not np.issubdtype(col_data.dtype, np.number):
            raise HTTPException(status_code=400, detail="Distribution analysis requires numeric column")

        result = {
            "column": column_name,
            "n_samples": len(col_data),
            "statistics": {
                "mean": float(col_data.mean()),
                "median": float(col_data.median()),
                "std": float(col_data.std()),
                "min": float(col_data.min()),
                "max": float(col_data.max()),
                "skewness": float(stats.skew(col_data)),
                "kurtosis": float(stats.kurtosis(col_data)),
                "q1": float(col_data.quantile(0.25)),
                "q3": float(col_data.quantile(0.75))
            }
        }

        # Normality tests
        if len(col_data) >= 20:
            # Shapiro-Wilk test (best for smaller samples)
            if len(col_data) < 5000:
                stat_sw, p_sw = stats.shapiro(col_data if len(col_data) <= 5000 else col_data.sample(5000))
                result["shapiro_wilk"] = {
                    "statistic": float(stat_sw),
                    "p_value": float(p_sw),
                    "is_normal": p_sw >= 0.05
                }
            
            # D'Agostino-Pearson test
            stat_dp, p_dp = stats.normaltest(col_data)
            result["dagostino_pearson"] = {
                "statistic": float(stat_dp),
                "p_value": float(p_dp),
                "is_normal": p_dp >= 0.05
            }

        # Histogram data
        hist, bin_edges = np.histogram(col_data, bins='auto')
        result["histogram"] = {
            "counts": hist.tolist(),
            "bin_edges": bin_edges.tolist()
        }

        # Distribution shape interpretation
        skew = result["statistics"]["skewness"]
        if abs(skew) < 0.5:
            shape = "approximately symmetric"
        elif skew > 0:
            shape = "right-skewed (positive)"
        else:
            shape = "left-skewed (negative)"
        result["distribution_shape"] = shape

        # Overall normality assessment
        is_normal = False
        if "shapiro_wilk" in result and "dagostino_pearson" in result:
            is_normal = result["shapiro_wilk"]["is_normal"] and result["dagostino_pearson"]["is_normal"]
        elif "dagostino_pearson" in result:
            is_normal = result["dagostino_pearson"]["is_normal"]
        result["is_normal"] = is_normal

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in distribution analysis: {str(e)}")

