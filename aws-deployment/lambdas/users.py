"""
Users Lambda
Routes:
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

    if method == 'GET':
        return get_user(user_id)
    if method == 'PUT':
        return update_user(user_id, body)
    if method == 'DELETE':
        return delete_user(user_id)

    return err('Not found', 404)


def create_user(body):
    user_type = body.get('user_type')
    if user_type not in ('rider', 'driver'):
        return err("user_type must be 'rider' or 'driver'")

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()

    item = {
        'user_id': user_id,
        'name': body.get('name', 'Trip User'),
        'user_type': user_type,
        'created_at': now,
    }
    table('users').put_item(Item=item)

    if user_type == 'driver':
        table('driver_status').put_item(Item={
            'user_id': user_id,
            'is_online': False,
            'is_verified': False,
            'created_at': now,
        })

    return ok(item, 201)


def get_user(user_id):
    resp = table('users').get_item(Key={'user_id': user_id})
    user = resp.get('Item')
    if not user:
        return err('User not found', 404)

    if user.get('user_type') == 'driver':
        status = table('driver_status').get_item(Key={'user_id': user_id}).get('Item', {})
        docs = table('driver_documents').get_item(Key={'user_id': user_id}).get('Item', {})
        user['driver_status'] = status
        user['documents'] = docs

    return ok(user)


def update_user(user_id, body):
    allowed = {k: body[k] for k in ('name', 'phone', 'email') if k in body}
    if not allowed:
        return err('No valid fields to update')

    allowed['updated_at'] = datetime.now(timezone.utc).isoformat()
    expr = 'SET ' + ', '.join(f'#{k} = :{k}' for k in allowed)
    names = {f'#{k}': k for k in allowed}
    values = {f':{k}': v for k, v in allowed.items()}

    table('users').update_item(
        Key={'user_id': user_id},
        UpdateExpression=expr,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
    )
    return ok({'message': 'User updated'})


def delete_user(user_id):
    resp = table('users').get_item(Key={'user_id': user_id})
    user = resp.get('Item')
    if not user:
        return err('User not found', 404)

    table('users').delete_item(Key={'user_id': user_id})

    if user.get('user_type') == 'driver':
        table('driver_status').delete_item(Key={'user_id': user_id})
        table('driver_documents').delete_item(Key={'user_id': user_id})
        table('driver_locations').delete_item(Key={'user_id': user_id})

    return ok({'message': 'Account deleted'})
