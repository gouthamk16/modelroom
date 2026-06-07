from datetime import datetime

from app.models import Project


def test_project_defaults():
    p = Project(name="Churn")
    assert p.name == "Churn"
    assert p.id is None
    assert isinstance(p.created_at, datetime)


def test_dataset_defaults():
    from app.models import Dataset

    d = Dataset(project_id=1, name="churn.csv", filename="churn.csv")
    assert d.project_id == 1
    assert d.n_rows == 0
    assert d.n_cols == 0
