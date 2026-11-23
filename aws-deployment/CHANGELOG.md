# AWS change history

Dates reflect Git commits. The [bug log](BUGS.md) tracks deployment and verification status.

## 2026-11-22

- Added role-filtered listing to the Users Lambda for the app's existing-profile picker. The handler scans the users table, filters by `rider` or `driver`, and returns results newest first. The gateway route remains open work. `a6eddae`
- Changed the Rides Lambda to return JSON `null` when the user has no active ride. `a6eddae`

## 2026-11-20

- Standardized driver-related DynamoDB writes and lookups on `driver_id` across the Users, Driver, Rides, and WebSocket handlers. Added regression tests. `7584bf9`
- Added explicit API Gateway integrations and routes for users, drivers, rides, payments, and places, plus the HTTP path currently assigned to the realtime handler. `331e6f4`
- Introduced the separate Lambda stack, seven Python handlers, shared database helpers, and scripts to package Lambda code and store provider credentials. Updated the base infrastructure and added driver and realtime persistence tables. `01074ef`, `ba8ce46`
- Added the legacy deployment template retained as `template.yaml`. `49178b6`

## 2026-11-19

- Added the AWS deployment package and the base CloudFormation infrastructure. `7c1bedc`, `2e5b3e3`, `d5ddc1e`
- Addressed early template issues documented at the time, including the missing SNS alarm topic, stage URL construction, and a resource naming conflict. `d5ddc1e`, `5e04c2c`

## Original documentation

The pre-consolidation guide, cost estimates, examples, and error reports are available in Git.

```sh
git ls-tree --name-only a6eddae:aws-deployment
git show a6eddae:aws-deployment/ERROR_REPORT.md
git show a6eddae:aws-deployment/02-COST_ANALYSIS.md
```
