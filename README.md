# TOFA Academy CRM

A complete CRM system for TOFA Academy built with FastAPI (backend) and Next.js/React (frontend).

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL database (Supabase recommended)

### Local Development

#### Backend Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env with your database URL and secret key

# Run backend
uvicorn backend.main:app --reload
```

Backend will run at: http://127.0.0.1:8000

#### Frontend Setup

```bash
cd frontend-react
npm install
cp .env.local.example .env.local
# Edit .env.local with API URL: NEXT_PUBLIC_API_URL=http://127.0.0.1:8000

npm run dev
```

Frontend will run at: http://localhost:3000

### Default Login

- **Email:** `admin@tofa.com`
- **Password:** `admin123`

## 📁 Project Structure

```
tofa-crm/
├── backend/              # FastAPI backend
│   ├── main.py          # API endpoints
│   ├── models.py        # Database models
│   ├── auth.py          # Authentication
│   └── database.py      # Database configuration
├── frontend-react/      # Next.js React frontend
│   ├── src/
│   │   ├── app/         # Pages
│   │   ├── components/  # React components
│   │   └── lib/         # API client, utilities
├── frontend/            # Streamlit frontend (legacy)
└── requirements.txt     # Python dependencies
```

## ✨ Features

- ✅ **Authentication** - JWT-based login/logout
- ✅ **Dashboard** - Metrics, charts, and analytics
- ✅ **Lead Management** - View, filter, search, and update leads
- ✅ **User Management** - Create and manage users (team leads)
- ✅ **Center Management** - Manage academy centers (team leads)
- ✅ **Data Import** - Upload Excel/CSV files to import leads
- ✅ **Role-based Access** - Different permissions for different roles
- ✅ **Meta Integration** - Webhook support for Meta Lead Forms

## 🛠️ Technology Stack

### Backend
- FastAPI
- SQLModel
- PostgreSQL (via Supabase)
- JWT authentication

### Frontend
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- React Query

## 📦 Dependencies

This project uses **separate dependency management**:

- **Backend (Python):** `requirements.txt` - Install with `pip install -r requirements.txt`
- **Frontend (Node.js):** `frontend-react/package.json` - Install with `cd frontend-react && npm install`

See [DEPENDENCIES.md](DEPENDENCIES.md) for detailed information.

## 📚 Documentation

- [Deployment Guide](DEPLOYMENT_GUIDE.md) - Deploy to PythonAnywhere + Vercel
- [Migration Guide](STREAMLIT_TO_REACT_MIGRATION.md) - Streamlit to React migration
- [Quick Start - React](QUICK_START_REACT.md) - React frontend quick start
- [Meta Integration](META_INTEGRATION_GUIDE.md) - Meta Lead Forms integration

## 🌐 Deployment

### Backend (PythonAnywhere)
See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed instructions.

### Frontend (Vercel/Netlify)
See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed instructions.

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
DATABASE_URL=postgresql://user:password@host:port/database
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

### Frontend Environment

Create `frontend-react/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

## 📝 API Documentation

Once the backend is running, visit:
- Swagger UI: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

[Add your license here]

## 🔗 Links

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)

## 💬 Support

For issues or questions, please open an issue on GitHub.

