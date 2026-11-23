# Bug log

Open issues below reflect the checked-in source and earlier audit findings. This documentation review used source inspection. Device behavior, deployed AWS routes, and provider settings still need verification in their target environments.

## Open issues

### Existing-user selection

**Status:** Open in the checked-in API configuration.

The [profile screen](../frontend/app/select-type.tsx) calls `GET /api/users/type/{type}`. [Local FastAPI](../backend/server.py) lacks the endpoint. The AWS Lambda implements it, with an [open gateway routing gap](../aws-deployment/BUGS.md#existing-user-selection).

For realtime wiring and other deployed backend issues, see the [AWS bug log](../aws-deployment/BUGS.md).

### Identity and access

**Status:** Open in the FastAPI source. AWS authorization requires verification.

The 2026-10-15 review found that FastAPI relies on client-supplied user IDs and uses wildcard CORS with credentials enabled. The checked-in [FastAPI server](../backend/server.py) still shows this configuration. Verify authenticated identity, roles, and resource ownership on HTTP and WebSocket routes, including rides, profiles, driver documents, and payment actions. Realtime isolation and payment replay handling were outside the earlier review.

### Credential exposure and dependency follow-up

**Status:** Provider actions and current dependency assessment pending verification.

The October 2026 review found Maps key material in historical Git objects. Later commits removed credential literals from tracked configuration. Verify provider-side rotation and revocation for exposed credentials, and review restrictions on Android, iOS, browser, and server Maps keys. The review also flagged client-side geocoding and missing production startup configuration validation.

The frontend dependency audit on 2026-10-15 reported 54 dependency advisories, including 1 critical and 33 high. Those counts apply to the dependency graph at that date. Reassess the current lockfile and audit backend dependencies separately.

## Fixes recorded in code or earlier reports

| Finding | Fix and verification status |
| --- | --- |
| Place suggestions appeared, but selecting a place failed | The 2026-11-21 report recorded a place-details 404 and an expired Maps key. A follow-up reported successful autocomplete, details, and directions after replacing the key. Credentials and results are environment-specific. |
| Rider dashboard could get stuck on “Processing…” | The rides Lambda returns JSON `null` for no active ride, and the frontend validates the response and clears empty ride state. Profile initialization was updated in `a6eddae`. Verify startup and the idle state on a device. |
| Ride requests failed for missing users or mismatched IDs | The session recorded “User not found” responses. The app uses the selected or created profile ID and the rider dashboard restores or creates a rider profile. Verify with a fresh profile and a previously saved profile. |
| Pickup, autocomplete, and place selection appeared idle while requests ran | The rider request screen gained loading feedback for location, search, and place selection while retaining the ride submission indicator. Verify success, empty results, errors, and location permission denial. |
| Driver records used inconsistent DynamoDB keys | Driver-related handlers were updated to use `driver_id` in `7584bf9`. [Regression tests](../tests/test_aws_driver_keys.py) cover driver creation, profile, and tracking keys. |
| CloudFormation and TypeScript configuration errors | CloudFormation resource definitions and TypeScript configuration were updated in November 2026. See the [change history](CHANGELOG.md) for commits. |

For new entries, record the report date, environment, symptom, affected component, status, and fix or verification evidence.
