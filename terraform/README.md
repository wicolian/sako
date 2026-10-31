# Deploy Sako on any cloud

Pick one folder. Each one makes a Postgres database, a file bucket, and one service per app.

| Folder | Database | Apps run on | Best for |
|---|---|---|---|
| `vercel-neon-railway/` | Neon | Vercel (web) + Railway (API, n8n) | Fastest start, cheapest |
| `aws/` | RDS Postgres | App Runner + S3 | AWS shops |
| `gcp/` | Cloud SQL | Cloud Run + GCS | Google Cloud |
| `azure/` | Postgres Flexible Server | Container Apps + Storage | Azure |

## Steps

1. **Build images** (not needed for `vercel-neon-railway/`, it builds from your fork):
   ```bash
   docker build -t <registry>/sako-api platform/services/api
   docker build -t <registry>/sako-client platform/apps/client
   docker build -t <registry>/sako-studio platform/apps/studio
   docker build -t <registry>/sako-gtm apps/gtm
   # landing, waitlist, wall: add a Dockerfile or host them on Vercel
   ```
   Push them, then put the image names in `services` in your `terraform.tfvars`.
   On AWS the images must be in ECR.
2. **Fill in your keys:** `cp terraform.tfvars.example terraform.tfvars`
3. **Deploy:** `terraform init && terraform apply`
4. **Run migrations** against the `DATABASE_URL` it prints (see each app's README).

These are starting points, not hardened production setups. The databases are open to the
internet with a password. Lock them down before real customers use them.
