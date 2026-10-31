terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 4.0" }
  }
}

provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "rg" {
  name     = "${var.project_name}-rg"
  location = var.location
}

# ---- Postgres ----
resource "azurerm_postgresql_flexible_server" "db" {
  name                   = "${var.project_name}-db"
  resource_group_name    = azurerm_resource_group.rg.name
  location               = azurerm_resource_group.rg.location
  version                = "16"
  administrator_login    = "sako"
  administrator_password = var.db_password
  sku_name               = "B_Standard_B1ms"
  storage_mb             = 32768
  zone                   = "1"
}

resource "azurerm_postgresql_flexible_server_database" "sako" {
  name      = "sako"
  server_id = azurerm_postgresql_flexible_server.db.id
}

resource "azurerm_postgresql_flexible_server_firewall_rule" "azure" {
  name             = "allow-azure"
  server_id        = azurerm_postgresql_flexible_server.db.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

locals {
  database_url = "postgresql://sako:${var.db_password}@${azurerm_postgresql_flexible_server.db.fqdn}:5432/sako?sslmode=require"
}

# ---- File uploads ----
resource "azurerm_storage_account" "uploads" {
  name                     = substr(replace("${var.project_name}uploads${azurerm_resource_group.rg.location}", "-", ""), 0, 24)
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

# ---- Apps: one Container App each ----
resource "azurerm_log_analytics_workspace" "logs" {
  name                = "${var.project_name}-logs"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
}

resource "azurerm_container_app_environment" "env" {
  name                       = "${var.project_name}-env"
  resource_group_name        = azurerm_resource_group.rg.name
  location                   = azurerm_resource_group.rg.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.logs.id
}

resource "azurerm_container_app" "app" {
  for_each                     = var.services
  name                         = "${var.project_name}-${each.key}"
  resource_group_name          = azurerm_resource_group.rg.name
  container_app_environment_id = azurerm_container_app_environment.env.id
  revision_mode                = "Single"

  template {
    container {
      name   = each.key
      image  = each.value.image
      cpu    = 0.5
      memory = "1Gi"
      dynamic "env" {
        for_each = merge(var.app_env, {
          DATABASE_URL   = local.database_url
          STORAGE_BUCKET = azurerm_storage_account.uploads.name
        })
        content {
          name  = env.key
          value = env.value
        }
      }
    }
  }

  ingress {
    external_enabled = true
    target_port      = each.value.port
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }
}

output "urls" {
  value = { for k, a in azurerm_container_app.app : k => "https://${a.ingress[0].fqdn}" }
}
