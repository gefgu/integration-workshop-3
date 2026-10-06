"""Electrical equivalence of two boards, independent of where the parts sit.

Columns that a jumper joins are one net, so jumpers are wires and never take part in the
comparison. Two boards are equivalent when their parts connect the same way up to
renaming nets and to the order of elements in series or in parallel. Battery and LED
polarity still matters.

Circuits that reduce to a series/parallel tree between the battery terminals are compared
through that canonical tree. Anything else (bridges, floating legs) is compared by
isomorphism of the part/net graph, which is stricter but still position independent.
"""
from __future__ import annotations

import hashlib
from collections import Counter, defaultdict
from dataclasses import dataclass
from itertools import combinations

import networkx as nx
from networkx.algorithms.isomorphism import GraphMatcher

from .catalog import DIRECTED
from .diff import Issue, diff_inventory
from .graph import Part, Term
from .models import Category, MatchOptions


@dataclass(frozen=True)
class Netlist:
    parts: tuple[Part, ...]  # every non-jumper part
    legs: tuple[tuple[int, ...], ...]  # net id of each terminal, aligned with `parts`


def netlist(parts: list[Part]) -> Netlist:
    parent: dict[int, int] = {}

    def find(x: int) -> int:
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for p in parts:
        for t in p.terms:
            find(t.col)
        if p.family == "jumper":
            a, b = p.terms
            parent[find(a.col)] = find(b.col)
    comps = [p for p in parts if p.family != "jumper"]
    return Netlist(tuple(comps), tuple(tuple(find(t.col) for t in p.terms) for p in comps))


# ---- series/parallel reduction -------------------------------------------------------------
# An expression is ("L", family, value, d) for a part, or ("S"|"P", children) for a series /
# parallel group. It is oriented along the direction it was built for; `d` is +1/-1 for
# directed parts (-1 = reversed against that direction) and 0 for orderless ones.

def _rev(e: tuple) -> tuple:
    if e[0] == "L":
        return ("L", e[1], e[2], -e[3])
    return _mk(e[0], [_rev(c) for c in e[1]])


def _mk(kind: str, children: list[tuple]) -> tuple:
    flat: list[tuple] = []
    for c in children:
        flat.extend(c[1]) if c[0] == kind else flat.append(c)
    return (kind, tuple(sorted(flat, key=repr)))


def reduce_sp(nl: Netlist, values: bool) -> tuple | None:
    """Canonical series/parallel expression from the battery's + net to its - net, or None."""
    bats = [i for i, p in enumerate(nl.parts) if p.family == "bateria"]
    if len(bats) != 1:
        return None
    bi = bats[0]
    plus, minus = nl.legs[bi]
    if plus == minus:
        return None
    edges: list[tuple[int, int, tuple]] = []
    for i, p in enumerate(nl.parts):
        if i == bi:
            continue
        u, v = nl.legs[i]
        if u == v:
            return None
        edges.append((u, v, ("L", p.family, p.value if values else None, 1 if p.ctype in DIRECTED else 0)))

    changed = True
    while changed:
        changed = False
        groups: dict[tuple[int, int], list[tuple]] = {}
        for u, v, e in edges:
            if u > v:
                u, v, e = v, u, _rev(e)
            groups.setdefault((u, v), []).append(e)
        merged = [(u, v, _mk("P", es) if len(es) > 1 else es[0]) for (u, v), es in groups.items()]
        changed = len(merged) != len(edges)
        edges = merged
        incident: dict[int, list[int]] = defaultdict(list)
        for k, (u, v, _) in enumerate(edges):
            incident[u].append(k)
            incident[v].append(k)
        for net, ix in incident.items():
            if net in (plus, minus) or len(ix) != 2:
                continue
            i1, i2 = ix
            u1, v1, e1 = edges[i1]
            u2, v2, e2 = edges[i2]
            if u1 == net:
                u1, v1, e1 = v1, u1, _rev(e1)  # a -> net
            if v2 == net:
                u2, v2, e2 = v2, u2, _rev(e2)  # net -> b
            edges = [ed for k, ed in enumerate(edges) if k not in (i1, i2)] + [(u1, v2, _mk("S", [e1, e2]))]
            changed = True
            break

    if len(edges) != 1:
        return None
    u, v, e = edges[0]
    if {u, v} != {plus, minus}:
        return None
    return e if u == plus else _rev(e)


# ---- fallback: part/net graph ---------------------------------------------------------------

def net_graph(nl: Netlist, values: bool) -> nx.Graph:
    g = nx.Graph()
    for legs in nl.legs:
        for n in legs:
            g.add_node(("n", n), kind="net")
    for i, p in enumerate(nl.parts):
        g.add_node(("p", i), kind=(p.family, p.value if values else None))
        by: dict[int, list[str]] = defaultdict(list)
        for t, n in zip(p.terms, nl.legs[i]):
            by[n].append(t.name)
        for n, names in by.items():
            g.add_edge(("p", i), ("n", n), terms=tuple(sorted(names)))
    return g


def _iso(a: nx.Graph, b: nx.Graph) -> bool:
    if a.number_of_nodes() != b.number_of_nodes() or a.number_of_edges() != b.number_of_edges():
        return False
    if sorted(d for _, d in a.degree) != sorted(d for _, d in b.degree):
        return False
    return GraphMatcher(
        a, b,
        node_match=lambda x, y: x["kind"] == y["kind"],
        edge_match=lambda x, y: x["terms"] == y["terms"],
    ).is_isomorphic()


def equivalent(student: list[Part], target: list[Part], opts: MatchOptions | None = None) -> bool:
    values = (opts or MatchOptions()).match_values
    s, t = netlist(student), netlist(target)
    a, b = reduce_sp(s, values), reduce_sp(t, values)
    if a is not None and b is not None:
        return a == b
    return _iso(net_graph(s, values), net_graph(t, values))


def circuit_hash(parts: list[Part], opts: MatchOptions | None = None) -> str:
    """Hash that only changes when the electrical circuit changes (SFR7), not when parts move."""
    values = (opts or MatchOptions()).match_values
    nl = netlist(parts)
    expr = reduce_sp(nl, values)
    if expr is not None:
        return "sp:" + hashlib.sha1(repr(expr).encode()).hexdigest()
    g = net_graph(nl, values)
    for n in g.nodes:
        g.nodes[n]["_l"] = repr(g.nodes[n]["kind"])
    for _, _, d in g.edges(data=True):
        d["_t"] = repr(d["terms"])
    return "nt:" + nx.weisfeiler_lehman_graph_hash(g, node_attr="_l", edge_attr="_t")


# ---- debug / description --------------------------------------------------------------------

def describe_nets(parts: list[Part]) -> list[str]:
    nl = netlist(parts)
    members: dict[int, list[str]] = defaultdict(list)
    for p, legs in zip(nl.parts, nl.legs):
        for t, n in zip(p.terms, legs):
            members[n].append(f"{p.ctype}[{p.id}].{t.name}")
    return sorted(" = ".join(sorted(m)) for m in members.values())


def _expr_text(e: tuple) -> str:
    if e[0] == "L":
        arrow = {1: "→", -1: "←", 0: ""}[e[3]]
        return f"{e[1]}{arrow}"
    word = "série" if e[0] == "S" else "paralelo"
    return f"{word}({', '.join(_expr_text(c) for c in e[1])})"


def describe_canonical(parts: list[Part], opts: MatchOptions | None = None) -> str | None:
    expr = reduce_sp(netlist(parts), (opts or MatchOptions()).match_values)
    return None if expr is None else _expr_text(expr)


# ---- net-based diff -------------------------------------------------------------------------

def _flip(p: Part) -> Part:
    a, b = p.terms
    return Part(p.id, p.ctype, (Term(a.name, b.col, b.row), Term(b.name, a.col, a.row)), p.value)


def _dangling(nl: Netlist) -> int:
    legs = Counter(n for ls in nl.legs for n in ls)
    return sum(1 for c in legs.values() if c == 1)


def _short(nl: Netlist) -> Part | None:
    for p, legs in zip(nl.parts, nl.legs):
        if len(set(legs)) < len(legs):
            return p
    return None


def _signatures(nl: Netlist, values: bool) -> list[tuple]:
    members: dict[int, list[tuple[int, str]]] = defaultdict(list)
    for i, (p, legs) in enumerate(zip(nl.parts, nl.legs)):
        for t, n in zip(p.terms, legs):
            members[n].append((i, t.name))
    out = []
    for i, (p, legs) in enumerate(zip(nl.parts, nl.legs)):
        leg_sigs = [tuple(sorted((nl.parts[j].family, tn) for j, tn in members[n] if j != i)) for n in legs]
        if p.ctype not in DIRECTED:
            leg_sigs.sort()
        out.append((p.family, p.value if values else None, tuple(leg_sigs)))
    return out


def net_partners(parts: list[Part], part_id: str) -> list[Part]:
    """Parts sharing a net with `part_id`: the battery first, then other non-wire parts."""
    nl = netlist(parts)
    idx = next((i for i, p in enumerate(nl.parts) if p.id == part_id), None)
    if idx is None:
        return []
    mine = set(nl.legs[idx])
    found = [p for j, (p, legs) in enumerate(zip(nl.parts, nl.legs)) if j != idx and mine & set(legs)]
    return sorted(found, key=lambda p: p.family != "bateria")


def diff_nets(student: list[Part], target: list[Part], opts: MatchOptions) -> list[Issue]:
    """Why two boards are not electrically equivalent, described by parts and nets, not columns."""
    values = opts.match_values
    inv = diff_inventory(
        [p for p in student if p.family != "jumper"], [p for p in target if p.family != "jumper"], opts
    )
    if inv:
        return inv

    dirs = sorted((p for p in student if p.ctype in DIRECTED), key=lambda p: p.family == "bateria")
    for k in range(1, len(dirs) + 1):
        for combo in combinations(dirs, k):
            ids = {p.id for p in combo}
            if equivalent([_flip(p) if p.id in ids else p for p in student], target, opts):
                return [Issue(Category.REVERSED_POLARITY, p.family, p.id) for p in combo]

    s, t = netlist(student), netlist(target)
    shorted = _short(s)
    if shorted is not None and _short(t) is None:
        return [Issue(Category.SHORT_CIRCUIT, shorted.family, shorted.id)]
    if _dangling(s) > _dangling(t):
        return [Issue(Category.OPEN_CIRCUIT, "jumper")]

    want = Counter(_signatures(t, values))
    sigs_s, sigs_t = _signatures(s, values), _signatures(t, values)
    extra = [p for p, sig in zip(s.parts, sigs_s) if not _consume(want, sig)]
    left = Counter(sigs_t)
    for sig in sigs_s:
        if left[sig] > 0:
            left[sig] -= 1
    missing = [p for p, sig in zip(t.parts, sigs_t) if _consume(left, sig)]
    issues: list[Issue] = []
    for ep in sorted(extra, key=lambda p: p.family == "bateria"):
        mp = next((m for m in missing if m.family == ep.family), None)
        if mp is None:
            continue
        missing.remove(mp)
        issues.append(Issue(Category.MISCONNECTED_COMPONENT, mp.family, ep.id, mp.id, ep.id))
    return issues or [Issue(Category.INCORRECT_CONNECTION, "*")]


def _consume(counter: Counter, key: tuple) -> bool:
    """True when `key` is still available in `counter` (and takes one); used to match multisets."""
    if counter[key] > 0:
        counter[key] -= 1
        return True
    return False
