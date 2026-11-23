# AWS Lambda Implementation Summary

Based on the analysis of existing Lambda functions in `/aws-deployment/lambdas/`, here's what the GET /api/users endpoint implementation should look like.

## Key Findings from Existing Code

### 1. Architecture Pattern (from rides.py & users.py)

All Lambda functions follow this pattern:
```python
def lambda_handler(event, context):
    method = event.get('httpMethod', ...)
    path = event.get('path', ...)
    path_params = event.get('pathParameters') or {}
    qs = event.get('queryStringParameters') or {}  # Query parameters
    body = json.loads(event.get('body') or '{}')
    
    # Route based on method and path
    if method == 'POST' and path.endswith('/create'):
        return create_user(body)
    
    if method == 'GET' and path.endswith('/users'):  # List endpoint
        return list_users(qs)
    
    # ... more routes ...
```

### 2. Database Pattern (from common/db.py)

```python
from common.db import table, ok, err

# Access DynamoDB table
users = table('users').scan()

# Return responses
return ok(users)              # 200 OK response
return err('message', 400)    # 400 error response
```

### 3. Response Format Pattern

```python
def ok(body, status=200):
    return {
        'statusCode': status,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'  # CORS already handled
        },
        'body': json.dumps(body, default=str)
    }

def err(message, status=400):
    return {
        'statusCode': status,
        'headers': {...},
        'body': json.dumps({'error': message})
    }
```

## Implementation for GET /api/users

### In users.py - Add to lambda_handler()

The routing logic should check:
1. If path ends with `/users` (not a specific user ID path)
2. If method is GET
3. If there's no user_id parameter

```python
# Route list users endpoint
if method == 'GET' and path.endswith('/users') and not path_params.get('user_id'):
    return list_users(qs)
```

### New Function: list_users()

```python
def list_users(qs):
    """
    List all users, optionally filtered by type (rider/driver).
    
    Query Parameters:
      - type: 'rider', 'driver', or omitted
    
    Returns: Array of user objects
    """
    # 1. Get type parameter
    user_type = qs.get('type', '').lower() if qs else ''
    
    # 2. Validate type if provided
    if user_type and user_type not in ('rider', 'driver'):
        return err("Invalid user_type. Must be 'rider' or 'driver' or omitted.", 400)
    
    # 3. Query DynamoDB with pagination handling
    try:
        response = table('users').scan()
        users = response.get('Items', [])
        
        # Handle pagination for large datasets
        while 'LastEvaluatedKey' in response:
            response = table('users').scan(
                ExclusiveStartKey=response['LastEvaluatedKey']
            )
            users.extend(response.get('Items', []))
        
        # 4. Filter by type if specified
        if user_type:
            users = [u for u in users if u.get('user_type') == user_type]
        
        # 5. Sort by creation date (newest first)
        users.sort(key=lambda u: u.get('created_at', ''), reverse=True)
        
        # 6. Return success
        print(f"LIST_USERS - type={user_type or 'all'} - returned {len(users)} users")
        return ok(users)
    
    except Exception as e:
        print(f"LIST_USERS - error - {str(e)}")
        return err(f"Failed to fetch users: {str(e)}", 500)
```

## What Makes This Implementation Correct

✅ **Follows existing patterns**: Same structure as rides.py for handling queries
✅ **Uses established utilities**: Leverages common/db.py for responses
✅ **Proper error handling**: Returns appropriate status codes
✅ **Handles pagination**: DynamoDB scan can return paginated results
✅ **Type validation**: Validates query parameters before querying DB
✅ **Logging**: Prints request/response for CloudWatch monitoring
✅ **CORS ready**: common/db.py already handles CORS headers
✅ **No new dependencies**: Uses only existing boto3

## HTTP Routing

The API Gateway already routes based on path:

```
GET /api/users                    → users.py lambda_handler()
GET /api/users?type=rider         → users.py lambda_handler()
GET /api/users?type=driver        → users.py lambda_handler()
GET /api/users/{user_id}          → users.py lambda_handler()
POST /api/users/create            → users.py lambda_handler()
PUT /api/users/{user_id}          → users.py lambda_handler()
DELETE /api/users/{user_id}       → users.py lambda_handler()
```

The Lambda function's routing logic (using path and path_params) differentiates:
- List users: `GET /api/users` (no user_id param)
- Get specific user: `GET /api/users/{user_id}` (has user_id param)

## DynamoDB Structure Used

**Table:** `production_users` (via PREFIX in common/db.py)

**Partition Key:** user_id

**Attributes that will be returned:**
```
user_id      (String)  - Unique ID like "user_a1b2c3d4e5f6"
name         (String)  - User display name like "John Doe"
user_type    (String)  - Either "rider" or "driver"
created_at   (String)  - ISO 8601 timestamp
phone        (String, optional)
email        (String, optional)
updated_at   (String, optional)
```

## Frontend Integration Point

Once deployed, the frontend's `fetchExistingUsers()` function in select-type.tsx will work:

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
    setExistingUsers(users);  // Sets array like [{user_id, name, user_type, ...}]
  } catch (error) {
    Alert.alert('Error', 'Failed to load users');
  } finally {
    setFetchingUsers(false);
  }
}
```

The endpoint returns exactly the JSON structure the frontend expects.

## Deployment Checklist

- [ ] Edit `/aws-deployment/lambdas/users.py`
- [ ] Add query parameter parsing: `qs = event.get('queryStringParameters') or {}`
- [ ] Add routing: `if method == 'GET' and path.endswith('/users') and not path_params.get('user_id')`
- [ ] Add `list_users()` function
- [ ] No changes to other files needed
- [ ] Run `./build_and_upload.sh` in lambdas folder
- [ ] Run `./deploy.sh` in aws-deployment folder
- [ ] Wait 2-5 minutes for CloudFormation to complete
- [ ] Test with curl: `curl -X GET "https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/api/users"`
- [ ] Test with type filter: `curl -X GET "https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/api/users?type=rider"`
- [ ] Verify frontend "Select Existing" tab loads users

## Files to Reference

- **Implementation Guide**: `/documentation/AWS_LAMBDA_IMPLEMENTATION_GUIDE.md`
- **Code Snippet (ready to copy/paste)**: `/documentation/AWS_LAMBDA_CODE_SNIPPET.md`
- **Architecture Diagram**: `/documentation/AWS_LAMBDA_ARCHITECTURE_FLOW.md`
- **Existing Pattern (rides.py)**: `/aws-deployment/lambdas/rides.py`
- **Existing Pattern (users.py)**: `/aws-deployment/lambdas/users.py`
- **Utilities (common/db.py)**: `/aws-deployment/lambdas/common/db.py`

## Expected Result

After implementation:

✅ Frontend can call `GET /api/users?type=rider`
✅ Returns array of rider objects
✅ User can select from list in modal
✅ Continues to next step in onboarding
✅ All existing endpoints still work
✅ No breaking changes

This is the final piece needed to complete the select-type enhancement feature.
