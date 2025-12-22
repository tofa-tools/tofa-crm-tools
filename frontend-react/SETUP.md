# Setup Guide - React Frontend

## Prerequisites

Before you begin, ensure you have:

1. **Node.js 18+** installed ([Download here](https://nodejs.org/))
2. **npm** or **yarn** package manager
3. **Backend API** running at `http://127.0.0.1:8000`

## Installation Steps

### 1. Install Dependencies

```bash
cd frontend-react
npm install
```

### 2. Configure Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and ensure the API URL is correct:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

### 3. Start Development Server

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## Default Login Credentials

- **Email:** `admin@tofa.com`
- **Password:** `admin123`

## Project Structure

```
frontend-react/
├── src/
│   ├── app/                      # Next.js App Router pages
│   │   ├── login/               # Login page
│   │   ├── dashboard/           # Dashboard page
│   │   ├── leads/               # Leads management page
│   │   ├── users/               # User management (team leads only)
│   │   ├── centers/             # Center management (team leads only)
│   │   ├── import/              # Data import page (team leads only)
│   │   ├── layout.tsx           # Root layout
│   │   ├── page.tsx             # Home/redirect page
│   │   └── providers.tsx        # React Query & Auth providers
│   ├── components/
│   │   ├── ui/                  # Reusable UI components
│   │   │   ├── StatusBadge.tsx
│   │   │   └── MetricCard.tsx
│   │   ├── layout/              # Layout components
│   │   │   ├── Sidebar.tsx
│   │   │   └── MainLayout.tsx
│   │   └── forms/               # Form components
│   │       └── LoginForm.tsx
│   ├── context/                 # React Context providers
│   │   └── AuthContext.tsx      # Authentication context
│   ├── hooks/                   # Custom React hooks
│   │   ├── useLeads.ts
│   │   ├── useUsers.ts
│   │   └── useCenters.ts
│   ├── lib/                     # Utility functions and API client
│   │   ├── api.ts               # API client with axios
│   │   ├── utils.ts             # Utility functions
│   │   └── constants.ts         # Constants
│   └── types/                   # TypeScript type definitions
│       └── index.ts
├── public/                      # Static assets
└── package.json
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server (after build)
- `npm run lint` - Run ESLint

## Features Implemented

✅ **Authentication**
- Login/logout functionality
- JWT token management
- Protected routes
- Role-based access control

✅ **Dashboard**
- Metrics cards (Total Leads, New Leads, Trials, Joined)
- Status distribution chart
- Recent leads table

✅ **Lead Management**
- View all leads with filtering
- Search by name
- Filter by status
- Update lead status
- Add follow-up dates and comments

✅ **User Management** (Team Leads only)
- Create new users
- Assign users to centers
- View all users
- Role assignment

✅ **Center Management** (Team Leads only)
- Create new centers
- View all centers
- Manage center metadata

✅ **Data Import** (Team Leads only)
- Upload Excel (.xlsx, .xls) files
- Upload CSV files
- Import leads from file
- Error handling for unknown centers

## Technology Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State Management:** React Query (TanStack Query)
- **HTTP Client:** Axios
- **Charts:** Recharts
- **Form Handling:** React Hook Form (ready for use)

## Troubleshooting

### Port Already in Use

If port 3000 is already in use, Next.js will automatically use the next available port (3001, 3002, etc.)

### API Connection Errors

1. Ensure your FastAPI backend is running
2. Check that `NEXT_PUBLIC_API_URL` in `.env.local` matches your backend URL
3. Verify CORS is enabled on your backend for `http://localhost:3000`

### Build Errors

If you encounter build errors:

```bash
# Clear Next.js cache
rm -rf .next
npm run build
```

## Production Deployment

### Build for Production

```bash
npm run build
npm start
```

### Deployment Options

1. **Vercel** (Recommended for Next.js)
   - Connect your Git repository
   - Set environment variables
   - Deploy automatically on push

2. **Docker**
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   COPY . .
   RUN npm run build
   CMD ["npm", "start"]
   ```

3. **Other Platforms**
   - Netlify
   - AWS Amplify
   - Railway
   - Render

## Next Steps

1. Customize styling to match your brand
2. Add logo to `public/` directory (and update Sidebar if needed)
3. Configure production environment variables
4. Set up CI/CD pipeline
5. Add error monitoring (e.g., Sentry)
6. Add analytics (e.g., Google Analytics)

## Support

For issues or questions, refer to:
- [Next.js Documentation](https://nextjs.org/docs)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)


