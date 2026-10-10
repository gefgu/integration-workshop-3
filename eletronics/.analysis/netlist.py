"""Extract a netlist from an EasyEDA Standard multi-sheet schematic JSON.

Usage: python netlist.py <schematic.json> [--dump]
Net labels / net ports / power flags with the same name are joined across sheets.
"""
import json
import sys
from collections import defaultdict


class DSU:
    def __init__(self):
        self.p = {}

    def find(self, a):
        self.p.setdefault(a, a)
        while self.p[a] != a:
            self.p[a] = self.p[self.p[a]]
            a = self.p[a]
        return a

    def union(self, a, b):
        self.p[self.find(a)] = self.find(b)


def r(v):
    return round(float(v), 2)


def on_segment(pt, a, b):
    (x, y), (x1, y1), (x2, y2) = pt, a, b
    if (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1) != 0:
        return False
    return min(x1, x2) <= x <= max(x1, x2) and min(y1, y2) <= y <= max(y1, y2)


def parse_lib(s):
    parts = s.split("#@$")
    head = parts[0].split("~")
    attrs = head[3].split("`")
    attrs = dict(zip(attrs[0::2], attrs[1::2]))
    prefix, value, pins = "?", "", []
    for sub in parts[1:]:
        f = sub.split("~")
        if f[0] == "T" and f[1] == "P":
            prefix = f[12]
        elif f[0] == "T" and f[1] == "N":
            value = f[12]
        elif f[0] == "P":
            seg = sub.split("^^")
            g = seg[0].split("~")
            x, y = r(g[4]), r(g[5])
            name = seg[3].split("~")[4] if len(seg) > 3 else ""
            num = seg[4].split("~")[4] if len(seg) > 4 else g[3]
            pins.append((num, name, (x, y)))
    return prefix, value or attrs.get("Manufacturer Part", ""), attrs, pins


def main(path, dump=False):
    doc = json.load(open(path))
    dsu = DSU()
    comps = []  # (sheet, prefix, value, attrs, pins)
    names = defaultdict(set)  # node -> label names
    label_sheets = defaultdict(set)
    for sh in doc["schematics"]:
        title = sh["title"]
        wires, points = [], []  # points: (node_key, (x,y))
        for s in sh["dataStr"]["shape"]:
            kind = s.split("~", 1)[0]
            if kind == "W":
                c = s.split("~")[1].split()
                pts = [(r(c[i]), r(c[i + 1])) for i in range(0, len(c), 2)]
                for a, b in zip(pts, pts[1:]):
                    wires.append((a, b))
            elif kind == "LIB":
                prefix, value, attrs, pins = parse_lib(s)
                if prefix.startswith("frame") or not pins:
                    continue
                comps.append((title, prefix, value, attrs, pins))
                for num, name, xy in pins:
                    points.append(((title, prefix, num, name), xy))
            elif kind == "F":
                seg = s.split("^^")
                g = seg[1].split("~")
                xy = (r(g[0]), r(g[1]))
                lname = seg[2].split("~")[0]
                key = ("FLAG", title, xy, lname)
                points.append((key, xy))
                names[key].add(lname)
                label_sheets[lname].add(title)
            elif kind == "N":
                f = s.split("~")
                xy = (r(f[1]), r(f[2]))
                key = ("LABEL", title, xy, f[5])
                points.append((key, xy))
                names[key].add(f[5])
                label_sheets[f[5]].add(title)
        # wires: vertices of each segment are joined
        for a, b in wires:
            dsu.union((title, a), (title, b))
        verts = {v for w in wires for v in w}
        for v in verts:  # T-junctions: a wire vertex on another segment
            for a, b in wires:
                if on_segment(v, a, b):
                    dsu.union((title, v), (title, a))
        for key, xy in points:
            dsu.union(key, (title, xy))
            for a, b in wires:
                if on_segment(xy, a, b):
                    dsu.union(key, (title, a))
    # global labels
    first = {}
    for key, ns in names.items():
        for n in ns:
            if n in first:
                dsu.union(key, first[n])
            else:
                first[n] = key
    nets = defaultdict(list)
    netnames = defaultdict(set)
    for key in list(dsu.p):
        root = dsu.find(key)
        if isinstance(key, tuple) and len(key) == 4 and key[0] not in ("FLAG", "LABEL"):
            nets[root].append(key)
        if key in names:
            netnames[root] |= names[key]
    for sh_, prefix, value, attrs, pins in comps:
        for num, name, xy in pins:
            k = (sh_, prefix, num, name)
            dsu.find(k)
            if dsu.find(k) not in nets:
                nets[dsu.find(k)].append(k)

    def nname(root):
        n = sorted(netnames.get(root, []))
        return "/".join(n) if n else "?"

    print("== Components ==")
    for sh_, prefix, value, attrs, pins in sorted(comps, key=lambda c: (c[0], c[1])):
        print(f"{sh_:24} {prefix:8} {value:28} {attrs.get('package','')[:30]:30} LCSC={attrs.get('Supplier Part','')}")
    print("\n== Nets ==")
    for root, members in sorted(nets.items(), key=lambda kv: nname(kv[0])):
        m = ", ".join(f"{p}.{n}({nm})" for _, p, n, nm in sorted(members))
        print(f"[{nname(root)}] {m}")
    print("\n== Single-pin nets (unconnected pins, or label with one pin) ==")
    for root, members in nets.items():
        if len(members) == 1:
            sh_, p, n, nm = members[0]
            print(f"{sh_:24} {p}.{n}({nm})  net={nname(root)}")
    print("\n== Labels used on one sheet only and attached to <2 pins ==")
    for root, ns in netnames.items():
        if len(nets.get(root, [])) < 2:
            for n in ns:
                print(f"{n}  sheets={sorted(label_sheets[n])}  pins={len(nets.get(root, []))}")
    print("\n== Nets with more than one name (labels shorted together) ==")
    for root, ns in netnames.items():
        if len(ns) > 1:
            print(sorted(ns))


if __name__ == "__main__":
    main(sys.argv[1], "--dump" in sys.argv)
