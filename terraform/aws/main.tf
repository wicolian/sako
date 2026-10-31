terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "aws" {
  region = var.region
}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# ---- Postgres ----
resource "aws_db_subnet_group" "db" {
  name       = "${var.project_name}-db"
  subnet_ids = data.aws_subnets.default.ids
}

resource "aws_db_instance" "db" {
  identifier           = "${var.project_name}-db"
  engine               = "postgres"
  engine_version       = "16"
  instance_class       = "db.t4g.micro"
  allocated_storage    = 20
  db_name              = "sako"
  username             = "sako"
  password             = var.db_password
  db_subnet_group_name = aws_db_subnet_group.db.name
  publicly_accessible  = true
  skip_final_snapshot  = true
}

locals {
  database_url = "postgresql://sako:${var.db_password}@${aws_db_instance.db.address}:5432/sako"
}

# ---- File uploads ----
resource "aws_s3_bucket" "uploads" {
  bucket_prefix = "${var.project_name}-uploads-"
}

# ---- Apps: one App Runner service each ----
# App Runner pulls from ECR. Push your images to ECR and put the ECR URIs in var.services.
resource "aws_iam_role" "apprunner_ecr" {
  name = "${var.project_name}-apprunner-ecr"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "build.apprunner.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy_attachment" "apprunner_ecr" {
  role       = aws_iam_role.apprunner_ecr.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

resource "aws_apprunner_service" "app" {
  for_each     = var.services
  service_name = "${var.project_name}-${each.key}"

  source_configuration {
    auto_deployments_enabled = false
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_ecr.arn
    }
    image_repository {
      image_identifier      = each.value.image
      image_repository_type = startswith(each.value.image, "public.ecr.aws") ? "ECR_PUBLIC" : "ECR"
      image_configuration {
        port = tostring(each.value.port)
        runtime_environment_variables = merge(var.app_env, {
          DATABASE_URL   = local.database_url
          STORAGE_BUCKET = aws_s3_bucket.uploads.bucket
        })
      }
    }
  }
}

output "urls" {
  value = { for k, s in aws_apprunner_service.app : k => "https://${s.service_url}" }
}
