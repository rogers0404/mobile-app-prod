"""
Rides Lambda
Routes:
  GET   /api/rider/nearby-drivers
  POST  /api/rides/request
  POST  /api/rides/accept
  POST  /api/rides/update-status
  POST  /api/rides/rate
  GET   /api/rides/{user_id}/active
  GET   /api/rides/{user_id}/history
  GET   /api/rides/details/{ride_id}
"""
import json
import math
import uuid
import os
import boto3
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Attr
from common.db import table, ok, err

sqs = boto3.client('sqs')
SQS_RIDE_QUEUE_URL = os.getenv('SQS_RIDE_QUEUE_URL')
BASE_FARE = 2.00
PER_MILE = 1.50


def lambda_handler(event, context):
    method = event.get('httpMethod', event.get('requestContext', {}).get('http', {}).get('method', 'GET'))
    path = event.get('path', event.get('rawPath', ''))
    path_params = event.get('pathParameters') or {}
    qs = event.get('queryStringParameters') or {}
    body = json.loads(event.get('body') or '{}')

    if method == 'GET':
        if 'nearby-drivers' in path:
            return nearby_drivers(qs)
        user_id = path_params.get('user_id')
        ride_id = path_params.get('ride_id')
        if ride_id:
            return get_ride_details(ride_id, qs.get('user_id', ''))
        if user_id and path.endswith('/active'):
            return get_active_ride(user_id)
        if user_id and path.endswith('/history'):
            return get_history(user_id, qs)

    if method == 'POST':
        if path.endswith('/request'):
            return request_ride(body)
        if path.endswith('/accept'):
            return accept_ride(body)
        if path.endswith('/update-status'):
            return update_status(body)
        if path.endswith('/rate'):
            return rate_ride(body)

    return err('Not found', 404)


def _haversine(lat1, lon1, lat2, lon2):
    R = 3959
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def nearby_drivers(qs):
    lat = float(qs.get('latitude', 0))
    lon = float(qs.get('longitude', 0))
    radius = float(qs.get('radius', 10))

    online = table('driver_status').scan(
        FilterExpression=Attr('is_online').eq(True) & Attr('is_verified').eq(True)
    ).get('Items', [])

    result = []
    for driver in online:
        loc = table('driver_locations').get_item(Key={'user_id': driver['user_id']}).get('Item')
        if not loc:
            continue
        dist = _haversine(lat, lon, float(loc['latitude']), float(loc['longitude']))
        if dist <= radius:
            user = table('users').get_item(Key={'user_id': driver['user_id']}).get('Item', {})
            result.append({
                'user_id': driver['user_id'],
                'name': user.get('name', 'Driver'),
                'latitude': loc['latitude'],
                'longitude': loc['longitude'],
                'distance': round(dist, 2),
            })
    return ok(result)


def request_ride(body):
    user_id = body.get('user_id')
    user = table('users').get_item(Key={'user_id': user_id}).get('Item')
    if not user:
        return err('User not found', 404)
    if user.get('user_type') != 'rider':
        return err('Only riders can request rides', 403)

    dist = _haversine(
        float(body['pickup_latitude']), float(body['pickup_longitude']),
        float(body['dropoff_latitude']), float(body['dropoff_longitude'])
    )
    fare = round(BASE_FARE + PER_MILE * dist, 2)
    ride_id = f"ride_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()

    ride = {
        'ride_id': ride_id,
        'rider_id': user_id,
        'rider_name': user.get('name'),
        'driver_id': None,
        'pickup_latitude': str(body['pickup_latitude']),
        'pickup_longitude': str(body['pickup_longitude']),
        'pickup_address': body.get('pickup_address', ''),
        'dropoff_latitude': str(body['dropoff_latitude']),
        'dropoff_longitude': str(body['dropoff_longitude']),
        'dropoff_address': body.get('dropoff_address', ''),
        'distance_miles': round(dist, 2),
        'fare': fare,
        'status': 'pending',
        'payment_status': 'unpaid',
        'created_at': now,
    }
    table('rides').put_item(Item=ride)

    if SQS_RIDE_QUEUE_URL:
        sqs.send_message(QueueUrl=SQS_RIDE_QUEUE_URL, MessageBody=json.dumps(ride, default=str))

    return ok(ride, 201)


def accept_ride(body):
    user_id = body.get('user_id')
    ride_id = body.get('ride_id')

    driver_status = table('driver_status').get_item(Key={'user_id': user_id}).get('Item', {})
    if not driver_status.get('is_online'):
        return err('Must be online to accept rides', 403)
    if not driver_status.get('is_verified'):
        return err('Must be verified to accept rides', 403)

    ride = table('rides').get_item(Key={'ride_id': ride_id}).get('Item')
    if not ride or ride.get('status') != 'pending':
        return err('Ride not found or already accepted', 404)

    user = table('users').get_item(Key={'user_id': user_id}).get('Item', {})
    now = datetime.now(timezone.utc).isoformat()

    table('rides').update_item(
        Key={'ride_id': ride_id},
        UpdateExpression='SET driver_id = :d, driver_name = :n, #s = :s, accepted_at = :t',
        ExpressionAttributeNames={'#s': 'status'},
        ExpressionAttributeValues={
            ':d': user_id, ':n': user.get('name'),
            ':s': 'accepted', ':t': now,
        },
    )
    return ok({'message': 'Ride accepted', 'ride_id': ride_id})


def update_status(body):
    ride_id = body.get('ride_id')
    user_id = body.get('user_id')
    new_status = body.get('status')

    ride = table('rides').get_item(Key={'ride_id': ride_id}).get('Item')
    if not ride:
        return err('Ride not found', 404)
    if user_id not in [ride.get('driver_id'), ride.get('rider_id')]:
        return err('Not authorized', 403)

    valid = {'accepted': ['picked_up', 'cancelled'], 'picked_up': ['completed', 'cancelled'], 'pending': ['cancelled']}
    if new_status not in valid.get(ride['status'], []):
        return err(f"Cannot change from {ride['status']} to {new_status}")

    now = datetime.now(timezone.utc).isoformat()
    ts_field = {'picked_up': 'picked_up_at', 'completed': 'completed_at', 'cancelled': 'cancelled_at'}.get(new_status)

    expr = 'SET #s = :s'
    names = {'#s': 'status'}
    values = {':s': new_status}
    if ts_field:
        expr += f', {ts_field} = :t'
        values[':t'] = now

    table('rides').update_item(Key={'ride_id': ride_id}, UpdateExpression=expr,
                               ExpressionAttributeNames=names, ExpressionAttributeValues=values)
    return ok({'message': 'Status updated', 'status': new_status})


def rate_ride(body):
    ride_id = body.get('ride_id')
    user_id = body.get('user_id')
    rating = int(body.get('rating', 0))

    if not 1 <= rating <= 5:
        return err('Rating must be between 1 and 5')

    ride = table('rides').get_item(Key={'ride_id': ride_id}).get('Item')
    if not ride:
        return err('Ride not found', 404)
    if ride.get('status') != 'completed':
        return err('Can only rate completed rides')
    if user_id not in [ride.get('driver_id'), ride.get('rider_id')]:
        return err('Not authorized', 403)

    user = table('users').get_item(Key={'user_id': user_id}).get('Item', {})
    field = 'rider_rating' if user.get('user_type') == 'rider' else 'driver_rating'

    table('rides').update_item(
        Key={'ride_id': ride_id},
        UpdateExpression=f'SET {field} = :r',
        ExpressionAttributeValues={':r': rating},
    )
    return ok({'message': 'Rating submitted'})


def get_active_ride(user_id):
    user = table('users').get_item(Key={'user_id': user_id}).get('Item')
    if not user:
        return err('User not found', 404)

    statuses = ['pending', 'accepted', 'picked_up'] if user.get('user_type') == 'rider' else ['accepted', 'picked_up']
    id_field = 'rider_id' if user.get('user_type') == 'rider' else 'driver_id'

    result = table('rides').scan(
        FilterExpression=Attr(id_field).eq(user_id) & Attr('status').is_in(statuses)
    )
    items = result.get('Items', [])
    return ok(items[0] if items else {})


def get_history(user_id, qs):
    user = table('users').get_item(Key={'user_id': user_id}).get('Item')
    if not user:
        return err('User not found', 404)

    id_field = 'rider_id' if user.get('user_type') == 'rider' else 'driver_id'
    fe = Attr(id_field).eq(user_id)

    status = qs.get('status')
    if status and status != 'all':
        fe = fe & Attr('status').eq(status)

    result = table('rides').scan(FilterExpression=fe)
    rides = sorted(result.get('Items', []), key=lambda r: r.get('created_at', ''), reverse=True)
    return ok(rides[:int(qs.get('limit', 50))])


def get_ride_details(ride_id, user_id):
    ride = table('rides').get_item(Key={'ride_id': ride_id}).get('Item')
    if not ride:
        return err('Ride not found', 404)
    if user_id not in [ride.get('driver_id'), ride.get('rider_id')]:
        return err('Not authorized', 403)
    return ok(ride)
