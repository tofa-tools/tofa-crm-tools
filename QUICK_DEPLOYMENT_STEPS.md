# Quick Deployment Steps

A condensed guide for deploying TOFA Academy CRM to Git and PythonAnywhere.

## 🎯 Quick Summary

1. **Git Setup** → Push code to GitHub
2. **PythonAnywhere** → Deploy backend
3. **Vercel/Netlify** → Deploy frontend

---

## Step 1: Git Setup (5 minutes)

```bash
# In your project directory
git init
git add .
git commit -m "Initial commit"

# Create repository on GitHub.com, then:
git remote add origin https://github.com/YOUR_USERNAME/tofa-crm.git
git branch -M main
git push -u origin main
```

**Need help?** See [GIT_SETUP.md](GIT_SETUP.md) for detailed instructions.

---

## Step 2: PythonAnywhere Backend (15 minutes)

### 2.1 Create Account
- Go to https://www.pythonanywhere.com/
- Sign up for free account

### 2.2 Clone Repository
```bash
# In PythonAnywhere Bash console
cd ~
git clone https://github.com/YOUR_USERNAME/tofa-crm.git
cd tofa-crm
```

### 2.3 Setup Environment
```bash
# Create virtual environment
python3.10 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

### 2.4 Configure Environment Variables
```bash
nano .env
```

Add:
```env
DATABASE_URL=postgresql://user:password@host:port/database
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

### 2.5 Create Web App
1. Go to **Web** tab
2. Click **Add a new web app**
3. Choose **Manual configuration** → Python 3.10
4. Click **WSGI configuration file** link
5. Replace content with code from `pythonanywhere_wsgi.py.example`
6. Update `USERNAME` and environment variables
7. Save and reload web app

### 2.6 Test
Visit: `https://YOUR_USERNAME.pythonanywhere.com/docs`

**Your backend URL:** `https://YOUR_USERNAME.pythonanywhere.com`

---

## Step 3: Frontend Deployment - Vercel (5 minutes)

### 3.1 Sign Up
- Go to https://vercel.com
- Sign up with GitHub

### 3.2 Import Project
1. Click **New Project**
2. Import `tofa-crm` repository
3. Set **Root Directory** to `frontend-react`
4. Add environment variable:
   - Key: `NEXT_PUBLIC_API_URL`
   - Value: `https://YOUR_USERNAME.pythonanywhere.com`
5. Click **Deploy**

### 3.3 Done!
Your frontend is live at: `https://your-project.vercel.app`

---

## Step 4: Update CORS (2 minutes)

### 4.1 Update Backend CORS
Edit `backend/main.py`:

```python
allow_origins=[
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://your-project.vercel.app",  # Add your Vercel URL
],
```

### 4.2 Commit and Push
```bash
git add backend/main.py
git commit -m "Update CORS for production"
git push
```

### 4.3 Update PythonAnywhere
```bash
# In PythonAnywhere console
cd ~/tofa-crm
git pull origin main
# Reload web app in Web tab
```

---

## Step 5: Test Everything

1. ✅ Visit frontend URL
2. ✅ Login with `admin@tofa.com` / `admin123`
3. ✅ Test dashboard loads
4. ✅ Test leads page
5. ✅ Verify API calls work (check browser console)

---

## 🔧 Common Issues

### Backend not accessible
- Check Web tab → Error log
- Verify WSGI file paths are correct
- Ensure virtual environment is activated

### CORS errors
- Add frontend URL to `allow_origins` in `backend/main.py`
- Reload PythonAnywhere web app

### Login fails
- Verify backend is running
- Check `NEXT_PUBLIC_API_URL` is correct
- Check browser console for errors

---

## 📝 Quick Reference

| Service | URL Format |
|---------|-----------|
| Backend | `https://YOUR_USERNAME.pythonanywhere.com` |
| Frontend | `https://your-project.vercel.app` |
| API Docs | `https://YOUR_USERNAME.pythonanywhere.com/docs` |

---

## ✅ Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] PythonAnywhere account created
- [ ] Backend deployed and accessible
- [ ] Frontend deployed to Vercel
- [ ] Environment variables set
- [ ] CORS updated
- [ ] Login tested
- [ ] All features working

---

**That's it!** Your CRM is now live! 🚀

For detailed instructions, see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

