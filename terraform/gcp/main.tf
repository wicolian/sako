terraform {
  required_providers {
    google = { source = "hashicorp/google", version = "~> 6.0" }
  }
}

provider "google" {
  project = var.gcp_project
  region  = var.region
}

# ---- Postgres ----
resource "google_sql_database_instance" "db" {
  name                = "${var.project_name}-db"
  database_version    = "POSTGRES_16"
  deletion_protection = false
  settings {
    tier = "db-f1-micro"
    ip_configuration {
      authorized_networks {
        name  = "all"
        value = "0.0.0.0/0"
      }
    }
  }
}

resource "google_sql_database" "sako" {
  name     = "sako"
  instance = google_sql_database_instance.db.name
}

resource "google_sql_user" "sako" {
  name     = "sako"
  instance = google_sql_database_instance.db.name
  password = var.db_password
}

locals {
  database_url = "postgresql://sako:${var.db_password}@${google_sql_database_instance.db.public_ip_address}:5432/sako"
}

# ---- File uploads ----
resource "google_storage_bucket" "uploads" {
  name     = "${var.project_name}-uploads-${var.gcp_project}"
  location = var.region
}

# ---- Apps: one Cloud Run service each ----
resource "google_cloud_run_v2_service" "app" {
  for_each            = var.services
  name                = "${var.project_name}-${each.key}"
  location            = var.region
  deletion_protection = false

  template {
    containers {
      image = each.value.image
      ports {
        container_port = each.value.port
      }
      dynamic "env" {
        for_each = merge(var.app_env, {
          DATABASE_URL   = local.database_url
          STORAGE_BUCKET = google_storage_bucket.uploads.name
        })
        content {
          name  = env.key
          value = env.value
        }
      }
    }
  }
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  for_each = var.services
  name     = google_cloud_run_v2_service.app[each.key].name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

output "urls" {
  value = { for k, s in google_cloud_run_v2_service.app : k => s.uri }
}
