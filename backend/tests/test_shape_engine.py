from app.models_builder import shape_engine


def _chain():
    nodes = [
        {"id": "in", "type": "input", "params": {"features": 8}},
        {"id": "l1", "type": "linear", "params": {"out_features": 16}},
        {"id": "a1", "type": "relu", "params": {}},
        {"id": "out", "type": "output", "params": {"classes": 3}},
    ]
    edges = [
        {"source": "in", "target": "l1"},
        {"source": "l1", "target": "a1"},
        {"source": "a1", "target": "out"},
    ]
    return nodes, edges


def test_valid_chain_shapes_and_params():
    nodes, edges = _chain()
    rep = shape_engine.validate(nodes, edges)
    assert rep["valid"] is True
    by_id = {n["id"]: n for n in rep["nodes"]}
    assert by_id["l1"]["out_shape"] == [16]
    assert by_id["l1"]["n_params"] == 8 * 16 + 16
    assert by_id["out"]["out_shape"] == [3]
    assert rep["total_params"] == (8 * 16 + 16) + (16 * 3 + 3)


def test_missing_input_invalid():
    nodes = [
        {"id": "l1", "type": "linear", "params": {"out_features": 4}},
        {"id": "out", "type": "output", "params": {"classes": 2}},
    ]
    edges = [{"source": "l1", "target": "out"}]
    rep = shape_engine.validate(nodes, edges)
    assert rep["valid"] is False
    assert any("input" in e.lower() for e in rep["errors"])


def test_missing_output_invalid():
    nodes = [
        {"id": "in", "type": "input", "params": {"features": 4}},
        {"id": "l1", "type": "linear", "params": {"out_features": 4}},
    ]
    edges = [{"source": "in", "target": "l1"}]
    rep = shape_engine.validate(nodes, edges)
    assert rep["valid"] is False
    assert any("output" in e.lower() for e in rep["errors"])


def test_unconnected_node_errors():
    nodes = [
        {"id": "in", "type": "input", "params": {"features": 4}},
        {"id": "l1", "type": "linear", "params": {"out_features": 4}},
        {"id": "stray", "type": "relu", "params": {}},
        {"id": "out", "type": "output", "params": {"classes": 2}},
    ]
    edges = [{"source": "in", "target": "l1"}, {"source": "l1", "target": "out"}]
    rep = shape_engine.validate(nodes, edges)
    assert rep["valid"] is False
    by_id = {n["id"]: n for n in rep["nodes"]}
    assert by_id["stray"]["error"] is not None


def test_multiple_incoming_errors():
    nodes = [
        {"id": "in", "type": "input", "params": {"features": 4}},
        {"id": "in2", "type": "input", "params": {"features": 4}},
        {"id": "out", "type": "output", "params": {"classes": 2}},
    ]
    edges = [{"source": "in", "target": "out"}, {"source": "in2", "target": "out"}]
    rep = shape_engine.validate(nodes, edges)
    assert rep["valid"] is False
    by_id = {n["id"]: n for n in rep["nodes"]}
    assert by_id["out"]["error"] is not None


def test_cycle_detected():
    nodes = [
        {"id": "in", "type": "input", "params": {"features": 4}},
        {"id": "l1", "type": "linear", "params": {"out_features": 4}},
        {"id": "l2", "type": "linear", "params": {"out_features": 4}},
        {"id": "out", "type": "output", "params": {"classes": 2}},
    ]
    edges = [
        {"source": "in", "target": "l1"},
        {"source": "l1", "target": "l2"},
        {"source": "l2", "target": "l1"},
        {"source": "l2", "target": "out"},
    ]
    rep = shape_engine.validate(nodes, edges)
    assert rep["valid"] is False
    assert any("cycle" in e.lower() for e in rep["errors"])


def test_input_features_override():
    nodes = [
        {"id": "in", "type": "input", "params": {}},
        {"id": "out", "type": "output", "params": {"classes": 2}},
    ]
    edges = [{"source": "in", "target": "out"}]
    rep = shape_engine.validate(nodes, edges, input_features=10)
    by_id = {n["id"]: n for n in rep["nodes"]}
    assert by_id["in"]["out_shape"] == [10]
    assert rep["valid"] is True
