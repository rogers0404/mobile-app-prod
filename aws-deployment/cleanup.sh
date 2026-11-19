#!/bin/bash
set -e

echo "🧹 Cleaning up AWS deployment..."

ENVIRONMENT=${ENVIRONMENT:-production}
STACK_NAME="trip-ride-share-${ENVIRONMENT}"
AWS_REGION=${AWS_REGION:-us-east-1}

echo "⚠️  WARNING: This will delete all resources in stack: $STACK_NAME"
read -p "Are you sure? Type 'yes' to confirm: " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Cancelled"
    exit 1
fi

echo "🗑️  Deleting CloudFormation stack..."

aws cloudformation delete-stack \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION"

echo "⏳ Waiting for stack deletion to complete..."

aws cloudformation wait stack-delete-complete \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" 2>/dev/null || true

echo "✅ Cleanup complete!"
echo ""
echo "📝 Note: Some resources may take time to delete:"
echo "   - S3 buckets (if not empty)"
echo "   - RDS instances"
echo "   - Backups and snapshots"
echo ""
echo "Check CloudFormation console for details"
