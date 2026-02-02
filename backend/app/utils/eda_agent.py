"""
EDA Agent for the Data Science Platform.
Provides automated Exploratory Data Analysis capabilities.
Features:
- Univariate analysis
- Bivariate analysis
- Multivariate analysis
- Time series decomposition
- Automated insights generation
"""

import numpy as np
import pandas as pd
from scipy import stats
from typing import Dict, Any, List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class EDAAgent:
    """
    Automated Exploratory Data Analysis agent.
    Generates comprehensive insights from datasets.
    """
    
    def __init__(self):
        pass
    
    # ==================== UNIVARIATE ANALYSIS ====================
    
    def univariate_analysis(
        self,
        df: pd.DataFrame,
        column: str
    ) -> Dict[str, Any]:
        """
        Perform comprehensive univariate analysis on a column.
        
        Args:
            df: DataFrame
            column: Column name to analyze
            
        Returns:
            Dictionary with statistics, distribution info, and insights
        """
        try:
            if column not in df.columns:
                return {"error": f"Column '{column}' not found"}
            
            data = df[column]
            dtype = str(data.dtype)
            
            result = {
                "column": column,
                "dtype": dtype,
                "total_count": len(data),
                "missing_count": int(data.isna().sum()),
                "missing_pct": float(data.isna().sum() / len(data) * 100),
                "unique_count": int(data.nunique())
            }
            
            # Numeric analysis
            if np.issubdtype(data.dtype, np.number):
                clean_data = data.dropna()
                
                result.update({
                    "type": "numeric",
                    "min": float(clean_data.min()),
                    "max": float(clean_data.max()),
                    "mean": float(clean_data.mean()),
                    "median": float(clean_data.median()),
                    "std": float(clean_data.std()),
                    "variance": float(clean_data.var()),
                    "skewness": float(stats.skew(clean_data)),
                    "kurtosis": float(stats.kurtosis(clean_data)),
                    "q1": float(clean_data.quantile(0.25)),
                    "q3": float(clean_data.quantile(0.75)),
                    "iqr": float(clean_data.quantile(0.75) - clean_data.quantile(0.25)),
                })
                
                # Outlier detection using IQR
                q1, q3 = clean_data.quantile(0.25), clean_data.quantile(0.75)
                iqr = q3 - q1
                lower_bound = q1 - 1.5 * iqr
                upper_bound = q3 + 1.5 * iqr
                outliers = clean_data[(clean_data < lower_bound) | (clean_data > upper_bound)]
                
                result["outliers"] = {
                    "count": len(outliers),
                    "pct": float(len(outliers) / len(clean_data) * 100),
                    "lower_bound": float(lower_bound),
                    "upper_bound": float(upper_bound)
                }
                
                # Distribution shape interpretation
                skew = result["skewness"]
                if abs(skew) < 0.5:
                    shape = "approximately symmetric"
                elif skew > 0:
                    shape = "right-skewed (positive)"
                else:
                    shape = "left-skewed (negative)"
                result["distribution_shape"] = shape
                
                # Histogram bins for plotting
                hist, bin_edges = np.histogram(clean_data, bins='auto')
                result["histogram"] = {
                    "counts": hist.tolist(),
                    "bin_edges": bin_edges.tolist()
                }
                
            # Categorical analysis
            else:
                result["type"] = "categorical"
                value_counts = data.value_counts()
                
                result["value_counts"] = value_counts.head(20).to_dict()
                result["mode"] = str(data.mode().iloc[0]) if len(data.mode()) > 0 else None
                result["cardinality"] = int(data.nunique())
                
                # Entropy as measure of diversity
                probabilities = value_counts / value_counts.sum()
                entropy = -np.sum(probabilities * np.log2(probabilities + 1e-10))
                result["entropy"] = float(entropy)
                
                # Category concentration
                top_n_pct = value_counts.head(5).sum() / len(data.dropna()) * 100
                result["top_5_concentration"] = float(top_n_pct)
            
            # Generate insights
            result["insights"] = self._generate_univariate_insights(result)
            
            return result
            
        except Exception as e:
            logger.error(f"Univariate analysis error: {e}")
            return {"error": str(e)}
    
    def _generate_univariate_insights(self, result: Dict[str, Any]) -> List[str]:
        """Generate insights from univariate analysis."""
        insights = []
        
        if result.get("missing_pct", 0) > 5:
            insights.append(f"⚠️ {result['missing_pct']:.1f}% missing values detected")
        
        if result.get("type") == "numeric":
            if result.get("outliers", {}).get("pct", 0) > 1:
                insights.append(f"⚠️ {result['outliers']['pct']:.1f}% outliers detected using IQR method")
            
            if abs(result.get("skewness", 0)) > 1:
                insights.append(f"📊 Highly {result['distribution_shape']} - consider transformation")
            
            if result.get("std", 0) > result.get("mean", 1) * 2:
                insights.append("📈 High variance relative to mean")
        
        elif result.get("type") == "categorical":
            if result.get("cardinality", 0) > 50:
                insights.append(f"⚠️ High cardinality ({result['cardinality']} unique values)")
            
            if result.get("top_5_concentration", 0) > 80:
                insights.append(f"📊 Top 5 categories account for {result['top_5_concentration']:.1f}% of data")
        
        return insights
    
    # ==================== BIVARIATE ANALYSIS ====================
    
    def bivariate_analysis(
        self,
        df: pd.DataFrame,
        col1: str,
        col2: str
    ) -> Dict[str, Any]:
        """
        Analyze relationship between two variables.
        
        Args:
            df: DataFrame
            col1: First column
            col2: Second column
            
        Returns:
            Dictionary with relationship analysis
        """
        try:
            if col1 not in df.columns or col2 not in df.columns:
                return {"error": f"Columns not found"}
            
            data1 = df[col1]
            data2 = df[col2]
            
            is_numeric1 = np.issubdtype(data1.dtype, np.number)
            is_numeric2 = np.issubdtype(data2.dtype, np.number)
            
            result = {
                "column1": col1,
                "column2": col2,
                "type1": "numeric" if is_numeric1 else "categorical",
                "type2": "numeric" if is_numeric2 else "categorical"
            }
            
            # Both numeric: correlation analysis
            if is_numeric1 and is_numeric2:
                result["analysis_type"] = "correlation"
                
                # Remove missing values
                valid_mask = ~(data1.isna() | data2.isna())
                x, y = data1[valid_mask], data2[valid_mask]
                
                if len(x) < 3:
                    return {"error": "Not enough valid data points"}
                
                # Pearson correlation
                pearson_r, pearson_p = stats.pearsonr(x, y)
                
                # Spearman correlation
                spearman_r, spearman_p = stats.spearmanr(x, y)
                
                result.update({
                    "pearson": {
                        "correlation": float(pearson_r),
                        "p_value": float(pearson_p),
                        "significant": pearson_p < 0.05
                    },
                    "spearman": {
                        "correlation": float(spearman_r),
                        "p_value": float(spearman_p),
                        "significant": spearman_p < 0.05
                    },
                    "n_samples": len(x)
                })
                
                # Interpret strength
                abs_corr = abs(pearson_r)
                if abs_corr < 0.3:
                    strength = "weak"
                elif abs_corr < 0.7:
                    strength = "moderate"
                else:
                    strength = "strong"
                
                direction = "positive" if pearson_r > 0 else "negative"
                result["interpretation"] = f"{strength.capitalize()} {direction} correlation (r={pearson_r:.3f})"
                
                # Linear regression for trend line
                slope, intercept, _, _, _ = stats.linregress(x, y)
                result["regression"] = {
                    "slope": float(slope),
                    "intercept": float(intercept)
                }
            
            # One numeric, one categorical: group comparison
            elif is_numeric1 != is_numeric2:
                result["analysis_type"] = "group_comparison"
                
                num_col = col1 if is_numeric1 else col2
                cat_col = col2 if is_numeric1 else col1
                
                # Group statistics
                groups = df.groupby(cat_col)[num_col].agg(['mean', 'median', 'std', 'count'])
                
                result["group_stats"] = groups.head(20).to_dict()
                
                # ANOVA if more than 2 groups
                unique_groups = df[cat_col].dropna().unique()
                if len(unique_groups) >= 2:
                    group_data = [df[df[cat_col] == g][num_col].dropna() for g in unique_groups[:10]]
                    group_data = [g for g in group_data if len(g) > 0]
                    
                    if len(group_data) >= 2:
                        f_stat, p_value = stats.f_oneway(*group_data)
                        result["anova"] = {
                            "f_statistic": float(f_stat),
                            "p_value": float(p_value),
                            "significant": p_value < 0.05
                        }
                        result["interpretation"] = "Significant differences between groups" if p_value < 0.05 else "No significant differences between groups"
            
            # Both categorical: contingency analysis
            else:
                result["analysis_type"] = "contingency"
                
                # Cross-tabulation
                contingency = pd.crosstab(data1, data2)
                
                # Chi-square test
                chi2, p_value, dof, expected = stats.chi2_contingency(contingency)
                
                # Cramér's V effect size
                n = contingency.sum().sum()
                min_dim = min(contingency.shape) - 1
                cramers_v = np.sqrt(chi2 / (n * min_dim)) if (n * min_dim) > 0 else 0
                
                result.update({
                    "chi_square": float(chi2),
                    "p_value": float(p_value),
                    "degrees_of_freedom": int(dof),
                    "cramers_v": float(cramers_v),
                    "significant": p_value < 0.05,
                    "contingency_table": contingency.head(10).to_dict(),
                    "interpretation": "Variables are associated" if p_value < 0.05 else "Variables appear independent"
                })
            
            return result
            
        except Exception as e:
            logger.error(f"Bivariate analysis error: {e}")
            return {"error": str(e)}
    
    # ==================== AUTO EDA ====================
    
    def auto_eda(self, df: pd.DataFrame, max_columns: int = 20) -> Dict[str, Any]:
        """
        Run comprehensive automated EDA on the entire dataset.
        
        Args:
            df: DataFrame to analyze
            max_columns: Maximum columns to analyze in detail
            
        Returns:
            Dictionary with complete EDA results
        """
        try:
            result = {
                "overview": {},
                "columns": {},
                "correlations": {},
                "insights": [],
                "recommendations": []
            }
            
            # Dataset overview
            result["overview"] = {
                "n_rows": len(df),
                "n_columns": len(df.columns),
                "memory_usage_mb": float(df.memory_usage(deep=True).sum() / 1024 / 1024),
                "duplicate_rows": int(df.duplicated().sum()),
                "duplicate_pct": float(df.duplicated().sum() / len(df) * 100) if len(df) > 0 else 0
            }
            
            # Column types
            numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
            datetime_cols = df.select_dtypes(include=['datetime']).columns.tolist()
            
            result["overview"]["numeric_columns"] = len(numeric_cols)
            result["overview"]["categorical_columns"] = len(categorical_cols)
            result["overview"]["datetime_columns"] = len(datetime_cols)
            
            # Missing values summary
            missing = df.isna().sum()
            missing_pct = (missing / len(df) * 100).round(2)
            result["overview"]["total_missing_values"] = int(missing.sum())
            result["overview"]["columns_with_missing"] = int((missing > 0).sum())
            
            # Analyze each column (limited)
            columns_to_analyze = df.columns[:max_columns]
            for col in columns_to_analyze:
                result["columns"][col] = self.univariate_analysis(df, col)
            
            # Correlation matrix for numeric columns
            if len(numeric_cols) >= 2:
                corr_matrix = df[numeric_cols].corr()
                result["correlations"]["matrix"] = corr_matrix.to_dict()
                
                # Find top correlations
                top_corrs = []
                for i in range(len(numeric_cols)):
                    for j in range(i+1, len(numeric_cols)):
                        corr_val = corr_matrix.iloc[i, j]
                        if abs(corr_val) > 0.5:  # Only significant correlations
                            top_corrs.append({
                                "column1": numeric_cols[i],
                                "column2": numeric_cols[j],
                                "correlation": float(corr_val)
                            })
                
                top_corrs.sort(key=lambda x: abs(x['correlation']), reverse=True)
                result["correlations"]["top_pairs"] = top_corrs[:10]
            
            # Generate insights
            result["insights"] = self._generate_dataset_insights(df, result)
            
            # Generate recommendations
            result["recommendations"] = self._generate_recommendations(df, result)
            
            return result
            
        except Exception as e:
            logger.error(f"Auto EDA error: {e}")
            return {"error": str(e)}
    
    def _generate_dataset_insights(self, df: pd.DataFrame, eda_result: Dict) -> List[str]:
        """Generate insights from EDA results."""
        insights = []
        
        overview = eda_result.get("overview", {})
        
        # Size insight
        insights.append(f"📊 Dataset contains {overview.get('n_rows', 0):,} rows and {overview.get('n_columns', 0)} columns")
        
        # Missing values
        if overview.get("columns_with_missing", 0) > 0:
            insights.append(f"⚠️ {overview['columns_with_missing']} columns have missing values")
        
        # Duplicates
        if overview.get("duplicate_pct", 0) > 1:
            insights.append(f"⚠️ {overview['duplicate_pct']:.1f}% duplicate rows detected")
        
        # Memory
        if overview.get("memory_usage_mb", 0) > 100:
            insights.append(f"💾 Large dataset: {overview['memory_usage_mb']:.1f} MB in memory")
        
        # Top correlations
        top_corrs = eda_result.get("correlations", {}).get("top_pairs", [])
        if top_corrs:
            top = top_corrs[0]
            insights.append(f"🔗 Strongest correlation: {top['column1']} ↔ {top['column2']} (r={top['correlation']:.3f})")
        
        return insights
    
    def _generate_recommendations(self, df: pd.DataFrame, eda_result: Dict) -> List[str]:
        """Generate actionable recommendations."""
        recommendations = []
        
        overview = eda_result.get("overview", {})
        
        # Missing value handling
        if overview.get("columns_with_missing", 0) > 0:
            recommendations.append("🔧 Handle missing values before modeling (imputation or removal)")
        
        # Duplicates
        if overview.get("duplicate_pct", 0) > 1:
            recommendations.append("🔧 Consider removing duplicate rows")
        
        # High cardinality categoricals
        for col, analysis in eda_result.get("columns", {}).items():
            if analysis.get("type") == "categorical" and analysis.get("cardinality", 0) > 50:
                recommendations.append(f"🔧 Consider encoding/binning high-cardinality column: {col}")
                break  # Just one example
        
        # Skewed numerics
        for col, analysis in eda_result.get("columns", {}).items():
            if analysis.get("type") == "numeric" and abs(analysis.get("skewness", 0)) > 2:
                recommendations.append(f"🔧 Consider log transform for skewed column: {col}")
                break  # Just one example
        
        # High correlations (potential multicollinearity)
        top_corrs = eda_result.get("correlations", {}).get("top_pairs", [])
        high_corrs = [c for c in top_corrs if abs(c["correlation"]) > 0.9]
        if high_corrs:
            recommendations.append("⚠️ Highly correlated features detected - consider feature selection")
        
        return recommendations
    
    def format_eda_output(self, result: Dict[str, Any]) -> str:
        """Format EDA results for display."""
        lines = []
        lines.append("")
        lines.append("=" * 60)
        lines.append("📊 EXPLORATORY DATA ANALYSIS REPORT")
        lines.append("=" * 60)
        
        if "error" in result:
            lines.append(f"❌ Error: {result['error']}")
            return "\n".join(lines)
        
        # Overview
        overview = result.get("overview", {})
        lines.append("")
        lines.append("📋 DATASET OVERVIEW")
        lines.append("-" * 40)
        lines.append(f"  Rows:        {overview.get('n_rows', 0):,}")
        lines.append(f"  Columns:     {overview.get('n_columns', 0)}")
        lines.append(f"  Memory:      {overview.get('memory_usage_mb', 0):.2f} MB")
        lines.append(f"  Duplicates:  {overview.get('duplicate_pct', 0):.1f}%")
        
        # Insights
        insights = result.get("insights", [])
        if insights:
            lines.append("")
            lines.append("💡 KEY INSIGHTS")
            lines.append("-" * 40)
            for insight in insights:
                lines.append(f"  {insight}")
        
        # Top correlations
        top_corrs = result.get("correlations", {}).get("top_pairs", [])[:5]
        if top_corrs:
            lines.append("")
            lines.append("🔗 TOP CORRELATIONS")
            lines.append("-" * 40)
            for corr in top_corrs:
                lines.append(f"  {corr['column1']} ↔ {corr['column2']}: r={corr['correlation']:.3f}")
        
        # Recommendations
        recommendations = result.get("recommendations", [])
        if recommendations:
            lines.append("")
            lines.append("📝 RECOMMENDATIONS")
            lines.append("-" * 40)
            for rec in recommendations:
                lines.append(f"  {rec}")
        
        lines.append("=" * 60)
        
        return "\n".join(lines)


# Global instance
eda_agent = EDAAgent()
