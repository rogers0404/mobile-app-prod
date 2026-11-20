import boto3
import json
import os

_secrets_cache = {}

dynamodb = boto3.resource('dynamodb', region_name=os.getenv('AWS_REGION', 'us-east-1'))
secrets_client = boto3.client('secretsmanager', region_name=os.getenv('AWS_REGION', 'us-east-1'))

PREFIX = os.getenv('DYNAMODB_TABLE_PREFIX', 'production_')


def table(name: str):
    return dynamodb.Table(f"{PREFIX}{name}")


def get_secret(secret_arn: str) -> dict:
    if secret_arn in _secrets_cache:
        return _secrets_cache[secret_arn]
    value = secrets_client.get_secret_value(SecretId=secret_arn)
    parsed = json.loads(value['SecretString'])
    _secrets_cache[secret_arn] = parsed
    return parsed


def ok(body: dict, status: int = 200) -> dict:
    return {
        'statusCode': status,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps(body, default=str)
    }


def err(message: str, status: int = 400) -> dict:
    return {
        'statusCode': status,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': message})
    }
