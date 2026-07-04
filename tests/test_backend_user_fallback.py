from fastapi.testclient import TestClient

from backend import server


client = TestClient(server.app)


def test_create_user_falls_back_to_memory_when_database_write_fails(monkeypatch):
    async def failing_insert_one(*args, **kwargs):
        raise RuntimeError("database unavailable")

    monkeypatch.setattr(server.db.users, "insert_one", failing_insert_one)

    response = client.post(
        "/api/users/create",
        json={"user_type": "rider", "name": "Fallback User"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["user_type"] == "rider"
    assert body["name"] == "Fallback User"
    assert body["user_id"].startswith("user_")
