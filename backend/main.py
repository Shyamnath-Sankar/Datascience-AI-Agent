from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import pandas as pd
import io
import os
import uuid
from typing import List, Optional, Dict, Any

# Import modules for different functionalities
from app.routers import (
    data_upload,
    data_profile,
    data_cleaning,
    machine_learning,
    data_visualization,
    data_editor,
    ai_agent,
    specialized_agents,
    database,
    ai_agent_v2,
)
from app.utils.session_manager import get_session_data, create_session

app = FastAPI(
    title="Data Science Platform API",
    description="API for data processing, analysis, and machine learning",
    version="1.0.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(data_upload.router, prefix="/api/upload", tags=["Data Upload"])
app.include_router(data_profile.router, prefix="/api/profile", tags=["Data Profiling"])
app.include_router(data_cleaning.router, prefix="/api/cleaning", tags=["Data Cleaning"])
app.include_router(machine_learning.router, prefix="/api/ml", tags=["Machine Learning"])
app.include_router(
    data_visualization.router, prefix="/api/visualization", tags=["Data Visualization"]
)
app.include_router(data_editor.router, prefix="/api/editor", tags=["Data Editor"])
app.include_router(ai_agent.router, prefix="/api/agent", tags=["AI Agent"])
app.include_router(
    specialized_agents.router, prefix="/api/agents", tags=["Specialized Agents"]
)
app.include_router(database.router, prefix="/api/database", tags=["Database & SQL"])
app.include_router(ai_agent_v2.router, prefix="/api/v2/agent", tags=["AI Agent V2"])


@app.get("/")
async def root():
    return {"message": "Welcome to the Data Science Platform API"}


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}
