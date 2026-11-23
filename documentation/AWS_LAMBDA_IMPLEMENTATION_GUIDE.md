# AWS Lambda Implementation Guide for GET /api/users

## Overview

This document provides the implementation specification for the `GET /api/users` endpoint that the select-type enhancement requires. Based on the existing Lambda architecture, this endpoint should follow the established patterns used in `users.py`, `rides.py`, and other Lambda functions.

## Current Architecture Analysis

### Existing Lambda Structure

**Location:** `/aws-deployment/lambdas/`

**Key Files:**
- `users.py` - User management (create, get, update, delete)
- `rides.py` - Ride management (request, accept, tracking)
- `driver.py` - Driver-specific operations
- `common/db.py` - Database utilities

### Current Endpoints in users.py

```
POST   /api/users/create     - Create new user (rider/driver)
GET    /api/users/{user_id}  - Get single user by ID
PUT    /api/users/{user_id}  - Update user profile
DELETE /api/users/{user_id}  - Delete user account
```

**Missing endpoint:**
```
GET    /api/users?type=[rider|driver]  - List all users (optional type filter)
```

## Implementation Specification

### Endpoint Details

```
Method:     GET
Path:       /api/users
Query Params: type (optional: 'rider' or 'driver')
Response:   Array of user objects
Status:     200 OK | 400 Bad Request | 500 Internal Server Error
```

### Request Examples

```bash
# Get all users
curl -X GET "https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/api/users"

# Get only riders
curl -X GET "https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/api/users?type=rider"

# Get only drivers
curl -X GET "https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/api/users?type=driver"
```

### Response Format

**Success (200 OK):**
```json
[
  {
    "user_id": "user_a1b2c3d4e5f6",
    "name": "John Doe",
    "user_type": "rider",
    "created_at": "2026-11-22T19:12:03.288Z"
  },
  {
    "user_id": "user_f6e5d4c3b2a1",
    "name": "Jane Smith",
    "user_type": "rider",
    "created_at": "2026-11-22T18:00:00.000Z"
  }
]
```

**Error (400 Bad Request):**
```json
{
  "error": "Invalid user_type. Must be 'rider' or 'driver' or omitted."
}
```

**Error (500 Internal Server Error):**
```json
{
  "error": "Failed to fetch users"
}
```

## Implementation in users.py

### Step 1: Update the lambda_handler function

Add a new condition to handle the list users endpoint:

```python
def lambda_handler(event, context):
    method = event.get('httpMethod', event.get('requestContext', {}).get('http', {}).get('method', 'GET'))
    path = event.get('path', event.get('rawPath', ''))
    path_params = event.get('pathParameters') or {}
    qs = event.get('queryStringParameters') or {}
    body = json.loads(event.get('body') or '{}')

    # POST /api/users/create
    if method == 'POST' and path.endswith('/create'):
        return create_user(body)

    # GET /api/users (NEW - List users)
    if method == 'GET' and path.endswith('/users'):
        return list_users(qs)

    user_id = path_params.get('user_id')
    if not user_id:
        return err('Missing user_id', 400)

    if method == 'GET':
        return get_user(user_id)
    if method == 'PUT':
        return update_user(user_id, body)
    if method == 'DELETE':
        return delete_user(user_id)

    return err('Not found', 404)
```

### Step 2: Implement the list_users function

Add this new function to `users.py`:

```python
def list_users(qs):
    """
    List all users, optionally filtered by type (rider/driver).
    
    Query Parameters:
      - type: 'rider', 'driver', or omitted for all users
    
    Returns: Array of user objects
    """
    user_type = qs.get('type', '').lower() if qs else ''
    
    # Validate type parameter if provided
    if user_type and user_type not in ('rider', 'driver'):
        return err("Invalid user_type. Must be 'rider' or 'driver' or omitted.", 400)
    
    try:
        # Scan all users from the users table
        response = table('users').scan()
        users = response.get('Items', [])
        
        # Handle pagination if there are many users
        while 'LastEvaluatedKey' in response:
            response = table('users').scan(
                ExclusiveStartKey=response['LastEvaluatedKey']
            )
            users.extend(response.get('Items', []))
        
        # Filter by user_type if specified
        if user_type:
            users = [u for u in users if u.get('user_type') == user_type]
        
        # Sort by created_at (newest first)
        users.sort(key=lambda u: u.get('created_at', ''), reverse=True)
        
        return ok(users)
    
    except Exception as e:
        print(f"Error listing users: {str(e)}")
        return err(f"Failed to fetch users: {str(e)}", 500)
```

## Alternative Implementation with Efficiency Improvements

For better performance with large user bases, consider using DynamoDB Query instead of Scan:

```python
def list_users_optimized(qs):
    """
    List users with optional type filtering.
    Uses Query with Global Secondary Index if available,
    falls back to Scan for efficiency.
    """
    user_type = qs.get('type', '').lower() if qs else ''
    
    # Validate type parameter
    if user_type and user_type not in ('rider', 'driver'):
        return err("Invalid user_type. Must be 'rider' or 'driver' or omitted.", 400)
    
    try:
        # If type is specified and you have a GSI on user_type, use it
        if user_type:
            # Option 1: Use Global Secondary Index if available
            # Assumes GSI named "user_type-created_at-index"
            response = table('users').query(
                IndexName='user_type-created_at-index',
                KeyConditionExpression='user_type = :type',
                ExpressionAttributeValues={':type': user_type},
                ScanIndexForward=False  # Newest first
            )
            users = response.get('Items', [])
        else:
            # Scan all users if no type filter
            response = table('users').scan()
            users = response.get('Items', [])
            
            # Handle pagination
            while 'LastEvaluatedKey' in response:
                response = table('users').scan(
                    ExclusiveStartKey=response['LastEvaluatedKey']
                )
                users.extend(response.get('Items', []))
            
            # Sort by created_at
            users.sort(key=lambda u: u.get('created_at', ''), reverse=True)
        
        return ok(users)
    
    except Exception as e:
        print(f"Error listing users: {str(e)}")
        return err(f"Failed to fetch users: {str(e)}", 500)
```

## DynamoDB Table Structure

### Current users Table

**Partition Key:** `user_id` (String)

**Attributes:**
- `user_id` (String) - Unique identifier
- `name` (String) - User's display name
- `user_type` (String) - 'rider' or 'driver'
- `created_at` (String) - ISO 8601 timestamp
- `phone` (String, optional)
- `email` (String, optional)
- `updated_at` (String, optional)

### Recommended Global Secondary Index (Optional but Recommended)

For better performance when filtering by user_type:

```yaml
GlobalSecondaryIndexes:
  - IndexName: user_type-created_at-index
    KeySchema:
      - AttributeName: user_type
        KeyType: HASH
      - AttributeName: created_at
        KeyType: RANGE
    Projection:
      ProjectionType: ALL
    BillingMode: PAY_PER_REQUEST
```

This GSI allows efficient queries by user_type, sorted by creation date.

## Integration with API Gateway

### Current Routing in API Gateway

The Lambda is already integrated with the API Gateway. The routing pattern should automatically direct:

```
GET /api/users → users.py lambda_handler()
GET /api/users?type=rider → users.py lambda_handler()
GET /api/users/{user_id} → users.py lambda_handler()
```

### Routing Logic in users.py

The handler uses path checking to route to the correct function:

```python
# Route based on path
if method == 'GET' and path.endswith('/users'):
    return list_users(qs)  # GET /api/users (new)
if method == 'GET' and path_params.get('user_id'):
    return get_user(user_id)  # GET /api/users/{user_id} (existing)
```

## Deployment Steps

### 1. Update users.py

```bash
cd /aws-deployment/lambdas
# Edit users.py to add list_users function and routing
```

### 2. Update requirements.txt (if needed)

Current requirements should be sufficient. No new dependencies needed.

```
boto3
```

### 3. Build and Deploy

```bash
cd /aws-deployment/lambdas
./build_and_upload.sh

# Or use the deployment script
cd /aws-deployment
./deploy.sh
```

### 4. Test the Endpoint

```bash
# After deployment, test with curl

# Get all users
curl -X GET "https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/api/users"

# Get riders only
curl -X GET "https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/api/users?type=rider"

# Get drivers only
curl -X GET "https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/api/users?type=driver"
```

## Frontend Integration

The frontend (`select-type.tsx`) will call this endpoint:

```typescript
async function fetchExistingUsers() {
  setFetchingUsers(true);
  try {
    const url = userTypeModal 
      ? `${getApiUrl()}/api/users?type=${userTypeModal}`
      : `${getApiUrl()}/api/users`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch users');
    
    const users = await response.json();
    setExistingUsers(users);
  } catch (error) {
    Alert.alert('Error', 'Failed to load users');
  } finally {
    setFetchingUsers(false);
  }
}
```

## Error Handling

The implementation handles:

1. **Invalid type parameter** - Returns 400 error
2. **Database scan failures** - Returns 500 error with details
3. **Empty result set** - Returns 200 with empty array `[]`
4. **Pagination** - Automatically handles DynamoDB scan limits

## Performance Considerations

### Current Approach (Scan)
- ✅ Works with existing DynamoDB structure
- ✅ No schema changes required
- ⚠️ Less efficient with large datasets
- ✅ Automatic pagination handling

### Optimized Approach (Query with GSI)
- ✅ More efficient with large datasets
- ✅ Better for type filtering
- ⚠️ Requires GSI setup
- ✅ Faster response times

### Recommendations

1. **For < 10,000 users:** Use the basic Scan approach
2. **For > 10,000 users:** Implement the GSI and use Query
3. **Monitor:** Add CloudWatch metrics to track query performance
4. **Cache:** Consider adding caching layer for static user lists

## Monitoring & Logging

Add logging to track usage:

```python
def list_users(qs):
    user_type = qs.get('type', '').lower() if qs else ''
    
    # Log the request
    print(f"LIST_USERS - type={user_type or 'all'}")
    
    try:
        # ... implementation ...
        print(f"LIST_USERS - success - returned {len(users)} users")
        return ok(users)
    except Exception as e:
        print(f"LIST_USERS - error - {str(e)}")
        return err(f"Failed to fetch users: {str(e)}", 500)
```

## Security Considerations

### Current Implementation

The endpoint currently has no authentication. Consider adding:

```python
def lambda_handler(event, context):
    # Optional: Validate authorization
    auth_header = event.get('headers', {}).get('Authorization')
    if not auth_header:
        return err('Unauthorized', 401)
    
    # Continue with existing logic...
```

### CORS

Already handled by `common/db.py`:
```python
'headers': {
    'Content-Type': 'application/json', 
    'Access-Control-Allow-Origin': '*'
}
```

## Testing Checklist

- [ ] Deploy users.py with new list_users function
- [ ] Test: `GET /api/users` returns all users
- [ ] Test: `GET /api/users?type=rider` returns only riders
- [ ] Test: `GET /api/users?type=driver` returns only drivers
- [ ] Test: `GET /api/users?type=invalid` returns 400 error
- [ ] Test: Empty user table returns `[]`
- [ ] Test: Response includes all required fields (user_id, name, user_type, created_at)
- [ ] Test: Performance with 1000+ users
- [ ] Verify CORS headers in response
- [ ] Check CloudWatch logs for errors

## Summary

The `GET /api/users` endpoint:
- ✅ Follows existing Lambda patterns
- ✅ Integrates with current users.py
- ✅ Requires no new dependencies
- ✅ Works with existing DynamoDB structure
- ✅ Supports optional type filtering
- ✅ Handles pagination automatically
- ✅ Returns standardized responses
- ✅ Logs all operations

**Implementation Time:** ~30 minutes
**Testing Time:** ~15 minutes
**Total:** ~45 minutes to production-ready
