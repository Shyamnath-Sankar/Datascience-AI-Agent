"""
Database Connection Manager for the Data Science Platform.
Provides secure, enterprise-grade database connectivity with support for
PostgreSQL, MySQL, SQLite, and other databases via SQLAlchemy.
"""

import os
import uuid
import logging
import hashlib
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime
from functools import lru_cache
from contextlib import contextmanager
import threading

import pandas as pd
from sqlalchemy import create_engine, text, inspect, MetaData
from sqlalchemy.engine import Engine
from sqlalchemy.pool import QueuePool
from sqlalchemy.exc import SQLAlchemyError

# Configure logging
logger = logging.getLogger(__name__)


class DatabaseCredentials:
    """Secure credential storage with encryption support."""
    
    def __init__(
        self,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
        db_type: str = "postgresql",
        ssl_mode: Optional[str] = None,
        extra_params: Optional[Dict[str, Any]] = None
    ):
        self.host = host
        self.port = port
        self.database = database
        self.username = username
        self._password = password  # In production, use encryption
        self.db_type = db_type
        self.ssl_mode = ssl_mode
        self.extra_params = extra_params or {}
        self.connection_id = self._generate_connection_id()
    
    def _generate_connection_id(self) -> str:
        """Generate unique connection identifier."""
        unique_str = f"{self.host}:{self.port}/{self.database}:{self.username}"
        return hashlib.sha256(unique_str.encode()).hexdigest()[:16]
    
    @property
    def password(self) -> str:
        return self._password
    
    def get_connection_string(self) -> str:
        """Build SQLAlchemy connection string."""
        drivers = {
            "postgresql": "postgresql+psycopg2",
            "postgres": "postgresql+psycopg2",
            "mysql": "mysql+pymysql",
            "sqlite": "sqlite",
            "mssql": "mssql+pyodbc",
            "oracle": "oracle+cx_oracle",
            "redshift": "redshift+redshift_connector",
            "snowflake": "snowflake",
            "bigquery": "bigquery"
        }
        
        driver = drivers.get(self.db_type, self.db_type)
        
        if self.db_type == "sqlite":
            return f"sqlite:///{self.database}"
        
        # Build connection string
        conn_str = f"{driver}://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}"
        
        # Add SSL and extra parameters
        params = []
        if self.ssl_mode:
            params.append(f"sslmode={self.ssl_mode}")
        for key, value in self.extra_params.items():
            params.append(f"{key}={value}")
        
        if params:
            conn_str += "?" + "&".join(params)
        
        return conn_str
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary (without password)."""
        return {
            "connection_id": self.connection_id,
            "host": self.host,
            "port": self.port,
            "database": self.database,
            "username": self.username,
            "db_type": self.db_type,
            "ssl_mode": self.ssl_mode,
            "extra_params": self.extra_params
        }


class ConnectionPool:
    """Thread-safe connection pool manager."""
    
    def __init__(self, max_connections: int = 10, max_overflow: int = 20):
        self._engines: Dict[str, Engine] = {}
        self._credentials: Dict[str, DatabaseCredentials] = {}
        self._lock = threading.RLock()
        self.max_connections = max_connections
        self.max_overflow = max_overflow
        self._connection_stats: Dict[str, Dict[str, Any]] = {}
    
    def add_connection(
        self,
        credentials: DatabaseCredentials,
        test_connection: bool = True
    ) -> Tuple[bool, str]:
        """Add a new database connection to the pool."""
        with self._lock:
            try:
                # Create engine with connection pooling
                engine = create_engine(
                    credentials.get_connection_string(),
                    poolclass=QueuePool,
                    pool_size=self.max_connections,
                    max_overflow=self.max_overflow,
                    pool_pre_ping=True,  # Auto-reconnect stale connections
                    pool_recycle=3600,  # Recycle connections after 1 hour
                    echo=False
                )
                
                # Test connection if requested
                if test_connection:
                    with engine.connect() as conn:
                        conn.execute(text("SELECT 1"))
                
                # Store engine and credentials
                self._engines[credentials.connection_id] = engine
                self._credentials[credentials.connection_id] = credentials
                self._connection_stats[credentials.connection_id] = {
                    "created_at": datetime.now().isoformat(),
                    "last_used": datetime.now().isoformat(),
                    "query_count": 0,
                    "error_count": 0,
                    "total_rows_returned": 0
                }
                
                logger.info(f"Successfully added connection: {credentials.connection_id}")
                return True, credentials.connection_id
                
            except SQLAlchemyError as e:
                logger.error(f"Failed to add connection: {e}")
                return False, str(e)
    
    def get_engine(self, connection_id: str) -> Optional[Engine]:
        """Get engine by connection ID."""
        with self._lock:
            if connection_id in self._engines:
                self._connection_stats[connection_id]["last_used"] = datetime.now().isoformat()
                return self._engines[connection_id]
            return None
    
    def get_credentials(self, connection_id: str) -> Optional[DatabaseCredentials]:
        """Get credentials by connection ID."""
        return self._credentials.get(connection_id)
    
    def remove_connection(self, connection_id: str) -> bool:
        """Remove a connection from the pool."""
        with self._lock:
            if connection_id in self._engines:
                self._engines[connection_id].dispose()
                del self._engines[connection_id]
                del self._credentials[connection_id]
                del self._connection_stats[connection_id]
                logger.info(f"Removed connection: {connection_id}")
                return True
            return False
    
    def list_connections(self) -> List[Dict[str, Any]]:
        """List all active connections."""
        connections = []
        for conn_id, creds in self._credentials.items():
            conn_info = creds.to_dict()
            conn_info["stats"] = self._connection_stats.get(conn_id, {})
            connections.append(conn_info)
        return connections
    
    def update_stats(
        self,
        connection_id: str,
        rows_returned: int = 0,
        is_error: bool = False
    ):
        """Update connection statistics."""
        if connection_id in self._connection_stats:
            stats = self._connection_stats[connection_id]
            stats["query_count"] += 1
            stats["last_used"] = datetime.now().isoformat()
            stats["total_rows_returned"] += rows_returned
            if is_error:
                stats["error_count"] += 1


class SchemaExplorer:
    """Database schema introspection and metadata extraction."""
    
    def __init__(self, engine: Engine):
        self.engine = engine
        self.inspector = inspect(engine)
        self._metadata_cache: Dict[str, Any] = {}
        self._cache_time: Optional[datetime] = None
        self._cache_ttl = 300  # 5 minutes cache
    
    def _is_cache_valid(self) -> bool:
        """Check if metadata cache is still valid."""
        if self._cache_time is None:
            return False
        elapsed = (datetime.now() - self._cache_time).total_seconds()
        return elapsed < self._cache_ttl
    
    def get_schemas(self) -> List[str]:
        """Get all schemas in the database."""
        try:
            return self.inspector.get_schema_names()
        except Exception as e:
            logger.error(f"Error getting schemas: {e}")
            return []
    
    def get_tables(self, schema: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all tables with metadata."""
        try:
            tables = []
            table_names = self.inspector.get_table_names(schema=schema)
            
            for table_name in table_names:
                table_info = {
                    "name": table_name,
                    "schema": schema,
                    "type": "table",
                    "columns": self.get_columns(table_name, schema),
                    "primary_keys": self.get_primary_keys(table_name, schema),
                    "foreign_keys": self.get_foreign_keys(table_name, schema),
                    "indexes": self.get_indexes(table_name, schema),
                    "row_count": self._estimate_row_count(table_name, schema)
                }
                tables.append(table_info)
            
            return tables
        except Exception as e:
            logger.error(f"Error getting tables: {e}")
            return []
    
    def get_views(self, schema: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all views with metadata."""
        try:
            views = []
            view_names = self.inspector.get_view_names(schema=schema)
            
            for view_name in view_names:
                view_info = {
                    "name": view_name,
                    "schema": schema,
                    "type": "view",
                    "columns": self.get_columns(view_name, schema),
                    "definition": self._get_view_definition(view_name, schema)
                }
                views.append(view_info)
            
            return views
        except Exception as e:
            logger.error(f"Error getting views: {e}")
            return []
    
    def get_columns(
        self,
        table_name: str,
        schema: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get column information for a table."""
        try:
            columns = self.inspector.get_columns(table_name, schema=schema)
            return [
                {
                    "name": col["name"],
                    "type": str(col["type"]),
                    "nullable": col.get("nullable", True),
                    "default": str(col.get("default", "")) if col.get("default") else None,
                    "comment": col.get("comment", "")
                }
                for col in columns
            ]
        except Exception as e:
            logger.error(f"Error getting columns for {table_name}: {e}")
            return []
    
    def get_primary_keys(
        self,
        table_name: str,
        schema: Optional[str] = None
    ) -> List[str]:
        """Get primary key columns."""
        try:
            pk = self.inspector.get_pk_constraint(table_name, schema=schema)
            return pk.get("constrained_columns", [])
        except Exception as e:
            logger.error(f"Error getting primary keys for {table_name}: {e}")
            return []
    
    def get_foreign_keys(
        self,
        table_name: str,
        schema: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get foreign key relationships."""
        try:
            fks = self.inspector.get_foreign_keys(table_name, schema=schema)
            return [
                {
                    "columns": fk["constrained_columns"],
                    "referred_table": fk["referred_table"],
                    "referred_columns": fk["referred_columns"],
                    "referred_schema": fk.get("referred_schema")
                }
                for fk in fks
            ]
        except Exception as e:
            logger.error(f"Error getting foreign keys for {table_name}: {e}")
            return []
    
    def get_indexes(
        self,
        table_name: str,
        schema: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get index information."""
        try:
            indexes = self.inspector.get_indexes(table_name, schema=schema)
            return [
                {
                    "name": idx["name"],
                    "columns": idx["column_names"],
                    "unique": idx.get("unique", False)
                }
                for idx in indexes
            ]
        except Exception as e:
            logger.error(f"Error getting indexes for {table_name}: {e}")
            return []
    
    def _estimate_row_count(
        self,
        table_name: str,
        schema: Optional[str] = None
    ) -> Optional[int]:
        """Estimate row count for a table."""
        try:
            full_name = f"{schema}.{table_name}" if schema else table_name
            with self.engine.connect() as conn:
                result = conn.execute(text(f"SELECT COUNT(*) FROM {full_name}"))
                return result.scalar()
        except Exception:
            return None
    
    def _get_view_definition(
        self,
        view_name: str,
        schema: Optional[str] = None
    ) -> Optional[str]:
        """Get view definition SQL."""
        try:
            definition = self.inspector.get_view_definition(view_name, schema=schema)
            return definition
        except Exception:
            return None
    
    def get_full_schema(self, schema: Optional[str] = None) -> Dict[str, Any]:
        """Get complete database schema metadata."""
        if self._is_cache_valid() and schema in self._metadata_cache:
            return self._metadata_cache[schema]
        
        schema_info = {
            "schema": schema,
            "tables": self.get_tables(schema),
            "views": self.get_views(schema),
            "generated_at": datetime.now().isoformat()
        }
        
        self._metadata_cache[schema] = schema_info
        self._cache_time = datetime.now()
        
        return schema_info
    
    def generate_ddl_context(self, schema: Optional[str] = None) -> str:
        """Generate DDL-like context for AI training."""
        schema_info = self.get_full_schema(schema)
        ddl_lines = []
        
        for table in schema_info["tables"]:
            table_name = table["name"]
            columns_def = []
            
            for col in table["columns"]:
                col_def = f"  {col['name']} {col['type']}"
                if not col.get("nullable", True):
                    col_def += " NOT NULL"
                columns_def.append(col_def)
            
            # Add primary key
            if table["primary_keys"]:
                columns_def.append(f"  PRIMARY KEY ({', '.join(table['primary_keys'])})")
            
            ddl = f"CREATE TABLE {table_name} (\n"
            ddl += ",\n".join(columns_def)
            ddl += "\n);"
            
            if table.get("row_count"):
                ddl += f"\n-- Approximate row count: {table['row_count']:,}"
            
            ddl_lines.append(ddl)
        
        return "\n\n".join(ddl_lines)


class QueryExecutor:
    """Secure query execution with safety checks and performance monitoring."""
    
    # Dangerous keywords that could modify data or structure
    DANGEROUS_KEYWORDS = [
        "DROP", "DELETE", "TRUNCATE", "ALTER", "CREATE", "INSERT",
        "UPDATE", "GRANT", "REVOKE", "EXEC", "EXECUTE"
    ]
    
    def __init__(
        self,
        engine: Engine,
        allow_write: bool = False,
        max_rows: int = 100000,
        timeout: int = 60
    ):
        self.engine = engine
        self.allow_write = allow_write
        self.max_rows = max_rows
        self.timeout = timeout
    
    def validate_query(self, query: str) -> Tuple[bool, Optional[str]]:
        """Validate query for safety."""
        query_upper = query.upper().strip()
        
        # Check for dangerous keywords if write is not allowed
        if not self.allow_write:
            for keyword in self.DANGEROUS_KEYWORDS:
                if keyword in query_upper:
                    return False, f"Query contains forbidden keyword: {keyword}. Only SELECT queries are allowed."
        
        # Check for multiple statements (potential SQL injection)
        if query.count(";") > 1:
            return False, "Multiple statements not allowed"
        
        return True, None
    
    def execute_query(
        self,
        query: str,
        params: Optional[Dict[str, Any]] = None,
        return_df: bool = True
    ) -> Dict[str, Any]:
        """Execute a SQL query and return results."""
        start_time = datetime.now()
        
        # Validate query
        is_valid, error_msg = self.validate_query(query)
        if not is_valid:
            return {
                "success": False,
                "error": error_msg,
                "query": query,
                "execution_time_ms": 0
            }
        
        try:
            with self.engine.connect() as conn:
                # Set timeout if supported
                try:
                    conn.execute(text(f"SET statement_timeout = {self.timeout * 1000}"))
                except Exception:
                    pass  # Not all databases support this
                
                # Execute query
                result = conn.execute(text(query), params or {})
                
                # Check if it's a SELECT query
                if result.returns_rows:
                    # Fetch results
                    rows = result.fetchmany(self.max_rows)
                    columns = list(result.keys())
                    
                    execution_time = (datetime.now() - start_time).total_seconds() * 1000
                    
                    if return_df:
                        df = pd.DataFrame(rows, columns=columns)
                        return {
                            "success": True,
                            "data": df,
                            "columns": columns,
                            "row_count": len(df),
                            "truncated": len(rows) >= self.max_rows,
                            "execution_time_ms": execution_time,
                            "query": query
                        }
                    else:
                        return {
                            "success": True,
                            "data": [dict(zip(columns, row)) for row in rows],
                            "columns": columns,
                            "row_count": len(rows),
                            "truncated": len(rows) >= self.max_rows,
                            "execution_time_ms": execution_time,
                            "query": query
                        }
                else:
                    # Non-SELECT query (INSERT, UPDATE, etc.)
                    execution_time = (datetime.now() - start_time).total_seconds() * 1000
                    return {
                        "success": True,
                        "rows_affected": result.rowcount,
                        "execution_time_ms": execution_time,
                        "query": query
                    }
                    
        except SQLAlchemyError as e:
            execution_time = (datetime.now() - start_time).total_seconds() * 1000
            logger.error(f"Query execution error: {e}")
            return {
                "success": False,
                "error": str(e),
                "execution_time_ms": execution_time,
                "query": query
            }
    
    def explain_query(self, query: str) -> Dict[str, Any]:
        """Get query execution plan."""
        try:
            explain_query = f"EXPLAIN ANALYZE {query}"
            with self.engine.connect() as conn:
                result = conn.execute(text(explain_query))
                plan = [row[0] for row in result.fetchall()]
                
            return {
                "success": True,
                "execution_plan": plan,
                "query": query
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "query": query
            }


class QueryHistory:
    """Query history and audit logging."""
    
    def __init__(self, max_history: int = 1000):
        self._history: Dict[str, List[Dict[str, Any]]] = {}
        self.max_history = max_history
        self._lock = threading.Lock()
    
    def add_query(
        self,
        session_id: str,
        connection_id: str,
        query: str,
        result: Dict[str, Any],
        natural_language: Optional[str] = None
    ):
        """Add a query to history."""
        with self._lock:
            if session_id not in self._history:
                self._history[session_id] = []
            
            entry = {
                "id": str(uuid.uuid4()),
                "timestamp": datetime.now().isoformat(),
                "connection_id": connection_id,
                "query": query,
                "natural_language": natural_language,
                "success": result.get("success", False),
                "row_count": result.get("row_count", 0),
                "execution_time_ms": result.get("execution_time_ms", 0),
                "error": result.get("error")
            }
            
            self._history[session_id].append(entry)
            
            # Trim history if needed
            if len(self._history[session_id]) > self.max_history:
                self._history[session_id] = self._history[session_id][-self.max_history:]
    
    def get_history(
        self,
        session_id: str,
        limit: int = 50,
        connection_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get query history for a session."""
        history = self._history.get(session_id, [])
        
        if connection_id:
            history = [h for h in history if h["connection_id"] == connection_id]
        
        return history[-limit:]
    
    def get_successful_queries(
        self,
        session_id: str,
        connection_id: Optional[str] = None,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get successful queries for training or reference."""
        history = self.get_history(session_id, limit=1000, connection_id=connection_id)
        successful = [h for h in history if h["success"]]
        return successful[-limit:]
    
    def clear_history(self, session_id: str):
        """Clear history for a session."""
        with self._lock:
            if session_id in self._history:
                self._history[session_id] = []


# Global instances
connection_pool = ConnectionPool()
query_history = QueryHistory()


def get_connection_pool() -> ConnectionPool:
    """Get the global connection pool instance."""
    return connection_pool


def get_query_history() -> QueryHistory:
    """Get the global query history instance."""
    return query_history
