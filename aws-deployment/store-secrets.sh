#!/bin/bash
# store-secrets.sh
# Run this BEFORE deploying the CloudFormation stack.
# This stores your real credentials directly into AWS Secrets Manager
# so they never pass through CloudFormation parameters.
#
# Usage:
#   chmod +x store-secrets.sh
#   ./store-secrets.sh
#
# Requirements: AWS CLI configured with sufficient permissions

set -e

ENVIRONMENT=${1:-production}
REGION=${AWS_DEFAULT_REGION:-us-east-1}

echo "Storing secrets for environment: $ENVIRONMENT in region: $REGION"
echo ""

# ── PayPal Credentials ──────────────────────────────────────────────────────
read -p "Enter PayPal Client ID: " PAYPAL_CLIENT_ID
read -s -p "Enter PayPal Secret: " PAYPAL_SECRET
echo ""

aws secretsmanager put-secret-value \
  --secret-id "trip-paypal-credentials-${ENVIRONMENT}" \
  --secret-string "{\"client_id\":\"${PAYPAL_CLIENT_ID}\",\"secret\":\"${PAYPAL_SECRET}\"}" \
  --region "$REGION" 2>/dev/null || \
aws secretsmanager create-secret \
  --name "trip-paypal-credentials-${ENVIRONMENT}" \
  --description "PayPal API credentials for trip ride-share app" \
  --kms-key-id alias/aws/secretsmanager \
  --secret-string "{\"client_id\":\"${PAYPAL_CLIENT_ID}\",\"secret\":\"${PAYPAL_SECRET}\"}" \
  --region "$REGION"

echo "✅ PayPal credentials stored"

# ── Google Maps API Key ──────────────────────────────────────────────────────
read -s -p "Enter Google Maps API Key: " GOOGLE_MAPS_KEY
echo ""

aws secretsmanager put-secret-value \
  --secret-id "trip-google-maps-key-${ENVIRONMENT}" \
  --secret-string "{\"api_key\":\"${GOOGLE_MAPS_KEY}\"}" \
  --region "$REGION" 2>/dev/null || \
aws secretsmanager create-secret \
  --name "trip-google-maps-key-${ENVIRONMENT}" \
  --description "Google Maps API key for trip ride-share app" \
  --kms-key-id alias/aws/secretsmanager \
  --secret-string "{\"api_key\":\"${GOOGLE_MAPS_KEY}\"}" \
  --region "$REGION"

echo "✅ Google Maps key stored"

# Clear variables from memory
unset PAYPAL_CLIENT_ID PAYPAL_SECRET GOOGLE_MAPS_KEY

echo ""
echo "✅ All secrets stored. You can now deploy the CloudFormation stack."
echo "   The stack will create the secret resources and link to these values."
