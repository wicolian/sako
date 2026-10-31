# ---- Accounts (create tokens in each dashboard) ----
variable "vercel_api_token" {
  type      = string
  sensitive = true
}
variable "vercel_team_id" {
  type    = string
  default = null
}
variable "neon_api_key" {
  type      = string
  sensitive = true
}
variable "railway_token" {
  type      = string
  sensitive = true
}

# ---- Your brand ----
variable "project_name" {
  type    = string
  default = "sako"
}
variable "github_repo" {
  description = "Your fork, e.g. your-name/sako"
  type        = string
}
variable "region" {
  type    = string
  default = "aws-us-east-1"
}

# ---- App secrets. Every key the apps read. Leave optional ones empty. ----
variable "app_env" {
  description = "Env vars shared by all apps. See each app's .env.example for the full list."
  type        = map(string)
  sensitive   = true
  default     = {}
}
