#!/usr/bin/env bash
# =============================================================
# Garces Fruit - Deploy to Azure
# Builds Docker images, pushes to ACR, deploys to App Service
# =============================================================
set -euo pipefail

# ---- Default values (override with flags) ----
RESOURCE_GROUP=""
ACR_NAME=""
APP_NAME_PREFIX=""
ENVIRONMENT="dev"
TAG="latest"

usage() {
    echo "Usage: $0 -g <resource-group> -a <acr-name> -n <app-prefix> [-e <environment>] [-t <tag>]"
    echo ""
    echo "Options:"
    echo "  -g  Azure Resource Group name"
    echo "  -a  Azure Container Registry name (without .azurecr.io)"
    echo "  -n  App name prefix (e.g. 'garces' -> garces-backend, garces-frontend)"
    echo "  -e  Environment: dev or prod (default: dev)"
    echo "  -t  Docker image tag (default: latest)"
    echo ""
    echo "Example:"
    echo "  $0 -g rg-garces-dev -a garcesacr -n garces -e dev"
    exit 1
}

while getopts "g:a:n:e:t:h" opt; do
    case $opt in
        g) RESOURCE_GROUP="$OPTARG" ;;
        a) ACR_NAME="$OPTARG" ;;
        n) APP_NAME_PREFIX="$OPTARG" ;;
        e) ENVIRONMENT="$OPTARG" ;;
        t) TAG="$OPTARG" ;;
        h) usage ;;
        *) usage ;;
    esac
done

if [[ -z "$RESOURCE_GROUP" || -z "$ACR_NAME" || -z "$APP_NAME_PREFIX" ]]; then
    echo "Error: missing required parameters."
    usage
fi

ACR_LOGIN_SERVER="${ACR_NAME}.azurecr.io"
BACKEND_IMAGE="${ACR_LOGIN_SERVER}/${APP_NAME_PREFIX}-backend:${TAG}"
FRONTEND_IMAGE="${ACR_LOGIN_SERVER}/${APP_NAME_PREFIX}-frontend:${TAG}"
BACKEND_APP="${APP_NAME_PREFIX}-backend-${ENVIRONMENT}"
FRONTEND_APP="${APP_NAME_PREFIX}-frontend-${ENVIRONMENT}"

echo "=================================================="
echo "  Garces Fruit - Azure Deployment"
echo "  Environment: ${ENVIRONMENT}"
echo "  Resource Group: ${RESOURCE_GROUP}"
echo "  ACR: ${ACR_LOGIN_SERVER}"
echo "=================================================="

# ---- Step 1: Login to ACR ----
echo ""
echo "[1/5] Logging in to Azure Container Registry..."
az acr login --name "$ACR_NAME"

# ---- Step 2: Build backend image ----
echo ""
echo "[2/5] Building backend Docker image..."
docker build -t "$BACKEND_IMAGE" ./backend

# ---- Step 3: Build frontend image ----
echo ""
echo "[3/5] Building frontend Docker image..."
docker build -t "$FRONTEND_IMAGE" \
    --build-arg VITE_API_BASE_URL=/api/v1 \
    ./frontend

# ---- Step 4: Push images to ACR ----
echo ""
echo "[4/5] Pushing images to ACR..."
docker push "$BACKEND_IMAGE"
docker push "$FRONTEND_IMAGE"

# ---- Step 5: Deploy to Azure App Service ----
echo ""
echo "[5/5] Deploying to Azure App Service..."

# Update backend web app container
az webapp config container set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$BACKEND_APP" \
    --container-image-name "$BACKEND_IMAGE" \
    --container-registry-url "https://${ACR_LOGIN_SERVER}"

# Update frontend web app container
az webapp config container set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$FRONTEND_APP" \
    --container-image-name "$FRONTEND_IMAGE" \
    --container-registry-url "https://${ACR_LOGIN_SERVER}"

# Restart apps to pick up new images
az webapp restart --resource-group "$RESOURCE_GROUP" --name "$BACKEND_APP"
az webapp restart --resource-group "$RESOURCE_GROUP" --name "$FRONTEND_APP"

echo ""
echo "=================================================="
echo "  Deployment complete!"
echo "  Backend:  https://${BACKEND_APP}.azurewebsites.net"
echo "  Frontend: https://${FRONTEND_APP}.azurewebsites.net"
echo "=================================================="
