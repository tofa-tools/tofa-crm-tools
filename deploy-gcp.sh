#!/bin/bash

################################################################################
# Google Cloud Run Deployment Script
################################################################################
#
# Prerequisites (run these commands before first use):
#
# 1. Authenticate with Google Cloud:
#    gcloud auth login
#
# 2. Configure Docker to use gcloud as a credential helper:
#    gcloud auth configure-docker
#
# 3. Set your default project (optional, or set GCP_PROJECT_ID below):
#    gcloud config set project YOUR_PROJECT_ID
#
# 4. Enable required APIs:
#    gcloud services enable run.googleapis.com
#    gcloud services enable artifactregistry.googleapis.com
#    gcloud services enable secretmanager.googleapis.com
#
# 5. Create Artifact Registry repository (if not exists):
#    gcloud artifacts repositories create REPO_NAME \
#      --repository-format=docker \
#      --location=REGION \
#      --description="Docker repository for Cloud Run"
#
################################################################################

set -e  # Exit on any error

# Configuration Variables
# Update these values according to your GCP setup
# Change these three lines:
GCP_PROJECT_ID="tofa-app-test"         # The ID you used in the terminal earlier
REGION="asia-south1"                  # The region you chose (e.g., us-central1)
REPO_NAME="tofa-repo"                 # The name you gave to the Artifact Registry

# Service names
API_SERVICE_NAME="api"
WEB_SERVICE_NAME="web"

# Artifact Registry URL
ARTIFACT_REGISTRY_URL="${REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${REPO_NAME}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper function for colored output
info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    error "gcloud CLI is not installed. Please install it from https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    error "Docker is not installed. Please install Docker first."
    exit 1
fi

info "Starting deployment to Google Cloud Run..."
info "Project: ${GCP_PROJECT_ID}"
info "Region: ${REGION}"
info "Repository: ${REPO_NAME}"

################################################################################
# Step 1: Build and Push API Docker Image
################################################################################

info "Building API Docker image..."
API_IMAGE_NAME="${ARTIFACT_REGISTRY_URL}/${API_SERVICE_NAME}:latest"

docker build -f Dockerfile.api -t "${API_IMAGE_NAME}" .

info "Pushing API image to Artifact Registry..."
docker push "${API_IMAGE_NAME}"

info "API image built and pushed successfully: ${API_IMAGE_NAME}"

################################################################################
# Step 2: Deploy API to Cloud Run
################################################################################

info "Deploying API to Cloud Run..."

# Deploy API service
gcloud run deploy "${API_SERVICE_NAME}" \
  --image "${API_IMAGE_NAME}" \
  --platform managed \
  --region "${REGION}" \
  --project "${GCP_PROJECT_ID}" \
  --allow-unauthenticated \
  --port 8000 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300 \
  --set-env-vars "PYTHONUNBUFFERED=1,PYTHONPATH=/app"

# Capture the API service URL
API_URL=$(gcloud run services describe "${API_SERVICE_NAME}" \
  --platform managed \
  --region "${REGION}" \
  --project "${GCP_PROJECT_ID}" \
  --format 'value(status.url)')

if [ -z "${API_URL}" ]; then
    error "Failed to retrieve API service URL"
    exit 1
fi

info "API deployed successfully!"
info "API URL: ${API_URL}"

################################################################################
# Step 3: Set Secrets (DATABASE_URL and other environment variables)
################################################################################

info "Setting up secrets..."

# Function to create or update a secret
set_secret() {
    local secret_name=$1
    local secret_value=$2
    
    # Check if secret exists
    if gcloud secrets describe "${secret_name}" --project="${GCP_PROJECT_ID}" &> /dev/null; then
        info "Updating existing secret: ${secret_name}"
        echo -n "${secret_value}" | gcloud secrets versions add "${secret_name}" \
            --project="${GCP_PROJECT_ID}" \
            --data-file=-
    else
        info "Creating new secret: ${secret_name}"
        echo -n "${secret_value}" | gcloud secrets create "${secret_name}" \
            --project="${GCP_PROJECT_ID}" \
            --data-file=-
    fi
    
    # Grant Cloud Run service account access to the secret
    info "Granting Cloud Run access to secret: ${secret_name}"
    gcloud secrets add-iam-policy-binding "${secret_name}" \
        --project="${GCP_PROJECT_ID}" \
        --member="serviceAccount:${GCP_PROJECT_ID}@appspot.gserviceaccount.com" \
        --role="roles/secretmanager.secretAccessor" \
        --quiet || warn "Failed to grant access (may already be granted)"
}

# Set DATABASE_URL secret (you can add more secrets here)
# Note: You should set this value from your environment or prompt for it
if [ -z "${postgresql://postgres.xdduyfcijsrcdwinbgzd:ihkTjmn9LDZVnSFC@aws-1-ap-south-1.pooler.supabase.com:5432/postgres}" ]; then
    warn "DATABASE_URL environment variable is not set."
    warn "Please set it before running this script, or update the script to read from .env file"
    warn "Example: export DATABASE_URL='postgresql://user:pass@host:5432/dbname'"
    # Uncomment the line below if you want to read from .env file:
    # source .env
fi

if [ -n "${DATABASE_URL}" ]; then
    set_secret "DATABASE_URL" "${DATABASE_URL}"
    
    # Update API service to use the secret
    info "Updating API service to use DATABASE_URL secret..."
    gcloud run services update "${API_SERVICE_NAME}" \
        --platform managed \
        --region "${REGION}" \
        --project "${GCP_PROJECT_ID}" \
        --update-secrets "DATABASE_URL=DATABASE_URL:latest" \
        --quiet
fi

# Add other secrets as needed (SECRET_KEY, etc.)
# Example:
# if [ -n "${SECRET_KEY}" ]; then
#     set_secret "SECRET_KEY" "${SECRET_KEY}"
#     gcloud run services update "${API_SERVICE_NAME}" \
#         --platform managed \
#         --region "${REGION}" \
#         --project "${GCP_PROJECT_ID}" \
#         --update-secrets "SECRET_KEY=SECRET_KEY:latest" \
#         --quiet
# fi

################################################################################
# Step 4: Build Web Docker Image with API URL
################################################################################

info "Building Web Docker image with API URL: ${API_URL}..."

WEB_IMAGE_NAME="${ARTIFACT_REGISTRY_URL}/${WEB_SERVICE_NAME}:latest"

# Build the web image with NEXT_PUBLIC_API_URL as build argument
docker build -f Dockerfile.web \
  --build-arg NEXT_PUBLIC_API_URL="${API_URL}" \
  -t "${WEB_IMAGE_NAME}" .

info "Pushing Web image to Artifact Registry..."
docker push "${WEB_IMAGE_NAME}"

info "Web image built and pushed successfully: ${WEB_IMAGE_NAME}"

################################################################################
# Step 5: Deploy Web to Cloud Run
################################################################################

info "Deploying Web to Cloud Run..."

gcloud run deploy "${WEB_SERVICE_NAME}" \
  --image "${WEB_IMAGE_NAME}" \
  --platform managed \
  --region "${REGION}" \
  --project "${GCP_PROJECT_ID}" \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production"

# Capture the Web service URL
WEB_URL=$(gcloud run services describe "${WEB_SERVICE_NAME}" \
  --platform managed \
  --region "${REGION}" \
  --project "${GCP_PROJECT_ID}" \
  --format 'value(status.url)')

if [ -z "${WEB_URL}" ]; then
    error "Failed to retrieve Web service URL"
    exit 1
fi

info "Web deployed successfully!"
info "Web URL: ${WEB_URL}"

################################################################################
# Deployment Summary
################################################################################

echo ""
info "=========================================="
info "Deployment Complete!"
info "=========================================="
info "API Service: ${API_URL}"
info "Web Service: ${WEB_URL}"
info "=========================================="
echo ""
