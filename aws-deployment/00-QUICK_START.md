# AWS Low-Cost Deployment - Quick Start Guide

## Overview
This package provides production-ready AWS infrastructure for your ride-share app using **serverless & managed services** to keep costs low.

**Estimated Monthly Cost: $20-50** (at startup scale)
- API Gateway: ~$3.50 (1M requests)
- Lambda: ~$5-10 (included free tier coverage)
- DynamoDB: ~$1-5 (on-demand pricing)
- Cognito: Free (up to 50,000 users)
- S3: ~$1 (documents & uploads)
- CloudWatch: Free tier
- SQS/EventBridge: Minimal cost

## 📋 Prerequisites
1. AWS Account with billing enabled
2. AWS CLI v2 installed: https://aws.amazon.com/cli/
3. Node.js 18+ (for CDK)
4. Docker (optional, for local testing)

## 🚀 Deployment Steps

### Step 1: Configure AWS Credentials
```bash
aws configure
# Enter: AWS Access Key ID
# Enter: AWS Secret Access Key
# Enter: Default region (e.g., us-east-1)
# Enter: Default output format (json)
```

### Step 2: Prepare Environment Variables
```bash
cp aws-deployment/.env.example aws-deployment/.env
# Edit .env with your values:
# - PAYPAL_CLIENT_ID
# - PAYPAL_SECRET
# - GOOGLE_MAPS_API_KEY
# - STRIPE_SECRET_KEY (optional)
```

### Step 3: Deploy Infrastructure with CDK (Recommended)
```bash
cd aws-deployment/infrastructure
npm install
npm run deploy
```

**OR Step 3 Alternative: Deploy with CloudFormation**
```bash
aws cloudformation create-stack \
  --stack-name trip-ride-share \
  --template-body file://cloudformation/main-stack.yaml \
  --parameters file://cloudformation/parameters.json \
  --capabilities CAPABILITY_NAMED_IAM
```

### Step 4: Deploy Lambda Functions
```bash
cd aws-deployment/lambdas
bash deploy-all.sh
```

### Step 5: Update Frontend API Endpoint
Get your API Gateway URL from CloudFormation outputs:
```bash
aws cloudformation describe-stacks \
  --stack-name trip-ride-share \
  --query 'Stacks[0].Outputs' \
  --output table
```

Update `frontend/app.json` and environment configs with the API URL.

## 📁 Directory Structure

```
aws-deployment/
├── 00-QUICK_START.md           ← You are here
├── 01-ARCHITECTURE.md          ← System design overview
├── 02-COST_ANALYSIS.md         ← Pricing details
├── 03-SECURITY.md              ← Security hardening
├── 04-MONITORING.md            ← Observability setup
├── 05-LOCAL_TESTING.md         ← Test locally first
├── .env.example                ← Configuration template
├── infrastructure/             ← AWS CDK code
│   ├── lib/
│   ├── bin/
│   └── package.json
├── lambdas/                    ← Lambda function handlers
│   ├── auth/
│   ├── rides/
│   ├── users/
│   ├── payments/
│   ├── websocket/
│   └── deploy-all.sh
├── cloudformation/             ← CloudFormation templates
│   ├── main-stack.yaml
│   ├── parameters.json
│   └── templates/
├── terraform/                  ← Alternative to CDK
├── docker-compose.yml          ← Local testing
└── scripts/
    ├── setup.sh
    ├── deploy.sh
    └── cleanup.sh
```

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Clients (iOS/Android)                   │
└─────────────────────────────┬───────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │   CloudFront CDN   │ (optional, caching)
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │   API Gateway      │ (REST + WebSocket)
                    └─────────┬──────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
    ┌───────▼─────┐  ┌───────▼─────┐  ┌───────▼─────┐
    │   Lambda     │  │   Lambda    │  │   Lambda    │
    │   (Rides)    │  │   (Users)   │  │  (Payments) │
    └───────┬─────┘  └───────┬─────┘  └───────┬─────┘
            │                 │                 │
            └─────────────────┼─────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
    ┌───────▼─────┐  ┌───────▼─────┐  ┌───────▼─────┐
    │  DynamoDB   │  │   S3        │  │  Cognito    │
    │   (Data)    │  │ (Documents) │  │  (Auth)     │
    └─────────────┘  └─────────────┘  └─────────────┘
            │
    ┌───────▼─────┐
    │  SQS/SNS    │ (Events & Notifications)
    └─────────────┘
```

## 🔑 Key AWS Services Used

| Service | Purpose | Cost |
|---------|---------|------|
| **API Gateway** | REST & WebSocket APIs | $3.50/M requests |
| **Lambda** | Serverless compute | $0.20 per 1M |
| **DynamoDB** | NoSQL database | On-demand $1/M reads |
| **Cognito** | User auth & identity | Free (50K users) |
| **S3** | File storage | $0.023/GB |
| **SQS** | Event queue | $0.40/M requests |
| **CloudWatch** | Logging & monitoring | Included free tier |
| **EventBridge** | Event routing | $0.35/M events |

## 🚦 Next Steps

1. **Local Testing**: Follow `05-LOCAL_TESTING.md` to test locally first
2. **Review Architecture**: Read `01-ARCHITECTURE.md` for system design
3. **Security Hardening**: Check `03-SECURITY.md` for production safety
4. **Monitor Costs**: Set up budgets in `02-COST_ANALYSIS.md`
5. **Setup Monitoring**: Follow `04-MONITORING.md` for observability

## 🆘 Troubleshooting

### "Access Denied" errors
```bash
# Check your AWS credentials are correct
aws sts get-caller-identity
```

### CDK dependency issues
```bash
cd infrastructure
rm -rf node_modules package-lock.json
npm install
```

### Lambda deployment fails
```bash
# Check CloudWatch logs
aws logs tail /aws/lambda/trip-rides --follow
```

### Need to rollback?
```bash
aws cloudformation delete-stack --stack-name trip-ride-share
```

## 📞 Support

For questions about specific services:
- **API Gateway**: https://docs.aws.amazon.com/apigateway/
- **Lambda**: https://docs.aws.amazon.com/lambda/
- **DynamoDB**: https://docs.aws.amazon.com/dynamodb/
- **Cognito**: https://docs.aws.amazon.com/cognito/

## ✅ Deployment Checklist

- [ ] AWS Account created & credentials configured
- [ ] Environment variables (.env) set
- [ ] Infrastructure deployed
- [ ] Lambda functions deployed
- [ ] API endpoint working (test with curl)
- [ ] Frontend updated with API URL
- [ ] Tests passing
- [ ] Monitoring configured
- [ ] Backups enabled
- [ ] Security review complete

---

**Current Status**: Ready for deployment
**Last Updated**: 2026-11-19
