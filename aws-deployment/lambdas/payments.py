"""
Payments Lambda
Routes:
  POST /api/payment/create-order
  POST /api/payment/capture-order
"""
import json
import os
import httpx
from common.db import table, get_secret, ok, err

PAYPAL_SECRET_ARN = os.getenv('PAYPAL_SECRET_ARN')
PAYPAL_BASE_URL = os.getenv('PAYPAL_BASE_URL', 'https://api-m.sandbox.paypal.com')


def lambda_handler(event, context):
    path = event.get('path', event.get('rawPath', ''))
    qs = event.get('queryStringParameters') or {}

    if path.endswith('/create-order'):
        return create_order(qs.get('ride_id'), qs.get('user_id'))
    if path.endswith('/capture-order'):
        return capture_order(qs.get('order_id'), qs.get('user_id'))

    return err('Not found', 404)


def _get_paypal_token():
    creds = get_secret(PAYPAL_SECRET_ARN)
    resp = httpx.post(
        f'{PAYPAL_BASE_URL}/v1/oauth2/token',
        auth=(creds['client_id'], creds['secret']),
        data={'grant_type': 'client_credentials'},
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
    )
    if resp.status_code != 200:
        raise Exception('Failed to get PayPal token')
    return resp.json()['access_token']


def create_order(ride_id, user_id):
    if not ride_id or not user_id:
        return err('ride_id and user_id are required')

    ride = table('rides').get_item(Key={'ride_id': ride_id}).get('Item')
    if not ride:
        return err('Ride not found', 404)
    if ride.get('rider_id') != user_id:
        return err('Not authorized', 403)
    if ride.get('payment_status') == 'paid':
        return err('Ride already paid')

    try:
        token = _get_paypal_token()
        resp = httpx.post(
            f'{PAYPAL_BASE_URL}/v2/checkout/orders',
            headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
            json={
                'intent': 'CAPTURE',
                'purchase_units': [{
                    'reference_id': ride_id,
                    'description': f"Trip from {ride.get('pickup_address')} to {ride.get('dropoff_address')}",
                    'amount': {'currency_code': 'USD', 'value': str(ride['fare'])},
                }],
            },
        )
        if resp.status_code != 201:
            return err('Failed to create PayPal order', 500)

        order = resp.json()
        table('rides').update_item(
            Key={'ride_id': ride_id},
            UpdateExpression='SET paypal_order_id = :o',
            ExpressionAttributeValues={':o': order['id']},
        )
        return ok(order, 201)
    except Exception as e:
        return err(str(e), 500)


def capture_order(order_id, user_id):
    if not order_id or not user_id:
        return err('order_id and user_id are required')

    try:
        token = _get_paypal_token()
        resp = httpx.post(
            f'{PAYPAL_BASE_URL}/v2/checkout/orders/{order_id}/capture',
            headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
        )
        if resp.status_code != 201:
            return err('Failed to capture payment', 500)

        data = resp.json()
        if data.get('status') == 'COMPLETED':
            from datetime import datetime, timezone
            table('rides').update_item(
                Key={'paypal_order_id': order_id},
                UpdateExpression='SET payment_status = :s, payment_completed_at = :t',
                ExpressionAttributeValues={
                    ':s': 'paid',
                    ':t': datetime.now(timezone.utc).isoformat(),
                },
            )
        return ok(data)
    except Exception as e:
        return err(str(e), 500)
