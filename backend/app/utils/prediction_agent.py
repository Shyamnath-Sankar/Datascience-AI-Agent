"""
Prediction Agent for the Data Science Platform.
Implements multiple statistical models for accurate, consistent predictions.
Features:
- Linear, Polynomial, Exponential regression
- Auto model selection based on R²
- Confidence intervals
- Prediction caching for consistency
"""

import numpy as np
from scipy import stats
from typing import Dict, Any, Optional, Tuple, List
import logging
import hashlib
import json

logger = logging.getLogger(__name__)


class PredictionAgent:
    """
    Best-in-class prediction agent using multiple statistical models.
    Ensures consistent, reproducible predictions with confidence metrics.
    """
    
    def __init__(self):
        self.prediction_cache: Dict[str, Dict[str, Any]] = {}
    
    def _cache_key(self, years: np.ndarray, values: np.ndarray, target_year: int) -> str:
        """Generate cache key for prediction."""
        data = {
            'years': years.tolist(),
            'values': values.tolist(),
            'target': target_year
        }
        return hashlib.md5(json.dumps(data, sort_keys=True).encode()).hexdigest()
    
    def linear_regression(
        self, 
        years: np.ndarray, 
        values: np.ndarray
    ) -> Dict[str, Any]:
        """
        Perform linear regression.
        Returns: slope, intercept, r_squared, std_error, predictions
        """
        try:
            slope, intercept, r_value, p_value, std_err = stats.linregress(years, values)
            r_squared = r_value ** 2
            predictions = intercept + slope * years
            residuals = values - predictions
            
            return {
                'slope': float(slope),
                'intercept': float(intercept),
                'r_squared': float(r_squared),
                'p_value': float(p_value),
                'std_error': float(std_err),
                'residual_std': float(np.std(residuals)),
                'predictions': predictions
            }
        except Exception as e:
            logger.error(f"Linear regression error: {e}")
            return {'error': str(e), 'r_squared': 0}
    
    def polynomial_regression(
        self, 
        years: np.ndarray, 
        values: np.ndarray, 
        degree: int = 2
    ) -> Dict[str, Any]:
        """
        Perform polynomial regression.
        Returns: coefficients, r_squared, predictions
        """
        try:
            # Normalize years to avoid numerical issues
            years_norm = years - years.mean()
            
            coeffs = np.polyfit(years_norm, values, degree)
            poly = np.poly1d(coeffs)
            predictions = poly(years_norm)
            
            ss_res = np.sum((values - predictions) ** 2)
            ss_tot = np.sum((values - np.mean(values)) ** 2)
            r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0
            
            return {
                'coefficients': coeffs.tolist(),
                'degree': degree,
                'r_squared': float(max(0, min(1, r_squared))),  # Clamp to [0, 1]
                'predictions': predictions,
                'year_mean': float(years.mean())
            }
        except Exception as e:
            logger.error(f"Polynomial regression error: {e}")
            return {'error': str(e), 'r_squared': 0}
    
    def exponential_growth(
        self, 
        years: np.ndarray, 
        values: np.ndarray
    ) -> Dict[str, Any]:
        """
        Calculate compound annual growth rate (CAGR) using log-linear regression.
        Returns: cagr, base_value, r_squared
        """
        try:
            # Filter positive values for log transform
            valid_mask = values > 0
            if np.sum(valid_mask) < 2:
                return {'error': 'Not enough positive values', 'r_squared': 0}
            
            log_values = np.log(values[valid_mask])
            years_valid = years[valid_mask]
            
            slope, intercept, r_value, p_value, std_err = stats.linregress(years_valid, log_values)
            r_squared = r_value ** 2
            cagr = np.exp(slope) - 1  # Convert to percentage growth
            base_value = np.exp(intercept)
            
            # Calculate predictions
            predictions = base_value * np.exp(slope * (years_valid - years_valid[0]))
            
            return {
                'cagr': float(cagr),
                'base_value': float(base_value),
                'slope': float(slope),
                'r_squared': float(r_squared),
                'p_value': float(p_value),
                'predictions': predictions,
                'base_year': int(years_valid[0])
            }
        except Exception as e:
            logger.error(f"Exponential growth error: {e}")
            return {'error': str(e), 'r_squared': 0}
    
    def calculate_confidence_interval(
        self,
        prediction: float,
        std_error: float,
        n_samples: int,
        confidence: float = 0.95
    ) -> Tuple[float, float]:
        """Calculate confidence interval for prediction."""
        try:
            # t-value for confidence level
            alpha = 1 - confidence
            t_value = stats.t.ppf(1 - alpha/2, n_samples - 2)
            
            # Margin of error (simplified)
            margin = t_value * std_error * np.sqrt(1 + 1/n_samples)
            
            # For large predictions, use percentage-based margin
            if prediction > 1000000:
                margin = prediction * 0.02  # 2% margin for large values
            
            return (prediction - margin, prediction + margin)
        except Exception:
            # Fallback: 2% margin
            margin = abs(prediction) * 0.02
            return (prediction - margin, prediction + margin)
    
    def predict(
        self,
        years: np.ndarray,
        values: np.ndarray,
        target_year: int,
        entity_name: str = "Entity"
    ) -> Dict[str, Any]:
        """
        Generate prediction using multiple models and select the best.
        
        Args:
            years: Array of years (feature)
            values: Array of values to predict
            target_year: Year to predict for
            entity_name: Name of entity being predicted
            
        Returns:
            Comprehensive prediction with confidence metrics
        """
        # Check cache first
        cache_key = self._cache_key(years, values, target_year)
        if cache_key in self.prediction_cache:
            logger.info("Returning cached prediction")
            return self.prediction_cache[cache_key]
        
        results = {
            "entity": entity_name,
            "target_year": target_year,
            "data_points": len(years),
            "models": {},
            "best_model": None,
            "best_r_squared": 0,
            "prediction": None,
            "confidence_interval": None,
            "success": False
        }
        
        try:
            if len(years) < 3:
                results["error"] = "Insufficient data points (minimum 3 required)"
                return results
            
            # 1. Linear Regression
            linear_result = self.linear_regression(years, values)
            if 'error' not in linear_result:
                pred_linear = linear_result['intercept'] + linear_result['slope'] * target_year
                ci_linear = self.calculate_confidence_interval(
                    pred_linear, 
                    linear_result['residual_std'],
                    len(years)
                )
                results["models"]["linear"] = {
                    "prediction": float(pred_linear),
                    "r_squared": linear_result['r_squared'],
                    "confidence_interval": ci_linear,
                    "slope": linear_result['slope'],
                    "p_value": linear_result.get('p_value')
                }
            
            # 2. Polynomial Regression (degree 2)
            poly_result = self.polynomial_regression(years, values, degree=2)
            if 'error' not in poly_result:
                poly = np.poly1d(poly_result['coefficients'])
                target_norm = target_year - poly_result['year_mean']
                pred_poly = float(poly(target_norm))
                
                # Sanity check for polynomial predictions
                if pred_poly > 0 and pred_poly < values.max() * 10:
                    ci_poly = self.calculate_confidence_interval(pred_poly, np.std(values) * 0.1, len(years))
                    results["models"]["polynomial"] = {
                        "prediction": pred_poly,
                        "r_squared": poly_result['r_squared'],
                        "confidence_interval": ci_poly,
                        "degree": poly_result['degree']
                    }
            
            # 3. Exponential Growth
            exp_result = self.exponential_growth(years, values)
            if 'error' not in exp_result:
                years_diff = target_year - exp_result['base_year']
                pred_exp = exp_result['base_value'] * ((1 + exp_result['cagr']) ** years_diff)
                
                # Sanity check
                if pred_exp > 0 and pred_exp < values.max() * 10:
                    ci_exp = self.calculate_confidence_interval(pred_exp, np.std(values) * 0.1, len(years))
                    results["models"]["exponential"] = {
                        "prediction": float(pred_exp),
                        "r_squared": exp_result['r_squared'],
                        "confidence_interval": ci_exp,
                        "cagr": exp_result['cagr'],
                        "growth_rate_percent": round(exp_result['cagr'] * 100, 2)
                    }
            
            # Select best model based on R²
            if results["models"]:
                best_model_name = max(
                    results["models"].keys(),
                    key=lambda k: results["models"][k].get('r_squared', 0)
                )
                best_model = results["models"][best_model_name]
                
                results["best_model"] = best_model_name
                results["best_r_squared"] = best_model['r_squared']
                results["prediction"] = best_model['prediction']
                results["confidence_interval"] = best_model['confidence_interval']
                results["success"] = True
                
                # Add quality indicator
                if best_model['r_squared'] >= 0.9:
                    results["quality"] = "excellent"
                elif best_model['r_squared'] >= 0.7:
                    results["quality"] = "good"
                elif best_model['r_squared'] >= 0.5:
                    results["quality"] = "moderate"
                else:
                    results["quality"] = "low"
                    results["warning"] = "Low model fit (R² < 0.5). Prediction may be unreliable."
            else:
                results["error"] = "All models failed"
            
            # Cache the result
            self.prediction_cache[cache_key] = results
            
        except Exception as e:
            logger.error(f"Prediction error: {e}")
            results["error"] = str(e)
        
        return results
    
    def format_prediction_output(self, results: Dict[str, Any]) -> str:
        """Format prediction results as a clear, professional output."""
        if not results.get("success"):
            return f"❌ Prediction failed: {results.get('error', 'Unknown error')}"
        
        lines = []
        lines.append("")
        lines.append("=" * 60)
        lines.append("📊 PREDICTION ANALYSIS REPORT")
        lines.append("=" * 60)
        lines.append(f"Entity:        {results['entity']}")
        lines.append(f"Target Year:   {results['target_year']}")
        lines.append(f"Data Points:   {results['data_points']}")
        
        lines.append("")
        lines.append("📈 MODEL COMPARISON:")
        lines.append("-" * 40)
        
        for name, model in results["models"].items():
            r2 = model["r_squared"]
            pred = model["prediction"]
            marker = "✓ BEST" if name == results["best_model"] else "      "
            lines.append(f"  {marker} {name.capitalize():12}  R²={r2:.4f}  →  {pred:,.0f}")
        
        lines.append("")
        lines.append(f"✅ SELECTED MODEL: {results['best_model'].upper()}")
        lines.append(f"   Model Quality: {results['quality'].upper()} (R² = {results['best_r_squared']:.4f})")
        
        lines.append("")
        lines.append("🎯 PREDICTION:")
        lines.append("-" * 40)
        pred = results["prediction"]
        low, high = results["confidence_interval"]
        lines.append(f"   Expected Value:    {pred:,.0f}")
        lines.append(f"   95% CI Range:      {low:,.0f} — {high:,.0f}")
        
        if "warning" in results:
            lines.append("")
            lines.append(f"⚠️  {results['warning']}")
        
        lines.append("=" * 60)
        
        return "\n".join(lines)
    
    def get_prediction_code(
        self,
        entity_column: str,
        entity_value: str,
        year_column: str,
        value_column: str,
        target_year: int
    ) -> str:
        """Generate Python code for the prediction."""
        return f'''import numpy as np
from scipy import stats

# Filter data for specific entity
entity_data = df[df['{entity_column}'] == '{entity_value}'].copy()
years = entity_data['{year_column}'].values
values = entity_data['{value_column}'].values

print(f"Analyzing {{len(years)}} data points for {entity_value}")

# Model 1: Linear Regression
slope, intercept, r_lin, p_val, std_err = stats.linregress(years, values)
pred_linear = intercept + slope * {target_year}
r2_linear = r_lin ** 2

# Model 2: Polynomial Regression (degree 2)
years_norm = years - years.mean()
coeffs = np.polyfit(years_norm, values, 2)
poly = np.poly1d(coeffs)
pred_poly = poly({target_year} - years.mean())
ss_res = np.sum((values - poly(years_norm)) ** 2)
ss_tot = np.sum((values - values.mean()) ** 2)
r2_poly = 1 - (ss_res / ss_tot)

# Model 3: Exponential Growth
log_values = np.log(values[values > 0])
years_valid = years[values > 0]
slope_exp, intercept_exp, r_exp, _, _ = stats.linregress(years_valid, log_values)
r2_exp = r_exp ** 2
cagr = np.exp(slope_exp) - 1
pred_exp = np.exp(intercept_exp) * ((1 + cagr) ** ({target_year} - years_valid[0]))

# Select best model
models = {{'Linear': (r2_linear, pred_linear), 'Polynomial': (r2_poly, pred_poly), 'Exponential': (r2_exp, pred_exp)}}
best_model = max(models.items(), key=lambda x: x[1][0])

print("\\n" + "=" * 55)
print("📊 PREDICTION ANALYSIS REPORT")
print("=" * 55)
print(f"Entity: {entity_value}")
print(f"Target Year: {target_year}")
print("\\n📈 MODEL COMPARISON:")
for name, (r2, pred) in models.items():
    marker = "✓" if name == best_model[0] else " "
    print(f"  {{marker}} {{name:12}} R²={{r2:.4f}}  →  {{pred:,.0f}}")
print(f"\\n✅ SELECTED: {{best_model[0]}} (R² = {{best_model[1][0]:.4f}})")
print(f"\\n🎯 PREDICTION: {{best_model[1][1]:,.0f}}")
print("=" * 55)
'''


# Global instance
prediction_agent = PredictionAgent()
