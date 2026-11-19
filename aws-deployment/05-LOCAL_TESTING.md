# Environment Setup & Local Testing

## Prerequisites

### Required Software
```bash
# 1. AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-macos.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Verify installation
aws --version  # Should be 2.x.x

# 2. Node.js 18+
brew install node@18
node --version  # Should be v18.x.x or higher

# 3. Python 3.9+
brew install python@3.11
python3 --version  # Should be 3.9+

# 4. Docker (optional, for local testing)
brew install docker

# 5. AWS SAM CLI (Serverless Application Model)
brew install aws-sam-cli
sam --version
```

### AWS Account Setup
```bash
# 1. Create AWS account at https://aws.amazon.com
# 2. Create IAM user with programmatic access
# 3. Configure credentials locally

aws configure
# Enter: AWS Access Key ID
# Enter: AWS Secret Access Key  
# Enter: Default region (e.g., us-east-1)
# Enter: Default output format (json)

# Verify setup
aws sts get-caller-identity
# Should return your AWS account info
```

## 2. Environment Variables

### Create .env file
```bash
cd aws-deployment
cp .env.example .env
```

### .env.example
```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=your-account-id
AWS_PROFILE=default

# Service Configuration
ENVIRONMENT=development
APP_NAME=trip-ride-share
LOG_LEVEL=INFO

# API Configuration
API_PORT=3000
API_DOMAIN=api.trip.local
CORS_ORIGINS=http://localhost:3000,http://localhost:8081,http://localhost:8100

# Database Configuration
DYNAMODB_TABLE_PREFIX=dev_
DYNAMODB_REGION=us-east-1

# Cognito Configuration
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx

# Third-party Services
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_SECRET=your-paypal-secret

STRIPE_API_KEY=sk_test_your-stripe-key
STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-key

GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# S3 Configuration
S3_BUCKET_DOCUMENTS=trip-app-documents-dev
S3_REGION=us-east-1

# Redis Configuration (optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# WebSocket Configuration
WEBSOCKET_API_ID=xxxxxxxxxx
WEBSOCKET_STAGE=dev
```

## 3. Local Development Setup

### Option A: Using LocalStack (Recommended)

LocalStack allows you to run AWS services locally.

```bash
# Install LocalStack
pip install localstack localstack-client

# Start LocalStack
localstack start
# In another terminal:
docker ps  # Verify LocalStack containers running

# Configure AWS CLI to use LocalStack
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

# Create local DynamoDB tables
aws dynamodb create-table \
  --table-name users \
  --attribute-definitions AttributeName=user_id,AttributeType=S \
  --key-schema AttributeName=user_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:4566

# Verify table creation
aws dynamodb list-tables --endpoint-url http://localhost:4566
```

### Option B: Using Docker Compose

```bash
cd aws-deployment
docker-compose up -d

# Verify services
docker-compose ps
```

### docker-compose.yml
```yaml
version: '3.8'

services:
  # LocalStack - AWS emulation
  localstack:
    image: localstack/localstack:latest
    container_name: localstack-trip-app
    ports:
      - "4566:4566"
      - "4571:4571"
    environment:
      - SERVICES=dynamodb,s3,lambda,sns,sqs,apigateway,cognito-idp
      - DEBUG=1
      - DATA_DIR=/tmp/localstack/data
      - DOCKER_HOST=unix:///var/run/docker.sock
    volumes:
      - "${TMPDIR:-/tmp/localstack}:/tmp/localstack"
      - "/var/run/docker.sock:/var/run/docker.sock"
    networks:
      - trip-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4566/_localstack/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  # DynamoDB (alternative to LocalStack)
  dynamodb-local:
    image: amazon/dynamodb-local:latest
    container_name: dynamodb-trip-app
    ports:
      - "8000:8000"
    volumes:
      - dynamodb-data:/home/dynamodblocal/data
    networks:
      - trip-network
    command: "-jar DynamoDBLocal.jar -sharedDb -dbPath /home/dynamodblocal/data"

  # Redis (for caching/sessions)
  redis:
    image: redis:7-alpine
    container_name: redis-trip-app
    ports:
      - "6379:6379"
    networks:
      - trip-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # PostgreSQL (alternative to DynamoDB)
  postgres:
    image: postgres:15-alpine
    container_name: postgres-trip-app
    environment:
      POSTGRES_DB: trip_app
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - trip-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  dynamodb-data:
  postgres-data:

networks:
  trip-network:
    driver: bridge
```

## 4. Lambda Local Testing

### Using AWS SAM CLI

```bash
# Initialize SAM project
sam init --runtime python3.11 --name trip-backend

# Build Lambda functions
sam build

# Run Lambda locally
sam local start-api --port 3000

# Test endpoint
curl http://localhost:3000/rides
```

### Using Serverless Framework

```bash
# Install Serverless
npm install -g serverless

# Create serverless project
serverless create --template aws-python3 --path trip-backend
cd trip-backend

# Install dependencies
npm install

# Configure AWS credentials
serverless config credentials --provider aws --key YOUR_KEY --secret YOUR_SECRET

# Deploy to AWS
serverless deploy

# View logs
serverless logs -f function-name --tail

# Invoke function locally
serverless invoke local -f function-name --data '{"key":"value"}'
```

## 5. API Testing

### Using Postman

```bash
# Install Postman
brew install --cask postman

# Import API collection
# File → Import → Select collection.json from aws-deployment/tests/

# Set up environment variables in Postman
{
  "api_url": "http://localhost:3000",
  "auth_token": "your-jwt-token",
  "user_id": "test-user-123",
  "ride_id": "test-ride-456"
}
```

### Using cURL

```bash
# Create user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Rider",
    "email": "john@example.com",
    "user_type": "rider"
  }'

# Request ride
curl -X POST http://localhost:3000/rides \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "user_id": "user-123",
    "pickup_latitude": 40.7128,
    "pickup_longitude": -74.0060,
    "dropoff_latitude": 40.7580,
    "dropoff_longitude": -73.9855
  }'

# Get ride details
curl -X GET http://localhost:3000/rides/ride-123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Using Python requests

```python
import requests
import json

BASE_URL = "http://localhost:3000"
AUTH_TOKEN = "your-jwt-token"

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {AUTH_TOKEN}"
}

# Create ride request
ride_data = {
    "user_id": "user-123",
    "pickup_latitude": 40.7128,
    "pickup_longitude": -74.0060,
    "dropoff_latitude": 40.7580,
    "dropoff_longitude": -73.9855,
    "pickup_address": "Times Square, NYC",
    "dropoff_address": "Central Park, NYC"
}

response = requests.post(
    f"{BASE_URL}/rides",
    headers=headers,
    json=ride_data
)

print(f"Status: {response.status_code}")
print(f"Response: {json.dumps(response.json(), indent=2)}")
```

## 6. Load Testing

### Using Apache JMeter

```bash
# Install JMeter
brew install jmeter

# Create test plan
# - Thread Group: 100 users
# - Ramp-up: 10 seconds
# - HTTP Request Sampler: POST /rides
# - View Results: Graph

jmeter -n -t test-plan.jmx -l results.jtl -j jmeter.log
```

### Using k6

```bash
# Install k6
brew install k6

# Create test script
cat > load-test.js << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },   // Ramp-up
    { duration: '1m30s', target: 100 }, // Ramp-up
    { duration: '2m', target: 100 },    // Stay at 100
    { duration: '30s', target: 0 },     // Ramp-down
  ],
};

export default function () {
  const payload = JSON.stringify({
    user_id: 'user-123',
    pickup_latitude: 40.7128,
    pickup_longitude: -74.0060,
    dropoff_latitude: 40.7580,
    dropoff_longitude: -73.9855,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer token',
    },
  };

  const response = http.post('http://localhost:3000/rides', payload, params);

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
EOF

# Run load test
k6 run load-test.js
```

## 7. Debugging

### CloudWatch Logs Locally

```bash
# Tail logs locally (if using LocalStack)
docker logs localstack-trip-app -f

# Or use awslogs CLI
pip install awslogs

awslogs get /aws/lambda/trip-rides \
  --start="30 minutes ago" \
  --follow
```

### VS Code Debugging

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python Lambda",
      "type": "python",
      "request": "launch",
      "program": "${workspaceFolder}/lambdas/rides/request.py",
      "console": "integratedTerminal",
      "justMyCode": true,
      "args": ["--debug"]
    },
    {
      "name": "SAM Debug",
      "type": "aws-sam",
      "request": "direct-invoke",
      "invokeTarget": {
        "target": "template",
        "templatePath": "${workspaceFolder}/template.yaml",
        "logicalId": "RidesFunction"
      },
      "lambda": {
        "payload": {
          "path": "payload.json"
        },
        "environmentVariables": {
          "ENVIRONMENT": "development"
        }
      }
    }
  ]
}
```

## 8. Testing Checklist

Before deploying to AWS:

- [ ] All environment variables set in .env
- [ ] LocalStack containers running
- [ ] DynamoDB tables created locally
- [ ] Lambda functions deployable
- [ ] API endpoints returning 200 status
- [ ] Authentication flow working
- [ ] Ride creation and tracking working
- [ ] Payment processing working
- [ ] WebSocket connections established
- [ ] Load test passed (100+ concurrent users)
- [ ] Security tests passed
- [ ] No hardcoded secrets in code
- [ ] All dependencies installed

## 9. Deployment to AWS

Once local testing passes:

```bash
# 1. Build functions
sam build

# 2. Deploy to AWS
sam deploy --guided

# 3. View deployment
aws cloudformation describe-stacks --stack-name trip-ride-share

# 4. Test on AWS
curl https://your-api-id.execute-api.us-east-1.amazonaws.com/prod/rides

# 5. Monitor
aws logs tail /aws/lambda/trip-rides --follow

# 6. Cleanup (if needed)
aws cloudformation delete-stack --stack-name trip-ride-share
```

---

**Version**: 1.0
**Last Updated**: 2026-11-19
