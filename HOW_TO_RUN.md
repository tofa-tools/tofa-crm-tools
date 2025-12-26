# How to Run the Application

You have **TWO options** - choose **ONE** based on your deployment needs:

## 🚀 Option 1: FastAPI (ASGI) - Recommended for Production

**Use this for:**
- ✅ **Local development** (what you're doing now)
- ✅ **Production deployment** on modern cloud platforms
- ✅ **GCP (Google Cloud Platform)** - Cloud Run, App Engine, Compute Engine
- ✅ **AWS** - ECS, Lambda, EC2
- ✅ **Azure** - App Service, Container Instances
- ✅ **Railway, Render, Fly.io** - Easy deployment platforms
- ✅ **Any hosting that supports ASGI**
- ✅ When you need async features

**This is your MAIN application for production!**

**Run it:**
```bash
# Make sure you're in the project root directory
cd /path/to/tofa-crm

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
- Docs: http://127.0.0.1:8000/docs

---

## 🌐 Option 2: Flask (WSGI) - Temporary Workaround

**Use this ONLY for:**
- ⚠️ **PythonAnywhere Free tier** (only supports WSGI, no ASGI)
- ⚠️ Very old/legacy hosting that only supports WSGI
- ⚠️ When ASGI is not available

**Important:** Flask is a **temporary solution** for PythonAnywhere Free. Once you move to a proper cloud platform (GCP, AWS, Azure, etc.), **use FastAPI**.

**Run it:**
```bash
# Make sure you're in the project root directory
cd /path/to/tofa-crm

# Activate virtual environment
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate

# Install dependencies (includes Flask)
pip install -r requirements.txt

# Run Flask
export FLASK_APP=backend.flask_app
export FLASK_ENV=development
flask run

# Or on Windows:
# set FLASK_APP=backend.flask_app
# flask run

# Or directly with Python:
python -c "from backend.flask_app import application; application.run(debug=True)"
```

**Access it:**
- API: http://127.0.0.1:5000
- (Flask doesn't have auto-generated docs like FastAPI)

---

## ⚠️ Important: Don't Run Both at Once!

**You should run EITHER FastAPI OR Flask, NOT both simultaneously.**

- They will conflict if run on the same port
- They provide the **same API endpoints**
- They use the **same database**
- They share the **same core business logic**

---

## 🎯 Which One Should I Use?

### Use **FastAPI** (Recommended) ✅
**For:**
- ✅ **Local development** (right now)
- ✅ **Production on GCP, AWS, Azure** (when you scale)
- ✅ **Modern cloud platforms** (Railway, Render, Fly.io, etc.)
- ✅ **Any platform that supports ASGI** (most do!)
- ✅ When you want async features
- ✅ When you want auto-generated API docs

**This is your main production app!**

### Use **Flask** (Temporary Workaround) ⚠️
**Only for:**
- ⚠️ **PythonAnywhere Free tier** (temporary, limited hosting)
- ⚠️ Legacy hosting that only supports WSGI
- ⚠️ Very old platforms without ASGI support

**Once you move to GCP/AWS/Azure, switch back to FastAPI!**

---

## 📋 Quick Start Checklist

### For Local Development (FastAPI):
```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Set up .env file
# DATABASE_URL=postgresql://...
# SECRET_KEY=...

# 3. Run FastAPI
uvicorn backend.fastapi_app:app --reload

# 4. Open browser
# http://127.0.0.1:8000/docs
```

### For PythonAnywhere (Flask):
```bash
# 1. Clone repo
cd ~/tofa-crm

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure WSGI file (in PythonAnywhere Web tab)
# Import: from backend.flask_app import application

# 4. Reload web app
```

---

## 🔧 Environment Variables

**Both FastAPI and Flask use the same environment variables:**

Create a `.env` file in the project root:
```env
DATABASE_URL=postgresql://user:password@host:port/database
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

---

## 🆚 API Compatibility

**Both FastAPI and Flask provide the same API endpoints:**

| Endpoint | FastAPI | Flask | Same Response? |
|----------|---------|-------|----------------|
| `POST /token` | ✅ | ✅ | ✅ Yes |
| `GET /users/` | ✅ | ✅ | ✅ Yes |
| `POST /users/` | ✅ | ✅ | ✅ Yes |
| `GET /leads/my_leads` | ✅ | ✅ | ✅ Yes |
| `PUT /leads/{id}` | ✅ | ✅ | ✅ Yes |
| `POST /leads/upload/` | ✅ | ✅ | ✅ Yes |
| `GET /centers/` | ✅ | ✅ | ✅ Yes |
| `POST /centers/` | ✅ | ✅ | ✅ Yes |

**Your React frontend works with either one!**

---

## 💡 Tips

1. **Use FastAPI for development AND production** - It's production-ready!
2. **Flask is ONLY for PythonAnywhere Free** - Temporary workaround
3. **When you move to GCP/AWS/Azure** - Use FastAPI (recommended)
4. **Both use the same database** - No migration needed when switching
5. **Both use the same core logic** - Same business rules
6. **FastAPI is better** - Async, auto-docs, type hints, modern Python

## 🚀 Production Deployment Strategy

**Phase 1 (Now):** 
- Develop with FastAPI locally ✅
- Deploy Flask to PythonAnywhere Free (if needed) ⚠️

**Phase 2 (Future - Recommended):**
- Deploy FastAPI to **GCP Cloud Run** or **AWS Lambda** or **Railway** ✅
- Much better performance, scaling, and features
- Proper production hosting

**Phase 3 (Scale):**
- Keep using FastAPI everywhere
- Add load balancing, CDN, etc.

---

## 🐛 Troubleshooting

### "Module not found" errors
```bash
# Make sure you installed dependencies
pip install -r requirements.txt

# Make sure you're in the project root
cd /path/to/tofa-crm
```

### Port already in use
```bash
# FastAPI uses port 8000 by default
# Flask uses port 5000 by default
# Make sure the other one isn't running
```

### Database connection errors
```bash
# Check your .env file has correct DATABASE_URL
# Test database connection separately
```

---

**Remember: Choose ONE framework, run ONE server!** 🎯

