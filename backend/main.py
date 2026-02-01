import uvicorn
import os
import sys

# Add the current directory to sys.path to ensure modules can be imported
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    # Import and run the app from api.main
    # This allows running the app simply with `python main.py` or `uvicorn main:app`
    from api.main import app
    uvicorn.run(app, host="0.0.0.0", port=8000)

# Also expose 'app' at the top level for uvicorn compatibility: `uvicorn main:app`
from api.main import app
