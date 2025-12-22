# Git Setup Guide

Quick guide to set up Git and push your code to GitHub.

## Step 1: Install Git

If you don't have Git installed:
- Windows: Download from https://git-scm.com/download/win
- Mac: `brew install git` or download from https://git-scm.com/download/mac
- Linux: `sudo apt-get install git`

## Step 2: Configure Git (First time only)

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

## Step 3: Initialize Repository

In your project directory (`d:\tofa`):

```bash
# Initialize git repository
git init

# Check status
git status
```

## Step 4: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `tofa-crm` (or your preferred name)
3. Description: "TOFA Academy CRM System"
4. Choose Public or Private
5. **Don't** initialize with README, .gitignore, or license (you already have files)
6. Click "Create repository"

## Step 5: Add Files and Commit

```bash
# Add all files
git add .

# Check what will be committed
git status

# Create initial commit
git commit -m "Initial commit: TOFA Academy CRM"

# Add remote repository (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/tofa-crm.git

# Verify remote was added
git remote -v
```

## Step 6: Push to GitHub

```bash
# Rename branch to main (if needed)
git branch -M main

# Push to GitHub
git push -u origin main
```

You'll be prompted for GitHub username and password/token.

## Step 7: Using Personal Access Token (Recommended)

GitHub no longer accepts passwords. Use a Personal Access Token:

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token"
3. Give it a name: "TOFA CRM Deployment"
4. Select scopes: **repo** (full control)
5. Click "Generate token"
6. **Copy the token immediately** (you won't see it again)
7. Use this token as your password when pushing

## Common Commands

### Daily Workflow

```bash
# Check status
git status

# Add specific files
git add filename.py
# Or add all changes
git add .

# Commit changes
git commit -m "Description of changes"

# Push to GitHub
git push
```

### Update from GitHub

```bash
# Pull latest changes
git pull origin main
```

### Check Commit History

```bash
git log
```

## Important Files

- `.gitignore` - Lists files/folders Git should ignore
- `.env` - Environment variables (already in .gitignore, won't be committed)
- `frontend-react/.env.local` - Frontend env vars (already in .gitignore)

## Troubleshooting

### Issue: "fatal: remote origin already exists"
```bash
# Remove existing remote
git remote remove origin
# Then add it again
git remote add origin https://github.com/YOUR_USERNAME/tofa-crm.git
```

### Issue: "Updates were rejected"
```bash
# Pull first, then push
git pull origin main --rebase
git push
```

### Issue: Large file warning
```bash
# If you accidentally committed large files, check .gitignore
# Remove from git cache (but keep locally)
git rm --cached largefile.zip
git commit -m "Remove large file"
git push
```

## Next Steps

After pushing to GitHub:
1. Follow [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) to deploy to PythonAnywhere
2. Deploy frontend to Vercel/Netlify
3. Update environment variables in production

Happy coding! 🚀

