# One Postgres (Neon) for everything. Each app gets its own database.
resource "neon_project" "db" {
  name      = var.project_name
  region_id = var.region
}

locals {
  databases = ["platform", "gtm", "wall", "n8n"]

  # Next.js / Vite apps on Vercel: name => folder in this repo
  web_apps = {
    landing  = { dir = "apps/landing", framework = "nextjs" }
    waitlist = { dir = "apps/waitlist", framework = "vite" }
    wall     = { dir = "apps/wall", framework = "nextjs" }
    gtm      = { dir = "apps/gtm", framework = "nextjs" }
    client   = { dir = "platform/apps/client", framework = "vite" }
    studio   = { dir = "platform/apps/studio", framework = "vite" }
  }
}

resource "neon_database" "app" {
  for_each   = toset(local.databases)
  project_id = neon_project.db.id
  branch_id  = neon_project.db.default_branch_id
  name       = each.key
  owner_name = neon_project.db.database_user
}

locals {
  db_url = {
    for k in local.databases :
    k => "postgresql://${neon_project.db.database_user}:${neon_project.db.database_password}@${neon_project.db.database_host}/${k}?sslmode=require"
  }
}

# ---------- Web apps (Vercel) ----------
resource "vercel_project" "web" {
  for_each       = local.web_apps
  name           = "${var.project_name}-${each.key}"
  framework      = each.value.framework
  root_directory = each.value.dir
  git_repository = {
    type = "github"
    repo = var.github_repo
  }
}

resource "vercel_project_environment_variables" "web" {
  for_each   = local.web_apps
  project_id = vercel_project.web[each.key].id
  variables = concat(
    [for k, v in var.app_env : {
      key       = k
      value     = v
      target    = ["production", "preview"]
      sensitive = true
    }],
    contains(["gtm", "wall"], each.key) ? [{
      key       = "DATABASE_URL"
      value     = local.db_url[each.key]
      target    = ["production", "preview"]
      sensitive = true
    }] : []
  )
}

# ---------- Backend: API + n8n (Railway) ----------
resource "railway_project" "backend" {
  name = var.project_name
}

resource "railway_service" "api" {
  name               = "api"
  project_id         = railway_project.backend.id
  source_repo        = var.github_repo
  source_repo_branch = "main"
  root_directory     = "platform"
  config_path        = "platform/railway.json"
}

resource "railway_service" "n8n" {
  name               = "n8n"
  project_id         = railway_project.backend.id
  source_repo        = var.github_repo
  source_repo_branch = "main"
  root_directory     = "n8n"
  config_path        = "n8n/railway.toml"
}

resource "railway_variable_collection" "api" {
  environment_id = railway_project.backend.default_environment.id
  service_id     = railway_service.api.id
  variables = concat(
    [for k, v in var.app_env : { name = k, value = v }],
    [{ name = "DATABASE_URL", value = local.db_url["platform"] }]
  )
}

resource "railway_variable_collection" "n8n" {
  environment_id = railway_project.backend.default_environment.id
  service_id     = railway_service.n8n.id
  variables = [
    { name = "DB_TYPE", value = "postgresdb" },
    { name = "DB_POSTGRESDB_HOST", value = neon_project.db.database_host },
    { name = "DB_POSTGRESDB_DATABASE", value = "n8n" },
    { name = "DB_POSTGRESDB_USER", value = neon_project.db.database_user },
    { name = "DB_POSTGRESDB_PASSWORD", value = neon_project.db.database_password },
    { name = "DB_POSTGRESDB_SSL_ENABLED", value = "true" },
  ]
}
