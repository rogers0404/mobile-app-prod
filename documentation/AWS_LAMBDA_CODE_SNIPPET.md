# AWS Lambda Code - Ready to Copy/Paste

This file contains the exact code changes needed to implement the GET /api/users endpoint in the AWS Lambda users.py file.

## File: aws-deployment/lambdas/users.py

### CHANGE 1: Update lambda_handler() function

**Find this section:**
```python
def lambda_handler(event, context):
    method = event.get('httpMethod', event.get('requestContext', {}).get('http', {}).get('method', 'GET'))
    path = event.get('path', event.get('rawPath', ''))
    path_params = event.get('pathParameters') or {}
    body = json.loads(event.get('body') or '{}')

    # POST /api/users/create
    if method == 'POST' and path.endswith('/create'):
        return create_user(body)

    user_id = path_params.get('user_id')
    if not user_id:
        return err('Missing user_id', 400)
```

**Replace with:**
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

    # GET /api/users (List users - new endpoint)
    if method == 'GET' and path.endswith('/users') and not path_params.get('user_id'):
        return list_users(qs)

    user_id = path_params.get('user_id')
    if not user_id:
        return err('Missing user_id', 400)
```

**What changed:**
- Added `qs = event.get('queryStringParameters') or {}` to capture query parameters
- Added condition `if method == 'GET' and path.endswith('/users') and not path_params.get('user_id'):` to route list requests
- Called new `list_users(qs)` function

---

### CHANGE 2: Add new list_users() function

**Add this new function after the existing get_user() function:**

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
        
        print(f"LIST_USERS - type={user_type or 'all'} - returned {len(users)} users")
        return ok(users)
    
    except Exception as e:
        print(f"LIST_USERS - error - {str(e)}")
        return err(f"Failed to fetch users: {str(e)}", 500)
```

---

## Complete Updated users.py Structure

Here's what the complete file structure should look like after changes:

```python
"""
Users Lambda
Routes:
  GET    /api/users                    # List users (NEW)
  GET    /api/users?type=rider         # List riders (NEW)
  GET    /api/users?type=driver        # List drivers (NEW)
  POST   /api/users/create
  GET    /api/users/{user_id}
  PUT    /api/users/{user_id}
  DELETE /api/users/{user_id}
"""
import json
import uuid
import os
from datetime import datetime, timezone
from common.db import table, ok, err

COGNITO_USER_POOL_ID = os.getenv('COGNITO_USER_POOL_ID')


def lambda_handler(event, context):
    # ... UPDATED CODE HERE ...


def list_users(qs):
    # ... NEW FUNCTION ...


def create_user(body):
    # ... EXISTING CODE (no changes) ...


def get_user(user_id):
    # ... EXISTING CODE (no changes) ...


def update_user(user_id, body):
    # ... EXISTING CODE (no changes) ...


def delete_user(user_id):
    # ... EXISTING CODE (no changes) ...
```

---

## Testing Commands

After deploying, test with these curl commands:

```bash
# 1. List all users
curl -X GET "https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/api/users" \
  -H "Content-Type: application/json"

# Expected response:
# [
#   {
#     "user_id": "user_a1b2c3d4e5f6",
#     "name": "John Doe",
#     "user_type": "rider",
#     "created_at": "2026-11-22T19:12:03.288Z"
#   },
#   ...
# ]

---

# 2. List only riders
curl -X GET "https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/api/users?type=rider" \
  -H "Content-Type: application/json"

# Expected response:
# [
#   {
#     "user_id": "user_a1b2c3d4e5f6",
#     "name": "John Doe",
#     "user_type": "rider",
#     "created_at": "2026-11-22T19:12:03.288Z"
#   },
#   ...
# ]

---

# 3. List only drivers
curl -X GET "https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/api/users?type=driver" \
  -H "Content-Type: application/json"

# Expected response:
# [
#   {
#     "user_id": "user_f6e5d4c3b2a1",
#     "name": "Jane Smith",
#     "user_type": "driver",
#     "created_at": "2026-11-22T18:00:00.000Z"
#   },
#   ...
# ]

---

# 4. Test error handling (invalid type)
curl -X GET "https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/api/users?type=invalid" \
  -H "Content-Type: application/json"

# Expected response (400 error):
# {
#   "error": "Invalid user_type. Must be 'rider' or 'driver' or omitted."
# }

---

# 5. Test empty list
curl -X GET "https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/api/users" \
  -H "Content-Type: application/json"

# Expected response (empty array):
# []
```

---

## Deployment Steps

### 1. Edit the file
```bash
cd /aws-deployment/lambdas
nano users.py  # or use your preferred editor
```

### 2. Make the two changes above

### 3. Build the Lambda package
```bash
cd /aws-deployment/lambdas
./build_and_upload.sh
```

### 4. Deploy to AWS
```bash
cd /aws-deployment
./deploy.sh
```

### 5. Wait for CloudFormation to complete
```bash
# Check status in AWS Console or via CLI
aws cloudformation describe-stacks --stack-name trip-lambdas-production
```

### 6. Test the endpoint
```bash
# Run one of the curl commands above
curl -X GET "https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/api/users"
```

---

## Troubleshooting

### No users returned
- Check if users exist in DynamoDB: `production_users` table
- Verify table permissions in IAM role

### 500 Error
- Check CloudWatch logs: AWS Console → CloudWatch → Logs → Logs Insights
- Search for "LIST_USERS - error"

### Invalid response format
- Verify `common/db.py` is not modified
- Check JSON serialization in return statement

### Type filtering not working
- Verify `user_type` values in DynamoDB are lowercase ('rider' or 'driver')
- Check query parameter is correctly passed: `?type=rider` (not `?userType=rider`)

---

## Migration Guide (if you have existing code)

If you already have a different implementation:

1. **Backup current users.py**
   ```bash
   cp aws-deployment/lambdas/users.py aws-deployment/lambdas/users.py.backup
   ```

2. **Compare files**
   ```bash
   diff aws-deployment/lambdas/users.py aws-deployment/lambdas/users.py.backup
   ```

3. **Merge changes carefully**
   - Only add the new `list_users()` function
   - Only update the routing in `lambda_handler()`
   - Do NOT change existing functions

4. **Test before deploying**
   - Test locally if possible
   - Deploy to staging first
   - Run curl tests
   - Verify response format

5. **Deploy to production**
   ```bash
   ./deploy.sh
   ```

---

## Success Criteria

✅ Endpoint responds at `/api/users`
✅ Supports `?type=rider` parameter
✅ Supports `?type=driver` parameter
✅ Returns array of user objects
✅ Each user has: user_id, name, user_type, created_at
✅ Handles invalid type parameter with 400 error
✅ Returns empty array [] when no users match
✅ Logs all requests to CloudWatch
✅ No breaking changes to existing endpoints
✅ Frontend can fetch and display users

---

## Frontend Connection

Once deployed, the frontend (`select-type.tsx`) will automatically work:

```typescript
const fetchExistingUsers = async () => {
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
};
```

The frontend is already ready. This endpoint implementation is the last piece needed.

---

## Questions?

Refer to:
- Full documentation: `/documentation/AWS_LAMBDA_IMPLEMENTATION_GUIDE.md`
- Backend endpoint specs: `/documentation/BACKEND_ENDPOINT_REQUIRED.md`
- Existing Lambda patterns: `/aws-deployment/lambdas/rides.py`
- Database utilities: `/aws-deployment/lambdas/common/db.py`
