from app.models_builder import shape_engine


def _nodes():
    return [
        {"id": "in", "type": "input", "params": {"features": 8}},
        {"id": "l1", "type": "linear", "params": {"out_features": 16}},
        {"id": "a1", "type": "relu", "params": {}},
        {"id": "out", "type": "output", "params": {"classes": 3}},
    ]


def test_valid_chain_shapes_and_params():
    rep = shape_engine.validate(_nodes())
    assert rep["valid"] is True
    by_id = {n["id"]: n for n in rep["nodes"]}
    assert by_id["l1"]["out_shape"] == [16]
    assert by_id["l1"]["n_params"] == 8 * 16 + 16
    assert by_id["out"]["out_shape"] == [3]
    assert rep["total_params"] == (8 * 16 + 16) + (16 * 3 + 3)


def test_missing_input_is_invalid():
    rep = shape_engine.validate([{"id": "l1", "type": "linear", "params": {"out_features": 4}}])
    assert rep["valid"] is False
    assert any("input" in e.lower() for e in rep["errors"])


def test_missing_output_is_invalid():
    nodes = [
        {"id": "in", "type": "input", "params": {"features": 4}},
        {"id": "l1", "type": "linear", "params": {"out_features": 4}},
    ]
    rep = shape_engine.validate(nodes)
    assert rep["valid"] is False
    assert any("output" in e.lower() for e in rep["errors"])


def test_linear_without_out_features_errors():
    nodes = [
        {"id": "in", "type": "input", "params": {"features": 4}},
        {"id": "l1", "type": "linear", "params": {}},
        {"id": "out", "type": "output", "params": {"classes": 2}},
    ]
    rep = shape_engine.validate(nodes)
    assert rep["valid"] is False
    assert any(n["id"] == "l1" and n["error"] for n in rep["nodes"])


def test_input_features_override():
    nodes = [
        {"id": "in", "type": "input", "params": {}},
        {"id": "out", "type": "output", "params": {"classes": 2}},
    ]
    rep = shape_engine.validate(nodes, input_features=10)
    by_id = {n["id"]: n for n in rep["nodes"]}
    assert by_id["in"]["out_shape"] == [10]
