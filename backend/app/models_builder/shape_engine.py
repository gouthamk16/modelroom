"""Validate an arbitrary layer graph (nodes + edges) and infer shapes.

The model is a sequential-ish DAG: each non-input layer takes exactly one
incoming connection. We topologically order the graph, compute the feature
dimension flowing along each edge, and report per-node shapes/params/errors.
"""

PASSTHROUGH = {"relu", "dropout"}


def validate(nodes: list[dict], edges: list[dict], input_features: int | None = None) -> dict:
    by_id = {n["id"]: n for n in nodes}
    report = {
        nid: {"id": nid, "out_shape": [], "n_params": 0, "error": None} for nid in by_id
    }
    errors: list[str] = []

    incoming: dict[str, list[str]] = {nid: [] for nid in by_id}
    outgoing: dict[str, list[str]] = {nid: [] for nid in by_id}
    for e in edges:
        s, t = e.get("source"), e.get("target")
        if s in by_id and t in by_id:
            outgoing[s].append(t)
            incoming[t].append(s)

    inputs = [n for n in nodes if n["type"] == "input"]
    outputs = [n for n in nodes if n["type"] == "output"]
    if not inputs:
        errors.append("Add an input layer")
    if len(inputs) > 1:
        errors.append("Only one input layer is allowed")
    if not outputs:
        errors.append("Add an output layer")

    # Kahn topological sort; if it can't consume every node there is a cycle.
    indeg = {nid: len(incoming[nid]) for nid in by_id}
    queue = [nid for nid in by_id if indeg[nid] == 0]
    topo: list[str] = []
    while queue:
        nid = queue.pop(0)
        topo.append(nid)
        for m in outgoing[nid]:
            indeg[m] -= 1
            if indeg[m] == 0:
                queue.append(m)
    if len(topo) != len(by_id):
        errors.append("The graph has a cycle")
        return {
            "valid": False,
            "total_params": 0,
            "nodes": [report[n["id"]] for n in nodes],
            "errors": errors,
        }

    dim: dict[str, int] = {}
    for nid in topo:
        node = by_id[nid]
        t = node["type"]
        p = node.get("params", {})
        r = report[nid]
        inc = incoming[nid]

        if t == "input":
            d = int(p.get("features") or input_features or 0)
            if d <= 0:
                r["error"] = "Input features must be > 0"
            else:
                dim[nid] = d
                r["out_shape"] = [d]
            continue

        if len(inc) == 0:
            r["error"] = "Not connected to an input"
            continue
        if len(inc) > 1:
            r["error"] = "Only one incoming connection is supported"
            continue
        src = inc[0]
        if src not in dim:
            r["error"] = "Upstream layer is invalid"
            continue
        cur = dim[src]

        if t == "linear":
            o = int(p.get("out_features", 0))
            if o <= 0:
                r["error"] = "out_features must be > 0"
                continue
            r["n_params"] = cur * o + o
            dim[nid] = o
            r["out_shape"] = [o]
        elif t in PASSTHROUGH:
            dim[nid] = cur
            r["out_shape"] = [cur]
        elif t == "batchnorm1d":
            r["n_params"] = 2 * cur
            dim[nid] = cur
            r["out_shape"] = [cur]
        elif t == "output":
            c = int(p.get("classes", 0))
            if c <= 0:
                r["error"] = "classes must be > 0"
                continue
            r["n_params"] = cur * c + c
            dim[nid] = c
            r["out_shape"] = [c]
        else:
            r["error"] = f"Unknown layer type: {t}"

    for nid in topo:
        if report[nid]["error"]:
            errors.append(f"{by_id[nid]['type']}: {report[nid]['error']}")

    if outputs and not any(report[o["id"]]["out_shape"] for o in outputs):
        if "Add an input layer" not in errors:
            errors.append("Connect a path from input to output")

    total = sum(r["n_params"] for r in report.values())
    return {
        "valid": len(errors) == 0,
        "total_params": total,
        "nodes": [report[n["id"]] for n in nodes],
        "errors": errors,
    }
