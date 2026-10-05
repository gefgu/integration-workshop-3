"""SFR5/SFR6/SFR8: isomorphism between the bench graph and a target graph."""
from __future__ import annotations

import networkx as nx
from networkx.algorithms.isomorphism import GraphMatcher

from .models import MatchOptions


def _node_attrs(opts: MatchOptions) -> tuple[str, ...]:
    attrs = ["ctype", "terminal"]
    if opts.match_values:
        attrs.append("value")
    if opts.strict_positions:
        attrs += ["rel_col", "rel_row"]
    return tuple(attrs)


def _label(g: nx.Graph, n: str, attrs: tuple[str, ...]) -> tuple:
    d = g.nodes[n]
    return tuple(d.get(a) for a in attrs)


def graph_hash(g: nx.Graph, opts: MatchOptions | None = None) -> str:
    """Isomorphism-invariant hash (WL), used for change detection (SFR7) and as a prefilter."""
    opts = opts or MatchOptions()
    attrs = _node_attrs(opts)
    h = g.copy()
    for n in h.nodes:
        h.nodes[n]["_l"] = repr(_label(g, n, attrs))
    return nx.weisfeiler_lehman_graph_hash(h, node_attr="_l", edge_attr="kind")


def is_match(student: nx.Graph, target: nx.Graph, opts: MatchOptions | None = None) -> bool:
    opts = opts or MatchOptions()
    if student.number_of_nodes() != target.number_of_nodes():
        return False
    if student.number_of_edges() != target.number_of_edges():
        return False
    attrs = _node_attrs(opts)
    if sorted(_label(student, n, attrs) for n in student) != sorted(_label(target, n, attrs) for n in target):
        return False
    if sorted(d for _, d in student.degree) != sorted(d for _, d in target.degree):
        return False
    if graph_hash(student, opts) != graph_hash(target, opts):
        return False
    gm = GraphMatcher(
        student, target,
        node_match=lambda a, b: all(a.get(k) == b.get(k) for k in attrs),
        edge_match=lambda a, b: a.get("kind") == b.get("kind"),
    )
    return gm.is_isomorphic()
