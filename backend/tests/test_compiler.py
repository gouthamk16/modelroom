import torch

from app.models_builder import compiler


def _chain():
    nodes = [
        {"id": "in", "type": "input", "params": {"features": 4}},
        {"id": "l1", "type": "linear", "params": {"out_features": 8}},
        {"id": "a1", "type": "relu", "params": {}},
        {"id": "out", "type": "output", "params": {"classes": 3}},
    ]
    edges = [
        {"source": "in", "target": "l1"},
        {"source": "l1", "target": "a1"},
        {"source": "a1", "target": "out"},
    ]
    return nodes, edges


def test_compile_forward_shape():
    nodes, edges = _chain()
    module = compiler.build_module(nodes, edges)
    x = torch.randn(5, 4)
    y = module(x)
    assert y.shape == (5, 3)


def test_compile_param_count_matches_shape_engine():
    nodes, edges = _chain()
    module = compiler.build_module(nodes, edges)
    n = sum(p.numel() for p in module.parameters())
    assert n == (4 * 8 + 8) + (8 * 3 + 3)
