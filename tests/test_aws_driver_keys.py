import importlib.util
import json
import sys
import types
from pathlib import Path
from unittest.mock import MagicMock

import pytest


LAMBDA_DIR = Path(__file__).resolve().parents[1] / "aws-deployment" / "lambdas"


@pytest.fixture
def lambdas(monkeypatch):
    tables = {
        name: MagicMock()
        for name in ("users", "driver_status", "driver_documents", "driver_locations", "rides")
    }
    db = types.ModuleType("common.db")
    db.table = lambda name: tables[name]
    db.ok = lambda body, status=200: {"statusCode": status, "body": json.dumps(body)}
    db.err = lambda message, status=400: db.ok({"error": message}, status)
    common = types.ModuleType("common")
    common.db = db

    boto3 = types.ModuleType("boto3")
    boto3.client = MagicMock()
    dynamodb = types.ModuleType("boto3.dynamodb")
    conditions = types.ModuleType("boto3.dynamodb.conditions")
    conditions.Attr = MagicMock()
    conditions.Key = MagicMock()
    for name, module in (
        ("common", common),
        ("common.db", db),
        ("boto3", boto3),
        ("boto3.dynamodb", dynamodb),
        ("boto3.dynamodb.conditions", conditions),
    ):
        monkeypatch.setitem(sys.modules, name, module)

    modules = {}
    for name in ("users", "driver", "rides", "websocket"):
        spec = importlib.util.spec_from_file_location(f"test_lambda_{name}", LAMBDA_DIR / f"{name}.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        modules[name] = module
    return modules, tables


def test_driver_creation_and_profile_use_driver_table_keys(lambdas):
    modules, tables = lambdas
    response = modules["users"].create_user({"user_type": "driver", "name": "Driver"})
    user = json.loads(response["body"])
    user_id = user["user_id"]

    assert response["statusCode"] == 201
    item = tables["driver_status"].put_item.call_args.kwargs["Item"]
    assert item["driver_id"] == user_id
    assert item["user_id"] == user_id
    tables["users"].get_item.return_value = {"Item": user}
    tables["driver_status"].get_item.return_value = {"Item": item}
    tables["driver_documents"].get_item.return_value = {}
    assert modules["users"].get_user(user_id)["statusCode"] == 200
    tables["driver_status"].get_item.assert_called_with(Key={"driver_id": user_id})
    tables["driver_documents"].get_item.assert_called_with(Key={"driver_id": user_id})

    modules["users"].delete_user(user_id)
    for name in ("driver_status", "driver_documents", "driver_locations"):
        tables[name].delete_item.assert_called_once_with(Key={"driver_id": user_id})


def test_driver_routes_and_tracking_use_driver_table_keys(lambdas):
    modules, tables = lambdas
    user_id = "driver-1"
    tables["users"].get_item.return_value = {"Item": {"user_type": "driver"}}
    tables["driver_status"].get_item.return_value = {"Item": {"is_verified": True}}
    tables["driver_documents"].get_item.return_value = {}
    tables["rides"].scan.return_value = {"Items": []}

    modules["driver"].upload_documents({"user_id": user_id})
    assert tables["driver_documents"].put_item.call_args.kwargs["Item"]["driver_id"] == user_id
    assert tables["driver_status"].update_item.call_args.kwargs["Key"] == {"driver_id": user_id}
    modules["driver"].get_documents(user_id)
    tables["driver_documents"].get_item.assert_called_with(Key={"driver_id": user_id})
    modules["driver"].get_status(user_id)
    modules["driver"].update_status({"user_id": user_id, "is_online": True})
    tables["driver_status"].get_item.assert_called_with(Key={"driver_id": user_id})
    assert tables["driver_status"].update_item.call_args.kwargs["Key"] == {"driver_id": user_id}

    modules["driver"].update_location({"user_id": user_id, "latitude": 1, "longitude": 2})
    assert tables["driver_locations"].put_item.call_args.kwargs["Item"]["driver_id"] == user_id
    modules["websocket"]._message("connection", user_id, '{"type":"location_update"}')
    assert tables["driver_locations"].put_item.call_args.kwargs["Item"]["driver_id"] == user_id

    tables["driver_status"].scan.return_value = {"Items": [{"user_id": user_id}]}
    tables["driver_locations"].get_item.return_value = {"Item": {"latitude": 1, "longitude": 2}}
    modules["rides"].nearby_drivers({"latitude": "1", "longitude": "2"})
    tables["driver_locations"].get_item.assert_called_with(Key={"driver_id": user_id})

    tables["driver_status"].get_item.return_value = {"Item": {"is_online": False}}
    modules["rides"].accept_ride({"user_id": user_id, "ride_id": "ride-1"})
    tables["driver_status"].get_item.assert_called_with(Key={"driver_id": user_id})
