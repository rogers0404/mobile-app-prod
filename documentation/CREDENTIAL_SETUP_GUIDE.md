# Credential Setup Guide

**Purpose:** Step-by-step instructions for safely setting up credentials for local development and production deployment.

---

## Table of Contents

1. [Local Development Setup](#local-development-setup)
2. [Production Deployment Setup](#production-deployment-setup)
3. [Credential Sources](#credential-sources)
4. [Security Best Practices](#security-best-practices)

---

## Local Development Setup

### Backend Setup

**File:** `backend/.env` (DO NOT commit this file)

```bash
# 1. Navigate to backend directory
cd backend

# 2. Copy the example file
cp .env.example .env

# 3. Edit .env with your local credentials
# Replace with your actual values:
MONGO_URL=mongodb://localhost:27017  # or your Atlas cluster URL
DB_NAME=trip_development
PAYPAL_CLIENT_ID=<your_sandbox_client_id>
PAYPAL_SECRET=<your_sandbox_secret>
GOOGLE_MAPS_API_KEY=<your_server_api_key>
```

**Where to Get Each Credential:**

#### PayPal Sandbox Credentials
1. Go to [PayPal Developer Dashboard](https://developer.paypal.com)
2. Log in or sign up for a developer account
3. Navigate to **Sandbox > Accounts**
4. Use the **Business** account for Merchant ID
5. Navigate to **Apps & Credentials**
6. Find your **Sandbox Client ID** and **Secret**
7. Copy both values to your .env file

#### Google Maps API Key (Server Key)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable APIs: **Maps JavaScript API**, **Geocoding API**, **Distance Matrix API**
4. Navigate to **Credentials**
5. Create new **API Key**
6. Add Restriction: **API restrictions** → Select the enabled APIs
7. Add Restriction: **Application restrictions** → Select **IP addresses**
8. Add your server IP address (or allow all for local dev)
9. Copy the API key to backend .env as `GOOGLE_MAPS_API_KEY`

#### MongoDB Connection String
- **Local Development:** `mongodb://localhost:27017`
- **MongoDB Atlas:** `mongodb+srv://username:password@cluster.mongodb.net/`

**Important:** Use test/development credentials only, never production!

---

### Frontend Setup

**File:** `frontend/.env.local` (DO NOT commit this file)

```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Copy the example file
cp .env.example .env.local

# 3. Edit .env.local with your local credentials
# Replace with your actual values:
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_BACKEND_URL=  # Leave empty for auto-detection or set to http://localhost:8000
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=<your_public_api_key>
GOOGLE_MAPS_ANDROID_API_KEY=<your_android_key>
GOOGLE_MAPS_IOS_API_KEY=<your_ios_key>
```

**Where to Get Each Credential:**

#### Public Google Maps API Key
1. Same Google Cloud Project as backend
2. Create separate **API Key** for public/client use
3. Add Restriction: **API restrictions** → Select same APIs
4. Add Restriction: **Application restrictions** → Select **iOS apps** and **Android apps**
5. Configure package names:
   - Android: `com.yourapp.rider` or `com.yourapp.driver`
   - iOS: `com.yourapp.rider` or similar
6. Configure signing certificates/fingerprints (see Google Cloud docs)
7. Copy to frontend .env.local

#### Separate Android Key (optional but recommended)
1. Create additional API Key in Google Cloud Console
2. Configure for Android only with package name and fingerprint
3. Set `GOOGLE_MAPS_ANDROID_API_KEY` to this key

#### Separate iOS Key (optional but recommended)
1. Create additional API Key in Google Cloud Console
2. Configure for iOS only with bundle identifier
3. Set `GOOGLE_MAPS_IOS_API_KEY` to this key

---

## Production Deployment Setup

### AWS Secrets Manager Setup

Before deploying to AWS, store credentials in AWS Secrets Manager:

```bash
# 1. Create secret for PayPal credentials
aws secretsmanager create-secret \
  --name trip-app/paypal \
  --description "PayPal API credentials" \
  --secret-string '{
    "client_id": "your_production_client_id",
    "secret": "your_production_secret"
  }'

# 2. Create secret for Google Maps
aws secretsmanager create-secret \
  --name trip-app/google-maps \
  --description "Google Maps API keys" \
  --secret-string '{
    "server_key": "your_production_server_key",
    "public_key": "your_production_public_key"
  }'

# 3. Create secret for MongoDB
aws secretsmanager create-secret \
  --name trip-app/mongodb \
  --description "MongoDB Atlas connection" \
  --secret-string '{
    "connection_url": "mongodb+srv://user:pass@cluster.mongodb.net/prod_db"
  }'
```

### CloudFormation Parameters

**File:** `aws-deployment/parameters.json`

```json
[
  {
    "ParameterKey": "Environment",
    "ParameterValue": "production"
  },
  {
    "ParameterKey": "PayPalClientId",
    "ParameterValue": "YOUR_PRODUCTION_PAYPAL_CLIENT_ID"
  },
  {
    "ParameterKey": "PayPalSecret",
    "ParameterValue": "YOUR_PRODUCTION_PAYPAL_SECRET"
  },
  {
    "ParameterKey": "GoogleMapsKey",
    "ParameterValue": "YOUR_PRODUCTION_GOOGLE_MAPS_KEY"
  }
]
```

### Deployment Steps

```bash
# 1. Validate CloudFormation template
aws cloudformation validate-template \
  --template-body file://aws-deployment/cloudformation-template.yaml

# 2. Create or update CloudFormation stack
aws cloudformation create-stack \
  --stack-name trip-app-prod \
  --template-body file://aws-deployment/cloudformation-template.yaml \
  --parameters file://aws-deployment/parameters.json \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM

# 3. Monitor stack creation
aws cloudformation describe-stacks \
  --stack-name trip-app-prod \
  --query 'Stacks[0].StackStatus'

# 4. Get stack outputs (API endpoint, etc)
aws cloudformation describe-stacks \
  --stack-name trip-app-prod \
  --query 'Stacks[0].Outputs'
```

---

## Credential Sources

### Summary Table

| Credential | Type | Source | Dev Value | Prod Value |
|------------|------|--------|-----------|------------|
| **PAYPAL_CLIENT_ID** | Sandbox/Prod | PayPal Developer | Sandbox ID | Production ID |
| **PAYPAL_SECRET** | Sandbox/Prod | PayPal Developer | Sandbox Secret | Production Secret |
| **GOOGLE_MAPS_API_KEY** | Server Key | Google Cloud | Public Dev Key | Restricted Prod Key |
| **MONGO_URL** | Connection | Local/Atlas | localhost:27017 | Atlas cluster URL |
| **EXPO_PUBLIC_GOOGLE_MAPS_API_KEY** | Public Key | Google Cloud | Public Dev Key | Restricted Public Key |
| **GOOGLE_MAPS_ANDROID_API_KEY** | Android Key | Google Cloud | Dev Android Key | Prod Android Key |
| **GOOGLE_MAPS_IOS_API_KEY** | iOS Key | Google Cloud | Dev iOS Key | Prod iOS Key |

---

## Security Best Practices

### ✅ DO

- ✅ Store credentials in environment variables
- ✅ Use separate credentials for development and production
- ✅ Restrict API keys by IP, domain, and app package
- ✅ Rotate credentials regularly (every 90 days recommended)
- ✅ Use AWS Secrets Manager for production
- ✅ Enable MFA on PayPal and Google accounts
- ✅ Monitor API usage and quotas
- ✅ Use test/sandbox credentials during development
- ✅ Document where each credential comes from
- ✅ Review access logs regularly

### ❌ DON'T

- ❌ Commit .env files to git repository
- ❌ Share credentials via email or chat
- ❌ Use production credentials in development
- ❌ Use same credentials across environments
- ❌ Hardcode credentials in source code
- ❌ Share API keys on public repositories
- ❌ Use overly permissive API restrictions
- ❌ Leave credentials in temporary files
- ❌ Forget to remove old/unused credentials
- ❌ Ignore security warnings from AWS/Google

### .gitignore Protection

Verify these files are in `.gitignore`:

```
# Environment files (never commit)
.env
.env.*
*.env

# Exceptions (OK to commit)
!.env.example

# Specific paths
backend/.env
frontend/.env.local

# Credentials
credentials.json
.credentials
```

---

## Verifying Setup

### Backend Verification

```bash
cd backend

# 1. Install dependencies
pip install -r requirements.txt

# 2. Run tests
python -m pytest tests/ -v

# 3. Start server (should not error on missing credentials)
python server.py

# Expected: "Uvicorn running on http://127.0.0.1:8000"
```

### Frontend Verification

```bash
cd frontend

# 1. Install dependencies
yarn install

# 2. Check TypeScript
yarn tsc --noEmit

# 3. Start Expo
yarn expo start

# Expected: "Expo CLI ready in development mode"
```

---

## Troubleshooting

### "Module not found: PayPal"
```bash
# Solution: Install dependencies
cd backend
pip install -r requirements.txt
```

### "GOOGLE_MAPS_API_KEY is undefined"
```bash
# Solution: Check .env file exists and has the key
backend/.env
# Should contain: GOOGLE_MAPS_API_KEY=your_key_here
```

### "PayPal authentication failed"
```bash
# Solution 1: Check if credentials are correct
# - Log in to PayPal Developer Dashboard
# - Verify sandbox credentials are being used (not production)
# - Check IP address is allowed

# Solution 2: Verify environment variable is loaded
python -c "import os; from dotenv import load_dotenv; load_dotenv(); print(os.getenv('PAYPAL_CLIENT_ID'))"
```

### "TypeScript compilation error"
```bash
# Solution: Ensure frontend/tsconfig.json is correct
cd frontend
cat tsconfig.json | grep compilerOptions

# If broken, run:
yarn tsc --noEmit
```

---

## Credential Rotation

### When to Rotate

- Every 90 days (as per security best practices)
- Immediately if credentials are compromised
- When team member leaves the project
- After production deployment
- If suspicious API usage detected

### How to Rotate

```bash
# 1. Backup current credentials (securely)
# 2. Create new credentials in respective services
# 3. Update all .env files
# 4. Update AWS Secrets Manager
# 5. Restart all running services
# 6. Monitor for errors/unusual activity
# 7. After 24-48 hours, delete old credentials
# 8. Document rotation in security log
```

---

## Support & Questions

For issues with specific credential providers:

- **PayPal:** https://developer.paypal.com/docs/
- **Google Maps:** https://developers.google.com/maps/documentation
- **MongoDB:** https://docs.mongodb.com/manual/
- **AWS:** https://docs.aws.amazon.com/

For application-specific questions, refer to:
- `CODE_AUDIT_REPORT.md` - Issue explanations
- `SETUP_AND_RUN_GUIDE.md` - Detailed setup instructions
- `aws-deployment/` folder - Deployment guides

---

**Last Updated:** 2024  
**Next Review:** 2024
