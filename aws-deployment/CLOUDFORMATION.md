# CloudFormation Template - Trip Ride-Share Backend

## Quick Deployment
```bash
aws cloudformation create-stack \
  --stack-name trip-ride-share \
  --template-body file://cloudformation-template.yaml \
  --parameters file://parameters.json \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1
```

## cloudformation-template.yaml
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Trip Ride-Share Backend Infrastructure'

Parameters:
  Environment:
    Type: String
    Default: production
    AllowedValues: [development, staging, production]
  
  PayPalClientId:
    Type: String
    NoEcho: true
  
  PayPalSecret:
    Type: String
    NoEcho: true
  
  GoogleMapsKey:
    Type: String
    NoEcho: true

Resources:
  # ============ IAM Roles ============
  
  LambdaExecutionRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: trip-lambda-execution-role
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
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
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - dynamodb:*
                Resource:
                  - !GetAtt UsersTable.Arn
                  - !GetAtt RidesTable.Arn
                  - !GetAtt PaymentsTable.Arn
                  - !Sub "${UsersTable.Arn}/index/*"
                  - !Sub "${RidesTable.Arn}/index/*"
        - PolicyName: S3Access
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - s3:GetObject
                  - s3:PutObject
                Resource: !Sub "arn:aws:s3:::${DocumentsBucket}/*"
        - PolicyName: SecretsManagerAccess
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - secretsmanager:GetSecretValue
                Resource: !GetAtt PayPalSecret.Arn

  # ============ Secrets Manager ============
  
  PayPalSecret:
    Type: AWS::SecretsManager::Secret
    Properties:
      Name: paypal-credentials
      Description: PayPal API credentials
      SecretString: !Sub |
        {
          "client_id": "${PayPalClientId}",
          "secret": "${PayPalSecret}"
        }
      KmsKeyId: alias/aws/secretsmanager

  GoogleMapsSecret:
    Type: AWS::SecretsManager::Secret
    Properties:
      Name: google-maps-api-key
      Description: Google Maps API key
      SecretString: !Sub |
        {
          "api_key": "${GoogleMapsKey}"
        }
      KmsKeyId: alias/aws/secretsmanager

  # ============ DynamoDB Tables ============
  
  UsersTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Sub "${Environment}_users"
      BillingMode: PAY_PER_REQUEST
      SSESpecification:
        SSEEnabled: true
        SSEType: KMS
        KMSMasterKeyId: alias/aws/dynamodb
      PointInTimeRecoverySpecification:
        PointInTimeRecoveryEnabled: true
      AttributeDefinitions:
        - AttributeName: user_id
          AttributeType: S
        - AttributeName: email
          AttributeType: S
      KeySchema:
        - AttributeName: user_id
          KeyType: HASH
      GlobalSecondaryIndexes:
        - IndexName: email-index
          KeySchema:
            - AttributeName: email
              KeyType: HASH
          Projection:
            ProjectionType: ALL
      Tags:
        - Key: Environment
          Value: !Ref Environment

  RidesTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Sub "${Environment}_rides"
      BillingMode: PAY_PER_REQUEST
      SSESpecification:
        SSEEnabled: true
        SSEType: KMS
        KMSMasterKeyId: alias/aws/dynamodb
      StreamSpecification:
        StreamViewType: NEW_AND_OLD_IMAGES
      AttributeDefinitions:
        - AttributeName: ride_id
          AttributeType: S
        - AttributeName: rider_id
          AttributeType: S
        - AttributeName: driver_id
          AttributeType: S
        - AttributeName: created_at
          AttributeType: N
      KeySchema:
        - AttributeName: ride_id
          KeyType: HASH
      GlobalSecondaryIndexes:
        - IndexName: rider-index
          KeySchema:
            - AttributeName: rider_id
              KeyType: HASH
            - AttributeName: created_at
              KeyType: RANGE
          Projection:
            ProjectionType: ALL
        - IndexName: driver-index
          KeySchema:
            - AttributeName: driver_id
              KeyType: HASH
            - AttributeName: created_at
              KeyType: RANGE
          Projection:
            ProjectionType: ALL
      Tags:
        - Key: Environment
          Value: !Ref Environment

  PaymentsTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Sub "${Environment}_payments"
      BillingMode: PAY_PER_REQUEST
      SSESpecification:
        SSEEnabled: true
      AttributeDefinitions:
        - AttributeName: payment_id
          AttributeType: S
        - AttributeName: user_id
          AttributeType: S
        - AttributeName: created_at
          AttributeType: N
      KeySchema:
        - AttributeName: payment_id
          KeyType: HASH
      GlobalSecondaryIndexes:
        - IndexName: user-index
          KeySchema:
            - AttributeName: user_id
              KeyType: HASH
            - AttributeName: created_at
              KeyType: RANGE
          Projection:
            ProjectionType: ALL
      Tags:
        - Key: Environment
          Value: !Ref Environment

  # ============ S3 Buckets ============
  
  DocumentsBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub "trip-documents-${AWS::AccountId}-${Environment}"
      VersioningConfiguration:
        Status: Enabled
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: aws:kms
              KMSMasterKeyID: alias/aws/s3
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true
      LifecycleConfiguration:
        Rules:
          - Id: DeleteOldVersions
            NoncurrentVersionExpirationInDays: 30
          - Id: DeleteOldLogs
            Prefix: logs/
            ExpirationInDays: 90
      Tags:
        - Key: Environment
          Value: !Ref Environment

  DocumentsBucketPolicy:
    Type: AWS::S3::BucketPolicy
    Properties:
      Bucket: !Ref DocumentsBucket
      PolicyText:
        Version: '2012-10-17'
        Statement:
          - Sid: AllowLambdaUpload
            Effect: Allow
            Principal:
              AWS: !GetAtt LambdaExecutionRole.Arn
            Action:
              - s3:PutObject
              - s3:GetObject
            Resource: !Sub "${DocumentsBucket.Arn}/*"
          - Sid: DenyUnencryptedUploads
            Effect: Deny
            Principal: '*'
            Action: s3:PutObject
            Resource: !Sub "${DocumentsBucket.Arn}/*"
            Condition:
              StringNotEquals:
                s3:x-amz-server-side-encryption: aws:kms

  # ============ API Gateway ============
  
  ApiGateway:
    Type: AWS::ApiGatewayV2::Api
    Properties:
      Name: !Sub "trip-${Environment}"
      ProtocolType: HTTP
      CorsConfiguration:
        AllowCredentials: true
        AllowOrigins:
          - '*'
        AllowMethods:
          - GET
          - POST
          - PUT
          - DELETE
          - OPTIONS
        AllowHeaders:
          - '*'

  ApiStage:
    Type: AWS::ApiGatewayV2::Stage
    Properties:
      ApiId: !Ref ApiGateway
      StageName: !Ref Environment
      AutoDeploy: true
      AccessLogSettings:
        DestinationArn: !GetAtt ApiLogGroup.Arn
        Format: '$context.requestId $context.error.message $context.error.messageString'
      ThrottleSettings:
        BurstLimit: 100
        RateLimit: 50

  ApiLogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: !Sub "/aws/apigateway/trip-${Environment}"
      RetentionInDays: 30

  # ============ Cognito User Pool ============
  
  UserPool:
    Type: AWS::Cognito::UserPool
    Properties:
      UserPoolName: !Sub "trip-${Environment}"
      Policies:
        PasswordPolicy:
          MinimumLength: 12
          RequireUppercase: true
          RequireLowercase: true
          RequireNumbers: true
          RequireSymbols: true
      Schema:
        - Name: email
          AttributeDataType: String
          Required: true
          Mutable: false
        - Name: phone_number
          AttributeDataType: String
          Mutable: true
        - Name: name
          AttributeDataType: String
          Mutable: true
      MfaConfiguration: OPTIONAL
      UserAttributeUpdateSettings:
        AttributesRequiringVerificationBeforeUpdate:
          - email
      EmailConfiguration:
        EmailSendingAccount: COGNITO_DEFAULT
      AccountRecoverySetting:
        RecoveryMechanisms:
          - Name: verified_email
            Priority: 1

  UserPoolClient:
    Type: AWS::Cognito::UserPoolClient
    Properties:
      UserPoolId: !Ref UserPool
      ClientName: trip-mobile-app
      ReadAttributes:
        - email
        - name
        - phone_number
      WriteAttributes:
        - email
        - name
        - phone_number
      ExplicitAuthFlows:
        - ALLOW_USER_PASSWORD_AUTH
        - ALLOW_REFRESH_TOKEN_AUTH
      RefreshTokenValidity: 30
      AccessTokenValidity: 1
      IdTokenValidity: 1

  # ============ CloudWatch ============
  
  ApiErrorAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: !Sub "trip-api-errors-${Environment}"
      MetricName: 5XXError
      Namespace: AWS/ApiGateway
      Statistic: Sum
      Period: 300
      EvaluationPeriods: 1
      Threshold: 10
      ComparisonOperator: GreaterThanThreshold
      AlarmActions:
        - !Sub "arn:aws:sns:${AWS::Region}:${AWS::AccountId}:trip-alerts"

Outputs:
  ApiEndpoint:
    Value: !GetAtt ApiGateway.ApiEndpoint
    Description: API Gateway endpoint URL
  
  UserPoolId:
    Value: !Ref UserPool
    Description: Cognito User Pool ID
  
  UserPoolClientId:
    Value: !Ref UserPoolClient
    Description: Cognito User Pool Client ID
  
  UsersTableName:
    Value: !Ref UsersTable
    Description: DynamoDB Users table name
  
  RidesTableName:
    Value: !Ref RidesTable
    Description: DynamoDB Rides table name
  
  DocumentsBucketName:
    Value: !Ref DocumentsBucket
    Description: S3 Documents bucket name
```

## parameters.json
```json
[
  {
    "ParameterKey": "Environment",
    "ParameterValue": "production"
  },
  {
    "ParameterKey": "PayPalClientId",
    "ParameterValue": "your-paypal-client-id"
  },
  {
    "ParameterKey": "PayPalSecret",
    "ParameterValue": "your-paypal-secret"
  },
  {
    "ParameterKey": "GoogleMapsKey",
    "ParameterValue": "your-google-maps-key"
  }
]
```

---

**Version**: 1.0
**Last Updated**: 2026-11-19
