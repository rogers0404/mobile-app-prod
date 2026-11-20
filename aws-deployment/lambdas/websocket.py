"""
WebSocket Lambda
Handles: $connect, $disconnect, location_update messages
API Gateway WebSocket routes call this function.
"""
import json
import os
import boto3
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Attr
from common.db import table, ok, err

APIGW_ENDPOINT = os.getenv('APIGW_WEBSOCKET_ENDPOINT')  # set after WebSocket API is created


def lambda_handler(event, context):
    route = event.get('requestContext', {}).get('routeKey')
    connection_id = event.get('requestContext', {}).get('connectionId')
    user_id = event.get('pathParameters', {}).get('user_id') or \
              event.get('queryStringParameters', {}).get('user_id', '')

    if route == '$connect':
        return _connect(connection_id, user_id)
    if route == '$disconnect':
        return _disconnect(connection_id, user_id)
    if route == '$default':
        return _message(connection_id, user_id, event.get('body', '{}'))

    return {'statusCode': 200}


def _connect(connection_id, user_id):
    if user_id:
        table('ws_connections').put_item(Item={
            'user_id': user_id,
            'connection_id': connection_id,
            'connected_at': datetime.now(timezone.utc).isoformat(),
        })
    return {'statusCode': 200}


def _disconnect(connection_id, user_id):
    if user_id:
        table('ws_connections').delete_item(Key={'user_id': user_id})
    return {'statusCode': 200}


def _message(connection_id, user_id, raw_body):
    try:
        data = json.loads(raw_body)
    except Exception:
        return {'statusCode': 400}

    if data.get('type') == 'location_update':
        now = datetime.now(timezone.utc).isoformat()
        table('driver_locations').put_item(Item={
            'user_id': user_id,
            'latitude': data.get('latitude'),
            'longitude': data.get('longitude'),
            'updated_at': now,
        })

        # Notify rider on active ride
        active = table('rides').scan(
            FilterExpression=Attr('driver_id').eq(user_id) & Attr('status').is_in(['accepted', 'picked_up'])
        ).get('Items', [])

        if active and APIGW_ENDPOINT:
            rider_id = active[0].get('rider_id')
            conn = table('ws_connections').get_item(Key={'user_id': rider_id}).get('Item')
            if conn:
                _send(conn['connection_id'], {
                    'type': 'driver_location',
                    'latitude': data.get('latitude'),
                    'longitude': data.get('longitude'),
                })

    return {'statusCode': 200}


def _send(connection_id, payload):
    if not APIGW_ENDPOINT:
        return
    client = boto3.client('apigatewaymanagementapi', endpoint_url=APIGW_ENDPOINT)
    try:
        client.post_to_connection(
            ConnectionId=connection_id,
            Data=json.dumps(payload).encode('utf-8'),
        )
    except client.exceptions.GoneException:
        pass
