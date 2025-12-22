# TOFA Academy CRM - React Frontend

Production-ready React/Next.js frontend for TOFA Academy CRM.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm/yarn
- Backend API running at http://127.0.0.1:8000

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.local.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Default Login
- **Email:** `admin@tofa.com`
- **Password:** `admin123`

## 📋 Features

- ✅ **Authentication** - JWT-based login/logout
- ✅ **Dashboard** - Metrics cards, charts, and recent leads
- ✅ **Lead Management** - View, filter, search, and update leads
- ✅ **User Management** - Create and manage users (team leads only)
- ✅ **Center Management** - Create and manage centers (team leads only)
- ✅ **Data Import** - Upload Excel/CSV files to import leads
- ✅ **Role-based Access Control** - Different views based on user role
- ✅ **Responsive Design** - Works on desktop, tablet, and mobile

## 🛠️ Technology Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State Management:** React Query (@tanstack/react-query)
- **HTTP Client:** Axios
- **Charts:** Recharts

## 📁 Project Structure

```
frontend-react/
├── src/
│   ├── app/                 # Next.js App Router pages
│   ├── components/          # Reusable React components
│   ├── context/             # React Context (Auth)
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utilities, API client
│   └── types/               # TypeScript definitions
├── public/                  # Static assets
└── package.json
```

## 📚 Documentation

For detailed setup instructions, see [SETUP.md](./SETUP.md)

For migration guide from Streamlit, see [../STREAMLIT_TO_REACT_MIGRATION.md](../STREAMLIT_TO_REACT_MIGRATION.md)

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## 🌐 Deployment

See [SETUP.md](./SETUP.md) for deployment instructions.

Recommended platforms:
- **Vercel** (easiest for Next.js)
- **Netlify**
- **AWS Amplify**
- **Docker** + any cloud provider

