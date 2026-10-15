# Security, Configuration, and Vulnerability Audit

Date: 2026-09-07

## Executive Summary

This project is not currently production-safe. The main issues are hard-coded secrets, insecure CORS settings, an unauthenticated API surface, and a significant set of frontend dependency vulnerabilities. The backend still compiles cleanly, but the configuration and security posture present clear risk.

## Verification Evidence

- Backend syntax validation: `python3 -m compileall backend` returned exit code 0.
- Dependency audit: `npm audit --audit-level=low --json` returned exit code 1 with 38 vulnerabilities total.
- The report shows: 1 critical, 10 high, 26 moderate, 1 low.
- The backend and frontend include active secrets in committed files and runtime config.

## Findings

### 1) Hard-coded secrets and API keys in source-controlled files

High risk / immediate action required.

Evidence:
- [backend/.env](backend/.env) contains live PayPal credentials and a Google Maps key.
- [frontend/.env](frontend/.env) contains a public Google Maps key.
- [frontend/app.json](frontend/app.json) embeds the Google Maps API key in the Android config.
- [backend/server.py](backend/server.py) reads secrets via `os.getenv()` but does not fail fast if they are missing.
- [frontend/src/config/env.ts](frontend/src/config/env.ts) exposes client-side environment values directly.
- [frontend/app/rider/request.tsx](frontend/app/rider/request.tsx) calls Google Geocoding directly from the mobile app using a browser-exposed key.

Why this matters:
- Secrets are exposed to anyone with repository access or a built app binary.
- The Google key can be abused for billing and API quota exhaustion.
- PayPal credentials can be used to make unauthorized API calls or hijack payment flow behavior.

Recommended fix:
- Remove all secrets from repo-tracked files.
- Move credentials to a secret manager or environment injection system.
- Restrict Google Maps API key usage by referrer/IP and separate keys by environment.
- Use backend-only proxying for third-party APIs instead of exposing keys in the client.

---

### 2) CORS misconfiguration creates browser security risk

High risk / immediate action required.

Evidence:
- [backend/server.py](backend/server.py) sets:
  - `allow_origins=["*"]`
  - `allow_credentials=True`

This is a known problematic combination in browsers. A wildcard origin with credentialed requests is not safe and can cause unexpected failures or insecure behavior.

Why this matters:
- It broadens the trust boundary for cross-origin requests.
- It can enable cross-site abuse if the API is exposed beyond a trusted client environment.
- It is unsafe for production deployments.

Recommended fix:
- Restrict origins to an explicit allowlist.
- Disable credentialed wildcard CORS.
- Use a clearly defined backend domain and same-origin or trusted-origin policy.

---

### 3) No authentication or authorization layer on the backend

Critical risk.

Evidence:
- The intro comment in [backend/server.py](backend/server.py) states: "No authentication required - simple user ID based system".
- No JWT, session, OAuth, API key enforcement, or role-based access control was found in the backend API layer.

Why this matters:
- Any client can create, modify, or query ride and user records if the API is reachable.
- Sensitive actions such as payment processing and driver status updates are not protected.
- This is not appropriate for any real-world deployment.

Recommended fix:
- Add authentication and authorization middleware.
- Require signed tokens or OAuth/OIDC for all protected routes.
- Validate ownership before allowing ride, payment, or driver actions.
- Add rate limits and request auditing.

---

### 4) Unsafe default configuration and weak startup validation

High risk.

Evidence:
- [backend/server.py](backend/server.py) provides default MongoDB values:
  - `MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")`
  - `DB_NAME = os.getenv("DB_NAME", "test_database")`
- Secrets are optional environment values and the app continues booting without validating readiness.

Why this matters:
- Local defaults can silently deploy insecurely.
- If environment variables are missing, the system may run in an unintended mode and fail later in production.
- The system does not fail fast at startup when critical configuration is absent.

Recommended fix:
- Validate required environment variables at startup.
- Refuse to boot when production settings are incomplete.
- Use separate config for development, staging, and production.

---

### 5) Frontend exposes API keys at runtime and in generated app files

High risk.

Evidence:
- [frontend/.expo/dev/logs/start.log](frontend/.expo/dev/logs/start.log) logs the live Google Maps key in development output.
- [frontend/.metro-cache](frontend/.metro-cache) contains bundled runtime files with the same environment values.
- [frontend/app.json](frontend/app.json) includes an Android Maps key.
- [frontend/app/rider/request.tsx](frontend/app/rider/request.tsx) fetches Google Maps Geocoding directly from the client using an embedded key.

Why this matters:
- Client-side keys are inherently more exposed than backend-only keys.
- Exposed keys are easy to copy from a built app or public bundle.
- This can lead to quota exhaustion, unexpected API charges, and unauthorized use.

Recommended fix:
- Remove keys from native app config and client bundles.
- Use backend API proxies for Google Maps wrappers.
- Keep public keys only where the platform requires them, and use restrictive usage rules.

---

### 6) Dependency vulnerabilities in frontend packages

High risk / current evidence from package audit.

Evidence:
- `npm audit --audit-level=low --json` returned exit code 1.
- Summary from the run: 38 vulnerabilities total.
- Breakdown: 1 critical, 10 high, 26 moderate, 1 low.

The vulnerable surface is broad and includes Expo tooling packages and dependency graphs that are likely used in app builds and packaging.

Why this matters:
- These vulnerabilities can affect local development, build pipelines, and production app delivery.
- Exposed toolchain issues can create supply-chain or build-time compromise paths.

Recommended fix:
- Upgrade Expo and related tooling to patched versions.
- Run `npm audit fix` or a controlled dependency update plan.
- Review lockfile changes and verify that the app still builds after upgrades.
- Consider pinning or auditing transitive dependencies used in production builds.

---

### 7) Local developer artifacts and generated build caches may leak environment values

Medium risk.

Evidence:
- [frontend/.expo](frontend/.expo) and [frontend/.metro-cache](frontend/.metro-cache) contain generated runtime artifacts.
- These folders have been used to cache environment variables and app config.

Why this matters:
- Build artifacts can preserve secrets even after the source files are cleaned up.
- Secret leakage often occurs through logs, cache folders, and temporary files.

Recommended fix:
- Add cache cleanup to CI/developer flow.
- Remove generated artifacts from version control or exclude them aggressively.
- Rotate any secrets found in cached output.

---

## Observed Positive Notes

- The backend syntax check succeeded: there is no immediate Python compile-time breakage in [backend/server.py](backend/server.py).
- The repository root [.gitignore](.gitignore) includes `.env` entries, which is helpful, but the secret-bearing files were still present in the working tree and are therefore not sufficient as a protection measure.

## Recommended Remediation Order

1. Rotate all leaked keys and secrets immediately.
2. Remove secrets from repo-tracked files and generated caches.
3. Enforce authentication and authorization on all protected routes.
4. Replace wildcard CORS with an explicit allowlist.
5. Move Google Maps and PayPal calls behind backend-only proxies.
6. Upgrade dependency tree and address the npm audit findings.
7. Add startup validation and environment separation for dev/staging/prod.

## Conclusion

The project has a clear security and configuration gap. The most urgent action is to rotate and remove live secrets, then lock down API access with real authentication and safe CORS settings. The dependency audit also indicates the frontend toolchain should be updated before it is used in a production build pipeline.
