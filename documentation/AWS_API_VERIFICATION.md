# AWS API Verification for Loading States

## API Configuration

**Base URL:** `https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production`

**Region:** `us-east-1`

**API Gateway:** AWS Lambda + API Gateway (Serverless)

## Endpoints Verification

### 1. Place Search Endpoint

**Endpoint:** `GET /api/places/search`

**Called During:** Place search loading state (`searching = true`)

**Parameters:**
- `query` (required) - Search query string (min 3 chars)
- `latitude` (optional) - User's current latitude for proximity
- `longitude` (optional) - User's current longitude for proximity

**Expected Response:**
```json
[
  {
    "place_id": "string",
    "description": "Full place description"
  },
  ...
]
```

**Loading State:**
- Triggered when user types 3+ characters in dropoff field
- Sets `searching = true`
- Shows "Searching places..." spinner
- Clears `searching = false` on success/error

**Code Reference:**
- Frontend: `frontend/app/rider/request.tsx:149-152` (searchPlaces function)
- Backend: `backend/server.py` (search handler)

---

### 2. Place Details Endpoint

**Endpoint:** `GET /api/places/details`

**Called During:** Place selection loading state (`selectingPlace = true`)

**Parameters:**
- `place_id` (required) - Place ID from search results

**Expected Response:**
```json
{
  "lat": number,
  "lng": number,
  "description": "string"
}
```

**Loading State:**
- Triggered when user taps a search result
- Sets `selectingPlace = true`
- Shows "Loading location..." spinner in dropoff field
- Populates dropoff address and coordinates on success
- Clears `selectingPlace = false` after (success or error)

**Code Reference:**
- Frontend: `frontend/app/rider/request.tsx:169-181` (selectPlace function)
- Backend: `backend/server.py` (details handler)

---

### 3. Ride Request Endpoint

**Endpoint:** `POST /api/rides/request`

**Called During:** Ride confirmation loading state (`isLoading = true`)

**Parameters (JSON Body):**
```json
{
  "user_id": "string",
  "pickup_latitude": number,
  "pickup_longitude": number,
  "pickup_address": "string",
  "dropoff_latitude": number,
  "dropoff_longitude": number,
  "dropoff_address": "string"
}
```

**Expected Response:**
```json
{
  "ride_id": "string",
  "rider_id": "string",
  "pickup_latitude": number,
  "pickup_longitude": number,
  "pickup_address": "string",
  "dropoff_latitude": number,
  "dropoff_longitude": number,
  "dropoff_address": "string",
  "distance_miles": number,
  "fare": number,
  "status": "pending",
  "payment_status": "unpaid",
  "created_at": "ISO8601 timestamp"
}
```

**Loading State:**
- Triggered when user taps "Confirm Ride" button
- Sets `isLoading = true` (from rideStore)
- Shows spinner on confirm button
- Disables button and all location fields
- Navigates to `/rider/tracking` on success
- Shows error alert on failure, allowing retry

**Code Reference:**
- Frontend: `frontend/src/store/rideStore.ts:140-181` (requestRide function)
- Backend: `backend/server.py` (ride request handler)

---

## AWS API Gateway Configuration

### CORS Configuration
```
Allow Origins: *
Allow Methods: GET, POST, OPTIONS
Allow Headers: Content-Type, Authorization
```

### Request/Response Times
- **Place Search:** 500-1500ms
- **Place Details:** 300-800ms  
- **Ride Request:** 1000-3000ms

### Error Handling
- **400 Bad Request:** Invalid parameters
- **401 Unauthorized:** Missing/invalid user_id
- **404 Not Found:** Resource not found
- **500 Server Error:** Backend failure

---

## Testing the API with Loading States

### Test 1: Place Search Loading

```bash
# Simulate user typing "Central"
curl -X GET \
  "https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/api/places/search?query=Central&latitude=40.7128&longitude=-74.0060"

# Expected: Array of place results
# Loading State: Shows "Searching places..." for 0.5-2 seconds
```

### Test 2: Place Details Loading

```bash
# User selects first result (place_id from above)
curl -X GET \
  "https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/api/places/details?place_id=ChIJCfnMrfVYwokRwhZ00pXKkjM"

# Expected: { lat, lng, description }
# Loading State: Shows "Loading location..." for 0.3-1 second
```

### Test 3: Ride Request Loading

```bash
# User confirms ride
curl -X POST \
  "https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/api/rides/request" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_123",
    "pickup_latitude": 40.7128,
    "pickup_longitude": -74.0060,
    "pickup_address": "123 Main St, New York, NY",
    "dropoff_latitude": 40.7489,
    "dropoff_longitude": -73.9680,
    "dropoff_address": "Central Park, New York, NY"
  }'

# Expected: Ride object with ride_id and status = "pending"
# Loading State: Shows spinner for 1-3 seconds, then navigates
```

---

## Network Conditions & Loading States

### Fast Network (3G+)
- Place Search: 500ms → "Searching places..." visible briefly
- Place Details: 300ms → "Loading location..." quick flash
- Ride Request: 1-2 seconds → Loading spinner clearly visible

### Slow Network (Dial-up)
- Place Search: 2000ms → User sees longer loading
- Place Details: 1000ms → More prominent loading state
- Ride Request: 5000ms+ → May hit timeout (15s max)

### No Network
- All requests fail → Loading states clear → Error handling

---

## AWS CloudWatch Metrics for Loading States

### Recommended Metrics to Monitor

1. **Place Search API**
   - Duration percentiles: p50, p95, p99
   - Error rate
   - Throttling events

2. **Place Details API**
   - Duration percentiles: p50, p95, p99
   - Error rate
   - Cache hit rate (if implemented)

3. **Ride Request API**
   - Duration percentiles: p50, p95, p99
   - Error rate
   - Timeout rate

---

## Loading State Performance Targets

| Endpoint | Target | Acceptable | Alert |
|----------|--------|-----------|-------|
| Places Search | 500-1000ms | <2000ms | >2000ms |
| Place Details | 300-500ms | <1000ms | >1000ms |
| Ride Request | 1000-2000ms | <5000ms | >5000ms |

---

## Health Check Implementation

```bash
# Health check endpoint (if available)
curl -X GET \
  "https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/health"

# Expected: { "status": "healthy" }
```

---

## Monitoring Checklist

- [ ] Place Search API responds consistently
- [ ] Place Details API responds consistently
- [ ] Ride Request API responds consistently
- [ ] All endpoints handle errors gracefully
- [ ] No excessive latency causing user frustration
- [ ] Loading states visible for appropriate duration
- [ ] Error messages clear and actionable
- [ ] Timeouts handled properly

---

## Related Files

- Backend: `/backend/server.py` - FastAPI application
- Frontend Config: `/frontend/src/config/env.ts` - API URL configuration
- Loading States: `/frontend/app/rider/request.tsx` - UI implementation
- Store: `/frontend/src/store/rideStore.ts` - Ride state management

