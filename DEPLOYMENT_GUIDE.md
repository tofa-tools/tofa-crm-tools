# Deployment Guide - PythonAnywhere + Git

This guide walks you through deploying your TOFA Academy CRM to PythonAnywhere.

## 📋 Table of Contents

1. [Git Setup](#1-git-setup)
2. [PythonAnywhere Backend Deployment](#2-pythonanywhere-backend-deployment)
3. [Frontend Deployment Options](#3-frontend-deployment-options)
4. [Configuration](#4-configuration)
5. [Troubleshooting](#5-troubleshooting)

---

## 1. Git Setup

### Step 1: Initialize Git Repository

```bash
# In your project root directory
git init
git add .
git commit -m "Initial commit: TOFA Academy CRM"

# If you already have a remote repository
git remote add origin https://github.com/yourusername/tofa-crm.git
git branch -M main
git push -u origin main
```

### Step 2: Create GitHub Repository (if needed)

1. Go to https://github.com/new
2. Create a new repository (e.g., `tofa-crm`)
3. Don't initialize with README (you already have files)
4. Copy the repository URL
5. Run the commands above

---

## 2. PythonAnywhere Backend Deployment

PythonAnywhere can host your FastAPI backend. Here's how:

### Step 1: Create PythonAnywhere Account

1. Go to https://www.pythonanywhere.com/
2. Sign up for a free account (or paid for custom domains)
3. Log in to your account

### Step 2: Clone Your Repository

Open a Bash console in PythonAnywhere:

```bash
cd ~
git clone https://github.com/yourusername/tofa-crm.git
cd tofa-crm
```

### Step 3: Set Up Virtual Environment

```bash
# Create virtual environment
python3.10 -m venv venv
# Or use python3.9, python3.11 based on what's available

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 4: Configure Environment Variables

Create a `.env` file in the project root:

```bash
nano .env
```

Add your configuration:

```env
DATABASE_URL=postgresql://user:password@host:port/database
SECRET_KEY=your-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

**Important:** 
- If using Supabase, get your DATABASE_URL from Supabase dashboard
- Generate a secure SECRET_KEY (you can use: `python -c "import secrets; print(secrets.token_urlsafe(32))"`)

### Step 5: Create Web App

1. Go to **Web** tab in PythonAnywhere dashboard
2. Click **Add a new web app**
3. Choose **Manual configuration**
4. Select Python version (3.10 recommended)
5. Click **Next**

### Step 6: Configure for ASGI (FastAPI)

**Important:** FastAPI uses ASGI, not WSGI. PythonAnywhere requires a special setup.

📖 **See [ASGI_PYTHONANYWHERE_GUIDE.md](ASGI_PYTHONANYWHERE_GUIDE.md) for complete step-by-step instructions.**

**Quick Summary:**
1. Create an Always-on Task to run uvicorn
2. Configure WSGI file as a proxy to forward requests
3. Test your deployment

#### Option A: Always-on Task (Recommended for FastAPI)

1. **Create a startup script:**

In the Bash console, create a startup file:

```bash
cd ~/tofa-crm
nano start_server.sh
```

Add this content (replace `yourusername` with your username):

```bash
#!/bin/bash
cd /home/yourusername/tofa-crm
source venv/bin/activate
export DATABASE_URL='postgresql://user:password@host:port/database'
export SECRET_KEY='your-secret-key'
export ALGORITHM='HS256'
export ACCESS_TOKEN_EXPIRE_MINUTES='60'
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Make it executable:
```bash
chmod +x start_server.sh
```

2. **Create a simple WSGI file that redirects:**

In the **Web** tab, click on the WSGI file link and replace with:

```python
# Simple WSGI proxy for ASGI app running on port 8000
def application(environ, start_response):
    # Redirect to the Always-on task
    status = '302 Found'
    headers = [('Location', 'http://yourusername.pythonanywhere.com:8000' + environ['PATH_INFO'])]
    start_response(status, headers)
    return []
```

Actually, better approach - create a WSGI wrapper:

```python
import sys
import os

# Add your project directory to the path
path = '/home/yourusername/tofa-crm'  # ← CHANGE: Replace 'yourusername'
if path not in sys.path:
    sys.path.insert(0, path)

# Set environment variables
os.environ['DATABASE_URL'] = 'postgresql://user:password@host:port/database'  # ← CHANGE
os.environ['SECRET_KEY'] = 'your-secret-key'  # ← CHANGE
os.environ['ALGORITHM'] = 'HS256'
os.environ['ACCESS_TOKEN_EXPIRE_MINUTES'] = '60'

# Activate virtual environment
activate_this = '/home/yourusername/tofa-crm/venv/bin/activate_this.py'  # ← CHANGE
try:
    with open(activate_this) as file_:
        exec(file_.read(), dict(__file__=activate_this))
except FileNotFoundError:
    # Alternative activation method
    venv_site_packages = '/home/yourusername/tofa-crm/venv/lib/python3.10/site-packages'  # ← CHANGE
    if venv_site_packages not in sys.path:
        sys.path.insert(0, venv_site_packages)

# Import ASGI app and wrap it as WSGI
from asgiref.wsgi import WsgiToAsgi
from backend.main import app

# Wrap FastAPI (ASGI) app as WSGI
application = WsgiToAsgi(app)
```

3. **Set up Always-on Task:**

- Go to **Tasks** tab in PythonAnywhere
- Click **Create a new always-on task**
- Command: `/home/yourusername/tofa-crm/start_server.sh` (or full command)
- Click **Create**
- Make sure it's enabled (green button)

📖 **For detailed ASGI configuration, see [ASGI_PYTHONANYWHERE_GUIDE.md](ASGI_PYTHONANYWHERE_GUIDE.md)**

### Step 7: Configure Static Files (if needed)

In the **Web** tab, add static file mapping:
- **URL:** `/static/`
- **Directory:** `/home/yourusername/tofa-crm/static/`

### Step 8: Reload Web App

Click the green **Reload** button in the Web tab.

### Step 9: Test Your Backend

Visit: `https://yourusername.pythonanywhere.com/docs` to see the FastAPI docs.

---

## 3. Frontend Deployment Options

### Option A: Vercel (Recommended for Next.js)

Vercel is the easiest way to deploy Next.js apps:

1. **Push code to GitHub** (already done)

2. **Go to https://vercel.com** and sign up/login with GitHub

3. **Import your repository:**
   - Click "New Project"
   - Select your `tofa-crm` repository
   - Select the `frontend-react` folder as root directory

4. **Configure environment variables:**
   - Add: `NEXT_PUBLIC_API_URL=https://yourusername.pythonanywhere.com`
   - Click Deploy

5. **Your frontend will be live at:** `https://your-project.vercel.app`

### Option B: Netlify

Similar to Vercel:

1. Go to https://www.netlify.com
2. Import from Git
3. Build settings:
   - Base directory: `frontend-react`
   - Build command: `npm run build`
   - Publish directory: `frontend-react/.next`
4. Add environment variable: `NEXT_PUBLIC_API_URL`
5. Deploy

### Option C: Build and Serve Static Files (Advanced)

If you want everything on PythonAnywhere:

```bash
cd frontend-react
npm install
npm run build
npm run export  # For static export
```

Then serve the `out` directory as static files. (Note: This won't work well with Next.js App Router, better to use Option A or B)

---

## 4. Configuration

### Update Frontend API URL

After deploying backend to PythonAnywhere, update your frontend:

**For Vercel/Netlify:**
- Add environment variable: `NEXT_PUBLIC_API_URL=https://yourusername.pythonanywhere.com`

**For local development:**
- Update `frontend-react/.env.local`:
```env
NEXT_PUBLIC_API_URL=https://yourusername.pythonanywhere.com
```

### CORS Configuration

Update your backend `main.py` CORS to include your frontend domain:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://your-frontend.vercel.app",  # Add your frontend URL
        "https://your-frontend.netlify.app",  # Or Netlify URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Then reload your PythonAnywhere web app.

---

## 5. Troubleshooting

### Backend Issues

**Issue: Module not found**
```bash
# Make sure virtual environment is activated
source venv/bin/activate
pip install -r requirements.txt
```

**Issue: Database connection failed**
- Check DATABASE_URL in .env is correct
- Verify Supabase/PostgreSQL is accessible from PythonAnywhere
- Check firewall/whitelist settings

**Issue: 502 Bad Gateway**
- Check error log in PythonAnywhere Web tab
- Verify WSGI file path is correct
- Make sure virtual environment path is correct

### Frontend Issues

**Issue: CORS errors**
- Update CORS in backend to include frontend domain
- Reload PythonAnywhere web app

**Issue: API connection failed**
- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Check backend is running: visit `https://yourusername.pythonanywhere.com/docs`
- Check browser console for specific errors

### Database Issues

**Issue: Tables not created**
```bash
# SSH into PythonAnywhere console
cd ~/tofa-crm
source venv/bin/activate
python -c "from backend.database import create_db_and_tables; create_db_and_tables()"
```

---

## 6. Updating Your Deployment

### Backend Updates

```bash
cd ~/tofa-crm
git pull origin main
source venv/bin/activate
pip install -r requirements.txt
# Reload web app in PythonAnywhere dashboard
```

### Frontend Updates

If using Vercel/Netlify, it auto-deploys on git push. Otherwise, rebuild and redeploy.

---

## 📝 Quick Checklist

- [ ] Code pushed to GitHub
- [ ] PythonAnywhere account created
- [ ] Repository cloned on PythonAnywhere
- [ ] Virtual environment created and activated
- [ ] Dependencies installed
- [ ] .env file configured
- [ ] WSGI file configured
- [ ] Web app created and reloaded
- [ ] Backend accessible at PythonAnywhere URL
- [ ] Frontend deployed (Vercel/Netlify)
- [ ] Frontend environment variable set
- [ ] CORS updated in backend
- [ ] Tested login functionality

---

## 🔗 Useful Links

- [PythonAnywhere Documentation](https://help.pythonanywhere.com/)
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)

---

## 💡 Tips

1. **Use environment variables** - Never commit secrets to Git
2. **Test locally first** - Make sure everything works before deploying
3. **Monitor logs** - Check PythonAnywhere error logs regularly
4. **Backup database** - Regularly backup your Supabase/PostgreSQL database
5. **Use custom domains** - Upgrade PythonAnywhere plan for custom domains

Good luck with your deployment! 🚀

