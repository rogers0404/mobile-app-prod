# AWS Lambda Architecture - Implementation Flow

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         React Native Frontend                       │
│                      (select-type.tsx)                              │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  User Selects Rider/Driver                                │   │
│  │  ↓                                                          │   │
│  │  Modal Opens with 2 Tabs                                  │   │
│  │  ├─ "Select Existing" (calls GET /api/users?type=X)      │   │
│  │  └─ "Create New" (calls POST /api/users/create)          │   │
│  └────────────────────────────────────────────────────────────┘   │
│                           ↓                                        │
│                    HTTP Request to AWS API                        │
│                   https://dzk2lr8j09...                           │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────────────────────────────────────┐
        │          AWS API Gateway (dzk2lr8j09)              │
        │                                                     │
        │  Routes incoming requests to Lambda functions     │
        │  ├─ GET /api/users → users Lambda                 │
        │  ├─ POST /api/users/create → users Lambda         │
        │  └─ GET /api/users/{user_id} → users Lambda       │
        └─────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────────────────────────────────────┐
        │      AWS Lambda - users.py (NEW)                   │
        │                                                     │
        │  def lambda_handler(event, context):               │
        │    ├─ if POST /create → create_user()             │
        │    ├─ if GET /users → list_users() [NEW]          │
        │    └─ if GET /{id} → get_user()                   │
        │                                                     │
        │  def list_users(qs):        # NEW FUNCTION         │
        │    ├─ Get type parameter: qs.get('type')          │
        │    ├─ Query DynamoDB users table                   │
        │    ├─ Filter by type if provided                   │
        │    └─ Return array of users                        │
        └─────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────────────────────────────────────┐
        │       AWS DynamoDB - users Table                   │
        │                                                     │
        │  Partition Key: user_id                            │
        │  Attributes:                                       │
        │  ├─ user_id: String                               │
        │  ├─ name: String                                  │
        │  ├─ user_type: String (rider|driver)              │
        │  ├─ created_at: String (ISO 8601)                 │
        │  ├─ phone: String (optional)                      │
        │  └─ email: String (optional)                      │
        │                                                     │
        │  Existing Data:                                    │
        │  - Row 1: {user_id, name, user_type=rider, ...}   │
        │  - Row 2: {user_id, name, user_type=driver, ...}  │
        │  - Row 3: {user_id, name, user_type=rider, ...}   │
        └─────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────────────────────────────────────┐
        │           Response (JSON Array)                     │
        │                                                     │
        │  [                                                 │
        │    {                                               │
        │      "user_id": "user_a1b2c3d4e5f6",              │
        │      "name": "John Doe",                          │
        │      "user_type": "rider",                        │
        │      "created_at": "2026-11-22T19:12:03.288Z"    │
        │    },                                              │
        │    {                                               │
        │      "user_id": "user_f6e5d4c3b2a1",              │
        │      "name": "Jane Smith",                        │
        │      "user_type": "rider",                        │
        │      "created_at": "2026-11-22T18:00:00.000Z"    │
        │    }                                               │
        │  ]                                                 │
        └─────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────────────────────────────────────┐
        │         Frontend Receives Response                  │
        │                                                     │
        │  setExistingUsers(users)                           │
        │  Renders FlatList with user options                │
        │  User can select to continue                       │
        └─────────────────────────────────────────────────────┘
```

## Request Flow - GET /api/users

```
REQUEST FLOW
════════════════════════════════════════════════════════════════════

Frontend                 API Gateway              Lambda Function
   │                           │                         │
   │  GET /api/users          │                         │
   │   ?type=rider            │                         │
   ├─────────────────────────→│                         │
   │                           │  Route to users.py    │
   │                           ├────────────────────→ lambda_handler()
   │                           │                       │
   │                           │                       ├─ Parse event
   │                           │                       ├─ Extract qs params
   │                           │                       ├─ Call list_users()
   │                           │                       │
   │                           │  list_users() Logic  │
   │                           │  ←───────────────────┤
   │                           │   - Get 'type' param  │
   │                           │   - Validate (rider|driver)
   │                           │   - Query DynamoDB    │
   │                           │   - Filter if needed  │
   │                           │   - Sort by created_at
   │                           │   - Return array      │
   │                           │                       │
   │                           │  Response OK(users)  │
   │                           │←───────────────────┤
   │                           │                     ├─ Serialize JSON
   │  Response (200 OK)        │                     ├─ Add CORS headers
   │  [user1, user2, ...]  ←─┤                       ├─ Return response
   │                           │                       │
   
RESPONSE STATUS CODES
══════════════════════════════════════════════════════════════════

✓ 200 OK
  └─ Users found and returned as JSON array

✗ 400 Bad Request
  └─ Invalid type parameter (not 'rider' or 'driver')
     {"error": "Invalid user_type. Must be 'rider' or 'driver' or omitted."}

✗ 500 Internal Server Error
  └─ Database error or unexpected exception
     {"error": "Failed to fetch users: [error details]"}

✓ 200 OK (Empty List)
  └─ No users found matching criteria
     []
```

## Lambda Code Changes - Before & After

```
BEFORE (Current Implementation)
═══════════════════════════════════════════════════════════════════

def lambda_handler(event, context):
    method = event.get('httpMethod', ...)
    path = event.get('path', ...)
    path_params = event.get('pathParameters') or {}
    body = json.loads(event.get('body') or '{}')

    if method == 'POST' and path.endswith('/create'):
        return create_user(body)

    user_id = path_params.get('user_id')
    if not user_id:
        return err('Missing user_id', 400)

    if method == 'GET':
        return get_user(user_id)      # GET /api/users/{user_id}
    # ... other methods ...


AFTER (With New Endpoint)
═══════════════════════════════════════════════════════════════════

def lambda_handler(event, context):
    method = event.get('httpMethod', ...)
    path = event.get('path', ...)
    path_params = event.get('pathParameters') or {}
    qs = event.get('queryStringParameters') or {}  # ← NEW
    body = json.loads(event.get('body') or '{}')

    if method == 'POST' and path.endswith('/create'):
        return create_user(body)

    # NEW ROUTE: List users
    if method == 'GET' and path.endswith('/users') and not path_params.get('user_id'):
        return list_users(qs)  # ← NEW

    user_id = path_params.get('user_id')
    if not user_id:
        return err('Missing user_id', 400)

    if method == 'GET':
        return get_user(user_id)      # GET /api/users/{user_id}
    # ... other methods ...


NEW FUNCTION: list_users()
═══════════════════════════════════════════════════════════════════

def list_users(qs):
    # 1. Extract query parameter
    user_type = qs.get('type', '').lower() if qs else ''
    
    # 2. Validate
    if user_type and user_type not in ('rider', 'driver'):
        return err("Invalid user_type...", 400)
    
    # 3. Query DynamoDB
    try:
        response = table('users').scan()
        users = response.get('Items', [])
        
        # 4. Handle pagination
        while 'LastEvaluatedKey' in response:
            response = table('users').scan(
                ExclusiveStartKey=response['LastEvaluatedKey']
            )
            users.extend(response.get('Items', []))
        
        # 5. Filter by type if specified
        if user_type:
            users = [u for u in users if u.get('user_type') == user_type]
        
        # 6. Sort by newest first
        users.sort(key=lambda u: u.get('created_at', ''), reverse=True)
        
        # 7. Return success response
        return ok(users)
    
    except Exception as e:
        return err(f"Failed to fetch users: {str(e)}", 500)
```

## Request/Response Examples

```
EXAMPLE 1: Get All Users
════════════════════════════════════════════════════════════════════

REQUEST:
  GET /api/users
  Host: dzk2lr8j09.execute-api.us-east-1.amazonaws.com
  Path: /production/api/users

LAMBDA EXECUTION:
  method = 'GET'
  path = '/production/api/users'
  qs = {}  (no query parameters)
  → Calls list_users({})

RESPONSE:
  Status: 200 OK
  Body:
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
      "user_type": "driver",
      "created_at": "2026-11-22T18:00:00.000Z"
    }
  ]


EXAMPLE 2: Get Only Riders
════════════════════════════════════════════════════════════════════

REQUEST:
  GET /api/users?type=rider
  Host: dzk2lr8j09.execute-api.us-east-1.amazonaws.com
  Path: /production/api/users
  Query: type=rider

LAMBDA EXECUTION:
  method = 'GET'
  path = '/production/api/users'
  qs = {'type': 'rider'}
  → Calls list_users({'type': 'rider'})
  → Filters to only user_type == 'rider'

RESPONSE:
  Status: 200 OK
  Body:
  [
    {
      "user_id": "user_a1b2c3d4e5f6",
      "name": "John Doe",
      "user_type": "rider",
      "created_at": "2026-11-22T19:12:03.288Z"
    }
  ]


EXAMPLE 3: Invalid Type Parameter
════════════════════════════════════════════════════════════════════

REQUEST:
  GET /api/users?type=invalid
  Host: dzk2lr8j09.execute-api.us-east-1.amazonaws.com
  Path: /production/api/users
  Query: type=invalid

LAMBDA EXECUTION:
  method = 'GET'
  path = '/production/api/users'
  qs = {'type': 'invalid'}
  → Calls list_users({'type': 'invalid'})
  → Validation check: 'invalid' not in ['rider', 'driver']
  → Returns error

RESPONSE:
  Status: 400 Bad Request
  Body:
  {
    "error": "Invalid user_type. Must be 'rider' or 'driver' or omitted."
  }
```

## Routing Logic - Path Matching

```
ROUTING DECISION TREE
════════════════════════════════════════════════════════════════════

Is method GET?
  │
  ├─ NO → Go to POST/PUT/DELETE handlers
  │
  └─ YES → Check path
        │
        ├─ Path ends with '/users' AND no 'user_id' param?
        │  └─ YES → list_users() [NEW]  ← GET /api/users
        │
        └─ Has 'user_id' param?
           └─ YES → get_user()  ← GET /api/users/{user_id}


ACTUAL CODE:
─────────────────────────────────────────────────────────────────

if method == 'POST' and path.endswith('/create'):
    return create_user(body)

# NEW: List users endpoint
if method == 'GET' and path.endswith('/users') and not path_params.get('user_id'):
    return list_users(qs)

# Existing: Get specific user
user_id = path_params.get('user_id')
if not user_id:
    return err('Missing user_id', 400)

if method == 'GET':
    return get_user(user_id)
```

## DynamoDB Query Operation

```
DYNAMODB SCAN OPERATION
════════════════════════════════════════════════════════════════════

Operation: table('users').scan()

What it does:
  1. Scans ALL items in the users table
  2. Returns up to 1MB of data (default)
  3. If more data exists, sets 'LastEvaluatedKey'

Python Code:
─────────────
response = table('users').scan()
users = response.get('Items', [])

# If paginated, continue scanning
while 'LastEvaluatedKey' in response:
    response = table('users').scan(
        ExclusiveStartKey=response['LastEvaluatedKey']
    )
    users.extend(response.get('Items', []))

Result: users = [
  {'user_id': '...', 'name': '...', 'user_type': '...', ...},
  {'user_id': '...', 'name': '...', 'user_type': '...', ...},
  ...
]


FILTERING (In-Memory)
─────────────────────

# Filter by type if specified
if user_type:
    users = [u for u in users if u.get('user_type') == user_type]

# Sort by creation date (newest first)
users.sort(key=lambda u: u.get('created_at', ''), reverse=True)
```

## Integration Points

```
INTEGRATION WITH EXISTING CODE
════════════════════════════════════════════════════════════════════

1. common/db.py (Already handles response formatting)
   ├─ ok(body, status) → Returns 200 response
   └─ err(message, status) → Returns error response

2. lambda_handler routing (Updated in users.py)
   ├─ Routes GET /api/users → list_users()
   └─ Maintains all existing routes

3. DynamoDB users table (Already exists)
   ├─ Partition Key: user_id
   ├─ Attributes: user_id, name, user_type, created_at, ...
   └─ Already populated with rider/driver users

4. API Gateway (Already configured)
   ├─ Routes HTTP requests to Lambda
   ├─ Provides event object with method, path, queryStringParameters
   └─ Handles response formatting


NO NEW DEPENDENCIES REQUIRED
─────────────────────────────
✓ Uses existing boto3 (DynamoDB client)
✓ Uses existing common/db.py utilities
✓ Uses Python standard library (json, datetime, etc.)
✓ No new npm/pip packages needed
```

## Deployment Timeline

```
STEP BY STEP DEPLOYMENT
════════════════════════════════════════════════════════════════════

0. Prepare (5 min)
   └─ Backup current users.py
      cp users.py users.py.backup

1. Code Changes (10 min)
   ├─ Update lambda_handler() with routing logic
   ├─ Add list_users() function
   └─ No other files need changes

2. Build (2 min)
   └─ cd aws-deployment/lambdas
      ./build_and_upload.sh

3. Deploy (3 min)
   └─ cd aws-deployment
      ./deploy.sh

4. Wait for CloudFormation (2-5 min)
   └─ AWS creates/updates Lambda, updates API Gateway routes

5. Test (5 min)
   ├─ curl GET /api/users
   ├─ curl GET /api/users?type=rider
   └─ curl GET /api/users?type=driver

6. Verify Frontend Integration (5 min)
   └─ Open app, trigger select-type modal
      Select Existing tab should load users


TOTAL TIME: ~30 minutes

ROLLBACK (if needed):
  cp users.py.backup users.py
  ./build_and_upload.sh
  ./deploy.sh
  Wait 2-5 minutes
```

## Success Indicators

```
✅ ENDPOINT WORKING WHEN:

1. HTTP Response
   └─ Status 200 (or 400 for invalid params)
   └─ Content-Type: application/json
   └─ CORS headers included

2. Response Format
   └─ JSON array [] or [user1, user2, ...]
   └─ Each user has: user_id, name, user_type, created_at

3. Filtering Works
   └─ ?type=rider returns only riders
   └─ ?type=driver returns only drivers
   └─ No type param returns all users

4. Error Handling
   └─ Invalid type → 400 error with message
   └─ Database error → 500 error with details

5. Frontend Integration
   └─ select-type.tsx "Select Existing" tab loads users
   └─ User can select from list
   └─ App navigates to next screen


✗ TROUBLESHOOTING IF NOT WORKING:

Problem: Empty response []
Solution: Verify users exist in DynamoDB

Problem: 500 error
Solution: Check CloudWatch logs for exceptions

Problem: Invalid JSON format
Solution: Verify common/db.py not modified

Problem: Type filtering not working
Solution: Check DynamoDB values are lowercase
```
