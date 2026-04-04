// =============================================================
// Garces Fruit - Azure Infrastructure (Bicep)
// Provisions: App Service Plan, Backend Web App, Frontend Web App, ACR
// =============================================================

@description('Environment name (dev or prod)')
@allowed(['dev', 'prod'])
param environment string = 'dev'

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Application name prefix')
param appNamePrefix string = 'garces'

@description('App Service Plan SKU')
param appServicePlanSku string = environment == 'prod' ? 'B2' : 'B1'

@description('ACR SKU')
param acrSku string = 'Basic'

// ---- Variables ----
var suffix = '${appNamePrefix}-${environment}'
var appServicePlanName = 'plan-${suffix}'
var backendAppName = '${appNamePrefix}-backend-${environment}'
var frontendAppName = '${appNamePrefix}-frontend-${environment}'
var acrName = '${appNamePrefix}acr${environment}'
var tags = {
  project: 'garces-segmentacion'
  environment: environment
  managedBy: 'bicep'
}

// ---- Azure Container Registry ----
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  tags: tags
  sku: {
    name: acrSku
  }
  properties: {
    adminUserEnabled: true
  }
}

// ---- App Service Plan (Linux) ----
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: appServicePlanName
  location: location
  tags: tags
  kind: 'linux'
  properties: {
    reserved: true
  }
  sku: {
    name: appServicePlanSku
  }
}

// ---- Backend Web App ----
resource backendApp 'Microsoft.Web/sites@2023-01-01' = {
  name: backendAppName
  location: location
  tags: tags
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acr.properties.loginServer}/${appNamePrefix}-backend:latest'
      alwaysOn: true
      httpLoggingEnabled: true
      appSettings: [
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://${acr.properties.loginServer}'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_USERNAME'
          value: acr.listCredentials().username
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_PASSWORD'
          value: acr.listCredentials().passwords[0].value
        }
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false'
        }
        {
          name: 'WEBSITES_PORT'
          value: '8000'
        }
      ]
    }
    httpsOnly: true
  }
}

// ---- Frontend Web App ----
resource frontendApp 'Microsoft.Web/sites@2023-01-01' = {
  name: frontendAppName
  location: location
  tags: tags
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acr.properties.loginServer}/${appNamePrefix}-frontend:latest'
      alwaysOn: environment == 'prod'
      httpLoggingEnabled: true
      appSettings: [
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://${acr.properties.loginServer}'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_USERNAME'
          value: acr.listCredentials().username
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_PASSWORD'
          value: acr.listCredentials().passwords[0].value
        }
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false'
        }
        {
          name: 'WEBSITES_PORT'
          value: '80'
        }
      ]
    }
    httpsOnly: true
  }
}

// ---- Outputs ----
output acrLoginServer string = acr.properties.loginServer
output backendUrl string = 'https://${backendApp.properties.defaultHostName}'
output frontendUrl string = 'https://${frontendApp.properties.defaultHostName}'
output appServicePlanId string = appServicePlan.id
