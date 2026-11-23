# Root Cause Analysis: Location Search Broken

**CRITICAL ISSUE FOUND:** 🔴

## The Problem

```
Google Maps API Key: AIzaSyB5hxVJTIHLbLknEzoG2rv3JZdjwiCWj58
Status: EXPIRED ❌
```

---

## Evidence

### Direct API Test
```bash
curl "https://maps.googleapis.com/maps/api/place/details/json?place_id=ChIJ4zGFAZpYwokRGUGph3Mf37k&key=AIzaSyB5hxVJTIHLbLknEzoG2rv3JZdjwiCWj58"

Response:
{
  "error_message": "The provided API key is expired.",
  "status": "REQUEST_DENIED"
}
```

### Why This Breaks Location Search
```
User Flow:
1. User types "Central" → searchPlaces() calls /api/places/search
   ✅ This works because it uses Google Places Autocomplete (different API)
   
2. User taps result → selectPlace() calls /api/places/details  
   ❌ This FAILS because API key is expired
   
3. App cannot get coordinates → Cannot calculate fare
   ❌ Ride request flow blocked
```

---

## Impact

| Endpoint | Google API Used | Status | Why |
|----------|-----------------|--------|-----|
| `/api/places/search` | Places Autocomplete | ✅ Works | Different endpoint, might be cached/working |
| `/api/places/details` | Places Details | ❌ FAILS | API key expired |
| `/api/directions` | Directions | ❌ FAILS | API key expired |
| `/api/geocode` | Geocoding | ❌ FAILS | API key expired |

**Result:** Users can search but cannot select locations → Ride request broken

---

## Solution

### 1. IMMEDIATE FIX: Get New/Valid API Key

**Steps:**
1. Go to Google Cloud Console: https://console.cloud.google.com
2. Project → Find the ride-share project
3. APIs & Services → Credentials
4. Create new API key OR reactivate existing key
5. Update frontend `.env.local`:
   ```
   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=<NEW_KEY>
   GOOGLE_MAPS_ANDROID_API_KEY=<NEW_KEY>
   GOOGLE_MAPS_IOS_API_KEY=<NEW_KEY>
   ```
6. Update backend `.env`:
   ```
   GOOGLE_MAPS_API_KEY=<NEW_KEY>
   ```
7. Restart both frontend and backend
8. Test location search again

### 2. VERIFY KEY PERMISSIONS

Ensure the new API key has these APIs enabled:
- ✅ Places API
- ✅ Maps JavaScript API
- ✅ Geocoding API
- ✅ Directions API

### 3. SET UP BILLING ALERTS

Google Maps API requires active billing. Set up:
- Alert when usage exceeds X requests/month
- Monitor for unexpected charges

---

## Verification Steps

### After Getting New Key

```bash
# Test Places Search
curl "https://maps.googleapis.com/maps/api/place/autocomplete/json?input=Central&key=<NEW_KEY>"
# Should return: {"predictions": [...]}

# Test Places Details  
curl "https://maps.googleapis.com/maps/api/place/details/json?place_id=ChIJ4zGFAZpYwokRGUGph3Mf37k&key=<NEW_KEY>"
# Should return: {"result": {"geometry": {"location": {...}}}}

# Test Backend Endpoint
curl "https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/api/places/details?place_id=ChIJ4zGFAZpYwokRGUGph3Mf37k"
# Should return: {"lat": ..., "lng": ..., "address": ...}
```

### Test in Frontend

1. Open app
2. Go to Rider → Request Ride
3. Type location in dropoff field
4. ✅ See results
5. Tap result → ✅ Should populate address and show fare

---

## Why This Happened

Possible causes:
1. ❌ API key reached usage limit
2. ❌ API key billing card expired
3. ❌ API key was deleted/revoked
4. ❌ GCP project billing was disabled
5. ❌ API key hasn't been used in 90+ days (auto-revoked)

---

## Timeline

**What Works:**
- Places Autocomplete (search) - returns cached results or uses different tier
- Backend is running
- AWS API Gateway is working
- Frontend requests are going through

**What's Broken:**
- Places Details API - returns "REQUEST_DENIED"
- Directions API - returns "REQUEST_DENIED"  
- Geocoding API - returns "REQUEST_DENIED"
- **All calls to Google APIs that require an active, valid key**

---

## Action Required

🔴 **URGENT:** Obtain new/valid Google Maps API key within **24 hours**  
🟡 **IMPORTANT:** Test all location search functionality after key update  
🟡 **RECOMMENDED:** Set up API key monitoring/alerts

---

## Configuration Files to Update

1. **Frontend:** `/frontend/.env.local`
   ```
   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=<NEW_KEY>
   GOOGLE_MAPS_ANDROID_API_KEY=<NEW_KEY>
   GOOGLE_MAPS_IOS_API_KEY=<NEW_KEY>
   ```

2. **Backend:** `/.env` (if separate from frontend)
   ```
   GOOGLE_MAPS_API_KEY=<NEW_KEY>
   ```

3. **AWS Lambda Environment Variables** (if used)
   - Update in AWS Console → Lambda → Environment Variables
   - Or redeploy with new key in environment

---

## Sign-Off

**Root Cause:** Expired Google Maps API key  
**Severity:** 🔴 CRITICAL - Blocks core functionality  
**Fix Time:** 5-15 minutes (once new key obtained)  
**Testing:** 10 minutes  
**Total:** 15-30 minutes to restore functionality

**Status:** Waiting for new API key
