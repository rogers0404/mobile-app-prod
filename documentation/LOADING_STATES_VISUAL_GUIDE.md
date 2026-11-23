# Pickup & Dropoff Loading States - Visual Guide

## Screen State Progression

### 1️⃣ Initial Mount - Getting Location

```
┌─────────────────────────────────────────┐
│          Request Ride Screen            │
├─────────────────────────────────────────┤
│                                         │
│  🟢 📍  ⏳ Getting your location...     │
│                                         │
│  🔴 🚩  [Where to?]                    │
│                                         │
│         [Confirm Ride] (disabled)      │
│                                         │
└─────────────────────────────────────────┘

State: initialLocationLoading = true
UI: Spinner in pickup field
Interaction: Disabled
```

### 2️⃣ Location Loaded - Ready for Dropoff

```
┌─────────────────────────────────────────┐
│          Request Ride Screen            │
├─────────────────────────────────────────┤
│                                         │
│  🟢 📍  123 Main St, New York         │
│                                         │
│  🔴 🚩  [Where to?]                    │
│                                         │
│         [Confirm Ride] (disabled)      │
│                                         │
└─────────────────────────────────────────┘

State: initialLocationLoading = false
UI: Pickup address populated
Interaction: Can type dropoff
```

### 3️⃣ User Typing Dropoff - Searching

```
┌─────────────────────────────────────────┐
│          Request Ride Screen            │
├─────────────────────────────────────────┤
│                                         │
│  🟢 📍  123 Main St, New York         │
│                                         │
│  🔴 🚩  [Central P...]                 │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  ⏳ Searching places...         │   │
│  └─────────────────────────────────┘   │
│                                         │
│         [Confirm Ride] (disabled)      │
│                                         │
└─────────────────────────────────────────┘

State: searching = true
UI: Spinner in search results
Interaction: Results hidden
```

### 4️⃣ Results Loaded - Ready to Select

```
┌─────────────────────────────────────────┐
│          Request Ride Screen            │
├─────────────────────────────────────────┤
│                                         │
│  🟢 📍  123 Main St, New York         │
│                                         │
│  🔴 🚩  [Central P...]                 │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 📍 Central Park, NY              │   │
│  │ 📍 Central Terminal, NY          │   │
│  └─────────────────────────────────┘   │
│                                         │
│         [Confirm Ride] (disabled)      │
│                                         │
└─────────────────────────────────────────┘

State: searching = false, searchResults = [...]
UI: Results displayed
Interaction: Can tap to select
```

### 5️⃣ Place Selected - Loading Details

```
┌─────────────────────────────────────────┐
│          Request Ride Screen            │
├─────────────────────────────────────────┤
│                                         │
│  🟢 📍  123 Main St, New York         │
│                                         │
│  🔴 🚩  ⏳ Loading location...         │
│                                         │
│         Distance: 2.5 miles            │
│         Estimated Fare: $5.75          │
│                                         │
│         [Confirm Ride] (disabled)      │
│                                         │
└─────────────────────────────────────────┘

State: selectingPlace = true
UI: Spinner in dropoff field
Interaction: Disabled during load
```

### 6️⃣ Both Locations Set - Ready to Confirm

```
┌─────────────────────────────────────────┐
│          Request Ride Screen            │
├─────────────────────────────────────────┤
│                                         │
│  🟢 📍  123 Main St, New York         │
│                                         │
│  🔴 🚩  Central Park, New York        │
│                                         │
│         Distance: 2.5 miles            │
│         Estimated Fare: $5.75          │
│                                         │
│         [Confirm Ride - $5.75] (enabled)│
│                                         │
└─────────────────────────────────────────┘

State: selectingPlace = false
UI: Both addresses shown, fare calculated
Interaction: Can confirm ride
```

### 7️⃣ Confirming Ride - Submitting

```
┌─────────────────────────────────────────┐
│          Request Ride Screen            │
├─────────────────────────────────────────┤
│                                         │
│  🟢 📍  123 Main St, New York         │
│                                         │
│  🔴 🚩  Central Park, New York        │
│                                         │
│         Distance: 2.5 miles            │
│         Estimated Fare: $5.75          │
│                                         │
│         [⏳] (disabled, loading)        │
│                                         │
└─────────────────────────────────────────┘

State: isLoading = true (from rideStore)
UI: Confirm button spinner
Interaction: All disabled
```

### 8️⃣ Ride Created - Navigation

```
┌─────────────────────────────────────────┐
│          Tracking Ride Screen           │
├─────────────────────────────────────────┤
│                                         │
│            🗺️  [MAP]                   │
│                                         │
│  Ride ID: ride_12345                   │
│  Status: Looking for driver...         │
│                                         │
│  Pickup: 123 Main St, New York        │
│  Dropoff: Central Park, New York      │
│                                         │
│         [Cancel Ride]                  │
│                                         │
└─────────────────────────────────────────┘

State: activeRide populated
UI: Navigated to tracking screen
Next: Waiting for driver acceptance
```

## State Transitions Diagram

```
┌─────────────┐
│   MOUNT     │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│ INITIAL LOCATION    │
│ LOADING             │
│ (1-3 seconds)       │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ LOCATION LOADED     │
│ Ready for Dropoff   │
└──────┬──────────────┘
       │
       ├─► User types ▼
┌─────────────────────┐
│ PLACE SEARCH        │
│ LOADING             │
│ (0.5-2 seconds)     │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ RESULTS DISPLAYED   │
│ User selects place  │
└──────┬──────────────┘
       │
       ├─► User taps ▼
┌─────────────────────┐
│ PLACE SELECTION     │
│ LOADING             │
│ (0.3-1 second)      │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ LOCATIONS SET       │
│ Ready to confirm    │
└──────┬──────────────┘
       │
       ├─► User confirms ▼
┌─────────────────────┐
│ RIDE REQUEST        │
│ LOADING             │
│ (1-3 seconds)       │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ RIDE CREATED        │
│ Navigate to         │
│ Tracking Screen     │
└─────────────────────┘
```

## Error Scenarios

### ❌ Location Permission Denied

```
┌─────────────────────────────────────────┐
│          Request Ride Screen            │
├─────────────────────────────────────────┤
│                                         │
│  🟢 📍  [--:--:-- --:--:--, -]         │
│         (or allow to enter manually)    │
│                                         │
│  🔴 🚩  [Where to?]                    │
│                                         │
│         [Confirm Ride] (disabled)      │
│                                         │
└─────────────────────────────────────────┘

State: initialLocationLoading = false
Error: Location permission denied
Recovery: User can type address manually
```

### ❌ Place Search Failed

```
┌─────────────────────────────────────────┐
│          Request Ride Screen            │
├─────────────────────────────────────────┤
│                                         │
│  🟢 📍  123 Main St, New York         │
│                                         │
│  🔴 🚩  [Central P...]                 │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │   (no results to show)           │   │
│  └─────────────────────────────────┘   │
│                                         │
│         [Confirm Ride] (disabled)      │
│                                         │
└─────────────────────────────────────────┘

State: searching = false
Error: Search failed or no results
Recovery: User can refine query and retry
```

### ❌ Place Details Failed

```
┌─────────────────────────────────────────┐
│          Request Ride Screen            │
├─────────────────────────────────────────┤
│                                         │
│  🟢 📍  123 Main St, New York         │
│                                         │
│  🔴 🚩  [Central P...]                 │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 📍 Central Park, NY              │   │
│  │ 📍 Central Terminal, NY          │   │
│  └─────────────────────────────────┘   │
│                                         │
│         [Confirm Ride] (disabled)      │
│                                         │
└─────────────────────────────────────────┘

State: selectingPlace = false (error cleared)
Error: Details fetch failed
Recovery: User can try another result
```

### ❌ Ride Request Failed

```
┌─────────────────────────────────────────┐
│          Request Ride Screen            │
├─────────────────────────────────────────┤
│                                         │
│  ⚠️ Error: Failed to request ride      │
│                                         │
│  🟢 📍  123 Main St, New York         │
│                                         │
│  🔴 🚩  Central Park, New York        │
│                                         │
│         Distance: 2.5 miles            │
│         Estimated Fare: $5.75          │
│                                         │
│         [Confirm Ride - $5.75] (enabled)│
│                                         │
└─────────────────────────────────────────┘

State: isLoading = false (after error)
Error: Ride request failed
Recovery: User can retry by tapping Confirm again
```

## Loading State Checklist

### ✅ Initial Location
- [ ] Shows spinner on mount
- [ ] Shows "Getting your location..." text
- [ ] Pickup field is disabled
- [ ] Clears when location resolves
- [ ] Clears when permission denied

### ✅ Place Search
- [ ] Shows spinner after 3+ characters typed
- [ ] Shows "Searching places..." text
- [ ] Hides results while loading
- [ ] Displays results when complete
- [ ] Clears on error

### ✅ Place Selection  
- [ ] Shows spinner when selecting place
- [ ] Shows "Loading location..." text
- [ ] Dropoff field is disabled
- [ ] Populates address when complete
- [ ] Shows fare calculation
- [ ] Clears on error

### ✅ Ride Confirmation
- [ ] Shows spinner on button
- [ ] Button is disabled
- [ ] Text is hidden
- [ ] Clears after success
- [ ] Shows alert on error
- [ ] Can retry after error

## Performance Targets

| Operation | Target Time | Acceptable | Warn |
|-----------|-----------|-----------|------|
| Initial Location | 1-2 sec | < 5 sec | > 5 sec |
| Place Search | 0.5-1 sec | < 2 sec | > 2 sec |
| Place Details | 0.3-0.5 sec | < 1 sec | > 1 sec |
| Ride Request | 1-2 sec | < 5 sec | > 5 sec |

