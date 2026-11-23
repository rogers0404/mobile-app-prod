# Bug Report: Ride Request Location Search Not Working

**Status:** 🔴 CRITICAL - Location search interface broken  
**Date:** 2026-11-21  
**Affected Component:** Ride Request Screen (Pickup/Dropoff Location Search)

---

## Issues Found

### Issue 1: ❌ Places Search Response Format Mismatch
**Severity:** HIGH  
**Component:** Frontend & Backend API

**Problem:**
- Backend returns full Google Places Autocomplete response (100+ fields)
- Frontend expects simplified format with only `description` and `place_id`
- Frontend code: `interface LocationResult { description: string; place_id: string; }`

**What Happens:**
```
API Returns: {
  "description": "Central Park, New York, NY, USA",
  "place_id": "ChIJ4zGFAZpYwokRGUGph3Mf37k",
  "matched_substrings": [...],
  "structured_formatting": {...},
  "terms": [...],
  "types": [...]
}

Frontend Expects: {
  "description": "Central Park, New York, NY, USA",
  "place_id": "ChIJ4zGFAZpYwokRGUGph3Mf37k"
}
```

**Current Behavior:** 
✅ Works but sends unnecessary data (inefficient)

---

### Issue 2: ❌ Place Details Endpoint Returns 404
**Severity:** CRITICAL  
**Component:** Backend API (`/api/places/details`)

**Problem:**
- Endpoint fails with "Place not found" for valid Google place IDs
- When user taps a search result, the app crashes trying to get coordinates

**Test Result:**
```bash
$ curl "https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/api/places/details?place_id=ChIJ4zGFAZpYwokRGUGph3Mf37k"
{"error": "Place not found"}
Status: 404
```

**Root Cause:**
- Google Places Details API might be misconfigured
- API key might not have Places API enabled
- Request parameters might be wrong

**Impact:**
- 🔴 Users CANNOT select a dropoff location
- 🔴 Ride request flow is completely broken
- 🔴 App will crash/show error when trying to get place details

---

### Issue 3: ❌ Ride Request Requires Existing User
**Severity:** MEDIUM  
**Component:** Backend API (`/api/rides/request`)

**Problem:**
- Endpoint returns 404 "User not found" if user doesn't exist in database
- New users cannot create rides without being created first

**Current Behavior:**
```bash
$ curl -X POST "https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/api/rides/request" \
  -d '{"user_id": "new_user_123", ...}'
{"error": "User not found"}
Status: 404
```

**Expected Behavior:**
- Either auto-create user or return better error message
- Or require user to be created first (should be documented)

**Impact:**
- 🟡 New users get confusing error messages
- 🟡 Need to create user account before testing rides

---

## Why Location Search Isn't Working

```
User Flow:
1. App opens → Location search screen loads
2. User types "Central" → searchPlaces() API called
3. ✅ API returns results (works)
4. User taps "Central Park" → selectPlace() called
5. ❌ API returns 404 "Place not found" (BROKEN)
6. ❌ App cannot get coordinates
7. ❌ User cannot confirm ride
```

---

## Detailed Impact

| Feature | Status | Impact |
|---------|--------|--------|
| Search locations | ✅ Works | Shows search results |
| Select location | ❌ Broken | App crashes/shows error when tapping result |
| Get coordinates | ❌ Broken | Cannot calculate distance or fare |
| Confirm ride | ❌ Blocked | Cannot create ride without location |
| **Overall** | 🔴 **NOT FUNCTIONAL** | Users cannot request rides |

---

## Testing Evidence

### ✅ Place Search Works
```
curl "https://...production/api/places/search?query=Central"
Status: 200
Returns: Array of 5+ results with description and place_id
```

### ❌ Place Details Broken
```
curl "https://...production/api/places/details?place_id=ChIJ4zGFAZpYwokRGUGph3Mf37k"
Status: 404
Error: "Place not found"
```

### ❌ Ride Request Broken  
```
curl -X POST "https://...production/api/rides/request" -d '{"user_id": "test_123", ...}'
Status: 404
Error: "User not found"
```

---

## Recommended Fixes

### Fix 1: Optimize Places Search Response (OPTIONAL)
**Priority:** LOW  
**Effort:** 5 minutes

Backend should return only needed fields:
```python
# Instead of:
return data.get("predictions", [])  # Returns full response

# Should be:
return [{
    "place_id": p["place_id"],
    "description": p["description"]
} for p in data.get("predictions", [])]
```

**Benefit:** Reduce network payload size (100+ fields → 2 fields)

---

### Fix 2: Repair Places Details Endpoint (URGENT)
**Priority:** CRITICAL  
**Effort:** 15 minutes

**Steps:**
1. Verify Google Places API key has "Places API" enabled in GCP Console
2. Test endpoint with curl using valid place_id from search results
3. Check if API credentials have enough quota
4. Debug Google API response (might be returning error)
5. Verify backend error handling

**Current Code Issue:**
```python
# Backend is checking:
if data.get("result"):  # Google API might not return "result" key
    # Process result
else:
    return 404 "Place not found"
```

**Check Google's actual response structure**

---

### Fix 3: Create User Before Ride (SHORT TERM)
**Priority:** MEDIUM  
**Effort:** 5 minutes

Add user creation endpoint call before ride request:
```typescript
// Before calling requestRide:
await fetch(`${API_URL}/api/users`, {
  method: 'POST',
  body: JSON.stringify({
    user_id: userId,
    user_type: 'rider',
    name: 'User'
  })
});
```

---

## Questions for Backend Team

1. **Is Google Places Details API working?**
   - Test: `curl "https://maps.googleapis.com/maps/api/place/details/json?place_id=ChIJ4zGFAZpYwokRGUGph3Mf37k&key=YOUR_KEY"`
   - What response do you get?

2. **Is the API key enabled for Places Details?**
   - Check GCP Console → APIs & Services → Credentials
   - Verify Places API is enabled
   - Check if key has restrictions

3. **What's the actual error from Google?**
   - Add logging to show Google's full response
   - Is it auth error? Not found? Invalid request?

4. **Should user exist before ride request?**
   - If yes, document the flow
   - If no, auto-create user in ride request endpoint

---

## How to Reproduce

```
1. Open app
2. Go to Rider → Request Ride
3. See pickup location auto-filled (or enter manual)
4. Tap dropoff field
5. Type "Central"
6. See search results
7. TAP ANY RESULT
8. ❌ See error "Place not found" 
9. ❌ Cannot proceed
```

---

## Blockers

🔴 **CRITICAL BLOCKER:** Users cannot select dropoff location  
🔴 **CRITICAL BLOCKER:** App cannot calculate fare/distance  
🔴 **CRITICAL BLOCKER:** Ride request flow is non-functional  

---

## Next Steps

1. **Backend Team:** Debug `GET /api/places/details` endpoint
   - Check API key configuration
   - Test with valid place_id
   - Add logging to see actual Google response
   
2. **Frontend Team:** Add error logging
   - Show exact error from API
   - Don't swallow errors silently
   
3. **QA:** Test with real place IDs from search results
   - Don't use hardcoded IDs

---

## Sign-Off

**Identified:** 2026-11-21 21:23  
**Status:** Awaiting backend fix for `/api/places/details`  
**Blockers:** Yes - Users cannot complete ride requests
