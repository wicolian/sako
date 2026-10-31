variable "project_name" {
  type    = string
  default = "sako"
}

# Build and push one image per app first (see terraform/README.md).
variable "services" {
  description = "App name => container image + port"
  type = map(object({
    image = string
    port  = number
  }))
  default = {
    api      = { image = "ghcr.io/your-github-user/sako-api:latest", port = 3001 }
    gtm      = { image = "ghcr.io/your-github-user/sako-gtm:latest", port = 3000 }
    client   = { image = "ghcr.io/your-github-user/sako-client:latest", port = 80 }
    studio   = { image = "ghcr.io/your-github-user/sako-studio:latest", port = 80 }
    landing  = { image = "ghcr.io/your-github-user/sako-landing:latest", port = 3000 }
    waitlist = { image = "ghcr.io/your-github-user/sako-waitlist:latest", port = 80 }
    wall     = { image = "ghcr.io/your-github-user/sako-wall:latest", port = 3000 }
    n8n      = { image = "n8nio/n8n:latest", port = 5678 }
  }
}

variable "app_env" {
  description = "Env vars for every app (keys from the .env.example files)"
  type        = map(string)
  sensitive   = true
  default     = {}
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "gcp_project" {
  type = string
}

variable "region" {
  type    = string
  default = "us-central1"
}
