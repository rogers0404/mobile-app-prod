# Exact Changes Required to users.py

## Validation Against Current Implementation

**Current File:** `/aws-deployment/lambdas/users.py` (118 lines)
**Current Endpoints:** 4 (create, get, update, delete)
**Missing Endpoint:** GET /api/users (list all users)

---

## Change #1: Update lambda_handler() - Add Query Parameter Parsing

**Location:** Line 23 (after `path_params = event.get('pathParameters') or {}`)

**CURRENT CODE (Lines 19-24):**
```python
def lambda_handler(event, context):
    method = event.get('httpMethod', event.get('requestContext', {}).get('http', {}).get('method', 'GET'))
    path = event.get('path', event.get('rawPath', ''))
    path_params = event.get('pathParameters') or {}
    body = json.loads(event.get('body') or '{}')

    # POST /api/users/create
```

**REQUIRED CHANGE:**
Add this line after line 23:
```python
    qs = event.get('queryStringParameters') or {}
```

**NEW CODE (Lines 19-25):**
```python
def lambda_handler(event, context):
    method = event.get('httpMethod', event.get('requestContext', {}).get('http', {}).get('method', 'GET'))
    path = event.get('path', event.get('rawPath', ''))
    path_params = event.get('pathParameters') or {}
    qs = event.get('queryStringParameters') or {}
    body = json.loads(event.get('body') or '{}')

    # POST /api/users/create
```

**Why:** To capture query parameters like `?type=rider`

---

## Change #2: Update lambda_handler() - Add Routing for List Endpoint

**Location:** Lines 25-27 (after `if method == 'POST' and path.endswith('/create'):` block)

**CURRENT CODE (Lines 25-29):**
```python
    # POST /api/users/create
    if method == 'POST' and path.endswith('/create'):
        return create_user(body)

    user_id = path_params.get('user_id')
```

**REQUIRED CHANGE:**
Add these 2 lines after line 27:
```python
    # GET /api/users (List users - new endpoint)
    if method == 'GET' and path.endswith('/users') and not path_params.get('user_id'):
        return list_users(qs)

```

**NEW CODE (Lines 25-33):**
```python
    # POST /api/users/create
    if method == 'POST' and path.endswith('/create'):
        return create_user(body)

    # GET /api/users (List users - new endpoint)
    if method == 'GET' and path.endswith('/users') and not path_params.get('user_id'):
        return list_users(qs)

    user_id = path_params.get('user_id')
```

**Why:** To route GET /api/users to new list_users() function (not to get_user() with specific ID)

---

## Change #3: Add New Function - list_users()

**Location:** After get_user() function (after line 83), before update_user() function

**REQUIRED CHANGE:**
Add this new function (27 lines total):

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
        print(f"LIST_USERS - error - {str(e)}")
        return err(f"Failed to fetch users: {str(e)}", 500)

```

**Why:** To handle the new GET /api/users endpoint with optional filtering

---

## Updated File Structure

**Before (Current - 118 lines):**
```
Lines 1-18:    Imports and docstring
Lines 19-37:   lambda_handler() [38 lines]
Lines 38-67:   create_user()
Lines 68-83:   get_user()
Lines 84-99:   update_user()
Lines 100-118: delete_user()
```

**After (Updated - 145 lines):**
```
Lines 1-18:    Imports and docstring
Lines 19-39:   lambda_handler() [38 lines + 2 new]
Lines 40-69:   create_user()
Lines 70-85:   get_user()
Lines 86-114:  list_users() [NEW - 27 lines]
Lines 115-130: update_user()
Lines 131-149: delete_user()
```

---

## Summary of Changes

| Aspect | Current | After | Change |
|--------|---------|-------|--------|
| Total Lines | 118 | 145 | +27 lines |
| lambda_handler() | 38 lines | 40 lines | +2 lines (1 parsing + 1 routing) |
| Existing functions | 4 | 4 | No changes |
| New functions | 0 | 1 | list_users() |
| Total functions | 5 | 6 | +1 |

---

## Routing Changes

**Current Routing Logic:**
```
GET /api/users/{user_id}  → get_user()
POST /api/users/create    → create_user()
PUT /api/users/{user_id}  → update_user()
DELETE /api/users/{user_id} → delete_user()
```

**New Routing Logic:**
```
GET /api/users            → list_users()        [NEW]
GET /api/users?type=rider → list_users()        [NEW]
GET /api/users?type=driver → list_users()       [NEW]
GET /api/users/{user_id}  → get_user()
POST /api/users/create    → create_user()
PUT /api/users/{user_id}  → update_user()
DELETE /api/users/{user_id} → delete_user()
```

---

## Code Comparison - Side by Side

### BEFORE - lambda_handler() routing
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

### AFTER - lambda_handler() routing
```python
def lambda_handler(event, context):
    method = event.get('httpMethod', event.get('requestContext', {}).get('http', {}).get('method', 'GET'))
    path = event.get('path', event.get('rawPath', ''))
    path_params = event.get('pathParameters') or {}
    qs = event.get('queryStringParameters') or {}  # ← NEW LINE
    body = json.loads(event.get('body') or '{}')

    # POST /api/users/create
    if method == 'POST' and path.endswith('/create'):
        return create_user(body)

    # GET /api/users (List users - new endpoint)  # ← NEW LINES
    if method == 'GET' and path.endswith('/users') and not path_params.get('user_id'):  # ← NEW LINES
        return list_users(qs)  # ← NEW LINES

    user_id = path_params.get('user_id')
    if not user_id:
        return err('Missing user_id', 400)
```

---

## Implementation Steps

### Step 1: Add Query Parameter Parsing (1 line)
**File:** users.py  
**Line:** 23 (after `path_params = event.get('pathParameters') or {}`)

```python
qs = event.get('queryStringParameters') or {}
```

### Step 2: Add Routing Logic (3 lines)
**File:** users.py  
**Line:** 28 (after `return create_user(body)`)

```python

# GET /api/users (List users - new endpoint)
if method == 'GET' and path.endswith('/users') and not path_params.get('user_id'):
    return list_users(qs)
```

### Step 3: Add New Function (27 lines)
**File:** users.py  
**Location:** After get_user() function (line 83), before update_user() function

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
        print(f"LIST_USERS - error - {str(e)}")
        return err(f"Failed to fetch users: {str(e)}", 500)
```

---

## Verification Checklist

After making changes, verify:

✅ **Syntax:**
```bash
python -m py_compile users.py
```

✅ **Import Check:**
```bash
python -c "import users"
```

✅ **Build:**
```bash
cd aws-deployment/lambdas
./build_and_upload.sh
```

✅ **Deploy:**
```bash
cd ../
./deploy.sh
```

✅ **Test Endpoints:**
```bash
# List all users
curl -X GET "https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/api/users"

# List riders only
curl -X GET "https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/api/users?type=rider"

# List drivers only
curl -X GET "https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/api/users?type=driver"

# Test error handling
curl -X GET "https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/api/users?type=invalid"

# Verify existing endpoints still work
curl -X GET "https://dzk2lr8j09.execute-api.us-east-1.amazonaws.com/production/api/users/{user_id}"
```

---

## No Changes Needed To:

✅ create_user() - Unchanged
✅ get_user() - Unchanged  
✅ update_user() - Unchanged
✅ delete_user() - Unchanged
✅ common/db.py - Unchanged
✅ requirements.txt - Unchanged
✅ Any other files - Unchanged

---

## Impact Analysis

**Files Modified:** 1 (users.py)
**Lines Added:** 31 (1 parsing + 3 routing + 27 function)
**Lines Changed:** 0
**Breaking Changes:** 0
**New Dependencies:** 0
**Backward Compatibility:** 100%

---

## Related Changes

No other files need modification. The frontend (select-type.tsx) is already ready and will work immediately after this Lambda is deployed.

**Frontend Status:**
- ✅ Already calling GET /api/users endpoint
- ✅ Already handling responses
- ✅ No changes needed
- ⏳ Just waiting for this Lambda implementation

---

## Total Effort

**Reading:** 10 minutes  
**Coding:** 10 minutes  
**Building:** 2 minutes  
**Deploying:** 5 minutes  
**Testing:** 15 minutes  

**TOTAL: ~45 minutes**
