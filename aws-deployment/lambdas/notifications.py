"""
Notifications Lambda
Triggered by SQS NotificationQueue.
Dispatches ride/payment events via SNS.
"""
import json
import os
import boto3

sns = boto3.client('sns')
SNS_TOPIC_ARN = os.getenv('SNS_TOPIC_ARN', '')


def lambda_handler(event, context):
    for record in event.get('Records', []):
        try:
            body = json.loads(record['body'])
            _dispatch(body)
        except Exception as e:
            print(f"Failed to process notification: {e}")
    return {'statusCode': 200}


def _dispatch(message: dict):
    msg_type = message.get('type', 'unknown')
    subject = {
        'ride_requested': 'New ride request',
        'ride_accepted': 'Your ride has been accepted',
        'ride_completed': 'Ride completed',
        'ride_cancelled': 'Ride cancelled',
        'payment_completed': 'Payment received',
        'payment_failed': 'Payment failed',
    }.get(msg_type, 'Trip notification')

    if SNS_TOPIC_ARN:
        sns.publish(
            TopicArn=SNS_TOPIC_ARN,
            Subject=subject,
            Message=json.dumps(message),
            MessageAttributes={
                'type': {'DataType': 'String', 'StringValue': msg_type}
            },
        )
