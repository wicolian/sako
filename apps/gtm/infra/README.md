# SAKO Composer - AWS Infrastructure

This directory contains Infrastructure as Code (IaC) and setup scripts for deploying SAKO Composer to AWS.

## Architecture Overview

```
                                    ┌─────────────────┐
                                    │   CloudFront    │
                                    │      CDN        │
                                    └────────┬────────┘
                                             │
                                    ┌────────▼────────┐
                                    │       ALB       │
                                    │ (Load Balancer) │
                                    └────────┬────────┘
                                             │
                          ┌──────────────────┼──────────────────┐
                          │                  │                  │
                   ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐
                   │  ECS Task   │    │  ECS Task   │    │  ECS Task   │
                   │  (Fargate)  │    │  (Fargate)  │    │  (Fargate)  │
                   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
                          │                  │                  │
                          └──────────────────┼──────────────────┘
                                             │
              ┌──────────────────────────────┼──────────────────────────────┐
              │                              │                              │
    ┌─────────▼─────────┐         ┌─────────▼─────────┐         ┌─────────▼─────────┐
    │     Supabase      │         │   Remotion Lambda  │         │   Cloudflare R2   │
    │  (AWS Marketplace)│         │  (Video Rendering) │         │     (Storage)     │
    └───────────────────┘         └───────────────────┘         └───────────────────┘
```

## Prerequisites

- AWS CLI configured with appropriate credentials
- AWS account with $5k credits (or budget)
- Domain name (optional, for custom domain)
- GitHub repository with OIDC configured

## Quick Start

### 1. Subscribe to Supabase via AWS Marketplace

Go to: https://aws.amazon.com/marketplace/pp/prodview-wet7aplxdxoh4

This allows your AWS credits to cover Supabase costs (~$25/month).

### 2. Deploy Infrastructure

```bash
# Deploy CloudFormation stack
aws cloudformation create-stack \
  --stack-name sako-composer \
  --template-body file://infra/cloudformation.yml \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --parameters \
    ParameterKey=Environment,ParameterValue=production \
    ParameterKey=DomainName,ParameterValue=composer.trysako.com

# Wait for completion
aws cloudformation wait stack-create-complete --stack-name sako-composer
```

### 3. Set Up Secrets

```bash
chmod +x infra/setup-secrets.sh
./infra/setup-secrets.sh
```

### 4. Set Up Remotion Lambda (Video Generation)

```bash
chmod +x infra/setup-remotion.sh
./infra/setup-remotion.sh
```

### 5. Configure GitHub Repository

Add these secrets to your GitHub repository:
- `AWS_ACCOUNT_ID`: Your AWS account ID (e.g., `<YOUR_AWS_ACCOUNT_ID>`)

Add these variables:
- `AWS_REGION`: `ap-south-1`

### 6. Push to Deploy

```bash
git add .
git commit -m "Add AWS infrastructure"
git push origin main
```

The GitHub Actions workflow will automatically:
1. Run tests
2. Build Docker image
3. Push to ECR
4. Deploy to ECS

## Files Overview

| File | Description |
|------|-------------|
| `cloudformation.yml` | Main infrastructure template (VPC, ECS, ALB, etc.) |
| `setup-secrets.sh` | Creates AWS Secrets Manager secrets |
| `setup-remotion.sh` | Sets up Remotion Lambda for video rendering |
| `cloudwatch-dashboard.json` | CloudWatch dashboard configuration |
| `cloudwatch-alarms.sh` | Creates CloudWatch alarms |

## Cost Estimate

| Service | Monthly Cost |
|---------|-------------|
| Supabase Pro (AWS Marketplace) | ~$25-40 |
| ECS Fargate (2 tasks, ARM64) | ~$50-80 |
| ALB | ~$25 |
| CloudFront | ~$15 |
| Remotion Lambda | ~$30-50 |
| S3 + Secrets Manager | ~$6 |
| CloudWatch | ~$10 |
| Data Transfer | ~$45 |
| **Total** | **~$205-270** |

With $5k credits: **~20 months runway**

## Monitoring

### CloudWatch Dashboard

```bash
# Create dashboard
aws cloudwatch put-dashboard \
  --dashboard-name sako-composer \
  --dashboard-body file://infra/cloudwatch-dashboard.json
```

### Set Up Alarms

```bash
chmod +x infra/cloudwatch-alarms.sh
./infra/cloudwatch-alarms.sh
```

### Subscribe to Alerts

```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:ap-south-1:YOUR_ACCOUNT_ID:sako-composer-alerts \
  --protocol email \
  --notification-endpoint your@email.com
```

## Custom Domain Setup

### 1. Request ACM Certificate

```bash
aws acm request-certificate \
  --domain-name composer.trysako.com \
  --validation-method DNS \
  --region ap-south-1
```

### 2. Add DNS Validation Records

Add the CNAME records provided by ACM to your DNS provider.

### 3. Create Route 53 Hosted Zone (if using Route 53)

```bash
aws route53 create-hosted-zone \
  --name trysako.com \
  --caller-reference $(date +%s)
```

### 4. Point Domain to CloudFront

Create an alias record pointing to the CloudFront distribution.

## Troubleshooting

### ECS Tasks Not Starting

```bash
# Check task logs
aws logs tail /ecs/sako-composer --follow

# Check task status
aws ecs describe-tasks \
  --cluster sako-cluster \
  --tasks $(aws ecs list-tasks --cluster sako-cluster --service-name sako-composer-service --query 'taskArns[0]' --output text)
```

### Deployment Failures

```bash
# Check service events
aws ecs describe-services \
  --cluster sako-cluster \
  --services sako-composer-service \
  --query 'services[0].events[:5]'
```

### Health Check Failures

```bash
# Test health endpoint locally
curl http://localhost:3000/api/health/liveness

# Check ALB target health
aws elbv2 describe-target-health \
  --target-group-arn TARGET_GROUP_ARN
```

## Security Best Practices

- [x] VPC with private subnets for ECS tasks
- [x] Security groups restricting access
- [x] IAM roles with least privilege
- [x] OIDC for GitHub Actions (no long-lived credentials)
- [x] Secrets in Secrets Manager
- [x] Container runs as non-root user
- [ ] Enable GuardDuty
- [ ] Enable CloudTrail
- [ ] Enable VPC Flow Logs

## Scaling

The infrastructure auto-scales based on CPU utilization:
- **Scale out**: CPU > 70% for 2 minutes
- **Scale in**: CPU < 30% for 5 minutes
- **Min tasks**: 2
- **Max tasks**: 8

To adjust:

```bash
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/sako-cluster/sako-composer-service \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 \
  --max-capacity 16
```

## Cleanup

To delete all resources:

```bash
# Delete CloudFormation stack
aws cloudformation delete-stack --stack-name sako-composer

# Delete Remotion Lambda
npx remotion lambda functions delete --all --yes

# Delete S3 buckets (must empty first)
aws s3 rb s3://sako-remotion-renders-ap-south-1 --force

# Delete secrets
aws secretsmanager delete-secret \
  --secret-id sako-composer/production \
  --force-delete-without-recovery
```
