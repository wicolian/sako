output "web_projects" {
  value = { for k, p in vercel_project.web : k => p.name }
}
output "database_host" {
  value = neon_project.db.database_host
}
output "railway_project_id" {
  value = railway_project.backend.id
}
