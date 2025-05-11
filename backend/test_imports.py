try:
    from app.routers import data_upload, data_profile, data_cleaning, machine_learning, data_visualization
    from app.utils.session_manager import get_session_data, create_session
    print("All imports successful!")
except Exception as e:
    print(f"Import error: {e}")
