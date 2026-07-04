# Trip - Ride Share App PRD

## Product Overview
Trip is a ride-sharing mobile app (compatible with Android, iOS, and web) similar to Uber/Lyft. It supports two user roles: **Rider** and **Driver**.

## Tech Stack
- **Frontend**: React Native (Expo 54), Expo Router, Zustand, TypeScript
- **Backend**: FastAPI (Python), MongoDB (Motor async driver)
- **Payments**: PayPal Sandbox
- **Maps**: Google Maps API (native only, placeholder on web)

## Architecture
```
/app
├── backend/
│   ├── server.py        # FastAPI server with all endpoints + WebSocket
│   └── .env             # MONGO_URL, DB_NAME
├── frontend/
│   ├── app/
│   │   ├── index.tsx           # Entry: route by stored user type
│   │   ├── select-type.tsx     # Role selection (Rider/Driver)
│   │   ├── _layout.tsx         # Root Stack navigator
│   │   ├── rider/              # Rider screens (home, request, tracking, payment, history, profile)
│   │   └── driver/             # Driver screens (home, ride, documents, history, profile)
│   ├── src/
│   │   ├── store/              # Zustand stores (userStore, rideStore, driverStore)
│   │   ├── components/         # Shared components (MapPlaceholder, LoadingScreen)
│   │   └── utils/              # API utilities
│   └── .env                    # EXPO_PUBLIC_BACKEND_URL
```

## Authentication
- **No authentication** - Users select a role (Rider/Driver), which creates a user on the backend
- User ID stored in AsyncStorage for session persistence

## Core Features Implemented
### Backend (✅ Complete)
- User creation & profile management
- Driver document upload & auto-verification
- Driver status (online/offline) & location tracking
- Ride lifecycle: request → accept → picked_up → completed/cancelled
- Nearby driver search
- Ride history & rating
- PayPal payment order creation
- WebSocket for real-time location updates

### Frontend (✅ Stabilized)
- Role selection screen
- Rider: Home, Request Ride, Tracking, Payment, History, Profile
- Driver: Home, Documents Upload, Active Ride, History, Profile
- Map placeholder for web (react-native-maps not supported on web)

## What Was Fixed (Phase 1 - March 15, 2026)
- Completed frontend refactor to remove old auth system
- Fixed payment screen to use user_id instead of session_token
- Fixed Expo Router "stale" navigation error using useRootNavigationState
- Cleaned up unused auth utilities
- Removed leftover (tabs) directory

## What Was Implemented (Phase 2 - Maps & Radar)
- Replaced MapPlaceholder with interactive Google Maps on all screens (rider home, request ride, tracking, driver home, driver ride)
- Created platform-specific InteractiveMap component (web: Google Maps JS API via iframe, native: react-native-maps fallback)
- Maps support markers (pickup/dropoff), route display, and zoom control
- Added RadarSearch animation component for "looking for a driver" state
- When ride status is "pending", tracking screen shows animated radar pulse instead of map
- All screens now use real device geolocation via browser navigator.geolocation API on web
- Request ride screen reverse-geocodes device location via Google Maps Geocoding API for pickup address
- Removed all hardcoded San Francisco default coordinates

## What Was Implemented (Phase 3 - Ride Flow & Real-time Tracking)
- Backend: Added Google Places proxy API (`/api/places/search`, `/api/places/details`) to avoid CORS issues
- Frontend: Request ride screen uses backend proxy for place autocomplete search
- Tracking screen: Shows radar animation when "pending", transitions to interactive map with route when "accepted"
- Real-time driver tracking: Rider connects via WebSocket, receives driver location updates, shows moving blue marker on map
- Driver broadcasts location via WebSocket every 5 seconds when online
- Tracking screen shows driver info (name, vehicle, license plate) when ride is accepted
- "LIVE" indicator shows when WebSocket is actively receiving driver position updates
- Full ride lifecycle tested: request → accept → picked_up → completed → rate (26/26 backend tests pass)

## What Was Implemented (In-app Notifications + Phase 4 - PayPal)
- In-app notification banner: Animated slide-down banners for ride status changes
  - Rider gets: "Driver Found!", "Ride Started", "Ride Completed", "Ride Cancelled"
  - Driver gets: "New Ride Request" when a nearby rider requests a ride
- NotificationBanner component with auto-dismiss after 4 seconds, dismissable by tap
- Notification store (Zustand) for triggering notifications from anywhere in the app
- PayPal payment: Full E2E working (sandbox) - create order, approval URL, capture
- Payment screen shows ride summary, fare breakdown, "Pay with PayPal" button
- Backend: 17/17 tests passed including PayPal error cases (already paid, wrong user, missing ride)

## What Was Implemented (Profile Management & Delete Account)
- Backend: PUT /api/users/{user_id} for updating name, phone, email (partial updates supported)
- Backend: DELETE /api/users/{user_id} with cascade deletion (driver docs, status, location)
- Delete blocked if user has active ride (returns 400 with clear message)
- Rider profile: View mode with stats, menu items; Edit mode with name/phone/email form
- Driver profile: View mode with vehicle info, verified badge, online status; Edit mode
- Both profiles: "Switch Role" and "Delete Account" buttons with confirmation dialogs
- Backend: 27/27 tests passed (profile update, cascade delete, blocked by active ride, error cases)

## What Was Implemented (UI/UX Polish & Driver Earnings)
- FadeInView component: Staggered entrance animations with configurable delay/duration
- Skeleton loading component: Shimmer loading placeholders for smooth loading states
- Role selection screen: Cards now animate in with staggered delays (header → rider card → driver card)
- Earnings dashboard skeleton: Shimmer placeholders while earnings data loads
- Driver Earnings Dashboard (new screen):
  - Total earnings hero card (blue gradient, ride count)
  - Period selector: Today / Week / Month tabs
  - Period summary: Earnings amount + ride count
  - 7-day bar chart showing daily earnings
  - Recent rides list with fare, destination, date
- "Earnings" quick action added to driver home screen
- Backend: GET /api/driver/{user_id}/earnings with timezone-safe datetime handling
- Backend: 34/34 tests passed (earnings with data, empty earnings, error cases, profile CRUD)

## API Credentials
- **PayPal**: Sandbox credentials configured
- **Google Maps**: API key configured

## Upcoming Tasks (P1)
- UI/UX: Replace remaining shadow* props with boxShadow for web compatibility
- Native push notifications (expo-notifications for app builds)

## Future Tasks (P2-P3)
- Trip receipts (downloadable fare breakdown with map)
- Ride history filters and search
- Surge pricing
- Multi-stop rides
- Driver rating system improvements
