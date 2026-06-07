PASSTHROUGH = {"relu", "dropout"}


def validate(nodes: list[dict], input_features: int | None = None) -> dict:
    report = []
    errors = []
    total = 0
    cur: int | None = None

    if not nodes or nodes[0]["type"] != "input":
        errors.append("Graph must start with an input layer")

    for node in nodes:
        t = node["type"]
        p = node.get("params", {})
        err = None
        out: list[int] = []
        n_params = 0

        if t == "input":
            cur = int(p.get("features") or input_features or 0)
            if cur <= 0:
                err = "Input features must be > 0"
            out = [cur]
        elif t == "linear":
            o = int(p.get("out_features", 0))
            if cur is None:
                err = "No input dimension before this layer"
            elif o <= 0:
                err = "out_features must be > 0"
            else:
                n_params = cur * o + o
                out = [o]
                cur = o
        elif t in PASSTHROUGH:
            out = [cur] if cur is not None else []
        elif t == "batchnorm1d":
            if cur is None:
                err = "No input dimension before this layer"
            else:
                n_params = 2 * cur
                out = [cur]
        elif t == "output":
            c = int(p.get("classes", 0))
            if cur is None:
                err = "No input dimension before this layer"
            elif c <= 0:
                err = "classes must be > 0"
            else:
                n_params = cur * c + c
                out = [c]
                cur = c
        else:
            err = f"Unknown layer type: {t}"

        if err:
            errors.append(f"{t}: {err}")
        total += n_params
        report.append({"id": node["id"], "out_shape": out, "n_params": n_params, "error": err})

    if not any(n["type"] == "output" for n in nodes):
        errors.append("Graph must end with an output layer")

    return {
        "valid": len(errors) == 0,
        "total_params": total,
        "nodes": report,
        "errors": errors,
    }
