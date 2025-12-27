# Production Deployment Guide - FastAPI on GCP

Complete guide for deploying your FastAPI backend to Google Cloud Platform (GCP).

## 🚀 Recommended Deployment Options

### Option 1: Cloud Run (Recommended - Serverless)

**Best for:**
- ✅ Serverless, pay-per-use
- ✅ Auto-scaling
- ✅ Easy deployment
- ✅ HTTPS included

**Steps:**
1. Build Docker image
2. Push to Google Container Registry
3. Deploy to Cloud Run
4. Configure environment variables
5. Set up custom domain (optional)

### Option 2: App Engine (Serverless Platform)

**Best for:**
- ✅ Fully managed platform
- ✅ Easy deployment
- ✅ Auto-scaling

### Option 3: Compute Engine (VM)

**Best for:**
- ✅ Full control
- ✅ Custom configurations
- ✅ Long-running processes

---

## 📦 Prerequisites

- GCP account (sign up at https://cloud.google.com/)
- Google Cloud SDK installed (`gcloud` CLI)
- Docker installed (for Cloud Run)
- Project code pushed to Git repository

---

## 🔧 Quick Start: Cloud Run Deployment

### Step 1: Install Google Cloud SDK

```bash
# Download and install from:
# https://cloud.google.com/sdk/docs/install

# Verify installation
gcloud --version
```

### Step 2: Authenticate and Set Project

```bash
# Login to GCP
gcloud auth login

# Set your project (replace with your project ID)
gcloud config set project YOUR_PROJECT_ID

# Verify
gcloud config list
```

### Step 3: Enable Required APIs

```bash
# Enable Cloud Run API
gcloud services enable run.googleapis.com

# Enable Container Registry API
gcloud services enable containerregistry.googleapis.com
```

### Step 4: Create Dockerfile

Create `Dockerfile` in project root:

```dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run FastAPI
CMD ["uvicorn", "backend.fastapi_app:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Step 5: Build and Push Docker Image

```bash
# Build image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/tofa-backend

# This will:
# - Build your Docker image
# - Push to Google Container Registry
```

### Step 6: Deploy to Cloud Run

```bash
gcloud run deploy tofa-backend \
  --image gcr.io/YOUR_PROJECT_ID/tofa-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL=your-db-url,SECRET_KEY=your-secret-key,ALGORITHM=HS256,ACCESS_TOKEN_EXPIRE_MINUTES=60
```

**Or deploy via GCP Console:**
1. Go to Cloud Run in GCP Console
2. Click "Create Service"
3. Select container image
4. Configure environment variables
5. Deploy

### Step 7: Test Deployment

After deployment, you'll get a URL like:
`https://tofa-backend-xxxxx-uc.a.run.app`

Test it:
- API Docs: `https://your-url.run.app/docs`
- Health check: `https://your-url.run.app/`

---

## 🔐 Environment Variables

Set environment variables securely:

```bash
# Via gcloud CLI
gcloud run services update tofa-backend \
  --update-env-vars DATABASE_URL=your-db-url,SECRET_KEY=your-secret-key

# Or via GCP Console
# Cloud Run → Your Service → Edit & Deploy New Revision → Variables & Secrets
```

**Required variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `SECRET_KEY` - JWT secret key
- `ALGORITHM` - HS256
- `ACCESS_TOKEN_EXPIRE_MINUTES` - 60

---

## 🔄 Continuous Deployment

### Option 1: Cloud Build Triggers

1. Connect your GitHub repository
2. Create build trigger
3. Automatically deploy on push to main

### Option 2: GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - uses: google-github-actions/setup-gcloud@v0
        with:
          service_account_key: ${{ secrets.GCP_SA_KEY }}
          project_id: ${{ secrets.GCP_PROJECT_ID }}
      
      - run: |-
          gcloud builds submit --tag gcr.io/${{ secrets.GCP_PROJECT_ID }}/tofa-backend
          gcloud run deploy tofa-backend \
            --image gcr.io/${{ secrets.GCP_PROJECT_ID }}/tofa-backend \
            --platform managed \
            --region us-central1
```

---

## 📊 Monitoring & Logging

### View Logs

```bash
# View logs via CLI
gcloud run services logs read tofa-backend

# Or in GCP Console
# Cloud Run → Your Service → Logs
```

### Set Up Monitoring

1. Go to Cloud Monitoring
2. Create alerts for errors
3. Set up uptime checks
4. Monitor performance metrics

---

## 🎯 Best Practices

1. **Use environment variables** - Never hardcode secrets
2. **Enable logging** - Monitor your application
3. **Set up alerts** - Get notified of issues
4. **Use custom domains** - Map your domain to Cloud Run
5. **Enable HTTPS** - Cloud Run provides this by default
6. **Set resource limits** - CPU and memory limits
7. **Use secrets** - Store sensitive data in Secret Manager

---

## 🔗 Additional Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)
- [GCP Best Practices](https://cloud.google.com/architecture/framework)

---

## ✅ Deployment Checklist

- [ ] GCP account created
- [ ] Google Cloud SDK installed
- [ ] Project created in GCP
- [ ] Required APIs enabled
- [ ] Dockerfile created
- [ ] Docker image built and pushed
- [ ] Cloud Run service deployed
- [ ] Environment variables configured
- [ ] Application tested
- [ ] Custom domain configured (optional)
- [ ] Monitoring set up
- [ ] CI/CD configured (optional)

---

**Your FastAPI backend is now running on GCP!** 🚀
