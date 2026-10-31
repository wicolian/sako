terraform {
  required_version = ">= 1.6"
  required_providers {
    vercel  = { source = "vercel/vercel", version = "~> 2.0" }
    neon    = { source = "kislerdm/neon", version = "~> 0.6" }
    railway = { source = "terraform-community-providers/railway", version = "~> 0.4" }
  }
}

provider "vercel" {
  api_token = var.vercel_api_token
  team      = var.vercel_team_id
}

provider "neon" {
  api_key = var.neon_api_key
}

provider "railway" {
  token = var.railway_token
}
