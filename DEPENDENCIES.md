# Dependencies Overview

This project has **separate dependency management** for backend and frontend.

## 📦 Backend Dependencies (Python)

**File:** `requirements.txt`

The backend is a FastAPI application. Install dependencies with:

```bash
pip install -r requirements.txt
```

### Core Dependencies

- **fastapi** - Web framework
- **uvicorn** - ASGI server
- **sqlmodel** - Database ORM
- **psycopg2-binary** - PostgreSQL driver
- **python-jose** - JWT authentication
- **passlib** - Password hashing
- **pandas** - Data processing
- **openpyxl** - Excel file handling
- **python-multipart** - File upload support
- **python-dotenv** - Environment variables
- **requests** - HTTP client

### What's NOT included

- ❌ **streamlit** - Removed (old frontend, not needed for backend)
- ❌ Frontend dependencies - Frontend uses Node.js, not Python

---

## 🎨 Frontend Dependencies (Node.js)

**File:** `frontend-react/package.json`

The frontend is a Next.js/React application. Install dependencies with:

```bash
cd frontend-react
npm install
```

### Core Dependencies

- **next** - React framework
- **react** - UI library
- **typescript** - Type safety
- **tailwindcss** - Styling
- **@tanstack/react-query** - Data fetching
- **axios** - HTTP client
- **recharts** - Charts

See `frontend-react/package.json` for complete list.

---

## 🔄 Migration Notes

### Old Setup (Streamlit)
- Used `requirements.txt` with streamlit
- Single Python environment

### New Setup (Next.js)
- Backend: `requirements.txt` (Python, no streamlit)
- Frontend: `package.json` (Node.js, separate installation)

---

## 📋 Installation Commands

### Backend Setup
```bash
# Create virtual environment
python3.10 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install backend dependencies
pip install -r requirements.txt
```

### Frontend Setup
```bash
cd frontend-react
npm install
```

### Full Setup (Both)
```bash
# Backend
python3.10 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd frontend-react
npm install
```

---

## 🚀 Production Deployment

### Backend (PythonAnywhere)
- Uses `requirements.txt`
- Install with: `pip install -r requirements.txt`

### Frontend (Vercel/Netlify)
- Uses `package.json`
- Auto-installs with: `npm install` (or `npm ci` for production)

---

## 📝 Notes

- **Streamlit is removed** from backend requirements
- Frontend dependencies are **completely separate** (Node.js)
- Each part can be installed/updated independently
- No Python dependencies needed for frontend
- No Node.js dependencies needed for backend

