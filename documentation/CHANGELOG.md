# Change history

Dates mark Git commits unless an entry identifies a report date. See the [bug log](BUGS.md) for open issues and verification status.

## 2026-11-22

- Added a create-or-select flow for riders and drivers. The app stores the selected profile locally and opens the matching dashboard. The Users Lambda gained a role-filtered list handler. `a6eddae`
- Added rider feedback while resolving the initial pickup, searching for places, loading place details, and submitting a ride request.
- Updated active-ride handling so the Lambda returns JSON `null` when no ride exists and the frontend clears invalid or empty ride data. Updated rider initialization and error handling around profile and ride state.

## 2026-11-21

- Location-search investigation recorded successful autocomplete responses followed by failures retrieving place details. The follow-up reported that replacing an expired Google Maps key restored place details and directions in the environment tested.
- Reviewed pickup, search, and selection loading behavior. The related app changes landed in `a6eddae`.

## 2026-11-20

- Updated the AWS templates and added API Gateway integrations for users, drivers, rides, payments, and places. Updated the frontend dependency lockfile and project configuration. `49178b6`, `331e6f4`
- Corrected driver-related DynamoDB key usage, updated Lambda and frontend error handling, and added regression tests for driver creation, profile, and tracking. `7584bf9`
- Replaced credential literals in tracked configuration with templates or environment-driven settings, updated ignore rules, and repaired TypeScript configuration. `c7f97a0`, `be1dbc3`

## 2026-11-19

- Merged the development branch and added AWS deployment scaffolding. Fixed CloudFormation resource definitions and documented the deployment workflow. `2e5b3e3`, `d5ddc1e`

## 2026-10-15

- Upgraded Expo and improved the driver location fallback. `81b54e0`
- Externalized Maps configuration, separated native Maps keys, and removed generated Metro cache files from Git tracking. `fd92580`

## 2026-07

- Established the standalone app, then updated rider tracking, the driver ride flow, interactive maps, and navigation. `63e93e2`, `dc94501`, `6fa1463`

## Original documentation

The original session notes, verification reports, deployment handoff, and audit write-ups are available from the repository root at the pre-consolidation revision.

```sh
git ls-tree --name-only a6eddae:documentation
git show a6eddae:documentation/CHANGELOG_SESSION.md
git show a6eddae:DEPLOYMENT_READY.txt
```
