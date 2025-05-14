from fastapi import APIRouter, HTTPException, Depends, Body
from typing import Optional, Dict, Any, List
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.tree import DecisionTreeRegressor, DecisionTreeClassifier
from sklearn.metrics import mean_squared_error, r2_score, accuracy_score, precision_score, recall_score, f1_score
import joblib
import os
import json
from ..utils.session_manager import get_session_data
from ..utils.file_handler import get_dataframe, save_model, get_model

router = APIRouter()

@router.post("/train")
async def train_model(
    session_id: str,
    model_params: Dict[str, Any] = Body(...)
):
    """
    Train a machine learning model on the dataset.
    """
    try:
        df = get_dataframe(session_id)
        if df is None:
            raise HTTPException(status_code=404, detail="Dataset not found")

        # Extract parameters
        model_type = model_params.get("model_type")
        target_column = model_params.get("target_column")
        feature_columns = model_params.get("feature_columns", [])
        test_size = model_params.get("test_size", 0.2)
        random_state = model_params.get("random_state", 42)
        hyperparameters = model_params.get("hyperparameters", {})

        # Validate parameters
        if not model_type:
            raise HTTPException(status_code=400, detail="Model type is required")
        if not target_column:
            raise HTTPException(status_code=400, detail="Target column is required")
        if not feature_columns:
            raise HTTPException(status_code=400, detail="Feature columns are required")

        # Check if columns exist in the dataframe
        for col in [target_column] + feature_columns:
            if col not in df.columns:
                raise HTTPException(status_code=400, detail=f"Column '{col}' not found in the dataset")

        # Prepare data
        X = df[feature_columns]
        y = df[target_column]

        # Handle categorical features (simple one-hot encoding)
        X = pd.get_dummies(X, drop_first=True)

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state
        )

        # Determine if regression or classification
        is_regression = pd.api.types.is_numeric_dtype(y) and y.nunique() > 10

        # Select and train model
        model = None
        if model_type == "linear_regression" and is_regression:
            model = LinearRegression(**hyperparameters)
        elif model_type == "logistic_regression" and not is_regression:
            model = LogisticRegression(**hyperparameters)
        elif model_type == "random_forest" and is_regression:
            model = RandomForestRegressor(**hyperparameters)
        elif model_type == "random_forest" and not is_regression:
            model = RandomForestClassifier(**hyperparameters)
        elif model_type == "decision_tree" and is_regression:
            model = DecisionTreeRegressor(**hyperparameters)
        elif model_type == "decision_tree" and not is_regression:
            model = DecisionTreeClassifier(**hyperparameters)
        else:
            raise HTTPException(status_code=400, detail=f"Invalid model type '{model_type}' for the given target")

        # Train the model
        model.fit(X_train, y_train)

        # Evaluate the model
        y_pred = model.predict(X_test)

        # Calculate metrics
        metrics = {}
        if is_regression:
            metrics = {
                "mse": mean_squared_error(y_test, y_pred),
                "rmse": np.sqrt(mean_squared_error(y_test, y_pred)),
                "r2": r2_score(y_test, y_pred)
            }
        else:
            metrics = {
                "accuracy": accuracy_score(y_test, y_pred),
                "precision": precision_score(y_test, y_pred, average='weighted', zero_division=0),
                "recall": recall_score(y_test, y_pred, average='weighted', zero_division=0),
                "f1": f1_score(y_test, y_pred, average='weighted', zero_division=0)
            }

        # Save the model
        model_id = save_model(model, session_id, model_type)

        # Save feature importance if available
        feature_importance = None
        if hasattr(model, 'feature_importances_'):
            feature_importance = dict(zip(X.columns, model.feature_importances_))
        elif hasattr(model, 'coef_'):
            feature_importance = dict(zip(X.columns, model.coef_))

        # Return results
        return {
            "model_id": model_id,
            "model_type": model_type,
            "target_column": target_column,
            "feature_columns": feature_columns,
            "metrics": metrics,
            "feature_importance": feature_importance,
            "test_size": test_size,
            "hyperparameters": hyperparameters
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error training model: {str(e)}")

@router.post("/predict")
async def predict(
    session_id: str,
    prediction_params: Dict[str, Any] = Body(...)
):
    """
    Make predictions using a trained model.
    """
    try:
        df = get_dataframe(session_id)
        if df is None:
            raise HTTPException(status_code=404, detail="Dataset not found")

        # Extract parameters
        model_id = prediction_params.get("model_id")
        feature_columns = prediction_params.get("feature_columns", [])

        # Validate parameters
        if not model_id:
            raise HTTPException(status_code=400, detail="Model ID is required")

        # Load the model
        model = get_model(model_id)
        if model is None:
            raise HTTPException(status_code=404, detail=f"Model with ID '{model_id}' not found")

        # Prepare data
        if not feature_columns:
            # If no feature columns provided, use all columns except the target
            # This assumes the model metadata is stored with the model
            # For simplicity, we'll just use all columns
            feature_columns = df.columns.tolist()

        X = df[feature_columns]

        # Handle categorical features (simple one-hot encoding)
        X = pd.get_dummies(X, drop_first=True)

        # Make predictions
        predictions = model.predict(X)

        # Return results
        return {
            "model_id": model_id,
            "predictions": predictions.tolist(),
            "feature_columns": feature_columns
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error making predictions: {str(e)}")

@router.get("/models")
async def list_models(session_id: str):
    """
    List all trained models for a session.
    """
    try:
        # Get all model files in the models directory
        model_files = []
        if os.path.exists("models"):
            model_files = [f for f in os.listdir("models") if f.startswith(session_id) and f.endswith(".joblib")]

        # Extract model information
        models = []
        for model_file in model_files:
            # Extract model ID and type from filename
            model_id = model_file.replace(".joblib", "")

            # Load the model to get more information
            model = get_model(model_id)
            if model:
                # Determine model type
                model_type = "unknown"
                if isinstance(model, (LinearRegression, RandomForestRegressor, DecisionTreeRegressor)):
                    model_type = "regression"
                elif isinstance(model, (LogisticRegression, RandomForestClassifier, DecisionTreeClassifier)):
                    model_type = "classification"

                # Add model info to the list
                models.append({
                    "model_id": model_id,
                    "model_type": model_type,
                    "algorithm": model.__class__.__name__
                })

        return {"models": models}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing models: {str(e)}")
