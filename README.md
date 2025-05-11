# Data Science Platform

A comprehensive platform for data analysis, visualization, and machine learning with an Excel-inspired user interface.

## Features

- **Data Upload**: Upload CSV or Excel files for analysis
- **Data Profiling**: Explore and understand your dataset with detailed statistics
- **Data Cleaning**: Clean and prepare your data with advanced tools
- **Machine Learning**: Train and evaluate machine learning models
- **Data Visualization**: Create interactive charts and visualizations
- **Excel-Inspired UI**: Familiar interface with Excel-like styling and interactions

## Tech Stack

- **Backend**: FastAPI, Python, scikit-learn, pandas, numpy
- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **UI Design**: Excel-inspired design system with custom CSS variables

## Project Structure

```
datascience/
├── backend/               # FastAPI backend
│   ├── app/               # Application code
│   │   ├── routers/       # API routes
│   │   └── utils/         # Utility functions
│   ├── main.py            # Main application entry point
│   └── requirements.txt   # Python dependencies
│
└── frontend/              # Next.js frontend
    ├── public/            # Static assets
    └── src/               # Source code
        ├── app/           # Next.js app router
        ├── components/    # React components
        └── lib/           # Utility functions
```

## Getting Started

### Prerequisites

- Python 3.8+
- Node.js 18+
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Create a virtual environment:
   ```
   python -m venv venv
   ```

3. Activate the virtual environment:
   - Windows: `venv\Scripts\activate`
   - macOS/Linux: `source venv/bin/activate`

4. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

5. Start the backend server:
   ```
   uvicorn main:app --reload
   ```

The API will be available at http://localhost:8000.

### Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

The frontend will be available at http://localhost:3000.

## Usage

1. Open the application in your browser at http://localhost:3000
2. Upload a CSV or Excel file on the home page
3. Navigate through the different sections to analyze and visualize your data
4. Clean your data and train machine learning models


### Interactive Features
- Tooltips for additional information
- Hover effects on tables and interactive elements
- Excel-like data presentation and formatting



> Note: Screenshots are placeholders. Replace with actual application screenshots.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
