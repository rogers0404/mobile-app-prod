# Architecture

Trip is an Expo and React Native ride-share app. It targets iOS, Android, and web. The app can use a local FastAPI backend or the AWS serverless backend. Both expose routes under `/api`, with [known differences](BUGS.md#open-issues).

## Frontend

| Area | Responsibility |
| --- | --- |
| [App routes](../frontend/app) | Expo Router manages the create-or-select profile screen and the rider and driver dashboards. |
| [Rider screens](../frontend/app/rider) | Pickup and drop-off selection, ride requests, live tracking, payment, and trip history. |
| [Driver screens](../frontend/app/driver) | Availability, incoming requests, active trips, document upload, earnings, and history. |
| [State stores](../frontend/src/store) | Zustand manages user, ride, driver, and notification state. AsyncStorage persists the selected profile locally. |
| [Map components](../frontend/src/components) | Platform-specific maps, route display, and navigation UI. |
| [Environment configuration](../frontend/src/config/env.ts) | Resolves the backend base URL and the client Maps key. [Expo app configuration](../frontend/app.config.js) injects Android and iOS Maps keys. |

## Local backend

[FastAPI](../backend/server.py) implements user profiles, driver availability and location, ride state and history, PayPal order creation and capture, and Google Places and Directions calls. MongoDB stores users, rides, driver status, locations, and documents. The server exposes a WebSocket at `/api/ws/{user_id}` for realtime updates.

## AWS backend

API Gateway routes requests to domain-specific Lambda functions backed by DynamoDB, S3, and provider integrations. See the [AWS architecture](../aws-deployment/ARCHITECTURE.md) for stack ownership, handler responsibilities, and realtime wiring.

## Ride flow

1. The user creates or selects a rider or driver profile. The frontend stores the profile and uses its ID in requests.
2. The rider chooses pickup and drop-off. Place search returns predictions, place details supply coordinates, and directions provide route information.
3. The rider submits the request. A driver accepts the pending ride and advances it through pickup and completion. The application also supports cancellation.
4. The rider and driver can view their trip history. PayPal order creation and capture support the payment flow.

See the [getting-started guide](GETTING_STARTED.md) for local setup and AWS deployment and the [bug log](BUGS.md) for identity and access findings.
