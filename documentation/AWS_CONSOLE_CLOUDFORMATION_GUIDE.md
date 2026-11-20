# AWS Console CloudFormation Deployment Guide

**Complete step-by-step guide to deploy using AWS CloudFormation web console**

---

## 🎯 Overview

You can deploy your backend infrastructure to AWS using the **AWS CloudFormation Console** without any command-line tools. This guide walks you through every step.

---

## 📋 Prerequisites

Before you start:
- ✅ AWS Account (with billing enabled)
- ✅ AWS Console access (https://console.aws.amazon.com)
- ✅ Your API credentials ready:
  - PayPal Client ID & Secret (sandbox)
  - Google Maps API Key
  - Stripe API Keys (if using Stripe)

---

## 🚀 Step-by-Step Deployment via AWS Console

### **Step 1: Navigate to CloudFormation Service**

1. **Go to AWS Console:**
   - Open https://console.aws.amazon.com
   - Sign in with your AWS account

2. **Search for CloudFormation:**
   - Click the search bar at the top
   - Type `CloudFormation`
   - Click on **"CloudFormation"** from the results

3. **You'll see the CloudFormation Dashboard:**
   - Shows existing stacks
   - Has buttons like "Create stack"
   - Displays stack status and events

---

### **Step 2: Create a New Stack**

1. **Click "Create stack" button**
   - Look for the orange/red button in the top right
   - Click the dropdown arrow next to it
   - Select **"With new resources (standard)"**

2. **You'll see the "Create stack" page**

---

### **Step 3: Specify Template (Choose One Method)**

#### **Method A: Upload CloudFormation File from Your Computer**

1. **On "Create stack" page:**
   - Under "Prerequisite - Prepare template"
   - Select **"Template is ready"** ✅

2. **Under "Specify template":**
   - Select **"Upload a template file"**
   - Click **"Choose file"**
   - Navigate to: `/aws-deployment/CLOUDFORMATION.md`

   **⚠️ NOTE:** The template is in the CLOUDFORMATION.md file. You need to:
   - Open `CLOUDFORMATION.md` in a text editor
   - Find the section `## cloudformation-template.yaml`
   - Copy everything from `AWSTemplateFormatVersion:` to the end
   - Paste it into a new file called `template.yaml`
   - Upload this `template.yaml` file

3. **Click "Next"**

---

#### **Method B: Paste Template Directly (Recommended)**

1. **On "Create stack" page:**
   - Select **"Template is ready"** ✅

2. **Under "Specify template":**
   - Select **"As text"**
   - Click in the text area
   - Paste the CloudFormation template:

   ```yaml
   AWSTemplateFormatVersion: '2010-09-09'
   Description: 'Trip Ride-Share Backend Infrastructure'
   
   # [Copy the full template from CLOUDFORMATION.md]
   # Starting from "AWSTemplateFormatVersion" to the end
   ```

3. **Click "Next"**

---

### **Step 4: Specify Stack Details**

**You'll now see the "Specify stack details" page:**

1. **Stack name:**
   - Enter: `trip-ride-share` (or your preferred name)
   - This is how AWS will identify your deployment

2. **Environment:**
   - Under "Parameters"
   - Select from dropdown: `production`, `staging`, or `development`
   - Choose: **`production`** (for live deployment)

3. **PayPal Credentials:**
   - **PayPalClientId:**
     - Enter your PayPal sandbox Client ID
   - **PayPalSecret:**
     - Enter your PayPal sandbox API Secret
     - ✅ This field is hidden for security

4. **Google Maps Key:**
   - **GoogleMapsKey:**
     - Enter your Google Maps API key
     - ✅ This field is hidden for security

5. **Additional Parameters (if present):**
   - Add any other required parameters
   - Each has a description explaining what to enter

6. **Click "Next"**

---

### **Step 5: Configure Stack Options**

**On the "Configure stack options" page:**

1. **Tags** (Optional but recommended):
   - Add tags to organize your resources
   - Click "Add new tag"
   - Example tags:
     - **Key:** `Project` | **Value:** `TripRideShare`
     - **Key:** `Environment` | **Value:** `Production`
     - **Key:** `Owner` | **Value:** `YourName`

2. **Termination protection:**
   - Enable this to prevent accidental deletion
   - **Recommended:** Check the box

3. **Other options:**
   - Leave defaults (you can skip these)

4. **Click "Next"**

---

### **Step 6: Review and Create**

**On the "Review" page:**

1. **Review all settings:**
   - Stack name: ✅
   - Environment: ✅
   - Parameters: ✅ (they're hidden for security)
   - Tags: ✅

2. **Acknowledge IAM Permissions:**
   - Scroll to bottom
   - Check the box: **"I acknowledge that AWS CloudFormation might create IAM resources"**
   - ✅ This is required because we're creating Lambda, DynamoDB, and other resources

3. **Click "Create stack"**

4. **You'll see:**
   - Stack creation in progress
   - Status: `CREATE_IN_PROGRESS`
   - Green banner: "Stack creation initiated"

---

### **Step 7: Monitor Stack Creation**

**While stack is being created:**

1. **On the stack page:**
   - You'll see a list of resources being created
   - Status updates in real-time

2. **Watch the Events tab:**
   - Shows creation steps:
     ```
     CloudFormation::Stack - CREATE_IN_PROGRESS
     AWS::IAM::Role - CREATE_IN_PROGRESS
     AWS::DynamoDB::Table - CREATE_IN_PROGRESS
     AWS::Lambda::Function - CREATE_IN_PROGRESS
     ...and so on
     ```

3. **Wait for completion:**
   - Typical time: **5-15 minutes**
   - Look for status: `CREATE_COMPLETE` ✅

4. **If errors occur:**
   - Red banner appears
   - Shows error details
   - You can delete the stack and retry

---

### **Step 8: Get Your Deployment Details**

**After stack creation completes:**

1. **Click on your stack name**
   - Shows stack details

2. **Go to "Outputs" tab:**
   - Shows important values:
     - API Gateway Endpoint URL ← **Copy this for your frontend!**
     - Lambda Functions ARNs
     - DynamoDB Table Names
     - S3 Bucket Names

3. **Copy the API Gateway Endpoint:**
   - This is your backend URL
   - Format: `https://xxxxxxx.execute-api.us-east-1.amazonaws.com/prod`
   - Use this in your frontend `.env` file:
     ```
     API_BASE_URL=https://xxxxxxx.execute-api.us-east-1.amazonaws.com/prod
     ```

4. **Go to "Resources" tab:**
   - See all created AWS resources
   - Lambda functions, databases, storage, etc.

---

## 📊 Alternative: Using Parameters JSON File

If you have a `parameters.json` file, here's how to use it:

### **Option 1: Create parameters.json**

Create a file named `parameters.json`:

```json
[
  {
    "ParameterKey": "Environment",
    "ParameterValue": "production"
  },
  {
    "ParameterKey": "PayPalClientId",
    "ParameterValue": "YOUR_PAYPAL_CLIENT_ID"
  },
  {
    "ParameterKey": "PayPalSecret",
    "ParameterValue": "YOUR_PAYPAL_SECRET"
  },
  {
    "ParameterKey": "GoogleMapsKey",
    "ParameterValue": "YOUR_GOOGLE_MAPS_KEY"
  }
]
```

### **Option 2: Upload Parameters in Console**

1. **During "Specify stack details" step:**
   - Instead of entering each parameter manually
   - Scroll down to "Parameters" section
   - You can:
     - Upload a JSON file with parameters
     - Or manually enter each one (easier via console)

2. **To upload parameters file:**
   - If your CloudFormation service supports it
   - Look for "Upload parameters" button
   - Select your `parameters.json` file

---

## 🔍 Monitoring Your Deployment

### **Watch the Events Tab**

Shows real-time creation progress:

```
Time              | Status                    | Logical ID
─────────────────────────────────────────────────────────
15:42:32         | CREATE_IN_PROGRESS        | trip-ride-share
15:42:35         | CREATE_IN_PROGRESS        | LambdaExecutionRole
15:42:40         | CREATE_COMPLETE           | LambdaExecutionRole
15:42:42         | CREATE_IN_PROGRESS        | UsersTable
15:43:15         | CREATE_COMPLETE           | UsersTable
15:43:17         | CREATE_IN_PROGRESS        | RidesTable
...
15:47:30         | CREATE_COMPLETE           | trip-ride-share
```

### **Common Status Values**

- 🟡 `CREATE_IN_PROGRESS` - Currently creating
- 🟢 `CREATE_COMPLETE` - Successfully created
- 🔴 `CREATE_FAILED` - Error during creation
- 🟡 `ROLLBACK_IN_PROGRESS` - Fixing errors
- 🔴 `ROLLBACK_COMPLETE` - Creation failed, rolling back

---

## ✅ Post-Deployment Checklist

After stack creation completes:

- [ ] Stack status shows `CREATE_COMPLETE` ✅
- [ ] No errors in Events tab
- [ ] All resources listed in Resources tab
- [ ] Outputs tab shows API Gateway endpoint
- [ ] API Gateway URL is accessible
- [ ] Lambda functions deployed
- [ ] DynamoDB tables created
- [ ] S3 bucket created
- [ ] Cognito user pool created
- [ ] Secrets Manager populated

---

## 🧪 Test Your Deployment

### **Test API Endpoint**

1. **Copy API Gateway URL from Outputs**
   - Format: `https://xxxxxxx.execute-api.us-east-1.amazonaws.com/prod`

2. **In your browser or terminal:**
   ```bash
   curl https://xxxxxxx.execute-api.us-east-1.amazonaws.com/prod/health
   ```

3. **You should get:**
   ```json
   {
     "status": "ok",
     "timestamp": "2026-11-19T15:42:32Z"
   }
   ```

---

## 🔧 Troubleshooting Common Issues

### **Issue 1: "I acknowledge that AWS CloudFormation might create IAM resources" unchecked**

**Solution:**
- Scroll to bottom of Review page
- Check the acknowledgment box
- Click Create stack again

### **Issue 2: Stack creation failed / ROLLBACK_COMPLETE**

**What happened:**
- Some resource failed to create
- CloudFormation automatically rolled back
- Stack is in failed state

**How to fix:**
1. Check Events tab for error messages
2. Common errors:
   - Invalid parameter values (check PayPal credentials)
   - IAM permissions issue
   - Region doesn't support a service

**Solution:**
1. Delete the failed stack
   - Right-click stack → Delete stack
   - Confirm deletion
2. Fix the issue (check parameters)
3. Create a new stack

### **Issue 3: "AccessDenied" or "User is not authorized"**

**Solution:**
- Your AWS IAM user needs CloudFormation permissions
- Contact your AWS administrator
- Or use an AWS account with AdministratorAccess

### **Issue 4: Can't find CloudFormation service**

**Solution:**
- Scroll down in services list
- Use search bar: type "CloudFormation"
- Make sure you're in the correct AWS region (top right)

---

## 📚 Advanced: Update Existing Stack

After initial deployment, to update configurations:

1. **Go to CloudFormation console**
2. **Click on your stack name**
3. **Click "Update" button (top right)**
4. **Select "Replace current template"**
5. **Upload new template or paste updated one**
6. **Click through Next/Next/Next**
7. **Review changes and click "Update stack"**
8. **Resources will update without deletion** ✅

---

## 🗑️ Delete Stack (Clean Up)

**To remove all resources and stop charges:**

1. **Go to CloudFormation console**
2. **Select your stack**
3. **Click "Delete" button (top right)**
4. **Confirm: "Delete stack"**
5. **Status changes to `DELETE_IN_PROGRESS`**
6. **Wait for `DELETE_COMPLETE`**
7. **All AWS resources deleted** ✅
8. **No more charges** 💰

**Warning:** ⚠️ This deletes:
- Lambda functions
- DynamoDB tables and data
- S3 buckets
- API Gateway
- Everything created by the stack

**Make sure to:**
- Back up any important data first
- Keep the CloudFormation template for reference

---

## 📖 Reference: CloudFormation Resources Created

Your stack creates these AWS resources:

| Resource | Type | Purpose |
|----------|------|---------|
| **trip-lambda-role** | IAM Role | Permissions for Lambda functions |
| **trip-api-gateway** | API Gateway | REST API endpoint for frontend |
| **users-table** | DynamoDB Table | User profiles & authentication |
| **rides-table** | DynamoDB Table | Ride requests & history |
| **payments-table** | DynamoDB Table | Payment records |
| **trip-bucket** | S3 Bucket | Document storage |
| **trip-cognito-pool** | Cognito User Pool | User authentication |
| **paypal-secret** | Secrets Manager | Encrypted credentials |
| **lambda-auth** | Lambda Function | Authentication handler |
| **lambda-rides** | Lambda Function | Ride management handler |
| **lambda-payments** | Lambda Function | Payment processing handler |

---

## 💡 Tips & Best Practices

1. **Use meaningful stack names:**
   - ✅ `trip-ride-share-prod`
   - ✅ `trip-ride-share-staging`
   - ❌ `stack1`, `test123`

2. **Tag your resources:**
   - Makes billing tracking easier
   - Helps organize multiple projects

3. **Enable termination protection:**
   - Prevents accidental deletion
   - Set in "Configure stack options"

4. **Monitor AWS billing:**
   - Check AWS Cost Explorer
   - Set up billing alerts

5. **Back up your parameters:**
   - Save your `parameters.json` file
   - Keep credentials in secure location
   - Use AWS Secrets Manager, not plaintext

6. **Test before production:**
   - Create a "staging" stack first
   - Test all features
   - Then create "production" stack

---

## 🎯 Next Steps After Deployment

1. **Get API Endpoint:**
   - From Outputs tab
   - Copy the API Gateway URL

2. **Update Frontend:**
   - Edit `frontend/.env`
   - Set `API_BASE_URL` to your endpoint
   - Deploy frontend

3. **Configure DNS:**
   - Point your domain to API Gateway
   - Set up custom domain name in API Gateway settings

4. **Enable Monitoring:**
   - Go to CloudWatch console
   - Set up alarms for Lambda errors
   - Monitor DynamoDB usage

5. **Test API Endpoints:**
   - Test authentication flow
   - Test ride creation
   - Test payments

---

## 🚀 Summary

**You have deployed your entire backend to AWS!**

✅ Infrastructure created  
✅ Databases initialized  
✅ Lambda functions deployed  
✅ API Gateway running  
✅ Authentication configured  
✅ Cost optimization enabled  

**Cost: $4-340/month depending on scale**  
**Deployment time: 5-15 minutes**  
**Ready for production!**

---

**Need help?** Check the other guides:
- `DEPLOYMENT_QUICK_REFERENCE.md` - Quick reference
- `00-QUICK_START.md` - Command-line deployment
- `01-ARCHITECTURE.md` - System design
- `03-SECURITY.md` - Security setup

