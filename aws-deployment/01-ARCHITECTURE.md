# AWS Architecture for Trip Ride-Share

## High-Level Design

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CLIENT TIER                                   │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  iOS/Android App (React Native/Expo)                         │    │
│  │  - Rider Interface                                           │    │
│  │  - Driver Interface                                          │    │
│  │  - Maps & Location Tracking                                 │    │
│  │  - Real-time Notifications                                  │    │
│  └─────────────────────────────────────────────────────────────┘    │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │ HTTPS + WebSocket
                    ┌────────────▼────────────┐
                    │  Route 53 (DNS)         │
                    │  API: api.trip.app      │
                    └────────────┬────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │ (Optional) CloudFront │ CDN for static assets │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  API Gateway            │
                    │  - REST Endpoints       │
                    │  - WebSocket (Real-time)│
                    │  - Rate Limiting        │
                    │  - Request Validation   │
                    │  - API Keys/JWT         │
                    └────────────┬────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
    ┌────▼──────┐          ┌────▼──────┐          ┌────▼──────┐
    │  Lambda   │          │  Lambda   │          │  Lambda   │
    │  Users    │          │  Rides    │          │  Payments │
    │  - Auth   │          │  - Create │          │  - PayPal │
    │  - Profile│          │  - Track  │          │  - Stripe │
    │  - Docs   │          │  - Accept │          │  - Invoice│
    └────┬──────┘          └────┬──────┘          └────┬──────┘
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
    ┌────▼──────┐          ┌────▼──────┐          ┌────▼──────┐
    │ DynamoDB  │          │ DynamoDB  │          │ DynamoDB  │
    │  Users    │          │  Rides    │          │  Payments │
    │ (GSI:     │          │ (GSI:     │          │ (GSI:     │
    │  email)   │          │  driver)  │          │  status)  │
    └───────────┘          └───────────┘          └───────────┘
         │
         └─────┬──────────────────────────────┐
               │                              │
         ┌─────▼─────┐              ┌────────▼────────┐
         │   S3      │              │  DynamoDB       │
         │ Documents │              │  Streams        │
         │ (Licenses)│              │  (Events)       │
         └───────────┘              └────────┬────────┘
                                             │
                           ┌─────────────────┼──────────────────┐
                           │                 │                  │
                      ┌────▼────┐      ┌────▼────┐      ┌──────▼──────┐
                      │   SQS   │      │  SNS    │      │ EventBridge │
                      │  Queue  │      │ Notify  │      │  Rules      │
                      └────┬────┘      └────┬────┘      └──────┬──────┘
                           │                │                  │
                      ┌────▼────────────────┴──────────────────▼──────┐
                      │   Lambda Consumers                             │
                      │   - Notifications                              │
                      │   - Webhooks                                   │
                      │   - Analytics                                  │
                      └────────────────────────────────────────────────┘

                  ┌─────────────────────────────────────┐
                  │  Monitoring & Logging               │
                  │  - CloudWatch Logs                  │
                  │  - CloudWatch Metrics               │
                  │  - X-Ray Tracing                    │
                  │  - CloudTrail Audit                 │
                  └─────────────────────────────────────┘

                  ┌─────────────────────────────────────┐
                  │  Security                           │
                  │  - Cognito User Pools               │
                  │  - Secrets Manager                  │
                  │  - VPC Endpoints (Private)          │
                  │  - WAF for API Gateway              │
                  └─────────────────────────────────────┘
```

## Component Details

### 1. API Gateway
**Purpose**: Unified entry point for all client requests

```yaml
Configuration:
  - Type: REST + WebSocket
  - Authentication: Cognito User Pool (JWT)
  - Rate Limiting: 10,000 requests/sec per stage
  - Logging: CloudWatch Logs
  - Caching: 5 minutes (configurable per endpoint)
  - Throttling: 400 burst, 200 sustained
  
Endpoints:
  POST   /auth/login              → Lambda (Cognito)
  POST   /auth/register           → Lambda (Cognito)
  POST   /auth/refresh            → Lambda (Cognito)
  
  GET    /users/{userId}          → Lambda (GetUser)
  POST   /users                   → Lambda (CreateUser)
  PUT    /users/{userId}          → Lambda (UpdateUser)
  
  POST   /rides                   → Lambda (RequestRide)
  GET    /rides/{rideId}          → Lambda (GetRide)
  PUT    /rides/{rideId}/status   → Lambda (UpdateRideStatus)
  GET    /rides/active            → Lambda (GetActiveRides)
  
  POST   /payments                → Lambda (ProcessPayment)
  GET    /payments/{paymentId}    → Lambda (GetPayment)
  
  POST   /documents/upload        → Lambda (S3 Upload)
  GET    /documents/{docId}       → Lambda (S3 Download)
  
  WebSocket: /ws                  → Lambda (WebSocket Handler)
```

### 2. AWS Lambda Functions

**Directory Structure**:
```
lambdas/
├── auth/
│   ├── login.py              # Cognito authentication
│   ├── register.py           # User registration
│   └── refresh.py            # Token refresh
├── users/
│   ├── get.py                # Fetch user profile
│   ├── create.py             # Create user
│   ├── update.py             # Update profile
│   └── upload_documents.py   # Store driver docs
├── rides/
│   ├── request.py            # Create ride request
│   ├── get.py                # Fetch ride details
│   ├── update_status.py      # Update ride status
│   ├── accept.py             # Driver accept ride
│   ├── track.py              # Real-time tracking
│   └── history.py            # Get ride history
├── payments/
│   ├── process.py            # Process payment
│   ├── refund.py             # Issue refund
│   └── webhook.py            # PayPal/Stripe webhook
├── websocket/
│   ├── connect.py            # WebSocket connect
│   ├── disconnect.py         # WebSocket disconnect
│   └── send.py               # Send real-time message
├── notifications/
│   ├── send_sms.py           # Twilio SMS
│   ├── send_email.py         # SES Email
│   └── send_push.py          # SNS Mobile Push
└── common/
    ├── auth.py               # JWT validation
    ├── db.py                 # DynamoDB helpers
    ├── errors.py             # Exception handling
    └── logging.py            # Structured logging
```

**Function Characteristics**:
- **Memory**: 512 MB (scales to 10GB if needed)
- **Timeout**: 30 seconds (60s for async tasks)
- **Environment Variables**: Loaded from Secrets Manager
- **Concurrency**: Auto-scaling, default 1000
- **Cost**: Free tier covers 1M requests/month

### 3. DynamoDB Tables

**Table Schema**:

```yaml
users:
  PrimaryKey:
    - partition: user_id (String)
  Attributes:
    - email (String, unique)
    - phone (String)
    - password_hash (String)
    - full_name (String)
    - user_type (String) # 'rider' or 'driver'
    - profile_pic_url (String)
    - rating (Number)
    - created_at (Number, Unix timestamp)
    - updated_at (Number)
  GSI: 
    - email_index: email → user_id
    - phone_index: phone → user_id
  TTL: None
  Billing: On-Demand

rides:
  PrimaryKey:
    - partition: ride_id (String)
  Attributes:
    - rider_id (String)
    - driver_id (String, nullable)
    - pickup_lat (Number)
    - pickup_lng (Number)
    - dropoff_lat (Number)
    - dropoff_lng (Number)
    - status (String) # 'requested', 'accepted', 'in_progress', 'completed', 'cancelled'
    - fare_amount (Number)
    - distance_miles (Number)
    - duration_minutes (Number)
    - created_at (Number)
    - accepted_at (Number, nullable)
    - completed_at (Number, nullable)
  GSI:
    - rider_id_index: rider_id, created_at → ride_id
    - driver_id_index: driver_id, created_at → ride_id
    - status_index: status, created_at → ride_id
  TTL: None
  Billing: On-Demand

payments:
  PrimaryKey:
    - partition: payment_id (String)
  Attributes:
    - ride_id (String)
    - user_id (String)
    - amount (Number)
    - currency (String)
    - status (String) # 'pending', 'completed', 'failed', 'refunded'
    - payment_method (String) # 'paypal', 'stripe', 'card'
    - transaction_id (String)
    - created_at (Number)
    - completed_at (Number, nullable)
  GSI:
    - user_id_index: user_id, created_at → payment_id
    - status_index: status, created_at → payment_id
  TTL: None
  Billing: On-Demand

driver_documents:
  PrimaryKey:
    - partition: driver_id (String)
    - sort: document_type (String) # 'license', 'insurance'
  Attributes:
    - s3_url (String)
    - verification_status (String) # 'pending', 'approved', 'rejected'
    - uploaded_at (Number)
    - verified_at (Number, nullable)
  TTL: None
  Billing: On-Demand

ride_locations:
  PrimaryKey:
    - partition: ride_id (String)
    - sort: timestamp (Number)
  Attributes:
    - latitude (Number)
    - longitude (Number)
    - accuracy (Number)
    - speed (Number)
  TTL: 86400 (1 day, auto-cleanup)
  Billing: On-Demand
```

**Capacity Planning**:
- Startup: On-Demand pricing (automatically scales)
- 10K+ rides/day: Consider Provisioned capacity
- Estimated Read Units: 100-500 RU/sec
- Estimated Write Units: 50-200 WU/sec

### 4. S3 Storage

```yaml
Bucket: trip-app-documents

Folder Structure:
  driver-licenses/
    {driver_id}/license_front.jpg
    {driver_id}/license_back.jpg
  
  driver-insurance/
    {driver_id}/insurance_doc.pdf
  
  profile-pictures/
    {user_id}/profile.jpg
  
  receipts/
    {ride_id}/receipt.pdf
  
  logs/
    {year}/{month}/{day}/logs.txt

Configuration:
  - Versioning: Enabled (keep 3 versions)
  - Encryption: AES-256 (default)
  - Public Access: Blocked
  - Logging: To separate bucket
  - Lifecycle:
    - Delete old logs after 90 days
    - Archive receipts after 1 year
  - Cost: ~$1/month at startup
```

### 5. Cognito User Pools

```yaml
User Pool: trip-riders, trip-drivers

Configuration:
  - Password Policy: Min 8 chars, numbers, uppercase
  - MFA: Optional (SMS or TOTP)
  - Email Verification: Enabled
  - Attribute Validation:
    - email: Required, unique
    - phone_number: Required for drivers
    - name: Required
  
  Triggers:
    - Pre-sign-up: Auto-confirm emails from whitelist
    - Post-confirmation: Create user record in DynamoDB
    - Custom message: Custom email/SMS templates

  App Client:
    - Auth Flows: ALLOW_USER_PASSWORD_AUTH, ALLOW_REFRESH_TOKEN_AUTH
    - Token Expiry: 1 hour (ID + Access), 30 days (Refresh)
    - Allowed Scopes: openid, profile, email, phone
    - Callback URLs: https://app.trip.com/auth/callback

Cost: FREE (up to 50K users/month)
```

### 6. SQS + SNS for Event Processing

```yaml
SQS Queues:
  
  ride-requests-queue:
    - Receives new ride requests
    - Triggers Lambda for driver matching
    - Visibility: 30 seconds
    - Retention: 14 days
    - Dead Letter Queue: ride-requests-dlq (max retries: 3)
  
  payment-processing-queue:
    - Payment transactions
    - Triggers PayPal/Stripe processing
    - Visibility: 60 seconds
    - Retention: 7 days
  
  notification-queue:
    - SMS/Email/Push notifications
    - Triggers notification Lambda
    - Visibility: 30 seconds
    - Retention: 24 hours

SNS Topics:
  
  ride-status-updates:
    - Subscribers: Mobile push notifications
    - Subscription filter: JSON-based routing
  
  payment-status-updates:
    - Subscribers: Email confirmation
    - Subscribers: Receipt generation
  
  driver-match-updates:
    - Subscribers: Real-time WebSocket broadcast
```

### 7. EventBridge Rules

```yaml
Rules:

  rule-ride-completion:
    Event Pattern:
      - source: "ride.service"
      - detail-type: "ride.completed"
    Targets:
      - Lambda: generate-receipt
      - SQS: payment-processing-queue
  
  rule-payment-failed:
    Event Pattern:
      - source: "payment.service"
      - detail-type: "payment.failed"
    Targets:
      - Lambda: notify-payment-failure
      - SQS: retry-payment-queue
  
  rule-driver-approved:
    Event Pattern:
      - source: "driver.service"
      - detail-type: "driver.approved"
    Targets:
      - Lambda: send-welcome-email
      - SNS: driver-approved-topic
```

## Data Flow Examples

### Ride Request Flow
```
1. Mobile Client
   POST /rides {pickup, dropoff}
   │
2. API Gateway
   Validates request
   │
3. Lambda: rides/request.py
   - Validates user
   - Calculates fare
   - Creates DynamoDB entry
   - Publishes to SQS
   │
4. SQS: ride-requests-queue
   │
5. Lambda: rides/match.py (async)
   - Finds nearby drivers
   - Updates ride status
   - Triggers WebSocket notification
   │
6. WebSocket API
   Sends real-time update to driver
   │
7. Driver App
   Shows new ride request
```

### Payment Processing Flow
```
1. Ride Completed
   λ: rides/update_status.py
   │
2. Event: ride.completed → EventBridge
   │
3. Lambda: payments/process.py
   - Retrieves ride fare
   - Gets payment method from user profile
   - Calls PayPal/Stripe API
   │
4. SQS: payment-processing-queue
   │
5. Lambda: payments/webhook.py
   - Receives PayPal/Stripe callback
   - Updates payment status
   - Triggers receipt generation
   │
6. Email Notification
   SES: Send receipt to rider
```

## Cost Optimization Strategies

1. **Use On-Demand DynamoDB**: Scales automatically, pay per request
2. **Lambda Concurrency Limits**: Prevent runaway costs
3. **CloudWatch Logs**: Set retention to 7-30 days
4. **S3 Lifecycle Policies**: Archive/delete old logs
5. **API Gateway Caching**: Reduce Lambda invocations
6. **Reserved Capacity** (Optional): Save 30-50% if confident in traffic
7. **Multi-region Setup** (Later): Use DynamoDB Global Tables

## Migration Path

**Phase 1 (Week 1-2)**: Core Infra
- Deploy API Gateway
- Create DynamoDB tables
- Deploy Lambda functions
- Setup Cognito

**Phase 2 (Week 3-4)**: Enhanced Features
- WebSocket real-time updates
- SQS/SNS event processing
- Payment integration
- Document storage

**Phase 3 (Month 2)**: Optimization
- CloudFront CDN
- Reserved capacity
- Advanced monitoring
- Multi-region failover

---

**Version**: 1.0
**Last Updated**: 2026-11-19
