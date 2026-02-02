"""
Data Edit Agent - Interprets natural language commands for data manipulation.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
import re
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class EditOperation:
    """Structured representation of a data edit operation."""
    operation_type: str  # 'add_row', 'add_column', 'delete_rows', 'update_cells', 'fill_missing', 'transform'
    target: str  # What to operate on (column name, row indices, etc.)
    params: Dict[str, Any]  # Operation-specific parameters
    description: str  # Human-readable description
    is_safe: bool = True  # Whether operation is safe to execute


class DataEditAgent:
    """
    Interprets and executes natural language data editing commands.
    
    Supported operations:
    - Add rows: "Add a row for USA 2025 with population 330M"
    - Add columns: "Add a column 'growth_rate' = (current - previous) / previous"
    - Delete rows: "Delete rows where population < 1M"
    - Fill missing: "Fill missing values in 'age' with median"
    - Transform: "Convert 'price' to millions"
    - Update cells: "Set all negative values in 'price' to 0"
    """
    
    def __init__(self):
        self.operation_patterns = {
            'add_row': r'add (?:a )?row (?:for )?(.+)',
            'add_column': r'add (?:a )?column [\'"]?(\w+)[\'"]?(?:\s*=\s*(.+))?',
            'delete_rows': r'delete rows? where (.+)',
            'fill_missing': r'fill missing (?:values? )?(?:in )?[\'"]?(\w+)[\'"]? (?:with )?(.+)',
            'transform': r'(?:convert|transform) [\'"]?(\w+)[\'"]? (?:to|into) (.+)',
            'update_cells': r'set (?:all )?(.+?) (?:in )?[\'"]?(\w+)[\'"]? to (.+)',
        }
    
    def analyze_selection(self, selection: Dict[str, Any], df: pd.DataFrame) -> Dict[str, Any]:
        """
        Analyze selected data and provide insights.
        
        Args:
            selection: Selection state (type, cells, rows, columns, range, data)
            df: Source DataFrame
            
        Returns:
            Dictionary with analysis results
        """
        result = {
            'selection_type': selection.get('type'),
            'count': 0,
            'insights': [],
            'suggestions': []
        }
        
        selection_type = selection.get('type')
        
        if selection_type == 'columns':
            columns = selection.get('columns', [])
            result['count'] = len(columns)
            
            for col in columns:
                if col in df.columns:
                    col_data = df[col]
                    col_insights = self._analyze_column(col, col_data)
                    result['insights'].extend(col_insights)
        
        elif selection_type == 'rows':
            rows = selection.get('rows', [])
            result['count'] = len(rows)
            result['insights'].append(f"{len(rows)} row(s) selected")
        
        elif selection_type == 'cells':
            cells = selection.get('cells', [])
            result['count'] = len(cells)
            
            # Analyze cell values
            values = [cell.get('value') for cell in cells if cell.get('value') is not None]
            if values:
                numeric_values = [v for v in values if isinstance(v, (int, float))]
                if numeric_values:
                    result['insights'].append(f"Average: {np.mean(numeric_values):.2f}")
                    result['insights'].append(f"Sum: {sum(numeric_values):.2f}")
        
        elif selection_type == 'range':
            range_info = selection.get('range', {})
            start_row = range_info.get('startRow', 0)
            end_row = range_info.get('endRow', 0)
            result['count'] = end_row - start_row + 1
            result['insights'].append(f"Range: {result['count']} rows")
        
        return result
    
    def _analyze_column(self, col_name: str, col_data: pd.Series) -> List[str]:
        """Analyze a single column and generate insights."""
        insights = []
        
        # Basic stats
        insights.append(f"**{col_name}**: {len(col_data)} values")
        
        # Missing values
        missing = col_data.isna().sum()
        if missing > 0:
            missing_pct = (missing / len(col_data)) * 100
            insights.append(f"  ⚠️ {missing} missing ({missing_pct:.1f}%)")
        
        # Numeric column analysis
        if pd.api.types.is_numeric_dtype(col_data):
            clean_data = col_data.dropna()
            if len(clean_data) > 0:
                insights.append(f"  📊 Mean: {clean_data.mean():.2f}, Median: {clean_data.median():.2f}")
                insights.append(f"  📉 Range: [{clean_data.min():.2f}, {clean_data.max():.2f}]")
                
                # Outliers (IQR method)
                q1, q3 = clean_data.quantile(0.25), clean_data.quantile(0.75)
                iqr = q3 - q1
                outliers = clean_data[(clean_data < q1 - 1.5*iqr) | (clean_data > q3 + 1.5*iqr)]
                if len(outliers) > 0:
                    insights.append(f"  🔍 {len(outliers)} outlier(s) detected")
        
        # Categorical column analysis
        elif pd.api.types.is_object_dtype(col_data):
            unique_count = col_data.nunique()
            insights.append(f"  🏷️ {unique_count} unique value(s)")
        
        return insights
    
    def parse_command(self, command: str, df_info: Dict[str, Any]) -> Optional[EditOperation]:
        """
        Parse natural language command into structured operation.
        
        Args:
            command: Natural language command
            df_info: DataFrame metadata (columns, dtypes, sample data)
            
        Returns:
            EditOperation if command is understood, None otherwise
        """
        command_lower = command.lower().strip()
        
        # Try each operation pattern
        for op_type, pattern in self.operation_patterns.items():
            match = re.search(pattern, command_lower, re.IGNORECASE)
            if match:
                try:
                    return self._create_operation(op_type, match.groups(), command, df_info)
                except Exception as e:
                    logger.error(f"Error creating operation for {op_type}: {e}")
                    continue
        
        return None
    
    def _create_operation(
        self, 
        op_type: str, 
        match_groups: Tuple, 
        original_command: str,
        df_info: Dict[str, Any]
    ) -> EditOperation:
        """Create EditOperation from matched pattern."""
        
        if op_type == 'add_column':
            col_name = match_groups[0]
            formula = match_groups[1] if len(match_groups) > 1 else None
            
            return EditOperation(
                operation_type='add_column',
                target=col_name,
                params={'formula': formula, 'default_value': None},
                description=f"Add column '{col_name}'" + (f" with formula: {formula}" if formula else ""),
                is_safe=True
            )
        
        elif op_type == 'fill_missing':
            col_name = match_groups[0]
            fill_method = match_groups[1] if len(match_groups) > 1 else 'mean'
            
            return EditOperation(
                operation_type='fill_missing',
                target=col_name,
                params={'method': fill_method},
                description=f"Fill missing values in '{col_name}' with {fill_method}",
                is_safe=True
            )
        
        elif op_type == 'transform':
            col_name = match_groups[0]
            transformation = match_groups[1] if len(match_groups) > 1 else ''
            
            return EditOperation(
                operation_type='transform',
                target=col_name,
                params={'transformation': transformation},
                description=f"Transform '{col_name}' to {transformation}",
                is_safe=True
            )
        
        else:
            # Generic operation
            return EditOperation(
                operation_type=op_type,
                target='',
                params={'command': original_command},
                description=original_command,
                is_safe=False  # Mark as unsafe until validated
            )
    
    def generate_code(self, operation: EditOperation, df_name: str = 'df') -> str:
        """
        Generate Python code for the operation.
        
        Args:
            operation: EditOperation to convert to code
            df_name: Variable name of the DataFrame
            
        Returns:
            Python code string
        """
        code_lines = []
        code_lines.append("# Generated by Data Edit Agent")
        code_lines.append(f"# Operation: {operation.description}\n")
        
        if operation.operation_type == 'add_column':
            col_name = operation.target
            formula = operation.params.get('formula')
            
            if formula:
                code_lines.append(f"{df_name}['{col_name}'] = {formula}")
            else:
                code_lines.append(f"{df_name}['{col_name}'] = None")
        
        elif operation.operation_type == 'fill_missing':
            col_name = operation.target
            method = operation.params.get('method', 'mean')
            
            if method in ['mean', 'median']:
                code_lines.append(f"{df_name}['{col_name}'].fillna({df_name}['{col_name}'].{method}(), inplace=True)")
            elif method == 'forward' or method == 'ffill':
                code_lines.append(f"{df_name}['{col_name}'].fillna(method='ffill', inplace=True)")
            elif method == 'backward' or method == 'bfill':
                code_lines.append(f"{df_name}['{col_name}'].fillna(method='bfill', inplace=True)")
            else:
                # Try to use method as a literal value
                code_lines.append(f"{df_name}['{col_name}'].fillna({method}, inplace=True)")
        
        elif operation.operation_type == 'transform':
            col_name = operation.target
            transformation = operation.params.get('transformation', '')
            
            if 'millions' in transformation.lower():
                code_lines.append(f"{df_name}['{col_name}'] = {df_name}['{col_name}'] / 1_000_000")
            elif 'thousands' in transformation.lower():
                code_lines.append(f"{df_name}['{col_name}'] = {df_name}['{col_name}'] / 1_000")
            elif 'percent' in transformation.lower() or '%' in transformation:
                code_lines.append(f"{df_name}['{col_name}'] = {df_name}['{col_name}'] * 100")
        
        code_lines.append(f"\nprint('Operation completed: {operation.description}')")
        code_lines.append(f"print(f'Updated {{len({df_name})}} rows')")
        
        return '\n'.join(code_lines)
    
    def suggest_quick_actions(self, selection: Dict[str, Any], df: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Suggest quick actions based on selection.
        
        Returns:
            List of suggested actions with labels and code
        """
        suggestions = []
        selection_type = selection.get('type')
        
        if selection_type == 'columns':
            columns = selection.get('columns', [])
            for col in columns:
                if col in df.columns:
                    col_data = df[col]
                    
                    # Missing values suggestion
                    if col_data.isna().sum() > 0:
                        suggestions.append({
                            'label': f'Fill missing in {col}',
                            'action': 'fill_missing',
                            'params': {'column': col, 'method': 'mean'},
                            'description': f'Fill missing values in {col} with mean'
                        })
                    
                    # Outlier detection
                    if pd.api.types.is_numeric_dtype(col_data):
                        suggestions.append({
                            'label': f'Detect outliers in {col}',
                            'action': 'detect_outliers',
                            'params': {'column': col},
                            'description': f'Detect outliers in {col} using IQR method'
                        })
        
        return suggestions


# Global instance
data_edit_agent = DataEditAgent()
