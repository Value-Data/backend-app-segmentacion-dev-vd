# Infrastructure - Garces Fruit

## Prerequisites

- Azure CLI (`az`) installed and authenticated
- Docker installed and running
- An Azure subscription with permissions to create resources

## Quick Start

### 1. Provision Azure resources (one-time)

```bash
# Create resource group
az group create --name rg-garces-dev --location eastus

# Deploy infrastructure with Bicep
az deployment group create \
  --resource-group rg-garces-dev \
  --template-file infra/azure/main.bicep \
  --parameters @infra/azure/parameters.dev.json
```

### 2. Configure environment

```bash
# Copy template and fill in your values
cp infra/.env.template backend/.env

# Set app settings on Azure (backend)
az webapp config appsettings set \
  --resource-group rg-garces-dev \
  --name garces-backend-dev \
  --settings @backend/.env
```

### 3. Build and deploy

```bash
chmod +x infra/deploy.sh

# Deploy to dev
./infra/deploy.sh -g rg-garces-dev -a garcesacr -n garces -e dev

# Deploy to prod
./infra/deploy.sh -g rg-garces-prod -a garcesacr -n garces -e prod
```

### 4. Local development with Docker Compose

```bash
# Ensure backend/.env exists with database credentials
docker compose up --build
# Frontend: http://localhost
# Backend API: http://localhost:8000/api/docs
```

## Architecture

```
Internet
  |
  +-- Azure App Service (frontend) -- nginx serves SPA, proxies /api to backend
  |
  +-- Azure App Service (backend)  -- FastAPI + uvicorn
  |
  +-- Azure SQL Server             -- Existing database (not provisioned by Bicep)
  |
  +-- Azure Container Registry     -- Stores Docker images
```

## CI/CD

- **CI** (`.github/workflows/ci.yml`): Runs on every push/PR to main. Lints and tests both frontend and backend.
- **CD** (`.github/workflows/cd.yml`): Runs on push to main after CI passes. Builds images, pushes to ACR, deploys to App Service.

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `AZURE_CREDENTIALS` | Service principal JSON for Azure login |
| `ACR_LOGIN_SERVER` | e.g. `garcesacr.azurecr.io` |
| `ACR_USERNAME` | ACR admin username |
| `ACR_PASSWORD` | ACR admin password |
| `AZURE_RESOURCE_GROUP` | e.g. `rg-garces-dev` |
| `BACKEND_APP_NAME` | e.g. `garces-backend-dev` |
| `FRONTEND_APP_NAME` | e.g. `garces-frontend-dev` |
