# Select Type Screen Enhancement - Create vs Select User Flow

## Overview
Enhanced the `select-type.tsx` screen to provide users with two options when choosing a rider or driver role:
1. **Create New Account** - Create a brand new user account with a custom name
2. **Select Existing Account** - Choose from existing users in the system

## User Flow

### Initial Screen
User is presented with two role options (Rider/Driver) as before.

### After Selecting Role
A modal appears with two tabs:
- **Select Existing**: Shows a list of existing users of the selected type
- **Create New**: Form to enter name and create new account

### Create New Flow
1. User taps "Create New" tab
2. Enters their name in text input
3. Taps "Create [Role] Account" button
4. API call creates user via `POST /api/users/create`
5. User is navigated to rider or driver home screen
6. User ID and type stored in AsyncStorage

### Select Existing Flow
1. User taps "Select Existing" tab (default)
2. App fetches existing users via `GET /api/users?type=[rider|driver]`
3. Users displayed in a list with:
   - Avatar (icon + color by role)
   - User name
   - User ID
4. User taps a user to select
5. User ID and type stored in AsyncStorage
6. User is navigated to rider or driver home screen

## Implementation Details

### Frontend Changes

#### File: `/frontend/app/select-type.tsx`

**New State Variables:**
- `userTypeModal`: Tracks selected role (rider/driver) or null if closed
- `modalMode`: 'select' (choose existing) or 'create' (new account)
- `existingUsers`: List of ExistingUser objects
- `fetchingUsers`: Loading state for user list
- `newUserName`: Text input value for new user name
- `creatingUser`: Loading state for user creation

**New Functions:**
```typescript
fetchExistingUsers(type): Fetches users from /api/users?type=[type]
handleUserTypeSelect(type): Opens modal and loads user list
handleSelectExistingUser(user): Saves user to AsyncStorage and navigates
handleCreateNewUser(): Validates name, calls createUser(), navigates
handleSelectType(type): Entry point when user clicks rider/driver
```

**New UI Components:**
- Modal overlay for account selection/creation
- Mode toggle buttons (Select Existing / Create New)
- FlatList of existing users with avatars
- Form with name input for creating new users
- Loading states and empty states

**New Styles (~150 lines):**
- Modal header, container, content
- Mode buttons and styling
- User list styles (card, avatar, info)
- Form styles (input, info box, button)

### Backend Changes

#### File: `/backend/server.py`

**New Endpoint:**
```
GET /api/users?type=[optional: rider|driver]
```

**Function: `list_users(type)`**
- Queries MongoDB users collection
- Filters by user_type if provided
- Returns array of users (excluding MongoDB _id)
- Falls back to in_memory_users if MongoDB unavailable

**Returns:**
```json
[
  {
    "user_id": "user_abc123def456",
    "name": "John Doe",
    "user_type": "rider",
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```

## API Endpoints Used

### Existing Endpoints (Updated)
- `POST /api/users/create` - Now supports optional name parameter
  - Already had this, enhanced with modal integration

### New Endpoints
- `GET /api/users?type=[rider|driver]` - List users by type
  - Supports filtering by user type
  - Returns 100 max users
  - Falls back to in-memory if MongoDB down

### Navigation Flow
```
select-type.tsx
  ├─ User clicks Rider/Driver
  │  └─ Opens modal
  │     ├─ Select Existing Tab (default)
  │     │  ├─ Fetch GET /api/users?type=rider
  │     │  ├─ Show user list
  │     │  └─ Select user → Store in AsyncStorage → Navigate to /rider
  │     │
  │     └─ Create New Tab
  │        ├─ Input name
  │        ├─ POST /api/users/create with name
  │        └─ Store in AsyncStorage → Navigate to /rider
```

## Error Handling

### User Fetch Errors
- If fetch fails: Shows alert "Failed to load users"
- Shows empty state: "No users found"
- User can proceed to create new account

### User Creation Errors
- Validates name is not empty
- Shows error alert if API fails
- Preserves loading state until response

### User Selection Errors
- Sets loading state during navigation
- Shows error alert if storage fails
- Closes modal on success

## Testing

### Manual Testing Checklist
1. **Create New User**
   - [ ] Click Rider/Driver role
   - [ ] Modal opens to "Select Existing" tab
   - [ ] Click "Create New" tab
   - [ ] Enter name and create account
   - [ ] Verify user created and navigated to home

2. **Select Existing User**
   - [ ] Create multiple users of same type
   - [ ] Click role to open modal
   - [ ] Verify list shows all users
   - [ ] Click user to select
   - [ ] Verify navigated to home with correct user

3. **Edge Cases**
   - [ ] No existing users → shows empty state
   - [ ] Empty name input → shows validation error
   - [ ] Network error on fetch → shows error alert
   - [ ] Modal close button → returns without selecting

### Unit Tests (Optional)
Could add tests for:
- fetchExistingUsers with network errors
- handleSelectExistingUser with async storage errors
- handleCreateNewUser with validation
- Modal state transitions

## User Experience Improvements

### Benefits
1. **Faster Entry** - Existing users can quickly switch between accounts
2. **Account Management** - See all accounts at a glance
3. **Better Onboarding** - Clear two-step flow for new users
4. **Flexibility** - Create multiple rider/driver accounts as needed

### Visual Design
- Color-coded avatars (blue for rider, orange for driver)
- Clear modal header showing account type
- Responsive layout for different screen sizes
- Loading and empty states for better feedback

## Future Enhancements

1. **Account Deletion** - Add ability to delete accounts from list
2. **Account Details** - Show ride count, rating in list
3. **Search/Filter** - Search users by name if list gets large
4. **Account Switching** - Switch accounts without leaving app
5. **Profile Photos** - Display user photos in avatar
6. **Last Used** - Show recently used accounts at top
7. **Favorites** - Star favorite accounts for quick access

## Files Modified

1. `/frontend/app/select-type.tsx` (450+ lines)
   - Added modal logic and UI
   - Added state management
   - Added styles (~150 lines)

2. `/backend/server.py` (+15 lines)
   - Added GET /api/users endpoint

## Testing Results

### Compilation
- ✅ TypeScript compilation passes
- ✅ Python backend compiles without errors
- ✅ No new linting warnings

### Integration
- ✅ Uses existing userStore.createUser() with optional name
- ✅ Integrates with AsyncStorage for persistence
- ✅ Works with existing navigation flow
- ✅ Fallback to in-memory users if MongoDB unavailable

## Deployment Notes

1. Frontend changes are backward compatible
2. Backend endpoint is read-only, no data risk
3. No database schema changes required
4. Works with existing user creation flow
5. No new dependencies added

## Configuration

The feature uses existing configuration:
- API URL from `src/config/env.ts`
- User store from `src/store/userStore.ts`
- AsyncStorage for user persistence
- No new environment variables needed
