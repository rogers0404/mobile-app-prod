# Lambda Functions Starter Template

## Common Dependencies
```bash
# requirements-common.txt
fastapi==0.110.1
pydantic==2.12.5
motor==3.3.1
boto3==1.42.58
python-jose==3.5.0
passlib==1.7.4
httpx==0.28.1
python-dotenv==1.2.1
```

## Deployment Script
```bash
#!/bin/bash
# deploy-all.sh

set -e

LAMBDAS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGION=${AWS_REGION:-us-east-1}

echo "🚀 Deploying Lambda functions..."

for dir in auth users rides payments websocket notifications; do
    if [ -d "$LAMBDAS_DIR/$dir" ]; then
        echo "📦 Deploying $dir..."
        
        cd "$LAMBDAS_DIR/$dir"
        
        # Install dependencies
        if [ -f requirements.txt ]; then
            mkdir -p package
            pip install -r requirements.txt -t package/
        fi
        
        # Create deployment package
        if [ -d package ]; then
            cd package
            zip -r ../${dir}.zip .
            cd ..
            rm -rf package
        fi
        
        # Zip lambda code
        zip -r ${dir}.zip . -x "*.zip" ".git/*" "__pycache__/*"
        
        # Update Lambda function (assumes function name matches directory)
        FUNCTION_NAME="trip-${dir}"
        
        if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>/dev/null; then
            echo "   ✓ Updating existing function: $FUNCTION_NAME"
            aws lambda update-function-code \
                --function-name $FUNCTION_NAME \
                --zip-file fileb://${dir}.zip \
                --region $REGION
        else
            echo "   ✓ Creating new function: $FUNCTION_NAME"
            aws lambda create-function \
                --function-name $FUNCTION_NAME \
                --runtime python3.11 \
                --role arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/lambda-execution-role \
                --handler index.lambda_handler \
                --zip-file fileb://${dir}.zip \
                --region $REGION
        fi
        
        # Clean up
        rm -f ${dir}.zip
        
        echo "   ✓ $dir deployed"
    fi
done

echo ""
echo -e "✅ All Lambda functions deployed!"
```

## Lambda Structure Template

### auth/login.py
```python
import json
import boto3
import hashlib
from datetime import datetime, timedelta, timezone
import os
from botocore.exceptions import ClientError

cognito_client = boto3.client('cognito-idp')
dynamodb = boto3.resource('dynamodb')

def lambda_handler(event, context):
    """
    Login endpoint - exchanges email/password for JWT tokens
    """
    try:
        body = json.loads(event['body'])
        email = body.get('email')
        password = body.get('password')
        
        if not email or not password:
            return response(400, {'error': 'Missing email or password'})
        
        # Use Cognito for authentication
        response_data = cognito_client.admin_initiate_auth(
            UserPoolId=os.getenv('COGNITO_USER_POOL_ID'),
            ClientId=os.getenv('COGNITO_CLIENT_ID'),
            AuthFlow='ADMIN_NO_SRP_AUTH',
            AuthParameters={
                'USERNAME': email,
                'PASSWORD': password
            }
        )
        
        return response(200, {
            'access_token': response_data['AuthenticationResult']['AccessToken'],
            'id_token': response_data['AuthenticationResult']['IdToken'],
            'refresh_token': response_data['AuthenticationResult']['RefreshToken']
        })
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'UserNotFoundException':
            return response(401, {'error': 'User not found'})
        elif error_code == 'NotAuthorizedException':
            return response(401, {'error': 'Invalid credentials'})
        else:
            return response(500, {'error': str(e)})
    except Exception as e:
        print(f"Error: {e}")
        return response(500, {'error': 'Internal server error'})

def response(status_code, body):
    """Format response"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps(body)
    }
```

### users/create.py
```python
import json
import boto3
import uuid
from datetime import datetime, timezone
import os

dynamodb = boto3.resource('dynamodb')
cognito_client = boto3.client('cognito-idp')

def lambda_handler(event, context):
    """
    Create new user - registers in Cognito and stores profile in DynamoDB
    """
    try:
        body = json.loads(event['body'])
        
        # Validate required fields
        required = ['email', 'password', 'name', 'phone', 'user_type']
        for field in required:
            if field not in body:
                return response(400, {'error': f'Missing {field}'})
        
        email = body['email']
        password = body['password']
        name = body['name']
        phone = body['phone']
        user_type = body['user_type']  # 'rider' or 'driver'
        
        # Create Cognito user
        try:
            cognito_client.admin_create_user(
                UserPoolId=os.getenv('COGNITO_USER_POOL_ID'),
                Username=email,
                TemporaryPassword=password,
                UserAttributes=[
                    {'Name': 'email', 'Value': email},
                    {'Name': 'email_verified', 'Value': 'true'},
                    {'Name': 'phone_number', 'Value': phone},
                    {'Name': 'name', 'Value': name}
                ],
                MessageAction='SUPPRESS'
            )
            
            # Set permanent password
            cognito_client.admin_set_user_password(
                UserPoolId=os.getenv('COGNITO_USER_POOL_ID'),
                Username=email,
                Password=password,
                Permanent=True
            )
        except cognito_client.exceptions.UsernameExistsException:
            return response(409, {'error': 'User already exists'})
        
        # Store user profile in DynamoDB
        user_id = str(uuid.uuid4())
        table = dynamodb.Table(os.getenv('DYNAMODB_TABLE_PREFIX', '') + 'users')
        
        table.put_item(
            Item={
                'user_id': user_id,
                'email': email,
                'phone': phone,
                'name': name,
                'user_type': user_type,
                'rating': 5.0,
                'created_at': int(datetime.now(timezone.utc).timestamp()),
                'updated_at': int(datetime.now(timezone.utc).timestamp()),
                'status': 'active'
            }
        )
        
        return response(201, {
            'user_id': user_id,
            'email': email,
            'name': name,
            'user_type': user_type,
            'message': 'User created successfully'
        })
        
    except Exception as e:
        print(f"Error: {e}")
        return response(500, {'error': 'Internal server error'})

def response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps(body)
    }
```

### rides/request.py
```python
import json
import boto3
import uuid
import math
from datetime import datetime, timezone
import os

dynamodb = boto3.resource('dynamodb')
sqs_client = boto3.client('sqs')

EARTH_RADIUS_MILES = 3959

def haversine(lat1, lon1, lat2, lon2):
    """Calculate distance between two coordinates"""
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return EARTH_RADIUS_MILES * c

def lambda_handler(event, context):
    """
    Request ride - creates ride record and queues for driver matching
    """
    try:
        # Extract from API Gateway event
        body = json.loads(event.get('body', '{}'))
        
        # Validate input
        required = ['user_id', 'pickup_latitude', 'pickup_longitude', 
                   'dropoff_latitude', 'dropoff_longitude']
        for field in required:
            if field not in body:
                return response(400, {'error': f'Missing {field}'})
        
        user_id = body['user_id']
        pickup_lat = float(body['pickup_latitude'])
        pickup_lng = float(body['pickup_longitude'])
        dropoff_lat = float(body['dropoff_latitude'])
        dropoff_lng = float(body['dropoff_longitude'])
        
        # Validate coordinates
        if not (-90 <= pickup_lat <= 90) or not (-180 <= pickup_lng <= 180):
            return response(400, {'error': 'Invalid pickup coordinates'})
        
        # Calculate distance
        distance = haversine(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
        
        # Calculate fare
        base_fare = 2.00
        per_mile = 1.50
        fare = max(5.00, base_fare + (distance * per_mile))
        
        # Create ride record
        ride_id = str(uuid.uuid4())
        timestamp = int(datetime.now(timezone.utc).timestamp())
        
        table = dynamodb.Table(os.getenv('DYNAMODB_TABLE_PREFIX', '') + 'rides')
        
        ride_item = {
            'ride_id': ride_id,
            'rider_id': user_id,
            'pickup_lat': pickup_lat,
            'pickup_lng': pickup_lng,
            'dropoff_lat': dropoff_lat,
            'dropoff_lng': dropoff_lng,
            'distance_miles': round(distance, 2),
            'fare_amount': round(fare, 2),
            'status': 'requested',
            'created_at': timestamp,
            'pickup_address': body.get('pickup_address', ''),
            'dropoff_address': body.get('dropoff_address', '')
        }
        
        table.put_item(Item=ride_item)
        
        # Queue for driver matching
        queue_url = os.getenv('SQS_RIDE_QUEUE_URL')
        if queue_url:
            sqs_client.send_message(
                QueueUrl=queue_url,
                MessageBody=json.dumps(ride_item)
            )
        
        return response(201, {
            'ride_id': ride_id,
            'status': 'requested',
            'fare_amount': ride_item['fare_amount'],
            'distance_miles': ride_item['distance_miles']
        })
        
    except ValueError as e:
        return response(400, {'error': f'Invalid input: {e}'})
    except Exception as e:
        print(f"Error: {e}")
        return response(500, {'error': 'Internal server error'})

def response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps(body)
    }
```

### common/auth.py
```python
import os
import json
from datetime import datetime, timedelta
import jwt
from functools import wraps

JWT_SECRET = os.getenv('JWT_SECRET_KEY')
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')

def create_token(user_id, expires_delta=None):
    """Create JWT token"""
    if expires_delta is None:
        expires_delta = timedelta(hours=24)
    
    expire = datetime.utcnow() + expires_delta
    to_encode = {
        'sub': user_id,
        'exp': expire
    }
    
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def verify_token(token):
    """Verify JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('sub')
        return user_id
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def require_auth(lambda_handler):
    """Decorator to require authentication"""
    @wraps(lambda_handler)
    def wrapper(event, context):
        # Extract token from Authorization header
        headers = event.get('headers', {})
        auth_header = headers.get('Authorization', '')
        
        if not auth_header.startswith('Bearer '):
            return {
                'statusCode': 401,
                'body': json.dumps({'error': 'Missing Authorization header'})
            }
        
        token = auth_header[7:]  # Remove 'Bearer ' prefix
        user_id = verify_token(token)
        
        if not user_id:
            return {
                'statusCode': 401,
                'body': json.dumps({'error': 'Invalid or expired token'})
            }
        
        # Add user_id to event for handler to use
        event['user_id'] = user_id
        return lambda_handler(event, context)
    
    return wrapper
```

## SAM Template (template.yaml)
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2013-05-13

Parameters:
  Environment:
    Type: String
    Default: development
    AllowedValues:
      - development
      - staging
      - production

Globals:
  Function:
    Runtime: python3.11
    Timeout: 30
    MemorySize: 512
    Environment:
      Variables:
        ENVIRONMENT: !Ref Environment

Resources:
  # API Gateway
  ApiGateway:
    Type: AWS::Serverless::Api
    Properties:
      StageName: !Ref Environment
      Auth:
        DefaultAuthorizer: CognitoAuth
        Authorizers:
          CognitoAuth:
            UserPoolArn: !GetAtt UserPool.Arn

  # Lambda Functions
  LoginFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: lambdas/auth/
      Handler: login.lambda_handler
      Events:
        LoginApi:
          Type: Api
          Properties:
            RestApiId: !Ref ApiGateway
            Path: /auth/login
            Method: POST

  CreateRideFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: lambdas/rides/
      Handler: request.lambda_handler
      Events:
        CreateRideApi:
          Type: Api
          Properties:
            RestApiId: !Ref ApiGateway
            Path: /rides
            Method: POST
            Auth:
              Authorizer: CognitoAuth

  # DynamoDB Tables
  UsersTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Sub "${Environment}_users"
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: user_id
          AttributeType: S
        - AttributeName: email
          AttributeType: S
      KeySchema:
        - AttributeName: user_id
          KeyType: HASH
      GlobalSecondaryIndexes:
        - IndexName: email_index
          KeySchema:
            - AttributeName: email
              KeyType: HASH
          Projection:
            ProjectionType: ALL

  RidesTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Sub "${Environment}_rides"
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: ride_id
          AttributeType: S
        - AttributeName: rider_id
          AttributeType: S
        - AttributeName: created_at
          AttributeType: N
      KeySchema:
        - AttributeName: ride_id
          KeyType: HASH
      GlobalSecondaryIndexes:
        - IndexName: rider_index
          KeySchema:
            - AttributeName: rider_id
              KeyType: HASH
            - AttributeName: created_at
              KeyType: RANGE
          Projection:
            ProjectionType: ALL

Outputs:
  ApiEndpoint:
    Value: !Sub "https://${ApiGateway}.execute-api.${AWS::Region}.amazonaws.com/${Environment}"
    Description: API Gateway endpoint URL
  
  UsersTableName:
    Value: !Ref UsersTable
    Description: DynamoDB Users table name
  
  RidesTableName:
    Value: !Ref RidesTable
    Description: DynamoDB Rides table name
```

---

**Version**: 1.0
**Last Updated**: 2026-11-19
