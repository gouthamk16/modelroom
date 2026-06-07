import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine

from app import db
from app.main import create_app


@pytest.fixture
def client(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path/'test.db'}",
        connect_args={"check_same_thread": False},
    )
    db.set_engine(engine)
    SQLModel.metadata.create_all(engine)
    app = create_app()
    with TestClient(app) as c:
        yield c
    db.set_engine(None)
