# Security status and repository hygiene

Reviewed: 2026-10-15. Scope: repository configuration cleanup and targeted source review, not a penetration test or production certification. This replaces the historical 2026-09-07 report; earlier assertions about live credentials and dependency counts are not current evidence.

## Repository cleanup

- Removed the literal Maps key from `frontend/app.json`. `frontend/app.config.js` now injects separate Android and optional iOS native keys from environment variables.
- Added blank credential templates in `frontend/.env.example` and `backend/.env.example`. Actual `.env` files remain ignored and are not tracked in the current index.
- Removed 9,027 generated Metro cache files from Git tracking while preserving local copies. Added an explicit ignore rule for Expo-generated state.
- Native and browser Maps keys remain extractable from shipped apps. Environment injection avoids literal keys in source; it does not make client keys private.

## Verified open issues

| Area | Current evidence | Remaining work |
| --- | --- | --- |
| Identity and authorization | The active FastAPI app accepts client-supplied user identifiers; no server-validated authentication dependency was found in the targeted route review. | Establish authenticated identity and enforce roles/ownership for HTTP and WebSocket access before production use. |
| Browser access | Backend CORS still combines wildcard origins with credentials. | Define an environment-specific origin allowlist and required credential behavior. CORS does not replace authentication. |
| Configuration | Backend reads payment and Maps credentials from the environment, retains local MongoDB defaults, and lacks centralized production startup validation. | Define production-required settings and fail startup when they are missing. |
| Maps | The request screen still calls Geocoding directly with a client key; web maps use a client key. Native keys are now configured separately. | Review each platform/API combination, restrict keys, and move unsuitable direct web-service calls behind an authenticated, rate-limited server endpoint. |
| Payments and realtime | No full payment replay, cross-user authorization, or realtime isolation test was completed in this cleanup. | Verify these flows with isolated tests before production use. |

## Dependency check

A fresh `npm audit --json` against the frontend npm dependency graph on 2026-10-15 completed with exit code 1 and reported **54** findings: **1 critical, 33 high, 19 moderate, 1 low**. These are package advisory findings, not 54 proven application exploits. Runtime/build exposure and reachable attack paths were not assessed. No forced upgrades were applied. Backend dependencies were not audited in this pass.

## History review and limits

A targeted pattern scan covered 4,926 unique blobs across 24 commits reachable from local Git refs. It detected Maps-key material in historical app configuration, backend source, and generated Metro caches. The scan skipped binary blobs and is not proof that all secrets were found. Existing history was not rewritten; removing files from the latest tree does not erase older copies. Remote-only refs were not part of this scan.

## Provider actions still required

The current provider configuration and credential validity were not queried. No key was used to test access, restricted, rotated, or revoked in this cleanup.

- Review Google Cloud key usage and restrictions. Use separate application restrictions for Android, iOS, browser, and server keys, plus only the required APIs. Validate legitimate clients before retiring an old key.
- Rotate any exposed private credential through its provider. Removing current files or rewriting history does not revoke a credential.
- Keep exact credential values and incident response details outside this repository. Local generated files and previous Git history can retain older values.

See [Google Maps security guidance](https://developers.google.com/maps/api-security-best-practices) and [Expo app configuration](https://docs.expo.dev/workflow/configuration/).
