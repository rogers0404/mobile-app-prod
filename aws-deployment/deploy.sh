#!/bin/bash
set -e

echo "🚀 Starting Trip Ride-Share AWS Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
ENVIRONMENT=${ENVIRONMENT:-production}
STACK_NAME="trip-ride-share-${ENVIRONMENT}"

echo -e "${YELLOW}📋 Configuration:${NC}"
echo "   Stack Name: $STACK_NAME"
echo "   Region: $AWS_REGION"
echo "   Environment: $ENVIRONMENT"
echo ""

# Check prerequisites
echo -e "${YELLOW}✓ Checking prerequisites...${NC}"

if ! command -v aws &> /dev/null; then
    echo -e "${RED}✗ AWS CLI not found. Install from https://aws.amazon.com/cli/${NC}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found. Install from https://nodejs.org/${NC}"
    exit 1
fi

if ! command -v sam &> /dev/null; then
    echo -e "${YELLOW}⚠ AWS SAM not found. Installing...${NC}"
    pip install aws-sam-cli
fi

echo -e "${GREEN}✓ Prerequisites OK${NC}"
echo ""

# Check AWS credentials
echo -e "${YELLOW}✓ Verifying AWS credentials...${NC}"
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${RED}✗ AWS credentials not configured. Run: aws configure${NC}"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✓ AWS Account: $ACCOUNT_ID${NC}"
echo ""

# Check if environment file exists
if [ ! -f .env ]; then
    echo -e "${RED}✗ .env file not found!${NC}"
    echo "   Please copy .env.example to .env and configure it"
    exit 1
fi

source .env
echo -e "${GREEN}✓ Environment loaded${NC}"
echo ""

# Build Lambda functions
echo -e "${YELLOW}🔨 Building Lambda functions...${NC}"
cd lambdas
for dir in auth users rides payments websocket notifications; do
    if [ -d "$dir" ]; then
        echo "   Building $dir..."
        cd "$dir"
        # Install dependencies if requirements.txt exists
        if [ -f requirements.txt ]; then
            mkdir -p package
            pip install -r requirements.txt -t package/
            cd package
            zip -r ../${dir}.zip .
            cd ..
        fi
        cd ..
    fi
done
cd ..

echo -e "${GREEN}✓ Lambda functions built${NC}"
echo ""

# Deploy infrastructure with SAM
echo -e "${YELLOW}📦 Deploying infrastructure with SAM...${NC}"

sam build

sam deploy \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --parameter-overrides \
        Environment="$ENVIRONMENT" \
        PayPalClientId="${PAYPAL_CLIENT_ID}" \
        PayPalSecret="${PAYPAL_SECRET}" \
        GoogleMapsKey="${GOOGLE_MAPS_API_KEY}" \
        StripeSecret="${STRIPE_API_KEY}" \
    --capabilities CAPABILITY_NAMED_IAM \
    --no-fail-on-empty-changeset

echo -e "${GREEN}✓ Infrastructure deployed${NC}"
echo ""

# Get stack outputs
echo -e "${YELLOW}📋 Stack Outputs:${NC}"
aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs' \
    --output table

# Get API endpoint
API_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
    --output text)

echo ""
echo -e "${GREEN}✓ Deployment Complete!${NC}"
echo ""
echo -e "${YELLOW}📱 Next Steps:${NC}"
echo "   1. Update frontend API endpoint: $API_ENDPOINT"
echo "   2. Update frontend app.json with API URL"
echo "   3. Configure your frontend environment"
echo "   4. Run frontend build and deploy"
echo ""
echo -e "${YELLOW}📊 Monitor deployment:${NC}"
echo "   AWS Console: https://console.aws.amazon.com/cloudformation"
echo "   CloudWatch: https://console.aws.amazon.com/cloudwatch/home?region=$AWS_REGION"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT:${NC}"
echo "   - See aws-deployment/GETTING_STARTED.md for deployment and verification guidance"
echo "   - Test thoroughly before production"
echo ""
