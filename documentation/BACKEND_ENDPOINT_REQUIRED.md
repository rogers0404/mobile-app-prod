# Backend Endpoint Implementation Required - AWS Lambda

## ⚠️ IMPORTANT

The frontend code for select-type.tsx enhancement is **COMPLETE**, but it requires a corresponding **backend endpoint to be implemented in AWS Lambda**.

## What's Needed

### New AWS Lambda Endpoint

**Endpoint:** `GET /api/users`

**Location:** AWS Lambda function at `https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/api/users`

**Query Parameters:**
- `type` (optional): "rider" or "driver"
  - If provided: Returns only users of that type
  - If omitted: Returns all users

**Response Format:**
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

## Implementation Details

### Endpoint Behavior

1. **No type filter:**
   ```
   GET /api/users
   ```
   Returns: All users from MongoDB

2. **Filter by rider:**
   ```
   GET /api/users?type=rider
   ```
   Returns: Only users where `user_type == "rider"`

3. **Filter by driver:**
   ```
   GET /api/users?type=driver
   ```
   Returns: Only users where `user_type == "driver"`

### Database Query

The endpoint should:
- Query MongoDB users collection
- Filter by user_type if `type` parameter provided
- Return up to 100 users (pagination optional)
- Exclude MongoDB `_id` field from response
- Include: `user_id`, `name`, `user_type`, `created_at`

### Error Handling

- **Network/DB error:** Return 500 with error message (or fallback to in-memory users if available)
- **Invalid type parameter:** Ignore and return all users (or return 400 Bad Request)
- **No results:** Return empty array `[]`

## Implementation Example (Pseudocode)

```python
@app.get("/api/users")
async def list_users(type: Optional[str] = None):
    """List users, optionally filtered by type (rider or driver)"""
    try:
        query = {}
        if type and type in ['rider', 'driver']:
            query = {"user_type": type}
        
        # Query MongoDB
        users = await db.users.find(query, {"_id": 0}).to_list(length=100)
        return users
    except Exception:
        # Fallback if DB unavailable
        users = [user for user in in_memory_users.values()]
        if type and type in ['rider', 'driver']:
            users = [user for user in users if user.get("user_type") == type]
        return users
```

## Frontend Status

✅ **Frontend Implementation:** COMPLETE
- Modal interface ready
- State management ready
- API calls configured
- Error handling in place
- Styling complete

✅ **Frontend Testing:** TypeScript compiles without errors

⚠️ **Frontend Limitation:** Cannot test user selection flow without backend endpoint

## Testing the Endpoint

### Using curl

```bash
# Test all users
curl "https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/api/users"

# Test riders only
curl "https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/api/users?type=rider"

# Test drivers only
curl "https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/api/users?type=driver"
```

### Expected Response

```json
[
  {
    "user_id": "user_xyz123abc456",
    "name": "John Smith",
    "user_type": "rider",
    "created_at": "2024-01-15T10:30:00Z"
  },
  {
    "user_id": "user_def789ghi012",
    "name": "Alice Johnson",
    "user_type": "rider",
    "created_at": "2024-01-14T14:20:00Z"
  }
]
```

## Deployment Steps

1. **Implement endpoint** in AWS Lambda function
2. **Deploy to production** API Gateway
3. **Test endpoint** using curl commands above
4. **Frontend will automatically work** (no changes needed)

## Integration with Frontend

Once the backend endpoint is implemented:

1. Frontend will fetch users on role selection
2. Modal will display user list
3. User can select existing user
4. Or click "Create New" to create account
5. All flows will work end-to-end

## Notes

- The local backend folder (`/backend/server.py`) is **NOT** used
- Backend is deployed on AWS Lambda at `https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production`
- Frontend code is ready and waiting for this endpoint
- No frontend changes needed once backend is ready

## Checklist for Backend Implementation

- [ ] Implement GET /api/users endpoint
- [ ] Add optional `type` query parameter
- [ ] Query MongoDB users collection
- [ ] Filter by user_type if parameter provided
- [ ] Return up to 100 users
- [ ] Exclude _id field from response
- [ ] Handle errors gracefully
- [ ] Deploy to AWS Lambda
- [ ] Test with curl commands
- [ ] Verify response format matches expected schema

## Status

| Component | Status | Notes |
|-----------|--------|-------|
| Frontend UI | ✅ Complete | Modal with 2 tabs ready |
| Frontend State | ✅ Complete | 6 state variables configured |
| Frontend API Call | ✅ Complete | Calls to GET /api/users ready |
| Frontend Styling | ✅ Complete | 150 lines of CSS |
| Backend Endpoint | ⏳ **PENDING** | Needs implementation in AWS Lambda |
| Backend Testing | ⏳ **PENDING** | Waiting for endpoint |
| Integration Testing | ⏳ **PENDING** | Waiting for backend |
| Deployment | ⏳ **PENDING** | Waiting for backend |

## Questions?

For detailed frontend documentation, see:
- [SELECT_TYPE_ENHANCEMENT.md](./SELECT_TYPE_ENHANCEMENT.md)
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)

For backend implementation guidance, follow the pseudocode example above.

---

**TL;DR:** Frontend is ready. Implement GET /api/users endpoint in AWS Lambda, and everything will work!
