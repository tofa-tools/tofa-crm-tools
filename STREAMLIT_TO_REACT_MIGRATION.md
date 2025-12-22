# Streamlit to React.js Migration Guide

## 🎯 Overview

This guide outlines the steps to convert your TOFA Academy CRM from Streamlit to a production-ready React.js application.

## 📱 Mobile Considerations: React.js vs Alternatives

### Is React.js the best option for mobile?

**Short answer:** React.js alone is web-only, but **React Native** (or hybrid solutions) would be better for native mobile apps.

### Options for Mobile Support:

1. **React Native** (Recommended for native mobile)
   - ✅ Same React syntax/knowledge transfer
   - ✅ True native iOS/Android apps
   - ✅ Excellent performance
   - ✅ Large ecosystem
   - ⚠️ Separate codebase from web (or use React Native Web)

2. **React with Capacitor/Cordova** (Hybrid apps)
   - ✅ Single React codebase
   - ✅ Package as mobile app
   - ⚠️ Not truly native, performance limitations
   - ✅ Good for simpler apps

3. **Expo + React Native** (Best for rapid mobile development)
   - ✅ Build on React Native
   - ✅ Easier setup and deployment
   - ✅ Over-the-air updates
   - ✅ Great developer experience

4. **Next.js (React framework) + React Native Web**
   - ✅ Single codebase for web + mobile
   - ✅ Better SEO (SSR)
   - ⚠️ More complex setup

### Recommendation:
- **For web:** Use React.js with a modern framework (Next.js or Vite + React)
- **For mobile:** Start with **React Native** (or Expo) - shares ~80% code structure with React
- **Alternative:** Use **Next.js** with **React Native Web** for code sharing

---

## 🔄 Migration Steps

### Phase 1: Setup & Planning (Week 1)

#### 1.1 Choose Your React Stack
```bash
# Option A: Next.js (Recommended for production)
npx create-next-app@latest tofa-crm-frontend --typescript --tailwind --app

# Option B: Vite + React (Lighter, faster dev)
npm create vite@latest tofa-crm-frontend -- --template react-ts
```

**Recommended Stack:**
- **Framework:** Next.js 14+ (App Router) or Vite + React
- **Styling:** Tailwind CSS (matches your current design approach)
- **State Management:** Zustand or React Query (for server state)
- **HTTP Client:** Axios or fetch with React Query
- **Routing:** Next.js App Router (if Next.js) or React Router
- **UI Components:** shadcn/ui, Material-UI, or Ant Design
- **Form Handling:** React Hook Form + Zod
- **Charts:** Recharts or Chart.js (replacing Streamlit charts)

#### 1.2 Project Structure
```
frontend-react/
├── src/
│   ├── app/ (or pages/)          # Routes/pages
│   ├── components/                # Reusable components
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── leads/
│   │   ├── centers/
│   │   └── users/
│   ├── lib/                       # Utilities, API client
│   │   ├── api.ts                # API endpoints
│   │   ├── auth.ts               # Auth logic
│   │   └── utils.ts
│   ├── hooks/                     # Custom React hooks
│   ├── store/                     # State management
│   ├── types/                     # TypeScript types
│   └── styles/                    # Global styles
├── public/                        # Static assets
└── package.json
```

---

### Phase 2: Core Infrastructure (Week 1-2)

#### 2.1 API Client Setup
Create a centralized API client with authentication:

```typescript
// lib/api.ts
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - redirect to login
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

#### 2.2 Authentication System
```typescript
// lib/auth.ts
export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: string;
}

export const authService = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);
    
    const response = await fetch(`${API_URL}/token`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) throw new Error('Invalid credentials');
    return response.json();
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  },
  
  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('token');
  },
  
  getToken: (): string | null => {
    return localStorage.getItem('token');
  },
};
```

#### 2.3 State Management (Auth Context)
```typescript
// context/AuthContext.tsx
import { createContext, useContext, useState, useEffect } from 'react';

interface User {
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Restore user from localStorage on mount
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authService.login(email, password);
    const userData = { email, role: response.role };
    localStorage.setItem('token', response.access_token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
```

---

### Phase 3: Component Migration (Week 2-3)

#### 3.1 Login Page
**Streamlit equivalent:** `login()` function
**React equivalent:**
- Create `/login` route/page
- Form with email/password inputs
- Submit handler calls authService.login()
- Redirect to dashboard on success

#### 3.2 Dashboard
**Streamlit equivalent:** Dashboard section with metrics
**React equivalent:**
- Metrics cards component (4 cards: Total Leads, New Leads, Trials, Joined)
- Chart component (bar chart for status distribution)
- Recent leads table component
- Fetch data using React Query or useEffect

#### 3.3 Leads Management
**Streamlit equivalent:** "My Leads" section
**React equivalent:**
- Leads list/table component
- Filters (status multiselect, search input)
- Lead update form/modal
- Status badges component

#### 3.4 User Management (Team Leads only)
**Streamlit equivalent:** "Manage Users" section
**React equivalent:**
- User list table
- Create user form/modal
- Center assignment multiselect

#### 3.5 Center Management
**Streamlit equivalent:** "Manage Centers" section
**React equivalent:**
- Centers list table
- Create center form

#### 3.6 Data Import
**Streamlit equivalent:** File uploader
**React equivalent:**
- File upload component (drag & drop or file input)
- Progress indicator
- Success/error messages

---

### Phase 4: UI Components Library

#### Recommended: shadcn/ui + Tailwind CSS
```bash
# Install shadcn/ui (if using Next.js)
npx shadcn-ui@latest init

# Add components as needed
npx shadcn-ui@latest add button card input table form select badge
```

**Key Components to Create:**
1. **StatusBadge** - Replaces your `get_status_badge()` function
2. **MetricCard** - For dashboard metrics
3. **DataTable** - For leads/users/centers tables
4. **Sidebar** - Navigation sidebar (matches Streamlit sidebar)
5. **StatusFilter** - Multiselect for filtering
6. **LeadUpdateModal** - Form for updating leads

---

### Phase 5: API Integration

Map Streamlit API calls to React hooks:

```typescript
// hooks/useLeads.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api';

export const useLeads = () => {
  return useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const response = await apiClient.get('/leads/my_leads');
      return response.data;
    },
  });
};

export const useUpdateLead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, next_date, comment }: UpdateLeadParams) => {
      const response = await apiClient.put(`/leads/${id}`, null, {
        params: { status, next_date, comment },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
};

// Similar hooks for: useUsers, useCenters, useUploadLeads, etc.
```

---

### Phase 6: Routing & Navigation

#### If using Next.js (App Router):
```
app/
├── login/
│   └── page.tsx
├── dashboard/
│   └── page.tsx
├── leads/
│   └── page.tsx
├── users/
│   └── page.tsx        # Protected: team_lead only
├── centers/
│   └── page.tsx        # Protected: team_lead only
├── import/
│   └── page.tsx        # Protected: team_lead only
└── layout.tsx          # Main layout with sidebar
```

#### Protected Routes:
```typescript
// middleware.ts (Next.js) or ProtectedRoute component
export function withAuth(Component, requiredRole?: string) {
  return function AuthenticatedComponent(props) {
    const { isAuthenticated, user } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!isAuthenticated) {
        router.push('/login');
      } else if (requiredRole && user?.role !== requiredRole) {
        router.push('/dashboard'); // Redirect if wrong role
      }
    }, [isAuthenticated, user, router]);

    if (!isAuthenticated || (requiredRole && user?.role !== requiredRole)) {
      return <div>Loading...</div>;
    }

    return <Component {...props} />;
  };
}
```

---

### Phase 7: Styling Migration

Convert Streamlit CSS to Tailwind CSS:

**Streamlit:**
```css
.header-container {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 2rem;
    border-radius: 10px;
}
```

**Tailwind CSS:**
```tsx
<div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-8 rounded-lg">
  {/* content */}
</div>
```

---

### Phase 8: Testing & Deployment

#### 8.1 Environment Variables
```env
# .env.local
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
# For production:
# NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

#### 8.2 Build & Test
```bash
npm run build
npm run start  # Test production build locally
```

#### 8.3 Deployment Options
- **Vercel** (Recommended for Next.js) - Free tier, easy setup
- **Netlify** - Good for static React apps
- **AWS Amplify** - Full-stack deployment
- **Docker + Cloud** - Full control

---

## 📋 Migration Checklist

### Core Features
- [ ] Authentication (login/logout)
- [ ] Protected routes
- [ ] Dashboard with metrics
- [ ] Leads list with filters
- [ ] Lead update functionality
- [ ] User management (team leads)
- [ ] Center management (team leads)
- [ ] Data import (Excel/CSV)
- [ ] Role-based access control

### UI/UX
- [ ] Responsive design (mobile-friendly)
- [ ] Loading states
- [ ] Error handling
- [ ] Success messages
- [ ] Form validation
- [ ] Status badges
- [ ] Charts/graphs

### Technical
- [ ] TypeScript types for all API responses
- [ ] Error boundaries
- [ ] API error handling
- [ ] Token refresh (if needed)
- [ ] Environment configuration
- [ ] Build optimization
- [ ] Performance optimization

---

## 🚀 Quick Start Template

If you want a head start, I can generate:
1. Complete Next.js project structure
2. All API integration hooks
3. Core components (Login, Dashboard, Leads)
4. Authentication system
5. Protected routes setup

Would you like me to create the initial React/Next.js structure for you?

---

## 📚 Recommended Learning Resources

- **Next.js:** https://nextjs.org/docs
- **React Query:** https://tanstack.com/query/latest
- **Tailwind CSS:** https://tailwindcss.com/docs
- **shadcn/ui:** https://ui.shadcn.com
- **React Native:** https://reactnative.dev (for future mobile)

---

## 💡 Tips for Migration

1. **Start small:** Migrate one feature at a time
2. **Keep backend running:** Your FastAPI backend stays the same
3. **Use TypeScript:** Better type safety and IDE support
4. **Test API endpoints:** Use Postman/Thunder Client to verify backend
5. **Reuse designs:** Try to match your current Streamlit UI initially
6. **Mobile-first:** Design responsive from the start

---

## 🔄 Hybrid Approach (Optional)

You could run both Streamlit and React simultaneously:
- Keep Streamlit for internal/admin use
- Build React for customer-facing/production use
- Both use the same FastAPI backend

This allows gradual migration and A/B testing.

