import shutil
import subprocess

from fastapi import APIRouter

router = APIRouter(prefix="/api/system", tags=["system"])


def _gpus() -> list[dict]:
    smi = shutil.which("nvidia-smi")
    if not smi:
        return []
    try:
        result = subprocess.run(
            [smi, "--query-gpu=index,name,memory.total", "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            timeout=5,
        )
    except Exception:
        return []
    gpus = []
    for line in result.stdout.strip().splitlines():
        parts = [p.strip() for p in line.split(",")]
        if len(parts) >= 3 and parts[0].isdigit():
            gpus.append(
                {
                    "id": f"cuda:{parts[0]}",
                    "name": parts[1],
                    "kind": "cuda",
                    "memory_mb": int(float(parts[2])),
                }
            )
    return gpus


@router.get("/devices")
def devices() -> list[dict]:
    return [{"id": "cpu", "name": "CPU", "kind": "cpu", "memory_mb": None}, *_gpus()]
