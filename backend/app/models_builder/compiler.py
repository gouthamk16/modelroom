import torch.nn as nn

# Ordered, sequential MLP compiler. Assumes a validated single-path graph
# (run shape_engine.validate first). Walks nodes in topological/edge order.


def _topo(nodes: list[dict], edges: list[dict]) -> list[dict]:
    by_id = {n["id"]: n for n in nodes}
    incoming = {n["id"]: 0 for n in nodes}
    nxt: dict[str, list[str]] = {n["id"]: [] for n in nodes}
    for e in edges:
        if e["source"] in by_id and e["target"] in by_id:
            incoming[e["target"]] += 1
            nxt[e["source"]].append(e["target"])
    queue = [nid for nid in by_id if incoming[nid] == 0]
    order = []
    while queue:
        nid = queue.pop(0)
        order.append(by_id[nid])
        for m in nxt[nid]:
            incoming[m] -= 1
            if incoming[m] == 0:
                queue.append(m)
    return order


def build_module(nodes: list[dict], edges: list[dict]) -> nn.Module:
    layers: list[nn.Module] = []
    dim = 0
    for node in _topo(nodes, edges):
        t = node["type"]
        p = node.get("params", {})
        if t == "input":
            dim = int(p.get("features", 0))
        elif t == "linear":
            o = int(p["out_features"])
            layers.append(nn.Linear(dim, o))
            dim = o
        elif t == "relu":
            layers.append(nn.ReLU())
        elif t == "dropout":
            layers.append(nn.Dropout(float(p.get("p", 0.5))))
        elif t == "batchnorm1d":
            layers.append(nn.BatchNorm1d(dim))
        elif t == "output":
            c = int(p["classes"])
            layers.append(nn.Linear(dim, c))
            dim = c
    return nn.Sequential(*layers)
