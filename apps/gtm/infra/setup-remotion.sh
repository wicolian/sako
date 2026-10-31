#!/bin/bash
# =============================================================================
# SAKO Composer - Remotion Lambda Setup
# =============================================================================
# Sets up Remotion Lambda for serverless video rendering
#
# Usage:
#   ./infra/setup-remotion.sh
#
# Prerequisites:
#   - AWS CLI configured
#   - Remotion packages installed (bun add @remotion/lambda @remotion/cli)
# =============================================================================

set -e

echo "🎬 Setting up Remotion Lambda for SAKO Composer..."

# Configuration
REGION="${AWS_REGION:-ap-south-1}"
MEMORY=3008
TIMEOUT=240
DISK=2048

# Check if Remotion is installed
if ! command -v npx &> /dev/null || ! npx remotion --version &> /dev/null; then
    echo "📦 Installing Remotion packages..."
    bun add @remotion/lambda @remotion/cli @remotion/core
fi

echo ""
echo "📝 Step 1: Creating IAM policies..."
echo ""

# Create policy files
npx remotion lambda policies role > /tmp/remotion-role-policy.json
npx remotion lambda policies user > /tmp/remotion-user-policy.json

echo "Generated IAM policy files:"
echo "  - /tmp/remotion-role-policy.json (for Lambda execution role)"
echo "  - /tmp/remotion-user-policy.json (for deploy user)"

echo ""
echo "📝 Step 2: Creating IAM role and policies in AWS..."
echo ""

# Create the Lambda execution role
ROLE_NAME="remotion-lambda-role"
if ! aws iam get-role --role-name "$ROLE_NAME" 2>/dev/null; then
    echo "Creating IAM role: $ROLE_NAME"
    
    # Create trust policy
    cat > /tmp/trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
    
    aws iam create-role \
        --role-name "$ROLE_NAME" \
        --assume-role-policy-document file:///tmp/trust-policy.json \
        --description "Remotion Lambda execution role"
    
    # Attach the Remotion policy
    aws iam put-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-name "RemotionLambdaPolicy" \
        --policy-document file:///tmp/remotion-role-policy.json
    
    # Attach basic Lambda execution policy
    aws iam attach-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
    
    echo "✅ IAM role created"
    
    # Wait for role to propagate
    echo "⏳ Waiting for IAM role to propagate (15 seconds)..."
    sleep 15
else
    echo "✅ IAM role already exists"
fi

echo ""
echo "📝 Step 3: Deploying Remotion Lambda function..."
echo ""

# Deploy the Lambda function
npx remotion lambda functions deploy \
    --region "$REGION" \
    --memory "$MEMORY" \
    --timeout "$TIMEOUT" \
    --disk "$DISK"

echo ""
echo "📝 Step 4: Creating S3 bucket for renders..."
echo ""

BUCKET_NAME="sako-remotion-renders-$REGION"
if ! aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
    echo "Creating S3 bucket: $BUCKET_NAME"
    
    if [ "$REGION" = "us-east-1" ]; then
        aws s3api create-bucket --bucket "$BUCKET_NAME"
    else
        aws s3api create-bucket \
            --bucket "$BUCKET_NAME" \
            --create-bucket-configuration LocationConstraint="$REGION"
    fi
    
    # Add lifecycle rule to delete old renders after 30 days
    cat > /tmp/lifecycle.json <<EOF
{
  "Rules": [
    {
      "ID": "DeleteOldRenders",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "renders/"
      },
      "Expiration": {
        "Days": 30
      }
    }
  ]
}
EOF
    
    aws s3api put-bucket-lifecycle-configuration \
        --bucket "$BUCKET_NAME" \
        --lifecycle-configuration file:///tmp/lifecycle.json
    
    echo "✅ S3 bucket created with 30-day lifecycle"
else
    echo "✅ S3 bucket already exists"
fi

echo ""
echo "📝 Step 5: Checking Lambda concurrency quotas..."
echo ""

npx remotion lambda quotas

echo ""
echo "🎉 Remotion Lambda setup complete!"
echo ""
echo "📋 Summary:"
echo "  - Region: $REGION"
echo "  - Memory: ${MEMORY}MB"
echo "  - Timeout: ${TIMEOUT}s"
echo "  - Disk: ${DISK}MB"
echo "  - S3 Bucket: $BUCKET_NAME"
echo ""
echo "💡 Add this to your .env.local:"
echo "  REMOTION_LAMBDA_FUNCTION_NAME=remotion-render-$REGION"
echo ""
echo "📖 Next steps:"
echo "  1. Create your Remotion compositions in src/remotion/"
echo "  2. Deploy your site: npx remotion lambda sites create src/remotion/index.ts --site-name sako-video"
echo "  3. Test rendering: npx remotion lambda render <site-url> <composition-id>"
