#!/bin/bash
# build_and_upload.sh
# Packages each Lambda function with dependencies and uploads to S3.
#
# Usage:
#   chmod +x build_and_upload.sh
#   ./build_and_upload.sh <s3-bucket-name> [environment]
#
# Example:
#   ./build_and_upload.sh trip-lambda-code-024811758557 production

set -e

BUCKET=${1:?Usage: ./build_and_upload.sh <s3-bucket-name> [environment]}
ENV=${2:-production}
REGION=${AWS_DEFAULT_REGION:-us-east-1}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/.build"

FUNCTIONS=("users" "driver" "rides" "payments" "places" "websocket" "notifications")

echo "Building and uploading Lambda packages"
echo "  Bucket : $BUCKET"
echo "  Env    : $ENV"
echo "  Region : $REGION"
echo ""

# Install dependencies into a shared layer directory once
DEPS_DIR="$BUILD_DIR/deps"
if [ ! -d "$DEPS_DIR" ]; then
  echo "Installing dependencies..."
  mkdir -p "$DEPS_DIR"
  pip install -r "$SCRIPT_DIR/requirements.txt" -t "$DEPS_DIR" -q
  echo "  Done"
fi

for FUNC in "${FUNCTIONS[@]}"; do
  echo "Packaging $FUNC..."

  PKG_DIR="$BUILD_DIR/$FUNC"
  rm -rf "$PKG_DIR"
  mkdir -p "$PKG_DIR"

  # Copy shared deps
  cp -r "$DEPS_DIR/." "$PKG_DIR/"

  # Copy common helpers
  mkdir -p "$PKG_DIR/common"
  cp "$SCRIPT_DIR/common/db.py" "$PKG_DIR/common/"
  touch "$PKG_DIR/common/__init__.py"

  # Copy handler
  cp "$SCRIPT_DIR/${FUNC}.py" "$PKG_DIR/"

  # Zip
  ZIP_FILE="$BUILD_DIR/${FUNC}.zip"
  cd "$PKG_DIR"
  zip -r "$ZIP_FILE" . -x "*.pyc" -x "*/__pycache__/*" > /dev/null
  cd "$SCRIPT_DIR"

  # Upload to S3
  aws s3 cp "$ZIP_FILE" "s3://$BUCKET/$ENV/${FUNC}.zip" --region "$REGION"
  echo "  Uploaded s3://$BUCKET/$ENV/${FUNC}.zip"
done

echo ""
echo "All Lambda packages uploaded to s3://$BUCKET/$ENV/"
echo ""
echo "Next: deploy lambda-functions.yaml via CloudFormation"
echo "  LambdaCodeBucket = $BUCKET"
echo "  Environment      = $ENV"
