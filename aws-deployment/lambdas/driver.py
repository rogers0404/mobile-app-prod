"""
Driver Lambda
Routes:
  POST  /api/driver/documents
  POST  /api/driver/location
  POST  /api/driver/status
  GET   /api/driver/{user_id}/documents
  GET   /api/driver/{user_id}/status
  GET   /api/driver/{user_id}/pending-rides
  GET   /api/driver/{user_id}/active-ride
  GET   /api/driver/{user_id}/earnings
"""
import json
import os
from datetime import datetime, timezone, timedelta
from boto3.dynamodb.conditions import Key, Attr
from common.db import table, ok, err

def lambda_handler(event, context):
    method = event.get('httpMethod', event.get('requestContext', {}).get('http', {}).get('method', 'GET'))
    path = event.get('path', event.get('rawPath', ''))
    path_params = event.get('pathParameters') or {}
    body = json.loads(event.get('body') or '{}')
    user_id = path_params.get('user_id')

    if method == 'POST':
        if path.endswith('/documents'):
            return upload_documents(body)
        if path.endswith('/location'):
            return update_location(body)
        if path.endswith('/status'):
            return update_status(body)

    if method == 'GET' and user_id:
        if path.endswith('/documents'):
            return get_documents(user_id)
        if path.endswith('/status'):
            return get_status(user_id)
        if path.endswith('/pending-rides'):
            return get_pending_rides(user_id)
        if path.endswith('/active-ride'):
            return get_active_ride(user_id)
        if path.endswith('/earnings'):
            return get_earnings(user_id)

    return err('Not found', 404)


def _require_driver(user_id):
    user = table('users').get_item(Key={'user_id': user_id}).get('Item')
    if not user:
        return None, err('User not found', 404)
    if user.get('user_type') != 'driver':
        return None, err('Not a driver', 403)
    return user, None


def upload_documents(body):
    user_id = body.get('user_id')
    _, e = _require_driver(user_id)
    if e:
        return e

    now = datetime.now(timezone.utc).isoformat()
    item = {
        'user_id': user_id,
        'license_data': body.get('license_data'),
        'insurance_data': body.get('insurance_data'),
        'vehicle_make': body.get('vehicle_make'),
        'vehicle_model': body.get('vehicle_model'),
        'vehicle_year': body.get('vehicle_year'),
        'vehicle_color': body.get('vehicle_color'),
        'license_plate': body.get('license_plate'),
        'uploaded_at': now,
        'verified': False,
    }
    table('driver_documents').put_item(Item=item)
    table('driver_status').update_item(
        Key={'user_id': user_id},
        UpdateExpression='SET is_verified = :v, updated_at = :t',
        ExpressionAttributeValues={':v': True, ':t': now},
    )
    return ok({'message': 'Documents uploaded', 'verified': True})


def update_location(body):
    user_id = body.get('user_id')
    _, e = _require_driver(user_id)
    if e:
        return e

    table('driver_locations').put_item(Item={
        'user_id': user_id,
        'latitude': body.get('latitude'),
        'longitude': body.get('longitude'),
        'updated_at': datetime.now(timezone.utc).isoformat(),
    })
    return ok({'message': 'Location updated'})


def update_status(body):
    user_id = body.get('user_id')
    _, e = _require_driver(user_id)
    if e:
        return e

    status = table('driver_status').get_item(Key={'user_id': user_id}).get('Item', {})
    if not status.get('is_verified'):
        return err('Driver not verified. Upload documents first.', 403)

    table('driver_status').update_item(
        Key={'user_id': user_id},
        UpdateExpression='SET is_online = :o, updated_at = :t',
        ExpressionAttributeValues={
            ':o': body.get('is_online', False),
            ':t': datetime.now(timezone.utc).isoformat(),
        },
    )
    return ok({'message': 'Status updated', 'is_online': body.get('is_online')})


def get_documents(user_id):
    _, e = _require_driver(user_id)
    if e:
        return e
    docs = table('driver_documents').get_item(Key={'user_id': user_id}).get('Item', {})
    return ok(docs)


def get_status(user_id):
    _, e = _require_driver(user_id)
    if e:
        return e
    status = table('driver_status').get_item(Key={'user_id': user_id}).get('Item', {})
    return ok(status or {'is_online': False, 'is_verified': False})


def get_pending_rides(user_id):
    _, e = _require_driver(user_id)
    if e:
        return e
    result = table('rides').scan(
        FilterExpression=Attr('status').eq('pending'),
        Limit=20,
    )
    return ok(result.get('Items', []))


def get_active_ride(user_id):
    _, e = _require_driver(user_id)
    if e:
        return e
    result = table('rides').scan(
        FilterExpression=Attr('driver_id').eq(user_id) & Attr('status').is_in(['accepted', 'picked_up'])
    )
    items = result.get('Items', [])
    return ok(items[0] if items else {})


def get_earnings(user_id):
    _, e = _require_driver(user_id)
    if e:
        return e

    result = table('rides').scan(
        FilterExpression=Attr('driver_id').eq(user_id) & Attr('status').eq('completed')
    )
    rides = result.get('Items', [])

    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    def since(cutoff):
        return [r for r in rides if r.get('completed_at', '') >= cutoff.isoformat()]

    today_rides = since(today)
    week_rides = since(week_start)
    month_rides = since(month_start)

    return ok({
        'total_earnings': round(sum(float(r.get('fare', 0)) for r in rides), 2),
        'total_rides': len(rides),
        'today': {'earnings': round(sum(float(r.get('fare', 0)) for r in today_rides), 2), 'rides': len(today_rides)},
        'this_week': {'earnings': round(sum(float(r.get('fare', 0)) for r in week_rides), 2), 'rides': len(week_rides)},
        'this_month': {'earnings': round(sum(float(r.get('fare', 0)) for r in month_rides), 2), 'rides': len(month_rides)},
    })
