"""
Database API Router for the Data Science Platform.
Provides REST endpoints for database connections, queries, and natural language SQL.
"""

from fastapi import APIRouter, HTTPException, Body, Query
from typing import Optional, Dict, Any, List
import logging
from pydantic import BaseModel, Field

from ..utils.sql_agent import get_sql_agent
from ..utils.database_manager import get_connection_pool, get_query_history
from ..utils.vanna_integration import get_vanna_manager

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()


# Pydantic models for request validation
class DatabaseConnectionRequest(BaseModel):
    host: str = Field(..., description="Database host")
    port: int = Field(..., description="Database port")
    database: str = Field(..., description="Database name")
    username: str = Field(..., description="Database username")
    password: str = Field(..., description="Database password")
    db_type: str = Field("postgresql", description="Database type")
    ssl_mode: Optional[str] = Field(None, description="SSL mode")


class NaturalLanguageQueryRequest(BaseModel):
    question: str = Field(..., description="Natural language question")
    execute: bool = Field(True, description="Whether to execute the query")
    explain: bool = Field(True, description="Whether to include explanation")
    save_to_session: bool = Field(True, description="Whether to save results to session")


class SQLQueryRequest(BaseModel):
    sql: str = Field(..., description="SQL query to execute")
    save_to_session: bool = Field(True, description="Whether to save results to session")


class TrainingExampleRequest(BaseModel):
    question: str = Field(..., description="Natural language question")
    sql: str = Field(..., description="Corresponding SQL query")


class DocumentationRequest(BaseModel):
    documentation: str = Field(..., description="Business context documentation")


# Connection Management Endpoints

@router.post("/connect")
async def connect_database(
    request: DatabaseConnectionRequest,
    session_id: str = Query(..., description="Session ID")
):
    """
    Connect to a database and auto-train on its schema.
    
    This endpoint establishes a connection to the specified database,
    automatically extracts the schema, and trains the AI model for
    natural language queries.
    """
    try:
        agent = get_sql_agent()
        result = agent.connect_database(
            host=request.host,
            port=request.port,
            database=request.database,
            username=request.username,
            password=request.password,
            db_type=request.db_type,
            ssl_mode=request.ssl_mode,
            session_id=session_id
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Connection failed"))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error connecting to database: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/connections")
async def list_connections():
    """List all active database connections."""
    try:
        pool = get_connection_pool()
        connections = pool.list_connections()
        
        return {
            "success": True,
            "connections": connections,
            "count": len(connections)
        }
        
    except Exception as e:
        logger.error(f"Error listing connections: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/connections/{connection_id}")
async def get_connection_info(connection_id: str):
    """Get detailed information about a specific connection."""
    try:
        agent = get_sql_agent()
        result = agent.get_connection_stats(connection_id)
        
        if not result.get("success"):
            raise HTTPException(status_code=404, detail=result.get("error", "Connection not found"))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting connection info: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/connections/{connection_id}")
async def disconnect_database(connection_id: str):
    """Disconnect from a database."""
    try:
        agent = get_sql_agent()
        result = agent.disconnect(connection_id)
        
        return result
        
    except Exception as e:
        logger.error(f"Error disconnecting: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Natural Language Query Endpoints

@router.post("/ask/{connection_id}")
async def ask_question(
    connection_id: str,
    request: NaturalLanguageQueryRequest,
    session_id: str = Query(..., description="Session ID")
):
    """
    Ask a question in natural language and get SQL + results.
    
    This endpoint converts your natural language question into SQL,
    optionally executes it, and returns the results with an explanation.
    """
    try:
        agent = get_sql_agent()
        result = agent.ask(
            connection_id=connection_id,
            question=request.question,
            session_id=session_id,
            execute=request.execute,
            explain=request.explain,
            save_to_session=request.save_to_session
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Query failed"))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing question: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/{connection_id}")
async def analyze_data(
    connection_id: str,
    question: str = Body(..., embed=True),
    session_id: str = Query(..., description="Session ID")
):
    """
    Comprehensive data analysis based on a question.
    
    Generates SQL, executes the query, and provides detailed
    business insights from the results.
    """
    try:
        agent = get_sql_agent()
        result = agent.analyze_data(
            connection_id=connection_id,
            question=question,
            session_id=session_id
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Analysis failed"))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Direct SQL Execution Endpoints

@router.post("/query/{connection_id}")
async def execute_query(
    connection_id: str,
    request: SQLQueryRequest,
    session_id: str = Query(..., description="Session ID")
):
    """
    Execute a specific SQL query.
    
    This endpoint executes the provided SQL query directly.
    Only SELECT queries are allowed for safety.
    """
    try:
        agent = get_sql_agent()
        result = agent.execute_sql(
            connection_id=connection_id,
            sql=request.sql,
            session_id=session_id,
            save_to_session=request.save_to_session
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Query execution failed"))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing query: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/explain-sql/{connection_id}")
async def explain_sql(
    connection_id: str,
    sql: str = Body(..., embed=True)
):
    """
    Get a plain English explanation of a SQL query.
    
    Useful for understanding complex queries or explaining
    results to non-technical stakeholders.
    """
    try:
        agent = get_sql_agent()
        result = agent.explain_query(connection_id, sql)
        
        return result
        
    except Exception as e:
        logger.error(f"Error explaining query: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/optimize-sql/{connection_id}")
async def optimize_sql(
    connection_id: str,
    sql: str = Body(..., embed=True)
):
    """
    Get optimization suggestions for a SQL query.
    
    Returns suggested improvements, recommended indexes,
    and potential performance issues.
    """
    try:
        agent = get_sql_agent()
        result = agent.optimize_query(connection_id, sql)
        
        return result
        
    except Exception as e:
        logger.error(f"Error optimizing query: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Schema Exploration Endpoints

@router.get("/schema/{connection_id}")
async def get_schema(
    connection_id: str,
    schema: Optional[str] = Query(None, description="Specific schema to explore")
):
    """
    Get database schema information.
    
    Returns all tables, views, columns, and relationships
    in the database.
    """
    try:
        agent = get_sql_agent()
        result = agent.get_schema(connection_id, schema)
        
        if not result.get("success"):
            raise HTTPException(status_code=404, detail=result.get("error", "Schema not found"))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting schema: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/schema/{connection_id}/table/{table_name}")
async def get_table_info(
    connection_id: str,
    table_name: str,
    schema: Optional[str] = Query(None, description="Schema containing the table")
):
    """
    Get detailed information about a specific table.
    
    Returns columns, primary keys, foreign keys, indexes,
    and row count.
    """
    try:
        agent = get_sql_agent()
        result = agent.get_table_info(connection_id, table_name, schema)
        
        if not result.get("success"):
            raise HTTPException(status_code=404, detail=result.get("error", "Table not found"))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting table info: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/schema/{connection_id}/table/{table_name}/sample")
async def get_sample_data(
    connection_id: str,
    table_name: str,
    limit: int = Query(10, ge=1, le=100, description="Number of rows to fetch"),
    schema: Optional[str] = Query(None, description="Schema containing the table")
):
    """
    Get sample data from a table.
    
    Returns a preview of the table data.
    """
    try:
        agent = get_sql_agent()
        result = agent.get_sample_data(connection_id, table_name, limit, schema)
        
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to get sample data"))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting sample data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/schema/{connection_id}/compare")
async def compare_tables(
    connection_id: str,
    table1: str = Body(..., embed=True),
    table2: str = Body(..., embed=True),
    session_id: str = Query(..., description="Session ID")
):
    """
    Compare two tables and find relationships.
    
    Analyzes common columns, foreign keys, and suggests
    JOIN queries.
    """
    try:
        agent = get_sql_agent()
        result = agent.compare_tables(connection_id, table1, table2, session_id)
        
        return result
        
    except Exception as e:
        logger.error(f"Error comparing tables: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Training Endpoints

@router.post("/train/{connection_id}/schema")
async def train_from_schema(connection_id: str):
    """
    Re-train the model on the current database schema.
    
    Useful after schema changes or to refresh the training.
    """
    try:
        vanna = get_vanna_manager()
        result = vanna.train_from_schema(connection_id)
        
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Training failed"))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error training from schema: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/train/{connection_id}/example")
async def add_training_example(
    connection_id: str,
    request: TrainingExampleRequest
):
    """
    Add a question-SQL pair for training.
    
    Improves the model's accuracy for specific types of queries.
    """
    try:
        agent = get_sql_agent()
        result = agent.add_training_example(connection_id, request.question, request.sql)
        
        return result
        
    except Exception as e:
        logger.error(f"Error adding training example: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/train/{connection_id}/documentation")
async def add_documentation(
    connection_id: str,
    request: DocumentationRequest
):
    """
    Add business documentation for context.
    
    Helps the model understand business terminology and
    generate more accurate queries.
    """
    try:
        agent = get_sql_agent()
        result = agent.add_documentation(connection_id, request.documentation)
        
        return result
        
    except Exception as e:
        logger.error(f"Error adding documentation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/train/{connection_id}/stats")
async def get_training_stats(connection_id: str):
    """
    Get training statistics for a connection.
    
    Shows DDL status, documentation count, and Q&A pairs.
    """
    try:
        vanna = get_vanna_manager()
        stats = vanna.get_training_stats(connection_id)
        
        return {
            "success": True,
            "connection_id": connection_id,
            "training_stats": stats
        }
        
    except Exception as e:
        logger.error(f"Error getting training stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Suggestions & History Endpoints

@router.get("/suggestions/{connection_id}")
async def get_suggestions(connection_id: str):
    """
    Get suggested questions for a database.
    
    AI-generated questions based on the database schema.
    """
    try:
        agent = get_sql_agent()
        result = agent.get_suggestions(connection_id)
        
        return result
        
    except Exception as e:
        logger.error(f"Error getting suggestions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def get_query_history_endpoint(
    session_id: str = Query(..., description="Session ID"),
    connection_id: Optional[str] = Query(None, description="Filter by connection"),
    limit: int = Query(50, ge=1, le=500, description="Maximum entries")
):
    """
    Get query history for a session.
    
    Shows all executed queries with results and timing.
    """
    try:
        agent = get_sql_agent()
        result = agent.get_query_history(session_id, connection_id, limit)
        
        return result
        
    except Exception as e:
        logger.error(f"Error getting history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/history")
async def clear_query_history(
    session_id: str = Query(..., description="Session ID")
):
    """Clear query history for a session."""
    try:
        history = get_query_history()
        history.clear_history(session_id)
        
        return {
            "success": True,
            "message": "History cleared"
        }
        
    except Exception as e:
        logger.error(f"Error clearing history: {e}")
        raise HTTPException(status_code=500, detail=str(e))
