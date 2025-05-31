import google.generativeai as genai
import os
from typing import Dict, List, Any, Optional
import json
import pandas as pd
import re
from .file_handler import get_dataframe

# Configure Gemini API
GEMINI_API_KEY = "AIzaSyBkY6Sm51IG-GwxTFwcErQkHaB41zS0S-I"
genai.configure(api_key=GEMINI_API_KEY)

class GeminiClient:
    def __init__(self):
        self.model = genai.GenerativeModel('gemini-2.0-flash-exp')
        self.chat_sessions = {}
    
    def get_or_create_chat_session(self, session_id: str):
        """Get or create a chat session for the given session ID."""
        if session_id not in self.chat_sessions:
            self.chat_sessions[session_id] = self.model.start_chat(history=[])
        return self.chat_sessions[session_id]
    
    def get_data_context(self, session_id: str, file_id: Optional[str] = None) -> str:
        """Get context about the available data for the session."""
        try:
            df = get_dataframe(session_id, file_id)
            if df is None:
                return "No data available in the current session."
            
            # Create a summary of the dataset
            context = f"""
Available Dataset Information:
- Shape: {df.shape[0]} rows, {df.shape[1]} columns
- Columns: {', '.join(df.columns.tolist())}
- Data types: {df.dtypes.to_dict()}
- Missing values: {df.isnull().sum().to_dict()}
- Sample data (first 3 rows):
{df.head(3).to_string()}

Statistical summary:
{df.describe().to_string()}
"""
            return context
        except Exception as e:
            return f"Error accessing data: {str(e)}"
    
    def generate_response(self, session_id: str, user_message: str, file_id: Optional[str] = None) -> Dict[str, Any]:
        """Generate a response using Gemini AI with data context."""
        try:
            chat = self.get_or_create_chat_session(session_id)

            # Get data context
            data_context = self.get_data_context(session_id, file_id)

            # Create enhanced prompt with data context
            enhanced_prompt = f"""
You are an AI data science assistant. You have access to the following dataset:

{data_context}

User Query: {user_message}

IMPORTANT INSTRUCTIONS:
You are helping NON-TECHNICAL business users understand their data. Your response should be:
1. Written in simple, business-friendly language
2. Focus on insights and answers, not technical processes
3. Provide clear, actionable information
4. NO technical jargon, code explanations, or statistical terms
5. Be conversational and helpful
6. Give direct answers to their questions

If analysis is needed, perform it silently in the background, but your response should only contain:
- Direct answers to their questions
- Key business insights
- Clear recommendations
- Easy-to-understand explanations

```python
# IMPORTANT: The dataframe is already loaded as 'df' - DO NOT try to load CSV files
# Use the existing 'df' variable that contains your data

# Always start by checking the data
print("Dataset shape:", df.shape)
print("Dataset columns:", df.columns.tolist())
print("First few rows:")
print(df.head())

# Perform analysis using the existing dataframe 'df'
# DO NOT use pd.read_csv() - the data is already loaded
# Your analysis code here
```

Respond as if you're a business consultant explaining findings to a client who wants clear answers, not technical details.
"""

            response = chat.send_message(enhanced_prompt)

            # Extract code blocks and clean response
            code_blocks = self._extract_code_blocks(response.text)
            clean_response = self._clean_response_text(response.text)

            return {
                "response": clean_response,
                "code_blocks": code_blocks,
                "session_id": session_id,
                "has_code": len(code_blocks) > 0
            }

        except Exception as e:
            return {
                "response": f"Error generating response: {str(e)}",
                "code_blocks": [],
                "session_id": session_id,
                "has_code": False
            }
    
    def _extract_code_blocks(self, text: str) -> List[Dict[str, str]]:
        """Extract Python code blocks from the response text."""
        code_blocks = []
        lines = text.split('\n')
        in_code_block = False
        current_code = []
        current_language = ""
        
        for line in lines:
            if line.strip().startswith('```'):
                if in_code_block:
                    # End of code block
                    code_blocks.append({
                        "language": current_language,
                        "code": '\n'.join(current_code)
                    })
                    current_code = []
                    in_code_block = False
                else:
                    # Start of code block
                    current_language = line.strip()[3:].strip() or "text"
                    in_code_block = True
            elif in_code_block:
                current_code.append(line)
        
        return code_blocks

    def _clean_response_text(self, text: str) -> str:
        """Remove code blocks from response text to keep only explanations."""
        # Remove code blocks but keep the explanatory text
        lines = text.split('\n')
        cleaned_lines = []
        in_code_block = False

        for line in lines:
            if line.strip().startswith('```'):
                in_code_block = not in_code_block
                continue
            elif not in_code_block:
                cleaned_lines.append(line)

        # Clean up extra whitespace
        cleaned_text = '\n'.join(cleaned_lines).strip()
        # Remove multiple consecutive newlines
        cleaned_text = re.sub(r'\n\s*\n\s*\n', '\n\n', cleaned_text)

        return cleaned_text

    def generate_insights(self, session_id: str, file_id: Optional[str] = None) -> Dict[str, Any]:
        """Generate automatic insights about the dataset."""
        try:
            data_context = self.get_data_context(session_id, file_id)
            
            prompt = f"""
Analyze the following dataset and provide key insights:

{data_context}

Please provide:
1. Key findings about the data
2. Potential data quality issues
3. Interesting patterns or correlations
4. Suggestions for further analysis
5. Python code for generating visualizations to explore the data

Format your response with clear sections and include Python code blocks where appropriate.
"""
            
            response = self.model.generate_content(prompt)
            code_blocks = self._extract_code_blocks(response.text)
            
            return {
                "insights": response.text,
                "code_blocks": code_blocks,
                "session_id": session_id
            }
            
        except Exception as e:
            return {
                "insights": f"Error generating insights: {str(e)}",
                "code_blocks": [],
                "session_id": session_id
            }

# Global instance
gemini_client = GeminiClient()
