# Docker Setup for TOFA CRM

## Quick Start

1. **Set up environment variables:**
   ```bash
   cp docker-compose.example.env .env
   # Edit .env with your actual values
   ```

2. **Build and start services:**
   ```bash
   docker-compose up --build
   ```

3. **Access the application:**
   - Web App: http://localhost:3000
   - API Docs: http://localhost:8000/docs

## Services

### Web (Next.js)
- **Port:** 3000
- **Dockerfile:** `Dockerfile.web`
- **Environment:**
  - `NEXT_PUBLIC_API_URL=http://localhost:8000`
  - `DATABASE_URL` (from .env)
  - `NEXT_PUBLIC_SUPABASE_URL` (from .env)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (from .env)

### API (FastAPI)
- **Port:** 8000
- **Dockerfile:** `Dockerfile.api`
- **Environment:**
  - `DATABASE_URL` (from .env)
  - `SECRET_KEY` (from .env)
  - `ALGORITHM=HS256`
  - `ACCESS_TOKEN_EXPIRE_MINUTES=60`

## Commands

```bash
# Start services
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild and restart
docker-compose up --build

# Stop and remove volumes
docker-compose down -v
```

## Network

Both services are on the `tofa-network` bridge network and can communicate using service names:
- Web → API: `http://api:8000`
- API → Database: Uses `DATABASE_URL` from environment

## Health Checks

- API: Checks `/docs` endpoint
- Web: Checks root endpoint

Services wait for dependencies to be healthy before starting.
