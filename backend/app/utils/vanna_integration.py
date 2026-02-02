"""
Vanna AI Integration for Natural Language to SQL.
Provides enterprise-grade text-to-SQL capabilities with training,
context management, and intelligent query generation using Vanna AI and Gemini.
"""

import os
import logging
import json
import pandas as pd
from typing import Dict, Any, Optional, List, Union

# Vanna Imports
try:
    from vanna.legacy.base import VannaBase
    from vanna.legacy.chromadb.chromadb_vector import ChromaDB_VectorStore
    VANNA_AVAILABLE = True
except ImportError:
    VANNA_AVAILABLE = False
    logging.warning("Vanna AI legacy modules not found. Ensure vanna is installed.")

from .config import settings
from .gemini_client import get_gemini_client
from .database_manager import (
    get_connection_pool, 
    get_query_history,
    SchemaExplorer,
    QueryExecutor
)

# Configure logging
logger = logging.getLogger(__name__)

if VANNA_AVAILABLE:
    class GeminiVanna(ChromaDB_VectorStore, VannaBase):
        """
        Custom Vanna adapter that uses Google Gemini for LLM and ChromaDB for storage.
        """
        def __init__(self, connection_id: str):
            self.connection_id = connection_id
            
            # Setup persistence path
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            self.vector_store_path = os.path.join(base_dir, 'data', 'vanna_vector_store')
            if not os.path.exists(self.vector_store_path):
                os.makedirs(self.vector_store_path)
            
            # Initialize ChromaDB with a specific collection for this connection
            # We use a unique collection name per connection to isolate contexts
            collection_name = f"vanna_{connection_id.replace('-', '_')}"
            
            config = {
                'path': self.vector_store_path,
                'collection_name': collection_name
            }
            
            ChromaDB_VectorStore.__init__(self, config=config)
            VannaBase.__init__(self, config=config)
            
            self.gemini_client = get_gemini_client()

        def system_message(self, message: str) -> any:
            return {"role": "system", "content": message}

        def user_message(self, message: str) -> any:
            return {"role": "user", "content": message}

        def assistant_message(self, message: str) -> any:
            return {"role": "assistant", "content": message}

        def submit_prompt(self, prompt, **kwargs) -> str:
            """
            Submit prompt to Gemini.
            prompt is a list of messages from get_sql_prompt.
            """
            try:
                # Convert message list to a single string prompt for Gemini
                # Gemini supports chat history, but for simple SQL gen, a single prompt works well.
                # We can also format it as a chat.
                
                full_prompt = ""
                for msg in prompt:
                    role = msg['role'].upper()
                    content = msg['content']
                    full_prompt += f"\n{role}: {content}\n"
                
                full_prompt += "\nASSISTANT: "
                
                response = self.gemini_client.client.models.generate_content(
                    model=settings.gemini_model,
                    contents=full_prompt
                )
                
                return response.text
                
            except Exception as e:
                logger.error(f"Error submitting prompt to Gemini: {e}")
                raise

        def run_sql(self, sql: str, **kwargs) -> pd.DataFrame:
            """
            Execute SQL query using the connection pool.
            """
            try:
                pool = get_connection_pool()
                engine = pool.get_engine(self.connection_id)
                
                if not engine:
                    raise Exception(f"Connection {self.connection_id} not found")
                
                df = pd.read_sql_query(sql, engine)
                return df
                
            except Exception as e:
                logger.error(f"Error running SQL: {e}")
                raise


class VannaManager:
    """
    High-level manager for Vanna AI integration.
    Handles connection-specific instances.
    """
    
    def __init__(self):
        self._instances: Dict[str, Any] = {}
    
    def get_vanna(self, connection_id: str) -> Any:
        """Get or create a Vanna instance for a connection."""
        if not VANNA_AVAILABLE:
            raise ImportError("Vanna AI is not available")
            
        if connection_id not in self._instances:
            self._instances[connection_id] = GeminiVanna(connection_id)
        return self._instances[connection_id]
    
    def train_from_schema(self, connection_id: str) -> Dict[str, Any]:
        """Automatically train from database schema."""
        try:
            vn = self.get_vanna(connection_id)
            pool = get_connection_pool()
            engine = pool.get_engine(connection_id)
            
            if not engine:
                return {"success": False, "error": "Connection not found"}
            
            # Use Vanna's built-in schema extraction if possible, or our SchemaExplorer
            # Vanna has generic `run_sql` to get schema, but it depends on the dialect.
            # It's safer to use our SchemaExplorer to get DDL and then feed it to Vanna.
            
            explorer = SchemaExplorer(engine)
            # Vanna prefers DDL statements
            ddl_context = explorer.generate_ddl_context()
            
            # Split DDL into chunks/statements for better training
            # We can train with the whole DDL or split it.
            # Vanna usually takes `ddl` string.
            
            vn.train(ddl=ddl_context)
            
            # Also train on information schema if helpful
            # vn.train(sql="SELECT * FROM ...") # Optional
            
            schema_info = explorer.get_full_schema()
            
            return {
                "success": True,
                "message": f"Successfully trained on {len(schema_info.get('tables', []))} tables",
                "tables_trained": len(schema_info.get('tables', []))
            }
            
        except Exception as e:
            logger.error(f"Error training from schema: {e}")
            return {"success": False, "error": str(e)}
    
    def train_with_documentation(self, connection_id: str, documentation: str) -> Dict[str, Any]:
        """Add business documentation."""
        try:
            vn = self.get_vanna(connection_id)
            vn.train(documentation=documentation)
            return {"success": True, "message": "Documentation added successfully"}
        except Exception as e:
            logger.error(f"Error adding documentation: {e}")
            return {"success": False, "error": str(e)}
    
    def train_with_example(self, connection_id: str, question: str, sql: str) -> Dict[str, Any]:
        """Add Q&A example."""
        try:
            vn = self.get_vanna(connection_id)
            vn.train(question=question, sql=sql)
            return {"success": True, "message": "Example added successfully"}
        except Exception as e:
            logger.error(f"Error adding example: {e}")
            return {"success": False, "error": str(e)}
            
    def generate_and_execute(
        self,
        connection_id: str,
        question: str,
        session_id: str,
        execute: bool = True,
        explain: bool = False
    ) -> Dict[str, Any]:
        """Generate SQL and optionally execute."""
        try:
            vn = self.get_vanna(connection_id)
            
            # Generate SQL
            # vn.generate_sql returns the SQL string
            sql = vn.generate_sql(question=question)
            
            result = {
                "success": True,
                "question": question,
                "sql": sql,
                "confidence": 0.8 # Placeholder as legacy Vanna might not return confidence easily in generate_sql
            }
            
            if execute:
                try:
                    df = vn.run_sql(sql)
                    
                    # Log to history
                    history = get_query_history()
                    history.add_query(
                        session_id=session_id,
                        connection_id=connection_id,
                        query=sql,
                        result={"success": True, "row_count": len(df)},
                        natural_language=question
                    )
                    
                    result["execution"] = {
                        "success": True,
                        "row_count": len(df),
                        "truncated": False
                    }
                    
                    result["data"] = {
                        "columns": df.columns.tolist(),
                        "rows": df.head(1000).to_dict(orient="records"),
                        "total_rows": len(df)
                    }
                    
                    # Auto-train on success? Maybe not always, to avoid bad training data.
                    # But if the user confirms, we should.
                    
                except Exception as e:
                    result["execution"] = {
                        "success": False,
                        "error": str(e)
                    }
            
            if explain:
                # Not fully supported in VannaBase standard methods, but we can implement it
                pass 
                
            return result
            
        except Exception as e:
            logger.error(f"Error in generate_and_execute: {e}")
            return {"success": False, "error": str(e), "question": question}

    def get_suggestions(self, connection_id: str) -> List[str]:
        """Get suggested questions."""
        # Vanna doesn't have a direct 'suggest' method in base, but we can prompt.
        # Or we can just return empty for now.
        return []

    def explain_query(self, connection_id: str, sql: str) -> Dict[str, Any]:
        try:
            vn = self.get_vanna(connection_id)
            # Use Gemini directly for explanation or Vanna if it had a method
            # Vanna doesn't have standard 'explain' in legacy base.
            # We can use our GeminiClient directly.
            client = get_gemini_client()
            prompt = f"Explain this SQL query in plain English: {sql}"
            response = client.client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt
            )
            return {"success": True, "explanation": response.text, "sql": sql}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def optimize_query(self, connection_id: str, sql: str) -> Dict[str, Any]:
        try:
            client = get_gemini_client()
            prompt = f"Optimize this SQL query for PostgreSQL: {sql}"
            response = client.client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt
            )
            return {"success": True, "optimization": response.text, "sql": sql}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_training_stats(self, connection_id: str) -> Dict[str, Any]:
        try:
            vn = self.get_vanna(connection_id)
            # Vanna Chroma store has methods to get data
            training_data = vn.get_training_data() # Returns DataFrame
            return {
                "training_data_size": len(training_data) if training_data is not None else 0
            }
        except Exception as e:
            return {"success": False, "error": str(e)}


vanna_manager = VannaManager()

def get_vanna_manager() -> VannaManager:
    return vanna_manager
