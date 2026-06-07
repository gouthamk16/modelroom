import pandas as pd

from app.config import get_settings


def mnist_dataframe(n: int = 6000) -> pd.DataFrame:
    """A flattened MNIST subset: px0..px783 (0-255) + label (0-9)."""
    from torchvision import datasets

    cache = get_settings().workspace_dir / ".torch"
    cache.mkdir(parents=True, exist_ok=True)
    ds = datasets.MNIST(root=str(cache), train=True, download=True)
    data = ds.data.numpy().reshape(len(ds), -1)[:n]
    labels = ds.targets.numpy()[:n]
    df = pd.DataFrame(data, columns=[f"px{i}" for i in range(data.shape[1])])
    df["label"] = labels
    return df


SAMPLES: dict[str, dict] = {
    "mnist": {"filename": "mnist_sample.csv", "loader": mnist_dataframe},
}
