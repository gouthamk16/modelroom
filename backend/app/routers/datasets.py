from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlmodel import Session, select

from app.datasets import analysis, store
from app.db import get_session
from app.models import Dataset
from app.schemas import DatasetRead

router = APIRouter(prefix="/api", tags=["datasets"])


def _load(dataset_id: int, session: Session):
    ds = session.get(Dataset, dataset_id)
    if ds is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return ds, store.load_df(dataset_id)


@router.post("/datasets", response_model=DatasetRead, status_code=status.HTTP_201_CREATED)
async def upload_dataset(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    content = await file.read()
    ds = Dataset(name=file.filename, filename=file.filename)
    session.add(ds)
    session.commit()
    session.refresh(ds)

    store.save_csv(ds.id, content)
    df = store.load_df(ds.id)
    ds.n_rows = int(len(df))
    ds.n_cols = int(len(df.columns))
    ds.size_bytes = len(content)
    session.add(ds)
    session.commit()
    session.refresh(ds)
    return ds


@router.get("/datasets", response_model=list[DatasetRead])
def list_datasets(session: Session = Depends(get_session)):
    return session.exec(select(Dataset).order_by(Dataset.created_at.desc())).all()


@router.get("/datasets/{dataset_id}", response_model=DatasetRead)
def get_dataset(dataset_id: int, session: Session = Depends(get_session)):
    ds = session.get(Dataset, dataset_id)
    if ds is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return ds


@router.get("/datasets/{dataset_id}/schema")
def get_schema(dataset_id: int, session: Session = Depends(get_session)):
    _, df = _load(dataset_id, session)
    return analysis.infer_schema(df)


@router.get("/datasets/{dataset_id}/preview")
def get_preview(dataset_id: int, n: int = 10, session: Session = Depends(get_session)):
    _, df = _load(dataset_id, session)
    return analysis.preview(df, n)


@router.get("/datasets/{dataset_id}/stats")
def get_stats(dataset_id: int, session: Session = Depends(get_session)):
    _, df = _load(dataset_id, session)
    return analysis.column_stats(df)


@router.get("/datasets/{dataset_id}/histogram")
def get_histogram(
    dataset_id: int,
    column: str,
    bins: int = 10,
    session: Session = Depends(get_session),
):
    _, df = _load(dataset_id, session)
    if column not in df.columns:
        raise HTTPException(status_code=404, detail="Column not found")
    return analysis.histogram(df, column, bins)


@router.get("/datasets/{dataset_id}/correlation")
def get_correlation(dataset_id: int, session: Session = Depends(get_session)):
    _, df = _load(dataset_id, session)
    return analysis.correlation(df)
