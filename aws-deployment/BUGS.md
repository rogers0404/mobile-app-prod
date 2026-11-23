# AWS bug log

Open entries reflect checked-in code and templates. The deployed stage may differ.

## Open issues

### Existing-user selection

The [Users Lambda](lambdas/users.py) implements `GET /api/users/type/{type}` for the profile picker, but the [Lambda stack](lambda-functions.yaml) lacks the route. The handler also scans the whole users table and returns all matching records. Before routing stage traffic to it, define who can list profiles and which fields the picker needs. Verify rider, driver, and empty-list responses with test data.

### Realtime wiring

The [infrastructure stack](cloudformation-template.yaml) creates an HTTP API and the [Lambda stack](lambda-functions.yaml) maps `GET /api/ws/{user_id}` on it. The [realtime handler](lambdas/websocket.py) expects WebSocket route events. The handler uses `user_id` to access the connection table, whose partition key is `connection_id`. The Lambda stack also omits the WebSocket management endpoint and connection table permissions from the function configuration and shared role, respectively. Verify the connection lifecycle and rider location updates on the intended stage.

### HTTP authorization

The templates provision Cognito, but the [HTTP routes](lambda-functions.yaml) lack a configured authorizer. Handlers use user IDs supplied in requests. Before exposing the API publicly, verify authenticated identity and role and ownership checks for profiles, rides, driver records, payments, and realtime connections.

### Notification delivery

The [Lambda stack](lambda-functions.yaml) invokes the [Notifications Lambda](lambdas/notifications.py) from SQS but omits the `SNS_TOPIC_ARN` it needs to publish. The handler also catches per-record errors and returns success for the batch. Verify destination configuration and confirm failed records are retried or sent to the configured dead-letter queue.

### Legacy deploy script

[deploy.sh](deploy.sh) calls SAM with a `StripeSecret` override. The [legacy template](template.yaml) has Markdown fences, lacks that parameter, and does not wire the checked-in handlers. Its setup output also refers to an older frontend URL configuration. Use the [two-stack guide](GETTING_STARTED.md) for the checked-in backend.

## Fixes in Git

| Finding | Fix |
| --- | --- |
| Infrastructure template had missing or conflicting resources and an incorrect API output | Added the SNS alarm topic, corrected the stage URL, and resolved a resource naming conflict in the November 19 changes. See [change history](CHANGELOG.md#2026-11-19). |
| Driver status, documents, and location lookups used inconsistent keys | Standardized handler access on `driver_id` in `7584bf9`. See [regression tests](../tests/test_aws_driver_keys.py). |
| No active ride returned an empty object | Changed the Rides Lambda to return JSON `null` in `a6eddae`. Verify on the intended stage after updating the function. |
| Place selection failed in an earlier environment | The earlier report attributed place-details failures to an expired Maps key and recorded recovery after replacement. Verify the Secrets Manager value and current provider configuration for the target stage. |

For new reports, record the environment, affected stack or handler, symptom, source or stage evidence, and follow-up status.
