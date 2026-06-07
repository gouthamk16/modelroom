import argparse
import json
import time

import numpy as np
import torch
import torch.nn as nn

from app.models_builder import compiler
from app.preprocessing import store as prep_store
from app.training import runs_store


def _pick_device(devices: list[str]) -> torch.device:
    for d in devices:
        if d.startswith("cuda") and torch.cuda.is_available():
            return torch.device(d)
    return torch.device("cpu")


def _batches(X, y, batch_size, device):
    xt = torch.tensor(X, dtype=torch.float32, device=device)
    yt = torch.tensor(np.asarray(y), device=device)
    n = xt.shape[0]
    for i in range(0, n, batch_size):
        yield xt[i : i + batch_size], yt[i : i + batch_size]


def run_training(run_id, prep_id, nodes, edges, task, config, resume=False):
    device = _pick_device(config.get("devices", ["cpu"]))
    data = prep_store.load_prepared(prep_id)
    module = compiler.build_module(nodes, edges).to(device)

    if task == "classification":
        loss_fn = nn.CrossEntropyLoss()
        y_train = data["y_train"].astype("int64")
        y_val = data["y_val"].astype("int64")
    else:
        loss_fn = nn.MSELoss()
        y_train = data["y_train"].astype("float32")
        y_val = data["y_val"].astype("float32")

    lr = float(config.get("lr", 1e-3))
    optimizer = (
        torch.optim.Adam(module.parameters(), lr=lr)
        if config.get("optimizer", "adam") == "adam"
        else torch.optim.SGD(module.parameters(), lr=lr)
    )

    start_epoch = 0
    if resume:
        ckpt_path = runs_store.latest_checkpoint(run_id)
        if ckpt_path is not None:
            ckpt = torch.load(ckpt_path, map_location=device)
            module.load_state_dict(ckpt["model"])
            optimizer.load_state_dict(ckpt["optimizer"])
            start_epoch = int(ckpt["epoch"])

    epochs = int(config.get("epochs", 20))
    batch_size = int(config.get("batch_size", 32))
    runs_store.append_log(run_id, f"device={device} resume_from={start_epoch}")

    for epoch in range(start_epoch + 1, epochs + 1):
        if runs_store.pause_requested(run_id):
            runs_store.append_log(run_id, f"paused before epoch {epoch}")
            return "paused"

        module.train()
        total = 0.0
        nb = 0
        for xb, yb in _batches(data["X_train"], y_train, batch_size, device):
            optimizer.zero_grad()
            loss = loss_fn(module(xb), yb)
            loss.backward()
            optimizer.step()
            total += float(loss.item())
            nb += 1
        train_loss = total / max(nb, 1)

        module.eval()
        with torch.no_grad():
            xv = torch.tensor(data["X_val"], dtype=torch.float32, device=device)
            yv = torch.tensor(y_val, device=device)
            vout = module(xv)
            val_loss = float(loss_fn(vout, yv).item())
            val_acc = (
                float((vout.argmax(1) == yv).float().mean().item())
                if task == "classification"
                else 0.0
            )

        runs_store.append_metric(
            run_id,
            {
                "epoch": epoch,
                "train_loss": round(train_loss, 6),
                "val_loss": round(val_loss, 6),
                "val_acc": round(val_acc, 6),
                "t": time.time(),
            },
        )
        runs_store.append_log(
            run_id, f"epoch {epoch}/{epochs} train_loss={train_loss:.4f} val_acc={val_acc:.4f}"
        )
        torch.save(
            {"model": module.state_dict(), "optimizer": optimizer.state_dict(), "epoch": epoch},
            runs_store.run_dir(run_id) / "checkpoints" / f"epoch_{epoch:04d}.pt",
        )

    try:
        _evaluate(run_id, module, data, task, device)
    except Exception as exc:  # eval is best-effort
        runs_store.append_log(run_id, f"eval skipped: {exc}")

    runs_store.append_log(run_id, "training complete")
    return "completed"


def _evaluate(run_id, module, data, task, device) -> None:
    module.eval()
    with torch.no_grad():
        xt = torch.tensor(data["X_test"], dtype=torch.float32, device=device)
        out = module(xt).cpu().numpy()

    if task == "classification":
        from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

        yt = data["y_test"].astype(int)
        preds = out.argmax(1)
        n = int(max(int(yt.max()) + 1, int(preds.max()) + 1))
        labels = list(range(n))
        cm = confusion_matrix(yt, preds, labels=labels).tolist()
        rep = classification_report(
            yt, preds, labels=labels, output_dict=True, zero_division=0
        )
        per_class = [
            {
                "label": str(lbl),
                "precision": round(rep[str(lbl)]["precision"], 4),
                "recall": round(rep[str(lbl)]["recall"], 4),
                "f1": round(rep[str(lbl)]["f1-score"], 4),
                "support": int(rep[str(lbl)]["support"]),
            }
            for lbl in labels
        ]
        runs_store.write_eval(
            run_id,
            {
                "task": "classification",
                "accuracy": round(float(accuracy_score(yt, preds)), 4),
                "labels": [str(lbl) for lbl in labels],
                "confusion_matrix": cm,
                "per_class": per_class,
            },
        )
    else:
        yt = data["y_test"].astype("float32")
        mse = float(((out.ravel() - yt) ** 2).mean())
        runs_store.write_eval(run_id, {"task": "regression", "mse": round(mse, 6)})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", required=True)
    ap.add_argument("--resume", action="store_true")
    args = ap.parse_args()
    spec = json.loads(open(args.spec, encoding="utf-8").read())
    status = run_training(
        spec["run_id"], spec["prep_id"], spec["nodes"], spec["edges"],
        spec["task"], spec["config"], resume=args.resume,
    )
    print(f"STATUS={status}")


if __name__ == "__main__":
    main()
