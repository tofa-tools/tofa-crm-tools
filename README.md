# TOFA Academy - CRM System

A comprehensive Customer Relationship Management system for TOFA Academy, built with Next.js, React Native, and FastAPI.

## 🚀 Quick Start

**👉 See [SETUP.md](./SETUP.md) for complete setup instructions.**

### TL;DR

1. **Install dependencies:**
   ```bash
   npm install
   cd packages/core && npm install && npm run build && cd ../..
   pip install -r requirements.txt
   ```

2. **Start Backend (from root directory):**
   ```bash
   # Make sure you are in the root directory (d:\tofa), NOT in backend folder
   uvicorn backend.fastapi_app:app --reload --port 8000
   ```

3. **Start Web App:**
   ```bash
   cd apps/web
   npm run dev
   ```

4. **Start Mobile App:**
   ```bash
   cd apps/mobile
   npm start
   ```

## 📱 Applications

- **Web App** (`apps/web`) - Next.js web application for team leads and sales reps
- **Mobile App** (`apps/mobile`) - React Native mobile app for coaches
- **Backend** (`backend/`) - FastAPI REST API server

## 📚 Documentation

- **[SETUP.md](./SETUP.md)** - Complete setup and run guide (READ THIS FIRST!)

## 🛠️ Tech Stack

- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS
- **Mobile:** React Native, Expo
- **Backend:** FastAPI, Python, SQLModel
- **Database:** PostgreSQL / Supabase
- **Monorepo:** Turborepo

For detailed setup instructions, troubleshooting, and deployment guides, see [SETUP.md](./SETUP.md).

