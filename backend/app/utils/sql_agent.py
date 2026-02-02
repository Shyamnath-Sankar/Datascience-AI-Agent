"""
SQL Agent for Natural Language Database Queries.
Enterprise-grade AI agent for database interactions, powered by Vanna AI and Gemini.
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

import pandas as pd

from .agent_base import BaseAgent
from .config import settings
from .gemini_client import get_gemini_client
from .database_manager import (
    get_connection_pool,
    get_query_history,
    DatabaseCredentials,
    SchemaExplorer,
    QueryExecutor
)
from .vanna_integration import get_vanna_manager
from .file_handler import save_dataframe

# Configure logging
logger = logging.getLogger(__name__)


class SQLAgent(BaseAgent):
    """
    Specialized agent for natural language database queries.
    Converts questions to SQL, executes queries, and provides insights.
    """
    
    def __init__(self):
        super().__init__(
            name="SQL Agent",
            role="Database Query Expert",
            goal="Answer questions about your database using natural language",
            backstory="""I am an expert at understanding your questions and translating 
            them into precise SQL queries. I can analyze your database structure, 
            execute queries safely, explain results, and help you discover insights 
            in your data. I learn from your database schema and previous queries 
            to provide increasingly accurate results."""
        )
        self.vanna = get_vanna_manager()
        self.pool = get_connection_pool()
        self.history = get_query_history()
    
    def connect_database(
        self,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
        db_type: str = "postgresql",
        ssl_mode: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Connect to a database and auto-train on its schema.
        
        Args:
            host: Database host
            port: Database port
            database: Database name
            username: Database username
            password: Database password
            db_type: Type of database (postgresql, mysql, etc.)
            ssl_mode: SSL mode for connection
            session_id: Session ID for tracking
            
        Returns:
            Connection result with connection_id
        """
        try:
            # Create credentials
            credentials = DatabaseCredentials(
                host=host,
                port=port,
                database=database,
                username=username,
                password=password,
                db_type=db_type,
                ssl_mode=ssl_mode
            )
            
            # Add to connection pool
            success, result = self.pool.add_connection(credentials)
            
            if not success:
                return {
                    "success": False,
                    "error": result,
                    "message": "Failed to connect to database"
                }
            
            connection_id = result
            
            # Auto-train on schema
            train_result = self.vanna.train_from_schema(connection_id)
            
            # Get schema summary
            engine = self.pool.get_engine(connection_id)
            explorer = SchemaExplorer(engine)
            schema_info = explorer.get_full_schema()
            
            return {
                "success": True,
                "connection_id": connection_id,
                "database": database,
                "host": host,
                "db_type": db_type,
                "training": train_result,
                "schema_summary": {
                    "tables": len(schema_info.get("tables", [])),
                    "views": len(schema_info.get("views", [])),
                    "table_names": [t["name"] for t in schema_info.get("tables", [])],
                    "view_names": [v["name"] for v in schema_info.get("views", [])]
                },
                "message": f"Successfully connected to {database} and trained on schema"
            }
            
        except Exception as e:
            logger.error(f"Error connecting to database: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to connect to database"
            }
    
    def ask(
        self,
        connection_id: str,
        question: str,
        session_id: str,
        execute: bool = True,
        explain: bool = True,
        save_to_session: bool = True
    ) -> Dict[str, Any]:
        """
        Ask a question in natural language and get SQL + results.
        
        Args:
            connection_id: Database connection ID
            question: Natural language question
            session_id: Session ID for tracking
            execute: Whether to execute the generated SQL
            explain: Whether to include plain English explanation
            save_to_session: Whether to save results as a DataFrame in session
            
        Returns:
            Query result with SQL, explanation, and data
        """
        try:
            # Generate and execute
            result = self.vanna.generate_and_execute(
                connection_id=connection_id,
                question=question,
                session_id=session_id,
                execute=execute,
                explain=explain
            )
            
            if not result.get("success"):
                return result
            
            # Save to session if requested and we have data
            if save_to_session and "data" in result and result["data"].get("rows"):
                df = pd.DataFrame(result["data"]["rows"])
                file_id = save_dataframe(
                    df=df,
                    session_id=session_id,
                    filename=f"query_result_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                )
                result["saved_file_id"] = file_id
            
            # Add agent info
            result["agent"] = self.name
            
            return result
            
        except Exception as e:
            logger.error(f"Error in ask: {e}")
            return {
                "success": False,
                "error": str(e),
                "agent": self.name,
                "question": question
            }
    
    def execute_sql(
        self,
        connection_id: str,
        sql: str,
        session_id: str,
        save_to_session: bool = True
    ) -> Dict[str, Any]:
        """
        Execute a specific SQL query.
        
        Args:
            connection_id: Database connection ID
            sql: SQL query to execute
            session_id: Session ID for tracking
            save_to_session: Whether to save results as a DataFrame
            
        Returns:
            Query execution result
        """
        try:
            engine = self.pool.get_engine(connection_id)
            
            if not engine:
                return {
                    "success": False,
                    "error": "Connection not found",
                    "agent": self.name
                }
            
            executor = QueryExecutor(engine)
            result = executor.execute_query(sql)
            
            # Store in history
            self.history.add_query(
                session_id=session_id,
                connection_id=connection_id,
                query=sql,
                result=result
            )
            
            # Update stats
            self.pool.update_stats(
                connection_id,
                rows_returned=result.get("row_count", 0),
                is_error=not result.get("success", False)
            )
            
            if result.get("success") and "data" in result:
                df = result["data"]
                
                response = {
                    "success": True,
                    "sql": sql,
                    "columns": result.get("columns", []),
                    "row_count": len(df),
                    "execution_time_ms": result.get("execution_time_ms", 0),
                    "truncated": result.get("truncated", False),
                    "data": df.head(1000).to_dict(orient="records"),
                    "agent": self.name
                }
                
                if save_to_session:
                    file_id = save_dataframe(
                        df=df,
                        session_id=session_id,
                        filename=f"sql_result_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                    )
                    response["saved_file_id"] = file_id
                
                return response
            else:
                return {
                    "success": result.get("success", False),
                    "sql": sql,
                    "error": result.get("error"),
                    "rows_affected": result.get("rows_affected", 0),
                    "execution_time_ms": result.get("execution_time_ms", 0),
                    "agent": self.name
                }
                
        except Exception as e:
            logger.error(f"Error executing SQL: {e}")
            return {
                "success": False,
                "error": str(e),
                "agent": self.name,
                "sql": sql
            }
    
    def explain_query(self, connection_id: str, sql: str) -> Dict[str, Any]:
        """
        Get plain English explanation of a SQL query.
        
        Args:
            connection_id: Database connection ID
            sql: SQL query to explain
            
        Returns:
            Explanation in plain English
        """
        result = self.vanna.explain_query(connection_id, sql)
        result["agent"] = self.name
        return result
    
    def optimize_query(self, connection_id: str, sql: str) -> Dict[str, Any]:
        """
        Get optimization suggestions for a SQL query.
        
        Args:
            connection_id: Database connection ID
            sql: SQL query to optimize
            
        Returns:
            Optimization suggestions
        """
        result = self.vanna.optimize_query(connection_id, sql)
        result["agent"] = self.name
        return result
    
    def get_schema(
        self,
        connection_id: str,
        schema: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get database schema information.
        
        Args:
            connection_id: Database connection ID
            schema: Specific schema to explore (optional)
            
        Returns:
            Schema information including tables, views, and columns
        """
        try:
            engine = self.pool.get_engine(connection_id)
            
            if not engine:
                return {
                    "success": False,
                    "error": "Connection not found",
                    "agent": self.name
                }
            
            explorer = SchemaExplorer(engine)
            schema_info = explorer.get_full_schema(schema)
            
            return {
                "success": True,
                "schema": schema_info,
                "agent": self.name
            }
            
        except Exception as e:
            logger.error(f"Error getting schema: {e}")
            return {
                "success": False,
                "error": str(e),
                "agent": self.name
            }
    
    def get_table_info(
        self,
        connection_id: str,
        table_name: str,
        schema: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get detailed information about a specific table.
        
        Args:
            connection_id: Database connection ID
            table_name: Name of the table
            schema: Schema containing the table (optional)
            
        Returns:
            Detailed table information
        """
        try:
            engine = self.pool.get_engine(connection_id)
            
            if not engine:
                return {
                    "success": False,
                    "error": "Connection not found",
                    "agent": self.name
                }
            
            explorer = SchemaExplorer(engine)
            
            return {
                "success": True,
                "table_name": table_name,
                "schema": schema,
                "columns": explorer.get_columns(table_name, schema),
                "primary_keys": explorer.get_primary_keys(table_name, schema),
                "foreign_keys": explorer.get_foreign_keys(table_name, schema),
                "indexes": explorer.get_indexes(table_name, schema),
                "row_count": explorer._estimate_row_count(table_name, schema),
                "agent": self.name
            }
            
        except Exception as e:
            logger.error(f"Error getting table info: {e}")
            return {
                "success": False,
                "error": str(e),
                "agent": self.name
            }
    
    def get_sample_data(
        self,
        connection_id: str,
        table_name: str,
        limit: int = 10,
        schema: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get sample data from a table.
        
        Args:
            connection_id: Database connection ID
            table_name: Name of the table
            limit: Number of rows to fetch
            schema: Schema containing the table (optional)
            
        Returns:
            Sample data from the table
        """
        full_name = f"{schema}.{table_name}" if schema else table_name
        sql = f"SELECT * FROM {full_name} LIMIT {min(limit, 100)}"
        
        return self.execute_sql(connection_id, sql, "sample_data", save_to_session=False)
    
    def get_suggestions(self, connection_id: str) -> Dict[str, Any]:
        """
        Get suggested questions for a database.
        
        Args:
            connection_id: Database connection ID
            
        Returns:
            List of suggested questions
        """
        try:
            suggestions = self.vanna.get_suggestions(connection_id)
            
            return {
                "success": True,
                "suggestions": suggestions,
                "agent": self.name
            }
            
        except Exception as e:
            logger.error(f"Error getting suggestions: {e}")
            return {
                "success": False,
                "error": str(e),
                "agent": self.name
            }
    
    def add_training_example(
        self,
        connection_id: str,
        question: str,
        sql: str
    ) -> Dict[str, Any]:
        """
        Add a question-SQL pair for training.
        
        Args:
            connection_id: Database connection ID
            question: Natural language question
            sql: Corresponding SQL query
            
        Returns:
            Training result
        """
        result = self.vanna.train_with_example(connection_id, question, sql)
        result["agent"] = self.name
        return result
    
    def add_documentation(
        self,
        connection_id: str,
        documentation: str
    ) -> Dict[str, Any]:
        """
        Add business documentation for context.
        
        Args:
            connection_id: Database connection ID
            documentation: Business context documentation
            
        Returns:
            Training result
        """
        result = self.vanna.train_with_documentation(connection_id, documentation)
        result["agent"] = self.name
        return result
    
    def get_query_history(
        self,
        session_id: str,
        connection_id: Optional[str] = None,
        limit: int = 50
    ) -> Dict[str, Any]:
        """
        Get query history for a session.
        
        Args:
            session_id: Session ID
            connection_id: Filter by connection (optional)
            limit: Maximum number of entries
            
        Returns:
            Query history
        """
        try:
            history = self.history.get_history(
                session_id=session_id,
                connection_id=connection_id,
                limit=limit
            )
            
            return {
                "success": True,
                "history": history,
                "count": len(history),
                "agent": self.name
            }
            
        except Exception as e:
            logger.error(f"Error getting query history: {e}")
            return {
                "success": False,
                "error": str(e),
                "agent": self.name
            }
    
    def analyze_data(
        self,
        connection_id: str,
        question: str,
        session_id: str
    ) -> Dict[str, Any]:
        """
        Comprehensive data analysis based on a question.
        Generates SQL, executes, and provides insights.
        
        Args:
            connection_id: Database connection ID
            question: Analysis question
            session_id: Session ID
            
        Returns:
            Complete analysis with data and insights
        """
        try:
            # First, get the data
            result = self.ask(
                connection_id=connection_id,
                question=question,
                session_id=session_id,
                execute=True,
                explain=True,
                save_to_session=True
            )
            
            if not result.get("success") or "data" not in result:
                return result
            
            # Generate additional insights
            client = get_gemini_client()
            
            data_summary = {
                "columns": result["data"]["columns"],
                "row_count": result["data"]["total_rows"],
                "sample": result["data"]["rows"][:5] if result["data"]["rows"] else []
            }
            
            insights_prompt = f"""Based on this data analysis result, provide key business insights:

Question: {question}

SQL Query: {result.get('sql', '')}

Data Summary:
- Columns: {data_summary['columns']}
- Total Rows: {data_summary['row_count']}
- Sample Data: {data_summary['sample']}

Provide:
1. Key findings from the data (3-5 bullet points)
2. Business implications
3. Suggested follow-up questions
4. Any data quality observations

Format in clear, business-friendly language."""

            insights_response = client.client.models.generate_content(
                model=settings.gemini_model,
                contents=insights_prompt
            )
            
            result["insights"] = insights_response.text.strip()
            result["agent"] = self.name
            
            return result
            
        except Exception as e:
            logger.error(f"Error in analyze_data: {e}")
            return {
                "success": False,
                "error": str(e),
                "agent": self.name,
                "question": question
            }
    
    def compare_tables(
        self,
        connection_id: str,
        table1: str,
        table2: str,
        session_id: str
    ) -> Dict[str, Any]:
        """
        Compare two tables and find relationships.
        
        Args:
            connection_id: Database connection ID
            table1: First table name
            table2: Second table name
            session_id: Session ID
            
        Returns:
            Comparison analysis
        """
        try:
            engine = self.pool.get_engine(connection_id)
            
            if not engine:
                return {
                    "success": False,
                    "error": "Connection not found",
                    "agent": self.name
                }
            
            explorer = SchemaExplorer(engine)
            
            table1_info = {
                "columns": explorer.get_columns(table1),
                "primary_keys": explorer.get_primary_keys(table1),
                "foreign_keys": explorer.get_foreign_keys(table1)
            }
            
            table2_info = {
                "columns": explorer.get_columns(table2),
                "primary_keys": explorer.get_primary_keys(table2),
                "foreign_keys": explorer.get_foreign_keys(table2)
            }
            
            # Find common columns
            cols1 = set(c["name"].lower() for c in table1_info["columns"])
            cols2 = set(c["name"].lower() for c in table2_info["columns"])
            common_columns = cols1.intersection(cols2)
            
            # Find FK relationships
            relationships = []
            for fk in table1_info["foreign_keys"]:
                if fk["referred_table"].lower() == table2.lower():
                    relationships.append({
                        "from_table": table1,
                        "from_columns": fk["columns"],
                        "to_table": table2,
                        "to_columns": fk["referred_columns"]
                    })
            
            for fk in table2_info["foreign_keys"]:
                if fk["referred_table"].lower() == table1.lower():
                    relationships.append({
                        "from_table": table2,
                        "from_columns": fk["columns"],
                        "to_table": table1,
                        "to_columns": fk["referred_columns"]
                    })
            
            return {
                "success": True,
                "table1": {
                    "name": table1,
                    **table1_info
                },
                "table2": {
                    "name": table2,
                    **table2_info
                },
                "common_columns": list(common_columns),
                "relationships": relationships,
                "suggested_join": self._suggest_join(table1, table2, relationships, common_columns),
                "agent": self.name
            }
            
        except Exception as e:
            logger.error(f"Error comparing tables: {e}")
            return {
                "success": False,
                "error": str(e),
                "agent": self.name
            }
    
    def _suggest_join(
        self,
        table1: str,
        table2: str,
        relationships: List[Dict],
        common_columns: set
    ) -> Optional[str]:
        """Generate a suggested JOIN clause."""
        if relationships:
            rel = relationships[0]
            join_cols = zip(rel["from_columns"], rel["to_columns"])
            conditions = [f"{rel['from_table']}.{fc} = {rel['to_table']}.{tc}" for fc, tc in join_cols]
            return f"SELECT * FROM {table1} JOIN {table2} ON {' AND '.join(conditions)}"
        
        if common_columns:
            col = list(common_columns)[0]
            return f"SELECT * FROM {table1} JOIN {table2} ON {table1}.{col} = {table2}.{col}"
        
        return None
    
    def get_connection_stats(self, connection_id: str) -> Dict[str, Any]:
        """
        Get statistics for a database connection.
        
        Args:
            connection_id: Database connection ID
            
        Returns:
            Connection statistics
        """
        try:
            connections = self.pool.list_connections()
            conn_info = next(
                (c for c in connections if c["connection_id"] == connection_id),
                None
            )
            
            if not conn_info:
                return {
                    "success": False,
                    "error": "Connection not found",
                    "agent": self.name
                }
            
            training_stats = self.vanna.get_training_stats(connection_id)
            
            return {
                "success": True,
                "connection": conn_info,
                "training": training_stats,
                "agent": self.name
            }
            
        except Exception as e:
            logger.error(f"Error getting connection stats: {e}")
            return {
                "success": False,
                "error": str(e),
                "agent": self.name
            }
    
    def disconnect(self, connection_id: str) -> Dict[str, Any]:
        """
        Disconnect from a database.
        
        Args:
            connection_id: Database connection ID
            
        Returns:
            Disconnection result
        """
        try:
            success = self.pool.remove_connection(connection_id)
            
            return {
                "success": success,
                "message": "Disconnected successfully" if success else "Connection not found",
                "agent": self.name
            }
            
        except Exception as e:
            logger.error(f"Error disconnecting: {e}")
            return {
                "success": False,
                "error": str(e),
                "agent": self.name
            }


# Global instance
sql_agent = SQLAgent()


def get_sql_agent() -> SQLAgent:
    """Get the global SQL agent instance."""
    return sql_agent
