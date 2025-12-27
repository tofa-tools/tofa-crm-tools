# How to Run the Application

This application uses **FastAPI** (ASGI framework) for production deployment.

## 🚀 Running FastAPI

**Use FastAPI for:**
- ✅ Local development
- ✅ Production deployment on modern cloud platforms
- ✅ GCP (Google Cloud Platform) - Cloud Run, App Engine, Compute Engine
- ✅ AWS - ECS, Lambda, EC2
- ✅ Azure - App Service, Container Instances
- ✅ Railway, Render, Fly.io - Easy deployment platforms
- ✅ Any hosting that supports ASGI

**Run it:**
```bash
# Make sure you're in the project root directory
cd /path/to/tofa

# Activate virtual environment (if using one)
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run FastAPI
uvicorn backend.fastapi_app:app --reload

# Or use the backward-compatible main.py
uvicorn backend.main:app --reload
```

**Access it:**
- API: http://127.0.0.1:8000
- Interactive API Docs: http://127.0.0.1:8000/docs
- Alternative Docs: http://127.0.0.1:8000/redoc

---

## 📋 Quick Start Checklist

### For Local Development:

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Set up .env file in project root
# DATABASE_URL=postgresql://...
# SECRET_KEY=...
# ALGORITHM=HS256
# ACCESS_TOKEN_EXPIRE_MINUTES=60

# 3. Run FastAPI
uvicorn backend.fastapi_app:app --reload

# 4. Open browser
# http://127.0.0.1:8000/docs
```

---

## 🔧 Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://user:password@host:port/database
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

**Note:** 
- For Supabase, get your `DATABASE_URL` from Supabase dashboard
- Generate a secure `SECRET_KEY`: `python -c "import secrets; print(secrets.token_urlsafe(32))"`

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/token` | User login (get JWT token) |
| `GET` | `/users/` | Get all users (requires auth) |
| `POST` | `/users/` | Create new user (requires auth) |
| `GET` | `/leads/my_leads` | Get user's leads (requires auth) |
| `PUT` | `/leads/{id}` | Update lead (requires auth) |
| `POST` | `/leads/upload/` | Upload CSV/Excel file (requires auth) |
| `POST` | `/leads/webhook` | Meta webhook endpoint |
| `GET` | `/centers/` | Get all centers (requires auth) |
| `POST` | `/centers/` | Create center (requires auth) |

**Full API documentation:** Visit http://127.0.0.1:8000/docs when server is running

---

## 🐛 Troubleshooting

### "Module not found" errors
```bash
# Make sure you installed dependencies
pip install -r requirements.txt

# Make sure you're in the project root (not inside backend/)
cd /path/to/tofa
# NOT: cd /path/to/tofa/backend
```

### Port already in use
```bash
# FastAPI uses port 8000 by default
# If port 8000 is in use, specify a different port:
uvicorn backend.fastapi_app:app --reload --port 8001
```

### Database connection errors
```bash
# Check your .env file has correct DATABASE_URL
# Test database connection separately
# Make sure database is accessible from your network
```

### Import errors when running uvicorn
```bash
# Always run uvicorn from project root directory
# The command expects: backend.fastapi_app:app
# This means "backend" must be a package in the current directory
```

---

## 🚀 Production Deployment

For production deployment on GCP, AWS, Azure, or other cloud platforms, see:
- `PRODUCTION_DEPLOYMENT.md` - Production deployment guide
- `DEPLOYMENT_GUIDE.md` - General deployment guide

---

**Remember: Always run uvicorn from the project root directory!** 🎯
