#!/bin/bash
# =============================================================================
# SAKO Composer - CloudWatch Alarms Setup
# =============================================================================
# Creates CloudWatch alarms for monitoring and alerting
#
# Usage:
#   ./infra/cloudwatch-alarms.sh
#
# Prerequisites:
#   - AWS CLI configured
#   - SNS topic for notifications (optional)
# =============================================================================

set -e

echo "🔔 Setting up CloudWatch Alarms for SAKO Composer..."

REGION="${AWS_REGION:-ap-south-1}"
CLUSTER_NAME="sako-cluster"
SERVICE_NAME="sako-composer-service"

# Create SNS topic for alerts (if doesn't exist)
SNS_TOPIC_ARN=$(aws sns create-topic --name sako-composer-alerts --region $REGION --query 'TopicArn' --output text)
echo "📬 SNS Topic ARN: $SNS_TOPIC_ARN"

echo ""
echo "📧 To receive email alerts, subscribe to the topic:"
echo "   aws sns subscribe --topic-arn $SNS_TOPIC_ARN --protocol email --notification-endpoint your@email.com"
echo ""

# High CPU Alarm
echo "Creating High CPU alarm..."
aws cloudwatch put-metric-alarm \
    --alarm-name "sako-composer-high-cpu" \
    --alarm-description "ECS CPU utilization above 85% for 5 minutes" \
    --namespace "AWS/ECS" \
    --metric-name "CPUUtilization" \
    --dimensions Name=ServiceName,Value=$SERVICE_NAME Name=ClusterName,Value=$CLUSTER_NAME \
    --statistic Average \
    --period 60 \
    --threshold 85 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 5 \
    --alarm-actions $SNS_TOPIC_ARN \
    --region $REGION

# High Memory Alarm
echo "Creating High Memory alarm..."
aws cloudwatch put-metric-alarm \
    --alarm-name "sako-composer-high-memory" \
    --alarm-description "ECS Memory utilization above 90% for 5 minutes" \
    --namespace "AWS/ECS" \
    --metric-name "MemoryUtilization" \
    --dimensions Name=ServiceName,Value=$SERVICE_NAME Name=ClusterName,Value=$CLUSTER_NAME \
    --statistic Average \
    --period 60 \
    --threshold 90 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 5 \
    --alarm-actions $SNS_TOPIC_ARN \
    --region $REGION

# Unhealthy Hosts Alarm
echo "Creating Unhealthy Hosts alarm..."
aws cloudwatch put-metric-alarm \
    --alarm-name "sako-composer-unhealthy-hosts" \
    --alarm-description "ALB has unhealthy targets" \
    --namespace "AWS/ApplicationELB" \
    --metric-name "UnHealthyHostCount" \
    --dimensions Name=TargetGroup,Value=targetgroup/sako-composer-tg/REPLACE_WITH_TG_ID Name=LoadBalancer,Value=app/sako-composer-alb/REPLACE_WITH_ALB_ID \
    --statistic Sum \
    --period 60 \
    --threshold 1 \
    --comparison-operator GreaterThanOrEqualToThreshold \
    --evaluation-periods 2 \
    --alarm-actions $SNS_TOPIC_ARN \
    --region $REGION

# 5xx Errors Alarm
echo "Creating 5xx Errors alarm..."
aws cloudwatch put-metric-alarm \
    --alarm-name "sako-composer-5xx-errors" \
    --alarm-description "ALB 5xx errors above 10 per minute" \
    --namespace "AWS/ApplicationELB" \
    --metric-name "HTTPCode_Target_5XX_Count" \
    --dimensions Name=LoadBalancer,Value=app/sako-composer-alb/REPLACE_WITH_ALB_ID \
    --statistic Sum \
    --period 60 \
    --threshold 10 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 1 \
    --alarm-actions $SNS_TOPIC_ARN \
    --region $REGION

# Lambda Errors Alarm (for Remotion)
echo "Creating Lambda Errors alarm..."
aws cloudwatch put-metric-alarm \
    --alarm-name "sako-remotion-lambda-errors" \
    --alarm-description "Remotion Lambda error rate above 5%" \
    --namespace "AWS/Lambda" \
    --metric-name "Errors" \
    --dimensions Name=FunctionName,Value=remotion-render-$REGION \
    --statistic Sum \
    --period 300 \
    --threshold 5 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 1 \
    --alarm-actions $SNS_TOPIC_ARN \
    --region $REGION

# Lambda Throttles Alarm
echo "Creating Lambda Throttles alarm..."
aws cloudwatch put-metric-alarm \
    --alarm-name "sako-remotion-lambda-throttles" \
    --alarm-description "Remotion Lambda being throttled" \
    --namespace "AWS/Lambda" \
    --metric-name "Throttles" \
    --dimensions Name=FunctionName,Value=remotion-render-$REGION \
    --statistic Sum \
    --period 300 \
    --threshold 1 \
    --comparison-operator GreaterThanOrEqualToThreshold \
    --evaluation-periods 1 \
    --alarm-actions $SNS_TOPIC_ARN \
    --region $REGION

echo ""
echo "✅ CloudWatch Alarms created successfully!"
echo ""
echo "📋 Alarms created:"
echo "   - sako-composer-high-cpu"
echo "   - sako-composer-high-memory"
echo "   - sako-composer-unhealthy-hosts"
echo "   - sako-composer-5xx-errors"
echo "   - sako-remotion-lambda-errors"
echo "   - sako-remotion-lambda-throttles"
echo ""
echo "⚠️  Note: Update REPLACE_WITH_ALB_ID and REPLACE_WITH_TG_ID with actual values after CloudFormation deployment"
