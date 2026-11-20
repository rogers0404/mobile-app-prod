# Full Architecture Mapping
**Stack:** trip-infra-production + trip-lambdas-production
**Region:** us-east-1
**Account:** 024811758557
**Last Verified:** 2026-11-20

---

## Endpoints & Resources

### Users — `trip-users-production`
| Method | Route | DynamoDB |
|---|---|---|
| POST | `/api/users/create` | `production_users` |
| GET | `/api/users/{user_id}` | `production_users` |
| PUT | `/api/users/{user_id}` | `production_users` |
| DELETE | `/api/users/{user_id}` | `production_users` |

**Env vars:** `DYNAMODB_TABLE_PREFIX=production_`, `COGNITO_USER_POOL_ID=us-east-1_7J7X0WytZ`, `COGNITO_CLIENT_ID=3jle5k5mfmua9u2v6dbhm04qf3`

---

### Driver — `trip-driver-production`
| Method | Route | DynamoDB |
|---|---|---|
| POST | `/api/driver/documents` | `production_driver_documents` |
| POST | `/api/driver/location` | `production_driver_locations` |
| POST | `/api/driver/status` | `production_driver_status` |
| GET | `/api/driver/{user_id}/documents` | `production_driver_documents` |
| GET | `/api/driver/{user_id}/status` | `production_driver_status` |
| GET | `/api/driver/{user_id}/pending-rides` | `production_rides` |
| GET | `/api/driver/{user_id}/active-ride` | `production_rides` |
| GET | `/api/driver/{user_id}/earnings` | `production_rides` |

**Env vars:** `DYNAMODB_TABLE_PREFIX=production_`, `DOCUMENTS_BUCKET=trip-documents-024811758557-production`

---

### Rides — `trip-rides-production`
| Method | Route | DynamoDB |
|---|---|---|
| GET | `/api/rider/nearby-drivers` | `production_driver_locations` |
| POST | `/api/rides/request` | `production_rides` |
| POST | `/api/rides/accept` | `production_rides` |
| POST | `/api/rides/update-status` | `production_rides` |
| POST | `/api/rides/rate` | `production_rides` |
| GET | `/api/rides/{user_id}/active` | `production_rides` |
| GET | `/api/rides/{user_id}/history` | `production_rides` |
| GET | `/api/rides/details/{ride_id}` | `production_rides` |

**Env vars:** `DYNAMODB_TABLE_PREFIX=production_`, `SQS_RIDE_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/024811758557/trip-ride-requests-production`

---

### Payments — `trip-payments-production`
| Method | Route | DynamoDB |
|---|---|---|
| POST | `/api/payment/create-order` | `production_payments` |
| POST | `/api/payment/capture-order` | `production_payments` |

**Env vars:** `DYNAMODB_TABLE_PREFIX=production_`, `PAYPAL_SECRET_ARN=arn:aws:secretsmanager:us-east-1:024811758557:secret:trip-paypal-credentials-production-msMsK6`, `PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com`, `SQS_PAYMENT_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/024811758557/trip-payment-processing-production`

---

### Places — `trip-places-production`
| Method | Route | External API |
|---|---|---|
| GET | `/api/places/search` | Google Places Autocomplete |
| GET | `/api/places/details` | Google Place Details |
| GET | `/api/directions` | Google Directions |

**Env vars:** `GOOGLE_MAPS_SECRET_ARN=arn:aws:secretsmanager:us-east-1:024811758557:secret:trip-google-maps-key-production-Wimr72`

---

### WebSocket — `trip-websocket-production`
| Method | Route | DynamoDB |
|---|---|---|
| GET | `/api/ws/{user_id}` | `production_ws_connections` |

**Env vars:** `DYNAMODB_TABLE_PREFIX=production_`

---

### Notifications — `trip-notifications-production` (SQS consumer, no API route)
| Trigger | Queue |
|---|---|
| SQS | `trip-ride-requests-production` |
| SQS | `trip-notifications-production` |

**Env vars:** `SQS_NOTIFICATION_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/024811758557/trip-notifications-production`

---

## DynamoDB Tables
| Table | Used By |
|---|---|
| `production_users` | trip-users-production |
| `production_rides` | trip-rides-production, trip-driver-production |
| `production_payments` | trip-payments-production |
| `production_driver_status` | trip-driver-production |
| `production_driver_locations` | trip-driver-production, trip-rides-production |
| `production_driver_documents` | trip-driver-production |
| `production_ws_connections` | trip-websocket-production |

---

## SQS Queues
| Queue | Producer | Consumer |
|---|---|---|
| `trip-ride-requests-production` | trip-rides-production | trip-notifications-production |
| `trip-payment-processing-production` | trip-payments-production | trip-payments-production |
| `trip-notifications-production` | any Lambda | trip-notifications-production |

---

## External Services
| Service | Used By | Secret ARN |
|---|---|---|
| PayPal (sandbox) | trip-payments-production | `arn:aws:secretsmanager:us-east-1:024811758557:secret:trip-paypal-credentials-production-msMsK6` |
| Google Maps | trip-places-production | `arn:aws:secretsmanager:us-east-1:024811758557:secret:trip-google-maps-key-production-Wimr72` |
| Cognito | trip-users-production | Pool: `us-east-1_7J7X0WytZ`, Client: `3jle5k5mfmua9u2v6dbhm04qf3` |

---

## S3 Buckets
| Bucket | Used By |
|---|---|
| `trip-documents-024811758557-production` | trip-driver-production (document uploads) |
| `trip-lambda-code-024811758557` | CloudFormation (Lambda deployment packages) |

---

## API Gateway
| Property | Value |
|---|---|
| API ID | `dzk2lr8j09` |
| Base URL | `https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production` |
| Protocol | HTTP |
| Stage | `production` |
| Total Routes | 26 |

---

## CloudFormation Stacks
| Stack | Template | Resources |
|---|---|---|
| `trip-infra-production` | `cloudformation-template.yaml` | DynamoDB (7), S3, API Gateway, Cognito, SNS, CloudWatch |
| `trip-lambdas-production` | `lambda-functions.yaml` | Lambda (7), SQS (6), IAM Role, API Gateway routes (26), CloudWatch alarms |

---

## Known Issues
- Integration `8la9dkv` in API Gateway is a stale duplicate for `trip-places-production` with wrong URI format. Not attached to any route — safe to delete manually via Console → API Gateway → trip-production → Integrations.
