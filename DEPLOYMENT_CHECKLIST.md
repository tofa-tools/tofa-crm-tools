# Deployment Checklist

Use this checklist to ensure everything is properly configured for deployment.

## Pre-Deployment

### Git Setup
- [ ] Initialize git repository (`git init`)
- [ ] Create `.gitignore` file
- [ ] Add all files (`git add .`)
- [ ] Initial commit (`git commit -m "Initial commit"`)
- [ ] Create GitHub repository
- [ ] Add remote (`git remote add origin <url>`)
- [ ] Push to GitHub (`git push -u origin main`)

### Environment Variables
- [ ] Create `.env.example` file
- [ ] Create `.env` file (not committed to git)
- [ ] Set `DATABASE_URL` (Supabase/PostgreSQL connection string)
- [ ] Set `SECRET_KEY` (generate secure random string)
- [ ] Set `ALGORITHM=HS256`
- [ ] Set `ACCESS_TOKEN_EXPIRE_MINUTES=60`

### Backend Configuration
- [ ] Test backend locally
- [ ] Verify database connection
- [ ] Test login endpoint
- [ ] Verify CORS is configured
- [ ] Test all API endpoints
- [ ] Check requirements.txt is up to date

### Frontend Configuration
- [ ] Test frontend locally
- [ ] Verify login works
- [ ] Test all pages/features
- [ ] Update API URL for production
- [ ] Build frontend (`npm run build`)
- [ ] Check for build errors

---

## PythonAnywhere Backend Deployment

### Account Setup
- [ ] Create PythonAnywhere account
- [ ] Note your username
- [ ] Upgrade plan if needed (for custom domain)

### Repository Setup
- [ ] Open Bash console
- [ ] Clone repository (`git clone <url>`)
- [ ] Navigate to project directory

### Python Environment
- [ ] Check Python version (`python3.10 --version`)
- [ ] Create virtual environment (`python3.10 -m venv venv`)
- [ ] Activate virtual environment (`source venv/bin/activate`)
- [ ] Upgrade pip (`pip install --upgrade pip`)
- [ ] Install dependencies (`pip install -r requirements.txt`)
- [ ] Verify installation (`pip list`)

### Environment Configuration
- [ ] Create `.env` file in project root
- [ ] Set all environment variables
- [ ] Test database connection
- [ ] Verify .env file is not in gitignore

### Web App Setup
- [ ] Go to Web tab
- [ ] Create new web app (Manual configuration)
- [ ] Select Python version
- [ ] Configure WSGI file
- [ ] Update paths in WSGI file
- [ ] Set environment variables in WSGI
- [ ] Save WSGI file

### Static Files (if needed)
- [ ] Configure static file mappings
- [ ] Test static file serving

### Testing
- [ ] Reload web app
- [ ] Visit `/docs` endpoint
- [ ] Test API endpoints
- [ ] Check error log for issues
- [ ] Verify CORS headers

---

## Frontend Deployment (Vercel)

### Account Setup
- [ ] Create Vercel account
- [ ] Connect GitHub account

### Project Setup
- [ ] Import repository
- [ ] Set root directory to `frontend-react`
- [ ] Configure build settings
- [ ] Set environment variables:
  - [ ] `NEXT_PUBLIC_API_URL=https://yourusername.pythonanywhere.com`

### Deployment
- [ ] Deploy project
- [ ] Wait for build to complete
- [ ] Check for build errors
- [ ] Visit deployed URL
- [ ] Test login
- [ ] Test all features

---

## Frontend Deployment (Netlify)

### Account Setup
- [ ] Create Netlify account
- [ ] Connect GitHub account

### Project Setup
- [ ] Import repository
- [ ] Set base directory: `frontend-react`
- [ ] Set build command: `npm run build`
- [ ] Set publish directory: `.next`
- [ ] Set environment variables:
  - [ ] `NEXT_PUBLIC_API_URL=https://yourusername.pythonanywhere.com`

### Deployment
- [ ] Deploy site
- [ ] Check build logs
- [ ] Visit deployed URL
- [ ] Test login
- [ ] Test all features

---

## Post-Deployment

### Backend Verification
- [ ] API docs accessible
- [ ] Login endpoint works
- [ ] All endpoints accessible
- [ ] CORS working correctly
- [ ] Error logs clean

### Frontend Verification
- [ ] Site loads correctly
- [ ] Login works
- [ ] Dashboard loads
- [ ] All pages accessible
- [ ] API calls successful
- [ ] No console errors

### Integration Testing
- [ ] Login from frontend to backend
- [ ] Fetch leads
- [ ] Update lead
- [ ] Create user (if team lead)
- [ ] Create center (if team lead)
- [ ] Upload file (if team lead)
- [ ] Test all user roles

### Security
- [ ] HTTPS enabled (both frontend and backend)
- [ ] Environment variables not exposed
- [ ] SECRET_KEY is strong and unique
- [ ] CORS only allows necessary origins
- [ ] Database credentials secure

### Performance
- [ ] Page load times acceptable
- [ ] API response times acceptable
- [ ] Images optimized (if any)
- [ ] No unnecessary requests

### Documentation
- [ ] Update README with production URLs
- [ ] Document environment variables
- [ ] Document deployment process
- [ ] Add troubleshooting notes

---

## Monitoring & Maintenance

### Regular Checks
- [ ] Monitor error logs weekly
- [ ] Check database size/performance
- [ ] Review user feedback
- [ ] Update dependencies monthly
- [ ] Backup database regularly

### Updates
- [ ] Test updates locally first
- [ ] Create backup before updates
- [ ] Update backend: git pull, pip install, reload
- [ ] Update frontend: auto-deploys via Vercel/Netlify
- [ ] Test after updates

---

## Rollback Plan

If something goes wrong:

### Backend Rollback
- [ ] Revert to previous commit (`git checkout <commit-hash>`)
- [ ] Reload web app
- [ ] Verify functionality

### Frontend Rollback
- [ ] Vercel: Use deployment history to rollback
- [ ] Netlify: Use deployment history to rollback

---

## Support Contacts

- PythonAnywhere: https://www.pythonanywhere.com/help/
- Vercel: https://vercel.com/support
- Netlify: https://www.netlify.com/support/

---

**Deployment Date:** _______________
**Deployed By:** _______________
**Production URLs:**
- Backend: _______________
- Frontend: _______________

