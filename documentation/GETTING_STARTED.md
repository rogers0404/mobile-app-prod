# Getting started

## Run locally

Use Python 3 with a virtual environment, MongoDB, and a Node.js version supported by the frontend lockfile. Node 22.13+ within the 22.x series or Node 24.3+ within the 24.x series satisfies the locked Expo and React Native requirements. The project declares npm 11.6.1.

From the repository root, set up the backend in one terminal.

```sh
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp -n .env.example .env
```

Start MongoDB or use a development MongoDB instance. Configure `MONGO_URL` and `DB_NAME` in [the backend environment file](../backend/.env.example). Add `GOOGLE_MAPS_API_KEY` for Places and Directions, and `PAYPAL_CLIENT_ID` and `PAYPAL_SECRET` for sandbox payments. Keep actual values in `backend/.env`.

```sh
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Check the server at `http://localhost:8001/api/health`. FastAPI serves interactive API documentation at `http://localhost:8001/docs`.

Start the app in a second terminal from the repository root.

```sh
cd frontend
npm ci
cp -n .env.example .env.local
```

Configure `EXPO_PUBLIC_BACKEND_URL` in `frontend/.env.local`. Use `http://localhost:8001` for web or an iOS simulator, `http://10.0.2.2:8001` for the standard Android emulator, or `http://<computer-lan-ip>:8001` for a device on the same network. Set the platform keys required for your test using the [frontend environment template](../frontend/.env.example). Restrict client Maps keys to their applications and APIs, and keep private credentials server-side.

```sh
npm start
```

Press `w` for web, `i` for an iOS simulator, or `a` for an Android emulator. For the profile flow on local FastAPI, use **Create New**. See [existing-user selection](BUGS.md#existing-user-selection) for the API gap.

## Verify the main flows

- Create test rider and driver profiles. Where the role-listing endpoint is available, reopen the app, select an existing profile, and confirm that it opens the correct dashboard.
- In the rider request screen, allow location access or choose pickup manually. Search for pickup and drop-off, select suggestions, and check the loading indicators, addresses, and coordinates. Try a query that returns no results.
- Submit a ride with a valid rider. With a verified test driver online, accept the ride, progress it through pickup and completion, and check both trip histories. Reopen the rider dashboard with no active ride and check that it returns to its idle state.
- Use PayPal sandbox credentials for payment checks. Run `npm run lint` and `npx tsc --noEmit` from `frontend/` for frontend checks.

## Deploy the two-stack AWS backend

Follow the [AWS deployment guide](../aws-deployment/GETTING_STARTED.md) to deploy or update CloudFormation and Lambda, configure the frontend stage URL, and run smoke checks.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| App cannot reach FastAPI | Visit `/api/health` on port 8001, confirm the frontend URL, and check host or device network reachability. |
| Profiles or rides fail to persist | Check the MongoDB connection URI, database name, and network access. |
| Map renders but place details fail | Check the backend Maps key separately from the map-rendering key. Verify enabled APIs, restrictions, and billing in the target environment. |
| Payment order creation fails | Check that the PayPal credentials match the sandbox environment and review backend logs. |
| Existing profiles fail to load | See the [known routing gap](BUGS.md#existing-user-selection). |
