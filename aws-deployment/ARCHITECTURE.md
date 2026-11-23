# AWS architecture

The Expo app sends requests to API Gateway using the stage URL configured in `EXPO_PUBLIC_BACKEND_URL`. API Gateway invokes a Python Lambda for the matching domain. The handlers use environment-prefixed DynamoDB tables and call external providers with credentials from Secrets Manager.

## Stack responsibilities

| Stack | Resources |
| --- | --- |
| [Infrastructure](cloudformation-template.yaml) | HTTP API and stage, DynamoDB tables, documents bucket, Cognito user pool and client, API access logs, and an SNS-backed API error alarm. |
| [Lambda and routes](lambda-functions.yaml) | Seven Python 3.11 functions, a shared Lambda IAM role, HTTP integrations and routes, worker queues with dead-letter queues, function logs, and error alarms. |

The Lambda stack takes the infrastructure API ID and Cognito IDs as parameters. It retrieves the deployment ZIPs from the artifact bucket under `<environment>/<handler>.zip`. The artifact bucket is supplied independently of the driver document bucket.

CloudFormation provisions Cognito. The checked-in HTTP routes lack a Cognito or JWT authorizer. See [HTTP authorization](BUGS.md#http-authorization) for the access-control gap.

## Storage

All DynamoDB table names start with `<environment>_`. The infrastructure template configures on-demand billing and point-in-time recovery. Its partition keys are grouped below.

| Tables | Partition key |
| --- | --- |
| `users` | `user_id` |
| `rides` | `ride_id` |
| `payments` | `payment_id` |
| `driver_status`, `driver_locations`, `driver_documents` | `driver_id` |
| `ws_connections` | `connection_id` |

The [infrastructure template](cloudformation-template.yaml) also provisions a versioned, encrypted S3 bucket for documents.

## Handlers and data flow

| Handler | Responsibility |
| --- | --- |
| [Users](lambdas/users.py) | Profile CRUD and a role-listing handler. User records use `user_id`; driver-specific records use `driver_id`. |
| [Driver](lambdas/driver.py) | Driver documents, locations, status, incoming and active rides, and earnings. |
| [Rides](lambdas/rides.py) | Nearby drivers, ride requests, acceptance and status changes, rating, active ride, and history. A new ride is written to DynamoDB and queued when the ride queue is configured. |
| [Payments](lambdas/payments.py) | Creates and captures PayPal orders and updates ride payment state. The Lambda template configures PayPal Sandbox. |
| [Places](lambdas/places.py) | Proxies Google Places autocomplete, place details, and directions. |
| [Notifications](lambdas/notifications.py) | Consumes messages from the ride, payment, and notification queues. Its SNS publishing path depends on topic configuration. |
| [Realtime](lambdas/websocket.py) | Handles WebSocket events and forwards driver location updates to riders when a WebSocket management endpoint is configured. The gateway and handler have a [wiring gap](BUGS.md#realtime-wiring). |

[Shared helpers](lambdas/common/db.py) resolve DynamoDB table names from the environment prefix, cache provider secrets within each warm Lambda process, and format HTTP responses.

For local FastAPI and frontend details, see the [project architecture](../documentation/ARCHITECTURE.md).
