# Security Hardening Guide

## 1. API Gateway Security

### Enable API Key & Usage Plans
```bash
# Create API key
aws apigateway create-api-key \
  --name "mobile-app-prod" \
  --description "Mobile app API key" \
  --enabled

# Create usage plan
aws apigateway create-usage-plan \
  --name "free-tier" \
  --description "10K requests/day" \
  --throttle burstLimit=100,rateLimit=10 \
  --quota limit=10000,period=DAY
```

### Setup AWS WAF
```yaml
# CloudFormation snippet
WAFWebACL:
  Type: AWS::WAFv2::WebACL
  Properties:
    Scope: REGIONAL
    DefaultAction:
      Allow: {}
    Rules:
      # Block SQL Injection
      - Name: AWSManagedRulesSQLiRuleSet
        Priority: 0
        OverrideAction:
          None: {}
        VisibilityConfig:
          SampledRequestsEnabled: true
          CloudWatchMetricsEnabled: true
          MetricName: AWSManagedRulesSQLiRuleSetMetric
        Statement:
          ManagedRuleGroupStatement:
            VendorName: AWS
            Name: AWSManagedRulesSQLiRuleSet
      
      # Block Known Bad Inputs
      - Name: AWSManagedRulesCommonRuleSet
        Priority: 1
        OverrideAction:
          None: {}
        VisibilityConfig:
          SampledRequestsEnabled: true
          CloudWatchMetricsEnabled: true
          MetricName: AWSManagedRulesCommonRuleSetMetric
        Statement:
          ManagedRuleGroupStatement:
            VendorName: AWS
            Name: AWSManagedRulesCommonRuleSet
      
      # Rate Limiting
      - Name: RateLimitRule
        Priority: 2
        Action:
          Block: {}
        VisibilityConfig:
          SampledRequestsEnabled: true
          CloudWatchMetricsEnabled: true
          MetricName: RateLimitRuleMetric
        Statement:
          RateBasedStatement:
            Limit: 2000
            AggregateKeyType: IP

VisibilityConfig:
  SampledRequestsEnabled: true
  CloudWatchMetricsEnabled: true
  MetricName: trip-ride-share-waf
```

### Enable Logging
```bash
# Log all API calls to CloudWatch
aws apigateway update-stage \
  --rest-api-id abc123 \
  --stage-name prod \
  --patch-operations \
    op=replace,path=/accessLogSetting/destinationArn,value="arn:aws:logs:us-east-1:123456789:log-group:api-logs" \
    op=replace,path=/accessLogSetting/format,value='{ "requestId":"$context.requestId", "ip": "$context.identity.sourceIp", "requestTime":"$context.requestTime", "httpMethod":"$context.httpMethod", "resourcePath":"$context.resourcePath", "status":"$context.status", "protocol":"$context.protocol", "responseLength":"$context.responseLength", "error":"$context.error.message", "integrationErrorMessage":"$context.integrationErrorMessage" }'
```

## 2. Lambda Security

### IAM Role Least Privilege
```yaml
LambdaExecutionRole:
  Type: AWS::IAM::Role
  Properties:
    AssumeRolePolicyDocument:
      Version: "2012-10-17"
      Statement:
        - Effect: Allow
          Principal:
            Service: lambda.amazonaws.com
          Action: sts:AssumeRole
    ManagedPolicyArns:
      - arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
    Policies:
      - PolicyName: DynamoDBAccess
        PolicyDocument:
          Version: "2012-10-17"
          Statement:
            # Only allow specific table access
            - Effect: Allow
              Action:
                - dynamodb:GetItem
                - dynamodb:Query
              Resource: !GetAtt RidesTable.Arn
            # Only allow specific GSI access
            - Effect: Allow
              Action:
                - dynamodb:Query
              Resource: !Sub "${RidesTable.Arn}/index/rider_id_index"
      - PolicyName: SecretsManagerAccess
        PolicyDocument:
          Version: "2012-10-17"
          Statement:
            - Effect: Allow
              Action:
                - secretsmanager:GetSecretValue
              Resource: !Sub "arn:aws:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:trip-app-secrets-*"
      - PolicyName: S3Access
        PolicyDocument:
          Version: "2012-10-17"
          Statement:
            - Effect: Allow
              Action:
                - s3:GetObject
                - s3:PutObject
              Resource: "arn:aws:s3:::trip-app-documents/*"
            - Effect: Deny
              Action:
                - s3:DeleteObject
              Resource: "arn:aws:s3:::trip-app-documents/*"
```

### Lambda Security Best Practices
```python
# DO: Use environment variables from Secrets Manager
import json
import boto3
import os
from botocore.exceptions import ClientError

secrets_client = boto3.client('secretsmanager')

def get_secret(secret_name):
    """Retrieve secret from Secrets Manager (cached)"""
    try:
        response = secrets_client.get_secret_value(SecretId=secret_name)
        if 'SecretString' in response:
            return json.loads(response['SecretString'])
    except ClientError as e:
        print(f"Error retrieving secret: {e}")
        raise

def lambda_handler(event, context):
    # Get secrets securely
    paypal_secret = get_secret('paypal-credentials')['secret']
    
    # DON'T: Access directly from environment (unless via Secrets Manager)
    # paypal_secret = os.getenv('PAYPAL_SECRET')  # ❌ Less secure
    
    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'Success'})
    }

# DO: Validate all inputs
def validate_ride_request(event):
    """Validate incoming request"""
    required_fields = ['user_id', 'pickup_lat', 'pickup_lng', 'dropoff_lat', 'dropoff_lng']
    
    for field in required_fields:
        if field not in event:
            raise ValueError(f"Missing required field: {field}")
    
    # Validate coordinates are in valid range
    if not (-90 <= event['pickup_lat'] <= 90):
        raise ValueError("Invalid latitude")
    
    if not (-180 <= event['pickup_lng'] <= 180):
        raise ValueError("Invalid longitude")

# DO: Use timeouts
def lambda_handler(event, context):
    timeout = 25  # Leave 5 seconds buffer for cleanup
    if context.get_remaining_time_in_millis() < timeout * 1000:
        return {'statusCode': 503, 'body': 'Function timeout'}

# DO: Log security events
import logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    user_id = event.get('user_id')
    logger.info(f"User {user_id} accessed rides endpoint", extra={
        'userId': user_id,
        'sourceIp': event.get('requestContext', {}).get('identity', {}).get('sourceIp'),
        'timestamp': context.aws_request_id
    })

# DON'T: Store secrets in environment variables
# ❌ BAD:
os.environ['PAYPAL_SECRET'] = 'my-secret-key'

# ✅ GOOD:
# Store in Secrets Manager, retrieve at runtime
```

### Enable Lambda Security Hub
```bash
# Enable Security Hub findings for Lambda
aws securityhub create-insight \
  --name "Lambda Security Issues" \
  --filters '{
    "ResourceType": [{"Value": "AwsLambda", "Comparison": "EQUALS"}],
    "RecordState": [{"Value": "ACTIVE", "Comparison": "EQUALS"}],
    "SeverityLabel": [
      {"Value": "CRITICAL", "Comparison": "EQUALS"},
      {"Value": "HIGH", "Comparison": "EQUALS"}
    ]
  }'
```

## 3. DynamoDB Security

### Enable Encryption at Rest
```yaml
RidesTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: rides
    BillingMode: PAY_PER_REQUEST
    SSESpecification:
      SSEEnabled: true
      SSEType: KMS
      KMSMasterKeyId: !GetAtt DynamoDBEncryptionKey.Arn
    # ... other properties
```

### Enable Point-in-Time Recovery
```yaml
RidesTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: rides
    PointInTimeRecoverySpecification:
      PointInTimeRecoveryEnabled: true
    # ... other properties
```

### Setup DynamoDB Streams with Lambda
```python
# Lambda to process DynamoDB Streams (audit trail)
def lambda_handler(event, context):
    for record in event['Records']:
        if record['eventName'] == 'MODIFY':
            ride_id = record['dynamodb']['Keys']['ride_id']['S']
            old_status = record['dynamodb']['OldImage'].get('status', {}).get('S')
            new_status = record['dynamodb']['NewImage']['status']['S']
            
            # Log status changes
            dynamodb.put_item(
                TableName='audit_log',
                Item={
                    'ride_id': {'S': ride_id},
                    'timestamp': {'N': str(int(time.time()))},
                    'old_status': {'S': old_status},
                    'new_status': {'S': new_status},
                    'ttl': {'N': str(int(time.time()) + 2592000)}  # 30 days
                }
            )
```

### Enable CloudTrail for DynamoDB Monitoring
```bash
aws cloudtrail create-trail \
  --name dynamodb-audit-trail \
  --s3-bucket-name trip-app-audit-logs

aws cloudtrail put-event-selectors \
  --trail-name dynamodb-audit-trail \
  --event-selectors '[
    {
      "ReadWriteType": "All",
      "IncludeManagementEvents": true,
      "DataResources": [
        {
          "Type": "AWS::DynamoDB::Table",
          "Values": ["arn:aws:dynamodb:*:*:table/*"]
        }
      ]
    }
  ]'
```

## 4. S3 Security

### Block Public Access
```yaml
S3BucketPublicAccessBlockConfiguration:
  Type: AWS::S3::BucketPublicAccessBlock
  Properties:
    Bucket: !Ref DocumentsBucket
    BlockPublicAcls: true
    BlockPublicPolicy: true
    IgnorePublicAcls: true
    RestrictPublicBuckets: true
```

### Enable Encryption
```yaml
DocumentsBucket:
  Type: AWS::S3::Bucket
  Properties:
    BucketName: trip-app-documents
    VersioningConfiguration:
      Status: Enabled
    BucketEncryption:
      ServerSideEncryptionConfiguration:
        - ServerSideEncryptionByDefault:
            SSEAlgorithm: aws:kms
            KMSMasterKeyID: !GetAtt S3EncryptionKey.Arn
    PublicAccessBlockConfiguration:
      BlockPublicAcls: true
      BlockPublicPolicy: true
      IgnorePublicAcls: true
      RestrictPublicBuckets: true
    LoggingConfiguration:
      DestinationBucketName: !Ref S3AuditBucket
      LogFilePrefix: documents-access-logs/
```

### Setup S3 Bucket Policy (Least Privilege)
```yaml
S3BucketPolicy:
  Type: AWS::S3::BucketPolicy
  Properties:
    Bucket: !Ref DocumentsBucket
    PolicyText:
      Version: "2012-10-17"
      Statement:
        # Allow Lambda to upload documents
        - Sid: AllowLambdaUpload
          Effect: Allow
          Principal:
            AWS: !GetAtt LambdaExecutionRole.Arn
          Action:
            - s3:PutObject
            - s3:GetObject
          Resource: "arn:aws:s3:::trip-app-documents/*"
          Condition:
            StringEquals:
              s3:x-amz-acl: private
        
        # Deny unencrypted uploads
        - Sid: DenyUnencryptedUploads
          Effect: Deny
          Principal: "*"
          Action: s3:PutObject
          Resource: "arn:aws:s3:::trip-app-documents/*"
          Condition:
            StringNotEquals:
              s3:x-amz-server-side-encryption: aws:kms
        
        # Deny public access
        - Sid: DenyPublicAccess
          Effect: Deny
          Principal: "*"
          Action: s3:*
          Resource:
            - "arn:aws:s3:::trip-app-documents/*"
            - "arn:aws:s3:::trip-app-documents"
          Condition:
            StringEquals:
              s3:x-amz-acl:
                - public-read
                - public-read-write
```

## 5. Cognito Security

### Setup Strong Password Policy
```bash
aws cognito-idp update-user-pool \
  --user-pool-id us-east-1_abcdef123 \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 12,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireNumbers": true,
      "RequireSymbols": true
    }
  }'
```

### Enable MFA
```bash
aws cognito-idp set-user-pool-mfa-config \
  --user-pool-id us-east-1_abcdef123 \
  --mfa-configuration OPTIONAL \
  --software-token-mfa-configuration Enabled=true
```

### Setup Account Lockout
```bash
aws cognito-idp update-user-pool \
  --user-pool-id us-east-1_abcdef123 \
  --account-recovery-setting RecoveryMechanisms='[
    {Priority=1,Name=verified_email},
    {Priority=2,Name=verified_phone_number}
  ]' \
  --policies '{
    "PasswordPolicy": {
      "TemporaryPasswordValidityDays": 7
    }
  }'
```

## 6. Secrets Manager

### Store All Secrets Securely
```bash
# Store PayPal credentials
aws secretsmanager create-secret \
  --name paypal-credentials \
  --description "PayPal API credentials" \
  --secret-string '{
    "client_id": "YOUR_CLIENT_ID",
    "secret": "YOUR_SECRET",
    "mode": "sandbox"
  }' \
  --kms-key-id alias/aws/secretsmanager

# Store Google Maps API key
aws secretsmanager create-secret \
  --name google-maps-api-key \
  --description "Google Maps API key" \
  --secret-string '{
    "api_key": "YOUR_API_KEY",
    "restrictions": "HTTP referrers"
  }' \
  --kms-key-id alias/aws/secretsmanager

# Store Stripe key
aws secretsmanager create-secret \
  --name stripe-api-key \
  --description "Stripe API key" \
  --secret-string '{
    "secret_key": "sk_test_...",
    "publishable_key": "pk_test_..."
  }' \
  --kms-key-id alias/aws/secretsmanager
```

### Setup Secret Rotation
```bash
# Lambda function for secret rotation
aws secretsmanager rotate-secret \
  --secret-id paypal-credentials \
  --rotation-lambda-arn arn:aws:lambda:us-east-1:123456789:function:rotate-paypal-secret \
  --rotation-rules AutomaticallyAfterDays=30
```

## 7. Network Security

### Setup VPC Endpoints (Optional for extra security)
```yaml
VPCEndpointForDynamoDB:
  Type: AWS::EC2::VPCEndpoint
  Properties:
    VpcId: !Ref VPC
    ServiceName: !Sub "com.amazonaws.${AWS::Region}.dynamodb"
    RouteTableIds:
      - !Ref PrivateRouteTable
    PolicyDocument:
      Version: "2012-10-17"
      Statement:
        - Effect: Allow
          Principal: "*"
          Action:
            - dynamodb:*
          Resource: !GetAtt RidesTable.Arn
```

## 8. Monitoring & Alerts

### Setup Security Notifications
```bash
# CloudWatch alarm for failed authentication
aws cloudwatch put-metric-alarm \
  --alarm-name cognito-failed-auth \
  --alarm-description "Alert on multiple failed authentications" \
  --metric-name UserAuthentication \
  --namespace AWS/Cognito \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions "arn:aws:sns:us-east-1:123456789:security-alerts"
```

### Setup Security Hub
```bash
# Enable Security Hub for continuous monitoring
aws securityhub enable-security-hub

# Review findings
aws securityhub get-findings \
  --filters "ResourceType=[{Value=AwsLambda,Comparison=EQUALS}],SeverityLabel=[{Value=CRITICAL,Comparison=EQUALS}]"
```

## 9. Security Checklist

- [ ] API Gateway has WAF enabled
- [ ] All secrets in Secrets Manager (not env vars)
- [ ] Lambda IAM roles use least privilege
- [ ] DynamoDB encryption at rest enabled
- [ ] S3 bucket is private (not public)
- [ ] S3 bucket versioning enabled
- [ ] Cognito password policy is strong
- [ ] Cognito MFA enabled
- [ ] CloudTrail enabled for audit logging
- [ ] VPC endpoints configured (optional)
- [ ] Security Hub enabled
- [ ] Regular security scanning enabled
- [ ] Rate limiting configured
- [ ] CORS properly restricted
- [ ] No hardcoded secrets in code
- [ ] Input validation on all endpoints

## 10. Incident Response

### Create Incident Response Plan
```bash
# If breach detected:
1. Rotate all Secrets Manager secrets
   aws secretsmanager rotate-secret --secret-id paypal-credentials

2. Enable detailed CloudTrail logs
   aws cloudtrail put-event-selectors --trail-name audit-trail ...

3. Review CloudWatch logs for suspicious activity
   aws logs filter-log-events --log-group-name /aws/lambda/...

4. Temporarily disable affected API key
   aws apigateway update-api-key --id key-id --enabled false

5. Run security assessment
   aws securityhub get-findings --filters ...
```

---

**Version**: 1.0
**Last Updated**: 2026-11-19
**References**: 
- AWS Security Best Practices: https://docs.aws.amazon.com/security/
- OWASP Top 10: https://owasp.org/www-project-top-ten/
