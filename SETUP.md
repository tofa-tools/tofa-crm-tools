# TOFA Application Setup Guide

Complete guide to set up and run the TOFA Web App, Mobile App, and Backend Server.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

1. **Node.js 18+** - [Download here](https://nodejs.org/)
2. **Python 3.9+** - [Download here](https://www.python.org/downloads/)
3. **PostgreSQL Database** - [Download here](https://www.postgresql.org/download/) or use Supabase
4. **npm** or **yarn** (comes with Node.js)
5. **pip** (Python package manager)

## 🗂️ Project Structure

```
tofa/
├── apps/
│   ├── web/          # Next.js Web Application
│   └── mobile/        # React Native Mobile App (Expo)
├── backend/           # FastAPI Backend Server
├── packages/
│   └── core/          # Shared TypeScript package (@tofa/core)
└── requirements.txt   # Python dependencies
```

## 🚀 Quick Start

### Step 1: Install Root Dependencies

```bash
# Install root dependencies (Turborepo)
npm install
```

### Step 2: Build Core Package

The `@tofa/core` package must be built before other apps can use it:

```bash
cd packages/core
npm install
npm run build
cd ../..
```

---

## 🔧 Backend Server Setup

### Step 1: Install Python Dependencies

```bash
# Create a virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Step 2: Configure Database

Create a `.env` file in the root directory (or `backend/` directory):

```env
# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/tofa_db

# JWT Secret (generate a random string)
SECRET_KEY=your-secret-key-here

# Optional: Sentry Error Tracking
SENTRY_DSN=your-sentry-dsn-here
ENVIRONMENT=development

# Optional: Welcome email (sent when Team Lead clicks "Verify & Enroll")
# Get an API key at https://resend.com/api-keys
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=Your Academy <onboarding@resend.dev>
```

**Using Supabase?** Use your Supabase connection string:
```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres
```

### Step 3: Initialize Database

If using Supabase, run the SQL schema:
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `main_schema.sql`
3. Paste and run in SQL Editor

If using local PostgreSQL:
```bash
psql -U postgres -d tofa_db -f main_schema.sql
```

### Step 4: Activate Virtual Environment and Start Backend Server

**⚠️ Important: Always activate the virtual environment before running the backend!**

**On Windows (PowerShell):**
```powershell
# Navigate to project root (d:\tofa)
cd d:\tofa

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# If you get an execution policy error, run this first:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Install dependencies (if not already installed)
pip install -r requirements.txt

# Start backend server (from ROOT directory, NOT from inside backend folder!)
uvicorn backend.fastapi_app:app --reload --host 0.0.0.0 --port 8000 --reload-exclude "node_modules/*" --reload-exclude "apps/*" --reload-exclude "packages/*" --reload-dir backend
```

**On Windows (Command Prompt):**
```cmd
# Navigate to project root
cd d:\tofa

# Activate virtual environment
venv\Scripts\activate.bat

# Install dependencies (if not already installed)
pip install -r requirements.txt

# Start backend server
uvicorn backend.fastapi_app:app --reload --host 0.0.0.0 --port 8000 --reload-exclude "node_modules/*" --reload-exclude "apps/*" --reload-exclude "packages/*" --reload-dir backend
```

**On macOS/Linux:**
```bash
# Navigate to project root
cd /path/to/tofa

# Activate virtual environment
source venv/bin/activate

# Install dependencies (if not already installed)
pip install -r requirements.txt

# Start backend server
uvicorn backend.fastapi_app:app --reload --host 0.0.0.0 --port 8000 --reload-exclude "node_modules/*" --reload-exclude "apps/*" --reload-exclude "packages/*" --reload-dir backend
```

**To deactivate the virtual environment when done:**
```bash
deactivate
```

The backend API will be available at: **http://127.0.0.1:8000**

**API Documentation (Swagger UI):** http://127.0.0.1:8000/docs

---

## 🌐 Web Application Setup

### Step 1: Clean Build Caches (Recommended for Fresh Start)

**On Windows (PowerShell):**
```powershell
cd apps/web
.\clean-dev.ps1
```

**On macOS/Linux:**
```bash
cd apps/web
chmod +x clean-dev.sh
./clean-dev.sh
```

**Or manually:**
```bash
cd apps/web
# Remove Next.js cache
rm -rf .next
# Remove Turborepo cache
rm -rf .turbo
# Remove node_modules cache
rm -rf node_modules/.cache
# Remove root-level Turborepo cache
cd ../..
rm -rf .turbo
cd apps/web
```

### Step 2: Install Dependencies

```bash
cd apps/web
npm install
```

### Step 3: Configure Environment Variables

Create a `.env.local` file in `apps/web/`:

```env
# Backend API URL
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000

# Optional: Supabase Configuration (if using Supabase)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Optional: Sentry Error Tracking (leave unset for local development)
# NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn-here
```

**Important:** Do NOT set `NEXT_PUBLIC_SENTRY_DSN` in your local `.env.local` file. Sentry is configured to be optional and will only initialize if this variable is set. This prevents module resolution errors during local development.

### Step 4: Start Web Application

```bash
# From apps/web directory
npm run dev
```

**Note:** The dev script now uses Webpack (stable) instead of Turbopack (beta) for better compatibility and fewer build-time errors. The app will be available at **http://localhost:3000**

**Alternative: Start from root directory**
```bash
# From root directory (d:\tofa)
cd apps/web
npm run dev
```
npm run dev

# Or from root directory
npm run dev --filter=tofa-crm-frontend
```

The web app will be available at: **http://localhost:3000**

---

## 📱 Mobile Application Setup

### Step 1: Install Dependencies

```bash
cd apps/mobile
npm install
```

### Step 2: Configure Environment Variables

Create a `.env` file in `apps/mobile/`:

```env
# Backend API URL
# For emulator/simulator, use: http://127.0.0.1:8000
# For physical device, use your computer's IP: http://192.168.1.XXX:8000
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

**To find your computer's IP:**
- Windows: Run `ipconfig` in Command Prompt, look for "IPv4 Address"
- macOS/Linux: Run `ifconfig` in Terminal, look for "inet"

### Step 3: Start Mobile App

```bash
# From apps/mobile directory
npm start

# Or run on specific platform
npm run android  # For Android
npm run ios       # For iOS (macOS only)
```

The Expo development server will start. Scan the QR code with:
- **Android**: Expo Go app
- **iOS**: Camera app (iOS 11+)

---

## 🎯 Running All Services Separately

### Option 1: Run Each Service in Separate Terminals (Recommended)

**Terminal 1 - Backend (from ROOT directory):**
```bash
# Make sure you're in d:\tofa (root), NOT in backend folder
# Exclude node_modules and other non-Python directories from reload watch
uvicorn backend.fastapi_app:app --reload --port 8000 --reload-exclude "node_modules/*" --reload-exclude "apps/*" --reload-exclude "packages/*" --reload-dir backend
```

**Terminal 2 - Web App:**
```bash
cd apps/web
npm run dev
```

**Terminal 3 - Mobile App:**
```bash
cd apps/mobile
npm start
```

### Option 2: Use Turborepo (Monorepo)

From the root directory:

```bash
# Run all apps in development mode
npm run dev

# Build all apps
npm run build

# Run linting
npm run lint
```

---

## 🔐 Default Login Credentials

After setting up the database, you can create a user via the API or use these default credentials (if seeded):

- **Email:** `admin@tofa.com`
- **Password:** `admin123`

**Note:** Create your first user via the `/users` endpoint or database directly.

---

## 🛠️ Development Commands Reference

### Backend (FastAPI)

```bash
# IMPORTANT: Run from ROOT directory, not from backend folder

# Option 1: Using the development script (Recommended - handles reload exclusions automatically)
python backend/run_dev.py

# Option 2: Using uvicorn directly (with proper exclusions to avoid node_modules errors)
uvicorn backend.fastapi_app:app --reload --port 8000 --reload-exclude "node_modules/*" --reload-exclude "apps/*" --reload-exclude "packages/*" --reload-dir backend

# Run database migrations
python migrations/add_last_updated_column.py

# Access API documentation
# Open http://127.0.0.1:8000/docs in browser
```

### Web App (Next.js)

```bash
cd apps/web

# Development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Linting
npm run lint
```

### Mobile App (Expo)

```bash
cd apps/mobile

# Start Expo development server
npm start

# Run on Android
npm run android

# Run on iOS (macOS only)
npm run ios

# Clear cache if issues
npx expo start -c
```

---

## 🗄️ Database Setup Options

### Option 1: Using PostgreSQL (Local)

1. Install PostgreSQL
2. Create a database:
```sql
CREATE DATABASE tofa_db;
```
3. Update `DATABASE_URL` in your `.env` file
4. Run the schema file:
```bash
psql -U postgres -d tofa_db -f main_schema.sql
```

### Option 2: Using Supabase (Recommended for Quick Setup)

1. Create a project at [supabase.com](https://supabase.com)
2. Get your connection string from Project Settings → Database
3. Update `DATABASE_URL` in your `.env` file
4. Run the schema:
   - Go to Supabase Dashboard → SQL Editor
   - Copy contents of `main_schema.sql`
   - Paste and run

---

## 🔧 Troubleshooting

### Backend Issues

**Port 8000 already in use:**
```bash
# Use a different port
uvicorn backend.fastapi_app:app --reload --port 8001
# Then update NEXT_PUBLIC_API_URL in web/mobile apps
```

**Database connection errors:**
- Verify `DATABASE_URL` is correct in `.env`
- Ensure PostgreSQL is running
- Check firewall settings
- For Supabase, ensure connection string includes correct password

**Module not found errors:**
```bash
# Reinstall dependencies
pip install -r requirements.txt
```

### Web App Issues

**Port 3000 already in use:**
- Next.js will automatically use the next available port (3001, 3002, etc.)

**API connection errors:**
- Ensure backend is running on `http://127.0.0.1:8000`
- Check `NEXT_PUBLIC_API_URL` in `.env.local`
- Verify CORS is enabled in backend (should be by default)

**Build errors:**
```bash
# Clear Next.js cache
rm -rf apps/web/.next
cd apps/web
npm run build
```

**Sentry module resolution errors:**
If you see errors about `@sentry/core` or `@sentry/vercel-edge` not found:

1. **Ensure `NEXT_PUBLIC_SENTRY_DSN` is NOT set in `.env.local`** - Sentry is now optional and will only load if this variable is set.

2. **Clean build caches:**
```bash
cd apps/web
# Windows PowerShell
.\clean-dev.ps1
# macOS/Linux
./clean-dev.sh
```

3. **If you need Sentry, install dependencies:**
```bash
cd apps/web
npm install @sentry/core @sentry/vercel-edge @swc/helpers --legacy-peer-deps
```

4. **Restart the dev server:**
```bash
npm run dev
```

### Mobile App Issues

**Expo not starting:**
```bash
# Clear Expo cache
npx expo start -c
```

**Cannot connect to backend from physical device:**
- Use your computer's local IP address instead of `127.0.0.1`
- Find your IP: `ipconfig` (Windows) or `ifconfig` (macOS/Linux)
- Update `NEXT_PUBLIC_API_URL` to `http://[YOUR-IP]:8000`
- Ensure backend allows connections from your network
- Check Windows Firewall settings

**Metro bundler errors:**
```bash
# Reset Metro cache
npx expo start --clear
```

---

## 📦 Production Deployment

### Backend

```bash
# Install production dependencies
pip install -r requirements.txt

# Set production environment variables
export ENVIRONMENT=production
export DATABASE_URL=your-production-db-url

# Run with production server (Gunicorn recommended)
pip install gunicorn
gunicorn backend.fastapi_app:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Web App

```bash
cd apps/web

# Build for production
npm run build

# Start production server
npm start

# Or deploy to Vercel (recommended for Next.js)
# Connect your Git repository and deploy
```

### Mobile App

```bash
cd apps/mobile

# Build for production
# Android
eas build --platform android

# iOS
eas build --platform ios

# Submit to stores
eas submit --platform android
eas submit --platform ios
```

---

## 📚 Additional Resources

- **Backend API Docs:** http://127.0.0.1:8000/docs (when backend is running)
- **Next.js Docs:** https://nextjs.org/docs
- **Expo Docs:** https://docs.expo.dev
- **FastAPI Docs:** https://fastapi.tiangolo.com

---

## 🆘 Need Help?

1. Check the API documentation at `/docs` endpoint
2. Review error messages in terminal/console
3. Verify all environment variables are set correctly
4. Ensure all services are running on correct ports
5. Check that the core package is built: `cd packages/core && npm run build`

---

**Happy Coding! 🚀**

