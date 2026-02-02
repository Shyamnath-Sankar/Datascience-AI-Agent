"""
Statistics Agent for the Data Science Platform.
Provides comprehensive statistical analysis capabilities.
Features:
- Hypothesis testing (t-test, chi-square, ANOVA)
- Correlation analysis (Pearson, Spearman, Kendall)
- Confidence intervals
- A/B test analysis
- Distribution fitting
"""

import numpy as np
from scipy import stats
from typing import Dict, Any, List, Optional, Tuple, Union
import logging

logger = logging.getLogger(__name__)


class StatisticsAgent:
    """
    Comprehensive statistical analysis agent.
    Provides rigorous statistical methods with proper p-values and effect sizes.
    """
    
    def __init__(self):
        self.significance_level = 0.05
    
    # ==================== HYPOTHESIS TESTING ====================
    
    def t_test(
        self,
        group1: np.ndarray,
        group2: np.ndarray,
        paired: bool = False,
        alternative: str = 'two-sided'
    ) -> Dict[str, Any]:
        """
        Perform t-test between two groups.
        
        Args:
            group1: First group data
            group2: Second group data
            paired: Whether to perform paired t-test
            alternative: 'two-sided', 'less', or 'greater'
            
        Returns:
            Dictionary with t-statistic, p-value, effect size, and interpretation
        """
        try:
            group1 = np.array(group1).flatten()
            group2 = np.array(group2).flatten()
            
            # Remove NaN values
            group1 = group1[~np.isnan(group1)]
            group2 = group2[~np.isnan(group2)]
            
            if paired:
                if len(group1) != len(group2):
                    return {"error": "Paired t-test requires equal sample sizes"}
                t_stat, p_value = stats.ttest_rel(group1, group2, alternative=alternative)
            else:
                t_stat, p_value = stats.ttest_ind(group1, group2, alternative=alternative)
            
            # Cohen's d effect size
            pooled_std = np.sqrt((np.var(group1) + np.var(group2)) / 2)
            cohens_d = (np.mean(group1) - np.mean(group2)) / pooled_std if pooled_std > 0 else 0
            
            # Effect size interpretation
            if abs(cohens_d) < 0.2:
                effect_interpretation = "negligible"
            elif abs(cohens_d) < 0.5:
                effect_interpretation = "small"
            elif abs(cohens_d) < 0.8:
                effect_interpretation = "medium"
            else:
                effect_interpretation = "large"
            
            significant = p_value < self.significance_level
            
            return {
                "test": "paired t-test" if paired else "independent t-test",
                "t_statistic": float(t_stat),
                "p_value": float(p_value),
                "significant": significant,
                "cohens_d": float(cohens_d),
                "effect_size": effect_interpretation,
                "group1_mean": float(np.mean(group1)),
                "group2_mean": float(np.mean(group2)),
                "group1_std": float(np.std(group1)),
                "group2_std": float(np.std(group2)),
                "group1_n": len(group1),
                "group2_n": len(group2),
                "interpretation": self._interpret_t_test(significant, cohens_d, np.mean(group1), np.mean(group2))
            }
        except Exception as e:
            logger.error(f"T-test error: {e}")
            return {"error": str(e)}
    
    def _interpret_t_test(self, significant: bool, cohens_d: float, mean1: float, mean2: float) -> str:
        """Generate human-readable interpretation of t-test results."""
        if not significant:
            return "No statistically significant difference found between the groups (p ≥ 0.05)."
        
        direction = "higher" if mean1 > mean2 else "lower"
        effect = "negligible" if abs(cohens_d) < 0.2 else (
            "small" if abs(cohens_d) < 0.5 else (
                "medium" if abs(cohens_d) < 0.8 else "large"
            )
        )
        return f"Statistically significant difference found. Group 1 is {direction} than Group 2 with a {effect} effect size."
    
    def chi_square_test(
        self,
        observed: np.ndarray,
        expected: Optional[np.ndarray] = None
    ) -> Dict[str, Any]:
        """
        Perform chi-square test for independence or goodness of fit.
        
        Args:
            observed: Observed frequencies (2D array for independence, 1D for goodness of fit)
            expected: Expected frequencies (optional, for goodness of fit)
            
        Returns:
            Dictionary with chi-square statistic, p-value, and interpretation
        """
        try:
            observed = np.array(observed)
            
            if observed.ndim == 2:
                # Chi-square test of independence
                chi2, p_value, dof, expected_freq = stats.chi2_contingency(observed)
                test_type = "independence"
            else:
                # Chi-square goodness of fit
                if expected is None:
                    expected = np.full_like(observed, observed.mean())
                chi2, p_value = stats.chisquare(observed, expected)
                dof = len(observed) - 1
                expected_freq = expected
                test_type = "goodness of fit"
            
            # Cramér's V for effect size (for 2D)
            if observed.ndim == 2:
                n = observed.sum()
                min_dim = min(observed.shape) - 1
                cramers_v = np.sqrt(chi2 / (n * min_dim)) if (n * min_dim) > 0 else 0
            else:
                cramers_v = None
            
            significant = p_value < self.significance_level
            
            return {
                "test": f"chi-square {test_type}",
                "chi2_statistic": float(chi2),
                "p_value": float(p_value),
                "degrees_of_freedom": int(dof),
                "significant": significant,
                "cramers_v": float(cramers_v) if cramers_v else None,
                "interpretation": "Variables are dependent" if significant else "Variables are independent"
            }
        except Exception as e:
            logger.error(f"Chi-square test error: {e}")
            return {"error": str(e)}
    
    def anova(self, *groups) -> Dict[str, Any]:
        """
        Perform one-way ANOVA.
        
        Args:
            *groups: Variable number of groups to compare
            
        Returns:
            Dictionary with F-statistic, p-value, and interpretation
        """
        try:
            # Clean groups
            clean_groups = []
            for g in groups:
                arr = np.array(g).flatten()
                arr = arr[~np.isnan(arr)]
                if len(arr) > 0:
                    clean_groups.append(arr)
            
            if len(clean_groups) < 2:
                return {"error": "Need at least 2 groups for ANOVA"}
            
            f_stat, p_value = stats.f_oneway(*clean_groups)
            
            # Calculate eta-squared effect size
            all_data = np.concatenate(clean_groups)
            grand_mean = np.mean(all_data)
            ss_between = sum(len(g) * (np.mean(g) - grand_mean)**2 for g in clean_groups)
            ss_total = np.sum((all_data - grand_mean)**2)
            eta_squared = ss_between / ss_total if ss_total > 0 else 0
            
            significant = p_value < self.significance_level
            
            return {
                "test": "one-way ANOVA",
                "f_statistic": float(f_stat),
                "p_value": float(p_value),
                "significant": significant,
                "eta_squared": float(eta_squared),
                "n_groups": len(clean_groups),
                "group_means": [float(np.mean(g)) for g in clean_groups],
                "group_stds": [float(np.std(g)) for g in clean_groups],
                "group_sizes": [len(g) for g in clean_groups],
                "interpretation": "Significant differences exist between groups" if significant else "No significant differences between groups"
            }
        except Exception as e:
            logger.error(f"ANOVA error: {e}")
            return {"error": str(e)}
    
    # ==================== CORRELATION ANALYSIS ====================
    
    def correlation(
        self,
        x: np.ndarray,
        y: np.ndarray,
        method: str = 'pearson'
    ) -> Dict[str, Any]:
        """
        Calculate correlation between two variables.
        
        Args:
            x: First variable
            y: Second variable
            method: 'pearson', 'spearman', or 'kendall'
            
        Returns:
            Dictionary with correlation coefficient, p-value, and interpretation
        """
        try:
            x = np.array(x).flatten()
            y = np.array(y).flatten()
            
            # Handle missing values
            valid_mask = ~(np.isnan(x) | np.isnan(y))
            x = x[valid_mask]
            y = y[valid_mask]
            
            if len(x) < 3:
                return {"error": "Need at least 3 data points for correlation"}
            
            if method == 'pearson':
                corr, p_value = stats.pearsonr(x, y)
            elif method == 'spearman':
                corr, p_value = stats.spearmanr(x, y)
            elif method == 'kendall':
                corr, p_value = stats.kendalltau(x, y)
            else:
                return {"error": f"Unknown method: {method}"}
            
            # Interpretation
            abs_corr = abs(corr)
            if abs_corr < 0.1:
                strength = "negligible"
            elif abs_corr < 0.3:
                strength = "weak"
            elif abs_corr < 0.5:
                strength = "moderate"
            elif abs_corr < 0.7:
                strength = "strong"
            else:
                strength = "very strong"
            
            direction = "positive" if corr > 0 else "negative"
            significant = p_value < self.significance_level
            
            return {
                "method": method,
                "correlation": float(corr),
                "p_value": float(p_value),
                "significant": significant,
                "strength": strength,
                "direction": direction,
                "n_samples": len(x),
                "interpretation": f"{strength.capitalize()} {direction} correlation (r={corr:.3f}, p={p_value:.4f})"
            }
        except Exception as e:
            logger.error(f"Correlation error: {e}")
            return {"error": str(e)}
    
    def correlation_matrix(
        self,
        df,
        method: str = 'pearson',
        include_pvalues: bool = True
    ) -> Dict[str, Any]:
        """
        Calculate correlation matrix for all numeric columns.
        
        Args:
            df: Pandas DataFrame
            method: 'pearson', 'spearman', or 'kendall'
            include_pvalues: Whether to include p-values
            
        Returns:
            Dictionary with correlation matrix, p-values, and significant pairs
        """
        try:
            import pandas as pd
            
            # Select numeric columns only
            numeric_df = df.select_dtypes(include=[np.number])
            
            if numeric_df.shape[1] < 2:
                return {"error": "Need at least 2 numeric columns"}
            
            # Calculate correlation matrix
            corr_matrix = numeric_df.corr(method=method)
            
            # Calculate p-values
            pvalue_matrix = None
            significant_pairs = []
            
            if include_pvalues:
                n = len(numeric_df)
                columns = corr_matrix.columns
                pvalue_matrix = pd.DataFrame(np.zeros((len(columns), len(columns))), 
                                            columns=columns, index=columns)
                
                for i, col1 in enumerate(columns):
                    for j, col2 in enumerate(columns):
                        if i < j:
                            result = self.correlation(numeric_df[col1], numeric_df[col2], method)
                            if 'p_value' in result:
                                pvalue_matrix.loc[col1, col2] = result['p_value']
                                pvalue_matrix.loc[col2, col1] = result['p_value']
                                
                                if result['significant'] and abs(result['correlation']) > 0.3:
                                    significant_pairs.append({
                                        "column1": col1,
                                        "column2": col2,
                                        "correlation": result['correlation'],
                                        "p_value": result['p_value'],
                                        "strength": result['strength']
                                    })
            
            # Sort significant pairs by absolute correlation
            significant_pairs.sort(key=lambda x: abs(x['correlation']), reverse=True)
            
            return {
                "method": method,
                "correlation_matrix": corr_matrix.to_dict(),
                "p_value_matrix": pvalue_matrix.to_dict() if pvalue_matrix is not None else None,
                "significant_pairs": significant_pairs[:10],  # Top 10
                "n_columns": len(corr_matrix.columns),
                "columns": corr_matrix.columns.tolist()
            }
        except Exception as e:
            logger.error(f"Correlation matrix error: {e}")
            return {"error": str(e)}
    
    # ==================== A/B TESTING ====================
    
    def ab_test(
        self,
        control: np.ndarray,
        treatment: np.ndarray,
        metric_type: str = 'continuous'
    ) -> Dict[str, Any]:
        """
        Analyze A/B test results.
        
        Args:
            control: Control group data
            treatment: Treatment group data
            metric_type: 'continuous' or 'binary' (conversion)
            
        Returns:
            Dictionary with test results, effect size, and recommendations
        """
        try:
            control = np.array(control).flatten()
            treatment = np.array(treatment).flatten()
            
            control = control[~np.isnan(control)]
            treatment = treatment[~np.isnan(treatment)]
            
            if metric_type == 'binary':
                # Proportions test
                control_conversions = np.sum(control)
                treatment_conversions = np.sum(treatment)
                control_rate = control_conversions / len(control)
                treatment_rate = treatment_conversions / len(treatment)
                
                # Z-test for proportions
                pooled_rate = (control_conversions + treatment_conversions) / (len(control) + len(treatment))
                se = np.sqrt(pooled_rate * (1 - pooled_rate) * (1/len(control) + 1/len(treatment)))
                z_stat = (treatment_rate - control_rate) / se if se > 0 else 0
                p_value = 2 * (1 - stats.norm.cdf(abs(z_stat)))
                
                lift = ((treatment_rate - control_rate) / control_rate * 100) if control_rate > 0 else 0
                
                result = {
                    "test": "proportions z-test",
                    "control_rate": float(control_rate),
                    "treatment_rate": float(treatment_rate),
                    "absolute_difference": float(treatment_rate - control_rate),
                    "relative_lift": float(lift),
                    "z_statistic": float(z_stat),
                    "p_value": float(p_value),
                }
            else:
                # T-test for continuous metrics
                t_result = self.t_test(control, treatment)
                
                lift = ((np.mean(treatment) - np.mean(control)) / np.mean(control) * 100) if np.mean(control) != 0 else 0
                
                result = {
                    "test": "independent t-test",
                    "control_mean": float(np.mean(control)),
                    "treatment_mean": float(np.mean(treatment)),
                    "absolute_difference": float(np.mean(treatment) - np.mean(control)),
                    "relative_lift": float(lift),
                    "t_statistic": t_result.get('t_statistic'),
                    "p_value": t_result.get('p_value'),
                    "cohens_d": t_result.get('cohens_d'),
                }
            
            significant = result['p_value'] < self.significance_level
            result["significant"] = significant
            result["control_n"] = len(control)
            result["treatment_n"] = len(treatment)
            
            # Recommendation
            if significant:
                if result['relative_lift'] > 0:
                    result["recommendation"] = f"✅ Treatment shows a significant {result['relative_lift']:.1f}% improvement. Consider rolling out."
                else:
                    result["recommendation"] = f"⚠️ Treatment shows a significant {abs(result['relative_lift']):.1f}% decrease. Do not roll out."
            else:
                result["recommendation"] = "⏸️ No significant difference detected. Consider extending the test or increasing sample size."
            
            return result
        except Exception as e:
            logger.error(f"A/B test error: {e}")
            return {"error": str(e)}
    
    # ==================== CONFIDENCE INTERVALS ====================
    
    def confidence_interval(
        self,
        data: np.ndarray,
        confidence: float = 0.95,
        statistic: str = 'mean'
    ) -> Dict[str, Any]:
        """
        Calculate confidence interval for a statistic.
        
        Args:
            data: Sample data
            confidence: Confidence level (e.g., 0.95 for 95%)
            statistic: 'mean' or 'proportion'
            
        Returns:
            Dictionary with point estimate and confidence interval
        """
        try:
            data = np.array(data).flatten()
            data = data[~np.isnan(data)]
            
            n = len(data)
            if n < 2:
                return {"error": "Need at least 2 data points"}
            
            if statistic == 'mean':
                point_estimate = np.mean(data)
                std_error = stats.sem(data)
                
                # t-distribution for small samples
                alpha = 1 - confidence
                t_value = stats.t.ppf(1 - alpha/2, n - 1)
                margin = t_value * std_error
                
            elif statistic == 'proportion':
                point_estimate = np.mean(data)  # Assumes binary 0/1
                std_error = np.sqrt(point_estimate * (1 - point_estimate) / n)
                
                alpha = 1 - confidence
                z_value = stats.norm.ppf(1 - alpha/2)
                margin = z_value * std_error
            else:
                return {"error": f"Unknown statistic: {statistic}"}
            
            lower = point_estimate - margin
            upper = point_estimate + margin
            
            return {
                "statistic": statistic,
                "point_estimate": float(point_estimate),
                "confidence_level": confidence,
                "lower_bound": float(lower),
                "upper_bound": float(upper),
                "margin_of_error": float(margin),
                "std_error": float(std_error),
                "n_samples": n,
                "interpretation": f"{confidence*100:.0f}% CI: [{lower:.4f}, {upper:.4f}]"
            }
        except Exception as e:
            logger.error(f"Confidence interval error: {e}")
            return {"error": str(e)}
    
    # ==================== DISTRIBUTION ANALYSIS ====================
    
    def normality_test(self, data: np.ndarray) -> Dict[str, Any]:
        """
        Test if data follows a normal distribution.
        
        Args:
            data: Sample data
            
        Returns:
            Dictionary with test results and interpretation
        """
        try:
            data = np.array(data).flatten()
            data = data[~np.isnan(data)]
            
            n = len(data)
            results = {
                "n_samples": n,
                "mean": float(np.mean(data)),
                "std": float(np.std(data)),
                "skewness": float(stats.skew(data)),
                "kurtosis": float(stats.kurtosis(data))
            }
            
            # Shapiro-Wilk test (best for n < 5000)
            if n < 5000:
                stat, p_value = stats.shapiro(data)
                results["shapiro_wilk"] = {
                    "statistic": float(stat),
                    "p_value": float(p_value),
                    "normal": p_value >= self.significance_level
                }
            
            # D'Agostino-Pearson test
            if n >= 20:
                stat, p_value = stats.normaltest(data)
                results["dagostino_pearson"] = {
                    "statistic": float(stat),
                    "p_value": float(p_value),
                    "normal": p_value >= self.significance_level
                }
            
            # Overall assessment
            tests_passed = sum(1 for test in ['shapiro_wilk', 'dagostino_pearson'] 
                              if test in results and results[test]['normal'])
            tests_total = sum(1 for test in ['shapiro_wilk', 'dagostino_pearson'] if test in results)
            
            if tests_total > 0:
                results["is_normal"] = tests_passed == tests_total
                results["interpretation"] = "Data appears normally distributed" if results["is_normal"] else "Data does not appear normally distributed"
            
            return results
        except Exception as e:
            logger.error(f"Normality test error: {e}")
            return {"error": str(e)}
    
    def format_statistics_output(self, results: Dict[str, Any], test_name: str = "Statistical Analysis") -> str:
        """Format statistical results for display."""
        lines = []
        lines.append("")
        lines.append("=" * 55)
        lines.append(f"📊 {test_name.upper()}")
        lines.append("=" * 55)
        
        if "error" in results:
            lines.append(f"❌ Error: {results['error']}")
            return "\n".join(lines)
        
        for key, value in results.items():
            if key in ['interpretation', 'recommendation']:
                continue
            if isinstance(value, float):
                lines.append(f"  {key}: {value:.4f}")
            elif isinstance(value, bool):
                lines.append(f"  {key}: {'Yes' if value else 'No'}")
            elif isinstance(value, (int, str)):
                lines.append(f"  {key}: {value}")
        
        if "interpretation" in results:
            lines.append("")
            lines.append(f"📝 {results['interpretation']}")
        
        if "recommendation" in results:
            lines.append("")
            lines.append(results['recommendation'])
        
        lines.append("=" * 55)
        
        return "\n".join(lines)


# Global instance
statistics_agent = StatisticsAgent()
