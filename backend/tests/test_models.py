from datetime import datetime

from app.models import Project


def test_project_defaults():
    p = Project(name="Churn")
    assert p.name == "Churn"
    assert p.id is None
    assert isinstance(p.created_at, datetime)
