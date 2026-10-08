"use strict";(()=>{var h="graphy:page";function F(){return{channel:h,type:"clear"}}function xe(e,n){return typeof e=="object"&&e!==null&&e.channel===n}function X(e,n,t=!1){return typeof e=="string"&&e.length<=n&&(!t||e.length>0)}function U(e){if(typeof e!="object"||e===null)return!1;let n=e;return X(n.name,128,!0)&&X(n.type,128,!0)}function j(e){return xe(e,h)?(e.type==="trace"||e.type==="hooks")&&typeof e.enabled=="boolean":!1}var $="\\ue000",we=/\u{E000}[^\n]*\n?/gu;function m(e){return e.includes("\uE000")?e.replace(we,""):e}function V(e,n){return e.flatMap(t=>typeof t!="string"?[t]:n&&t.startsWith("\uE000")&&m(t)===""?[]:[m(t)])}function y(e){let n={...e},t=e.code_output;return typeof t=="string"?n.code_output=m(t):Array.isArray(t)&&(n.code_output=V(t,!0)),Array.isArray(e.std_output_list)&&(n.std_output_list=V(e.std_output_list,!1)),typeof e.std_output=="string"&&(n.std_output=m(e.std_output)),JSON.stringify(n)===JSON.stringify(e)?null:n}var Te=["prerequisites","times","flights","trust","tickets","relations","redEdges","blueEdges","paths"],x=[...Te,"edges","connections","dislikes","roads","adjacentPairs","equations"],ve=["graph","rooms","adjList","adjacencyList"],Le=["isConnected"],z=[...x,...ve,...Le],K=["n","numCourses","numNodes","N"];var Me={background:["#ffffff"],nodeFill:["#eef2ff"],nodeStroke:["#4f46e5"],nodeText:["#111827","#1e1b4b"],rootFill:["#4f46e5"],rootStroke:["#3730a3"],terminalText:["#94a3b8"],edgeColor:["#64748b"],edgeText:["#475569"],cycleColor:["#e11d48"],cellFill:["#c7d2fe"],cellEmptyFill:["#f8fafc"],cellStroke:["#cbd5e1"],cellText:["#1e293b"],gutterText:["#94a3b8"]};var jn=Object.keys(Me);var w=100;var v="GRAPHY_TRACE_V2",Re=4e3,Pe=1e5,T=e=>JSON.stringify(e),Ce=`
# ${v}
def __graphy_install(G):
    import sys
    import builtins
    import functools
    from collections import deque

    S = "${$}"
    LET = "abcdefghijklmnopqrstuvwxy"
    MAX_INPUT = ${w}
    MAX_ALLOC = ${w*2}
    MAX_OPS = ${Re}
    MAX_LINES = ${Pe}
    MAX_SCAN = 1024
    WATCH = frozenset(("val", "left", "right", "next"))
    LINKS = ("left", "right", "next")
    TREE = {"left": "<", "right": ">"}
    AXES = (("row", "col"), ("r", "c"), ("i", "j"), ("x", "y"))
    DELTAS = frozenset(("d", "dd", "delta", "off", "offset", "dir", "step", "move"))
    STEPS = frozenset(("d", "dir", "dirs", "direction", "directions", "delta", "deltas", "moves", "offsets", "steps", "neighbors", "neighbours", "nbrs", "adj"))
    HEAP = frozenset(("heappush", "heappop", "heappushpop", "heapreplace", "heapify"))
    PREFIXES = frozenset(("", "n", "nn", "new", "next", "nxt", "s", "src", "start", "e", "end", "dst", "t", "target", "cur", "curr", "prev", "p", "old", "mid", "top", "bot", "bottom"))
    EDGES = frozenset(${T(x)})
    GRAPHS = frozenset(${T(z)})
    COUNTS = frozenset(${T(K)})
    TR = {9: 95, 10: 95, 11: 95, 12: 95, 13: 95, 32: 95, 44: 95}
    MISSING = object()
    NONE = frozenset()
    FN = type(__graphy_install)
    HOME = __graphy_install.__code__
    FILE = HOME.co_filename
    FIRST = HOME.co_firstlineno
    SKIP = set()
    METHODS = []
    raw = object.__getattribute__

    class State(object):
        pass

    st = State()
    st.ast = None
    st.on = False
    st.busy = False
    st.depth = 0
    st.calls = 0
    st.patched = []
    st.saved = None

    def reset(args):
        st.ids = {}
        st.keep = []
        st.kinds = {}
        st.visited = set()
        st.pending = []
        st.steps = []
        st.nops = 0
        st.lines = 0
        st.alloc = 0
        st.dead = set()
        st.shown = {}
        st.front = set()
        st.fframe = None
        st.lastf = None
        st.linked = False
        st.mutated = False
        st.grids = []
        st.pgrid = {}
        st.gnames = {}
        st.graphed = False
        st.glabels = set()
        st.nsnap = {}
        st.cshown = {}
        st.chold = {}
        st.ccur = None
        st.cframe = None
        st.cline = None
        st.heaps = {}
        st.closing = False
        st.top = None
        st.args = args
        st.inputs = set(id(a) for a in args)
        st.me = args[0] if args else None

    reset(())

    def dict_of(o):
        try:
            d = raw(o, "__dict__")
        except Exception:
            return None
        return d if type(d) is dict else None

    def shape(o):
        d = dict_of(o)
        if d is None or "val" not in d:
            return None
        if "left" in d or "right" in d:
            return "t"
        if "next" in d:
            return "l"
        return None

    def learn(cls, k):
        if cls not in st.kinds and isinstance(cls, type) and cls.__module__ != "builtins":
            st.kinds[cls] = k

    def label(v):
        if v is MISSING:
            return ""
        try:
            s = v if type(v) is str else str(v)
        except Exception:
            s = "?"
        return s[:12].translate(TR)

    def emit(op):
        if st.on or st.closing:
            st.pending.append(op)

    def flush():
        if st.pending:
            st.nops += len(st.pending)
            st.steps.append(",".join(st.pending))
            st.pending = []
            if st.on and st.nops > MAX_OPS:
                halt()

    def tag(o, r, k):
        st.ids[id(o)] = r
        st.keep.append(o)
        learn(type(o), k)

    def tag_tree(root, p):
        tag(root, p + "0", "t")
        n = 1
        cursor = 1
        q = deque([root])
        while q:
            d = dict_of(q.popleft()) or {}
            for f in ("left", "right"):
                c = d.get(f)
                slot = cursor
                cursor += 1
                if c is None or id(c) in st.ids or shape(c) is None:
                    continue
                tag(c, p + str(slot), "t")
                q.append(c)
                n += 1
                if n > MAX_INPUT:
                    return n
        return n

    def tag_chain(o, p, k):
        n = 0
        while o is not None and id(o) not in st.ids and shape(o) == "l":
            tag(o, p + str(k), "l")
            k += 1
            n += 1
            if n > MAX_INPUT:
                break
            o = (dict_of(o) or {}).get("next")
        return k, n

    def is_grid(a):
        if type(a) is not list or not a:
            return False
        first = a[0]
        if type(first) is str:
            w = len(first)
            return w > 0 and all(type(r) is str and len(r) == w for r in a)
        if type(first) is not list:
            return False
        w = len(first)
        return all(type(r) is list and len(r) == w for r in a)

    def graphish(name, a):
        if type(a) is not list or not all(type(r) is list for r in a):
            return False
        if name in EDGES:
            return all(2 <= len(r) <= 3 for r in a)
        if name in GRAPHS:
            n = len(a)
            return all(type(x) is int and 0 <= x <= n for r in a for x in r)
        return ragged(a)

    def ragged(a):
        if type(a) is not list or len(a) < 2 or not all(type(r) is list for r in a):
            return False
        if len(set(len(r) for r in a)) < 2:
            return False
        n = len(a)
        return all(type(x) is int and 0 <= x <= n for r in a for x in r)

    def tag_graph(o):
        q = deque([o])
        n = 0
        while q:
            x = q.popleft()
            if id(x) in st.ids:
                continue
            d = dict_of(x) or {}
            lb = label(d.get("val", MISSING))
            st.ids[id(x)] = "$" + lb
            st.keep.append(x)
            st.glabels.add(lb)
            n += 1
            if n > MAX_INPUT:
                return False
            for y in d.get("neighbors") or ():
                if id(y) not in st.ids:
                    q.append(y)
        return True

    def graph_labels(name, a):
        edges = name in EDGES
        for i in range(len(a)):
            row = a[i]
            if not edges:
                st.glabels.add(str(i))
            if type(row) is not list:
                continue
            for x in (row[:2] if edges else row):
                if type(x) is int or type(x) is str:
                    st.glabels.add(label(x))

    def tag_args(args, names):
        total = 0
        for i in range(1, min(len(args), len(LET) + 1)):
            a = args[i]
            p = LET[i - 1] if i > 1 else ""
            name = names[i] if i < len(names) else ""
            k = shape(a)
            if k == "t":
                if id(a) not in st.ids:
                    total += tag_tree(a, p)
            elif k == "l":
                total += tag_chain(a, p, 0)[1]
            elif type(a) is list and a and len(a) <= MAX_INPUT and all(e is None or shape(e) == "l" for e in a):
                k = 0
                for e in a:
                    if e is not None:
                        k, n = tag_chain(e, p, k)
                        total += n
            elif type(a) is not list and "neighbors" in (dict_of(a) or ()):
                if not tag_graph(a):
                    return False
                st.graphed = True
            elif graphish(name, a):
                if len(a) <= MAX_INPUT * 4:
                    graph_labels(name, a)
                    st.graphed = True
            elif is_grid(a) and sum(len(r) for r in a) <= MAX_INPUT:
                g = grid_of(a, p)
                st.grids.append(g)
                st.gnames[name] = g
            if total > MAX_INPUT:
                return False
        if st.graphed:
            for i in range(1, min(len(args), len(names))):
                v = args[i]
                if names[i] in COUNTS and type(v) is int and 0 <= v <= MAX_INPUT:
                    st.glabels.update(str(x) for x in range(v + 1))
        return True

    def prepare():
        if st.ast is None:
            st.ast = analyze()
        for key, bases in st.ast.bases.items():
            best = None
            for nm, cnt in bases.items():
                g = st.gnames.get(nm)
                if g is not None and (best is None or cnt > best[0]):
                    best = (cnt, g)
            if best is not None:
                st.pgrid[key] = best[1]

    def names_node(fn):
        try:
            ann = str(fn.__annotations__.get("return"))
        except Exception:
            return False
        return "TreeNode" in ann or "ListNode" in ann

    def alloc(o, k, v):
        if st.alloc >= MAX_ALLOC:
            halt()
            return None
        r = "z" + str(st.alloc)
        st.alloc += 1
        st.ids[id(o)] = r
        st.keep.append(o)
        st.mutated = True
        emit("+" + k + r + "=" + label(v))
        return r

    def arrow(k, f):
        if k == "t":
            return TREE.get(f)
        return ">" if f == "next" else None

    def ensure(o):
        r = st.ids.get(id(o))
        if r is not None:
            return r
        k = st.kinds.get(type(o))
        d = dict_of(o)
        if k is None or d is None:
            return None
        r = alloc(o, k, d.get("val", MISSING))
        todo = [(o, r, k)] if r is not None else []
        while todo:
            x, xr, xk = todo.pop()
            xd = dict_of(x) or {}
            for f in LINKS:
                ch = arrow(xk, f)
                c = xd.get(f)
                if ch is None or c is None:
                    continue
                cr = st.ids.get(id(c))
                if cr is None:
                    ck = st.kinds.get(type(c))
                    cd = dict_of(c)
                    if ck is None or cd is None:
                        continue
                    cr = alloc(c, ck, cd.get("val", MISSING))
                    if cr is None:
                        return r
                    todo.append((c, cr, ck))
                emit(xr + ch + cr)
        return r

    def wrote(o, k, name, value, first):
        r = st.ids.get(id(o))
        if r is None:
            d = dict_of(o) or {}
            r = alloc(o, k, value if name == "val" else d.get("val", MISSING))
            if r is None or name == "val":
                return
        elif name == "val":
            emit(r + "=" + label(value))
            return
        ch = arrow(k, name)
        if ch is None:
            return
        if value is None:
            if not first:
                emit(r + ch + "-")
                st.linked = True
            return
        c = ensure(value)
        if c is not None:
            emit(r + ch + c)
            st.linked = True
            st.mutated = True

    def hooks(k, osa, fallback):
        def graphy_get(self):
            try:
                v = raw(self, "__dict__")["val"]
            except KeyError:
                if fallback is MISSING:
                    raise AttributeError("val")
                v = fallback
            if st.on and not st.busy:
                r = st.ids.get(id(self))
                if r is not None and r not in st.visited:
                    st.visited.add(r)
                    st.pending.append(r)
            return v

        def graphy_put(self, v):
            raw(self, "__dict__")["val"] = v

        def graphy_drop(self):
            del raw(self, "__dict__")["val"]

        def graphy_set(self, name, value):
            if not st.on or st.busy or name not in WATCH:
                osa(self, name, value)
                return
            st.busy = True
            try:
                d = dict_of(self)
                old = MISSING if d is None else d.get(name, MISSING)
                osa(self, name, value)
                if old is not value:
                    try:
                        wrote(self, k, name, value, old is MISSING)
                    except Exception:
                        halt()
            finally:
                st.busy = False

        return property(graphy_get, graphy_put, graphy_drop), graphy_set

    def patch():
        for cls, k in list(st.kinds.items()):
            d = cls.__dict__
            if "__slots__" in d:
                continue
            for v in d.values():
                if type(v) is FN:
                    SKIP.add(id(v.__code__))
            saved_val = d.get("val", MISSING)
            saved_set = d.get("__setattr__", MISSING)
            prop, setter = hooks(k, cls.__setattr__, saved_val)
            try:
                setattr(cls, "val", prop)
                setattr(cls, "__setattr__", setter)
            except Exception:
                restore(cls, saved_val, saved_set)
                continue
            st.patched.append((cls, saved_val, saved_set))

    def restore(cls, saved_val, saved_set):
        for name, saved in (("val", saved_val), ("__setattr__", saved_set)):
            try:
                if saved is MISSING:
                    if name in cls.__dict__:
                        delattr(cls, name)
                else:
                    setattr(cls, name, saved)
            except Exception:
                pass

    def unpatch():
        while st.patched:
            restore(*st.patched.pop())

    def stop():
        if st.on:
            st.on = False
            sys.settrace(st.saved)
        st.saved = None
        unpatch()

    def halt():
        if st.on:
            flush()
            st.steps.append("~")
            stop()

    def gather(v, out, deep):
        t = type(v)
        if t in st.kinds:
            out.append(v)
        elif deep and (t is list or t is tuple or t is set or t is frozenset or t is deque):
            if len(v) <= MAX_SCAN:
                for e in v:
                    gather(e, out, deep - 1)
        elif deep and t is dict:
            if len(v) <= MAX_SCAN:
                for kk, e in v.items():
                    gather(kk, out, deep - 1)
                    gather(e, out, deep - 1)

    def reach(roots):
        seen = set()
        kinds = st.kinds
        while roots:
            o = roots.pop()
            i = id(o)
            if i in seen:
                continue
            seen.add(i)
            d = dict_of(o)
            if d is None:
                continue
            for f in LINKS:
                c = d.get(f)
                if c is not None and type(c) in kinds:
                    roots.append(c)
        return seen

    def liveness(f, ret):
        roots = []
        for a in st.args[1:]:
            gather(a, roots, 2)
        me = dict_of(st.me)
        if me:
            for v in me.values():
                gather(v, roots, 2)
        g = f
        while g is not None and g is not st.top:
            for v in g.f_locals.values():
                gather(v, roots, 2)
            g = g.f_back
        if ret is not None:
            roots.append(ret)
        seen = reach(roots)
        dead = st.dead
        for i, r in st.ids.items():
            if i in seen:
                dead.discard(r)
            elif r not in dead and (f is not None or r[0] != "z"):
                dead.add(r)
                emit("!" + r)

    def contents(v):
        n = len(v)
        if n == 0 or n > MAX_SCAN:
            return None
        kinds = st.kinds
        first = next(iter(v))
        if type(first) not in kinds and not (type(first) is tuple and any(type(x) in kinds for x in first)):
            return None
        ids = st.ids
        found = set()
        for e in v:
            r = ids.get(id(e))
            if r is not None:
                found.add(r)
            elif type(e) is tuple and len(e) <= 4:
                for x in e:
                    r = ids.get(id(x))
                    if r is not None:
                        found.add(r)
        return found

    def on_line(f):
        st.lines += 1
        if st.lines > MAX_LINES:
            halt()
            return
        loc = f.f_locals
        ids = st.ids
        gridded = bool(st.grids)
        graphed = st.graphed
        if gridded:
            diff()
        A = st.ast if gridded or graphed else None
        M = {}
        fr = set()
        seen = set()
        heap = None
        for k, v in loc.items():
            r = ids.get(id(v))
            if r is not None:
                if k != "self" and k.isascii() and k.isidentifier():
                    M[k] = r
                continue
            t = type(v)
            if graphed and (t is int or t is str) and k in A.nodes:
                lb = label(v)
                if lb in st.glabels and within(A, k, f.f_lineno):
                    M[k] = "$" + lb
                continue
            if (t is list or t is deque or t is set or t is tuple) and id(v) not in st.inputs:
                found = contents(v)
                if found:
                    fr |= found
                elif graphed:
                    if t is set:
                        seen |= nodeset(v, False) or NONE
                    elif t is list and flags(v, seen):
                        pass
                    elif t is deque or (t is list and k in A.popped):
                        if heap is None:
                            heap = heapy(f.f_code)
                        fr |= nodeset(v, heap) or NONE
                elif gridded:
                    if t is set:
                        seen |= cellset(v, False) or NONE
                    elif not (t is list and marks(v, seen)) and k.lower() not in STEPS:
                        if heap is None:
                            heap = heapy(f.f_code)
                        fr |= cellset(v, heap) or NONE
        lost = False
        shown = st.shown
        if M != shown:
            added = [k for k in M if shown.get(k) != M[k]]
            if added:
                for k in shown:
                    if k not in M:
                        emit("@" + k + "=-")
                for k in added:
                    emit("@" + k + "=" + M[k])
                news = set(M.values())
                lost = any(r not in news for r in shown.values())
                st.shown = M
        for c in sorted(seen - st.visited):
            st.visited.add(c)
            emit(c)
        if gridded:
            cells(loc, f)
        if graphed:
            notes(loc)
        if fr or f is st.fframe:
            front = st.front
            if fr != front:
                for r in sorted(front - fr):
                    emit("&-" + r)
                for r in sorted(fr - front):
                    emit("&+" + r)
                st.front = fr
            st.fframe = f
        switched = f is not st.lastf
        st.lastf = f
        if st.linked or (st.mutated and (lost or switched)):
            st.linked = False
            liveness(f, None)
        flush()

    def within(A, k, line):
        spans = A.scoped.get(k)
        return spans is None or any(a <= line <= b for a, b in spans)

    def grid_of(a, p):
        g = State()
        g.obj = a
        g.pane = p
        g.snap = [r[:] if type(r) is list else r for r in a]
        return g

    def cid(g, r, c):
        return g.pane + str(r) + "." + str(c)

    def diff():
        for g in st.grids:
            obj = g.obj
            snap = g.snap
            for ri in range(min(len(obj), len(snap))):
                row = obj[ri]
                old = snap[ri]
                if row == old:
                    continue
                for ci in range(min(len(row), len(old))):
                    if row[ci] != old[ci]:
                        c = cid(g, ri, ci)
                        emit(c + "=" + label(row[ci]))
                        if c not in st.visited:
                            st.visited.add(c)
                            emit(c)
                snap[ri] = row[:] if type(row) is list else row

    def inside(g, r, c):
        snap = g.snap
        return type(r) is int and type(c) is int and 0 <= r < len(snap) and 0 <= c < len(snap[r])

    def heapy(code):
        h = st.heaps.get(code)
        if h is None:
            h = not HEAP.isdisjoint(code.co_names)
            st.heaps[code] = h
        return h

    def cellset(v, heap):
        n = len(v)
        if n == 0 or n > MAX_SCAN:
            return None
        g = st.grids[0]
        snap = g.snap
        width = len(snap[0]) if snap else 0
        out = set()
        m = None
        for e in v:
            t = type(e)
            if t is not tuple and t is not list:
                return None
            if m is None:
                m = len(e)
                if m < 2 or m > 4 or (t is list and n == len(snap) and m == width):
                    return None
            elif len(e) != m:
                return None
            r, c = (e[m - 2], e[m - 1]) if heap and m > 2 else (e[0], e[1])
            if not inside(g, r, c):
                return None
            out.add(cid(g, r, c))
        return out

    def marks(v, out):
        g = st.grids[0]
        snap = g.snap
        if not v or len(v) != len(snap) or type(v[0]) is not list or not v[0] or type(v[0][0]) is not bool:
            return False
        for ri in range(len(v)):
            row = v[ri]
            if type(row) is not list:
                return False
            for ci in range(min(len(row), len(snap[ri]))):
                if row[ci] is True:
                    out.add(cid(g, ri, ci))
        return True

    def nodeset(v, heap):
        n = len(v)
        if n == 0 or n > MAX_SCAN:
            return None
        ids = st.ids
        out = set()
        for e in v:
            r = ids.get(id(e))
            if r is None:
                t = type(e)
                if t is tuple or t is list:
                    if not e:
                        return None
                    e = e[-1] if heap else e[0]
                    t = type(e)
                    r = ids.get(id(e))
                if r is None:
                    if t is not int and t is not str:
                        return None
                    lb = label(e)
                    if lb not in st.glabels:
                        return None
                    r = "$" + lb
            out.add(r)
        return out

    def flags(v, out):
        if not v or type(v[0]) is not bool or len(v) > MAX_SCAN:
            return False
        for i in range(len(v)):
            if v[i] is True:
                lb = str(i)
                if lb in st.glabels:
                    out.add("$" + lb)
        return True

    def notes(loc):
        snaps = st.nsnap
        for k in st.ast.keyed:
            v = loc.get(k)
            if v is None or id(v) in st.inputs:
                continue
            if type(v) is list:
                if len(v) > MAX_SCAN or (v and type(v[0]) is bool):
                    continue
                items = enumerate(v)
            elif isinstance(v, dict):
                if len(v) > MAX_SCAN:
                    continue
                items = v.items()
            else:
                continue
            cur = {}
            for key, val in items:
                tv = type(val)
                if tv is not int and tv is not float and tv is not str:
                    cur = None
                    break
                tk = type(key)
                if tk is int or tk is str:
                    lb = label(key)
                    if lb in st.glabels:
                        cur[lb] = label(val)
            if cur is None:
                continue
            old = snaps.get(k)
            if old == cur:
                continue
            old = old or {}
            for lb, s in cur.items():
                if old.get(lb) != s:
                    emit("%" + k + ":$" + lb + "=" + s)
            for lb in old:
                if lb not in cur:
                    emit("%" + k + ":$" + lb + "=")
            snaps[k] = cur

    def axis(name):
        for a, b in AXES:
            if name.endswith(a):
                return name[:-len(a)].rstrip("_").lower() not in DELTAS
        return True

    def analyze():
        import ast
        import inspect
        import textwrap
        A = State()
        A.axes = []
        A.loads = {}
        A.stores = {}
        A.bases = {}
        A.nodes = set()
        A.keyed = set()
        A.popped = set()
        A.deep = False
        A.scoped = {}
        bound = set()
        strong = set()
        subs = []

        def name(e):
            return e.id if isinstance(e, ast.Name) else None

        def leaves(t):
            if isinstance(t, ast.Name):
                return [t.id]
            if isinstance(t, (ast.Tuple, ast.List)):
                out = []
                for e in t.elts:
                    out.extend(leaves(e))
                return out
            return []

        def pair(elts, line, book, owner):
            if len(elts) != 2:
                return
            a, b = name(elts[0]), name(elts[1])
            if not a or not b or a == b or not axis(a) or not axis(b):
                return
            key = a + ":" + b
            if key not in A.bases:
                A.bases[key] = {}
                A.axes.append(key)
            if owner:
                A.bases[key][owner] = A.bases[key].get(owner, 0) + 1
            if book is A.loads:
                strong.add(key)
            book.setdefault(line, set()).add(key)

        for fn in METHODS:
            try:
                tree = ast.parse(textwrap.dedent(inspect.getsource(fn)))
            except Exception:
                continue
            base = fn.__code__.co_firstlineno - 1
            for n in ast.walk(tree):
                line = base + getattr(n, "lineno", 0)
                if isinstance(n, ast.Subscript):
                    i = name(n.slice)
                    if i:
                        subs.append((name(n.value), i))
                    if isinstance(n.value, ast.Subscript):
                        A.deep = True
                        pair((n.value.slice, n.slice), line, A.loads, name(n.value.value))
                elif isinstance(n, ast.Tuple) and isinstance(n.ctx, ast.Load):
                    pair(n.elts, line, A.loads, None)
                elif isinstance(n, ast.Assign) and len(n.targets) == 1 and isinstance(n.targets[0], ast.Tuple):
                    if isinstance(n.value, ast.Call):
                        pair(n.targets[0].elts, line, A.stores, None)
                    elif isinstance(n.value, ast.Subscript) and name(n.value.value) in EDGES:
                        A.nodes.update(leaves(n.targets[0])[:2])
                elif isinstance(n, ast.For):
                    span = (line, base + (n.end_lineno or n.lineno))
                    for v in leaves(n.target):
                        A.scoped.setdefault(v, []).append(span)
                    it = n.iter
                    fname = name(it.func) if isinstance(it, ast.Call) else None
                    if fname not in ("enumerate", "zip") and isinstance(n.target, ast.Tuple):
                        pair(n.target.elts, line, A.stores, None)
                    if fname in ("sorted", "zip", "reversed", "list") and it.args:
                        it = it.args[0]
                    if isinstance(it, ast.Subscript):
                        A.nodes.update(leaves(n.target)[:1])
                    elif name(it) in EDGES:
                        A.nodes.update(leaves(n.target)[:2])
                elif isinstance(n, ast.Call):
                    f = n.func
                    if isinstance(f, ast.Attribute) and f.attr in ("pop", "popleft") and name(f.value):
                        A.popped.add(f.value.id)
                    elif (name(f) in HEAP or (isinstance(f, ast.Attribute) and f.attr in HEAP)) and n.args and name(n.args[0]):
                        A.popped.add(n.args[0].id)
            for n in ast.walk(tree):
                if isinstance(n, ast.arg):
                    bound.add(n.arg)
                elif isinstance(n, (ast.Assign, ast.AugAssign, ast.AnnAssign)):
                    for t in (n.targets if isinstance(n, ast.Assign) else [n.target]):
                        bound.update(leaves(t))
                elif isinstance(n, ast.NamedExpr):
                    bound.update(leaves(n.target))
        for v in bound:
            A.scoped.pop(v, None)
        A.axes = [k for k in A.axes if k in strong]
        A.akeys = set(A.axes)
        for owner, i in subs:
            if owner not in EDGES and i != "_":
                A.nodes.add(i)
        for owner, i in subs:
            if owner and owner not in EDGES and i in A.nodes:
                A.keyed.add(owner)
        return A

    def pairs(loc):
        out = {}
        used = set()
        first = st.grids[0]
        for key in st.ast.axes:
            a, b = key.split(":")
            rv = loc.get(a)
            cv = loc.get(b)
            if type(rv) is int and type(cv) is int:
                g = st.pgrid.get(key, first)
                out[key] = cid(g, rv, cv) if inside(g, rv, cv) else None
                used.add(a)
                used.add(b)
        for k, rv in loc.items():
            if type(rv) is not int or k in used or not st.ast.deep:
                continue
            for a, b in AXES:
                if not k.endswith(a):
                    continue
                pre = k[:-len(a)]
                if pre.rstrip("_").lower() not in PREFIXES:
                    break
                for k2 in (pre + b, k.replace(a, b)):
                    cv = loc.get(k2)
                    if type(cv) is int and k2 not in used:
                        out[k + ":" + k2] = cid(first, rv, cv) if inside(first, rv, cv) else None
                        break
                break
        return out

    def cells(loc, f):
        A = st.ast
        line = f.f_lineno
        after = A.stores.get(st.cline, ()) if st.cframe is f else ()
        now = A.loads.get(line, ())
        st.cframe = f
        st.cline = line
        found = pairs(loc)
        shown = st.cshown
        hold = st.chold
        st.chold = {}
        moves = []
        gone = []
        stale = []
        lead = st.ccur in now
        for k, v in found.items():
            if v is None:
                if k in shown:
                    gone.append(k)
                continue
            if k in A.akeys:
                if k in now or k in after:
                    if shown.get(k) != v or (k in now and not lead):
                        moves.append(k)
                elif k in shown and shown[k] != v:
                    stale.append(k)
            elif shown.get(k) != v:
                if hold.get(k) == v:
                    moves.append(k)
                else:
                    st.chold[k] = v
        if moves:
            gone.extend(k for k in shown if k not in found)
            gone.extend(stale)
            moves.sort(key=lambda k: k in now)
        for k in gone:
            if k in shown:
                del shown[k]
                emit("@" + k + "=-")
        for k in moves:
            shown[k] = found[k]
            st.ccur = k
            emit("@" + k + "=" + found[k])

    def commit():
        for k, v in st.chold.items():
            st.cshown[k] = v
            st.ccur = k
            emit("@" + k + "=" + v)
        st.chold = {}

    def ltrace(frame, event, arg):
        if not st.on:
            return None
        if st.busy:
            return ltrace
        if event == "line":
            st.busy = True
            try:
                on_line(frame)
            except Exception:
                halt()
            finally:
                st.busy = False
        elif event == "return":
            if st.grids and st.chold:
                commit()
            flush()
        return ltrace

    def rtrace(frame, event, arg):
        if not st.on:
            return None
        if event == "return" and not st.busy:
            flush()
        return rtrace

    def gtrace(frame, event, arg):
        c = frame.f_code
        if c.co_filename != FILE or c.co_firstlineno >= FIRST:
            return None
        return rtrace if id(c) in SKIP else ltrace

    def begin(fn, args, frame):
        reset(args)
        for name, k in (("TreeNode", "t"), ("ListNode", "l")):
            learn(G.get(name), k)
        code = fn.__code__
        if not tag_args(args, code.co_varnames[:code.co_argcount]):
            return
        active = bool(st.grids) or st.graphed
        if not st.kinds and not active:
            return
        if not st.ids and not active and not names_node(fn):
            return
        if active:
            prepare()
        patch()
        st.top = frame
        st.saved = sys.gettrace()
        st.on = True
        sys.settrace(gtrace)

    def settle(ret):
        for g in st.grids:
            snap = g.snap
            if len(ret) != len(snap) or any(len(ret[ri]) != len(snap[ri]) for ri in range(len(snap))):
                continue
            for k in list(st.cshown):
                emit("@" + k + "=-")
            st.cshown = {}
            for ri in range(len(snap)):
                for ci in range(len(snap[ri])):
                    if ret[ri][ci] != snap[ri][ci]:
                        emit(cid(g, ri, ci) + "=" + label(ret[ri][ci]))
            return

    def finish(fn, ret, ok):
        st.closing = st.on and ok
        stop()
        try:
            if st.closing:
                for r in sorted(st.front):
                    emit("&-" + r)
                st.front = set()
                if st.grids:
                    diff()
                    commit()
                    if is_grid(ret) and all(ret is not g.obj for g in st.grids):
                        settle(ret)
                if ret is not None and type(ret) in st.kinds:
                    r = ensure(ret)
                    if r is not None:
                        liveness(None, ret)
                        emit("^" + r)
                elif ret is None and names_node(fn):
                    liveness(None, None)
                    emit("^-")
            flush()
            if any(s != "~" for s in st.steps):
                builtins.print(S + str(st.calls) + " " + " ".join(st.steps))
        except Exception:
            pass
        finally:
            st.calls += 1
            reset(())

    def wrap(fn):
        def __graphy_wrapped(*args, **kwargs):
            if st.depth:
                return fn(*args, **kwargs)
            st.depth = 1
            ok = False
            ret = None
            try:
                try:
                    begin(fn, args, sys._getframe())
                except Exception:
                    stop()
                ret = fn(*args, **kwargs)
                ok = True
                return ret
            finally:
                st.depth = 0
                finish(fn, ret, ok)
        try:
            functools.update_wrapper(__graphy_wrapped, fn)
        except Exception:
            pass
        return __graphy_wrapped

    sol = G.get("Solution")
    if not isinstance(sol, type):
        return
    for name, attr in list(vars(sol).items()):
        if type(attr) is FN:
            METHODS.append(attr)
            if not name.startswith("_"):
                setattr(sol, name, wrap(attr))

__graphy_install(globals())
`;function Ie(e){return e.includes(v)?e:`${e.replace(/\s+$/,"")}
${Ce}`}function B(e){if(typeof e!="string")return null;try{let n=JSON.parse(e);if(typeof n!="object"||n===null)return null;let t={...n},r=t.typed_code;return typeof r!="string"||t.lang!=="python3"||r.includes(v)?null:JSON.stringify({...t,typed_code:Ie(r)})}catch{return null}}var Oe="QD_TESTCASE_CACHE_",Q="query($titleSlug: String!) { question(titleSlug: $titleSlug) { exampleTestcaseList metaData } }";function a(e){return typeof e=="object"&&e!==null&&!Array.isArray(e)?e:null}function J(e){if(typeof e=="string")try{return JSON.parse(e)}catch{return}}function M(e){return e.map(n=>n.trim()).join(`
`)}function Y(e){return M(e.trim().split(/\r?\n/))}function He(e){let n=a(J(e));if(!n)return null;if(n.systemdesign===!0)return{lineCount:2};let t=n.params;return!Array.isArray(t)||t.length===0||t.length>32||!t.every(U)?null:{lineCount:t.length,params:t.map(({name:r,type:s})=>({name:r,type:s}))}}function qe(e){return Array.isArray(e)?e.filter(n=>typeof n=="string").map(Y).slice(0,64):[]}function W(e){let n=He(e.metaData),t={cases:qe(e.exampleTestcaseList),lineCount:n?.lineCount??null};return n?.params&&(t.params=n.params),t}function Z(e,n){let t=a(a(a(a(e)?.props)?.pageProps)?.dehydratedState)?.queries;if(!Array.isArray(t))return null;for(let r of t){let s=a(r),o=s?.queryKey;if(!Array.isArray(o)||o[0]!=="questionDetail"||a(o[1])?.titleSlug!==n)continue;let i=ne(a(a(s?.state)?.data)?.question);if(i)return i}return null}function ee(e){return ne(a(a(e)?.data)?.question)}function ne(e){let n=a(e);return n?{exampleTestcaseList:n.exampleTestcaseList,metaData:n.metaData}:null}function te(e){return Oe+e}function re(e,n){if(e===null)return null;let t=J(e);if(!Array.isArray(t)||t.length===0||t.length>64)return null;let r=[];for(let s of t){if(!Array.isArray(s)||s.length===0||!s.every(o=>typeof o=="string")||n!==null&&s.length!==n||s.some(o=>/[\r\n]/.test(o)))return null;r.push(M(s))}return r}function De(e,n){if(e.length===0||e.length%n!==0)return null;let t=[];for(let r=0;r<e.length;r+=n)t.push(M(e.slice(r,r+n)));return t}function se(e,n){if(e.trim()==="")return null;let t=e.split(/\r?\n/);for(;t.at(-1)?.trim()==="";)t.pop();return((n!==null&&n>0?De(t,n):null)??[Y(e)]).slice(0,64)}function ae(e){if(e)return oe(e.code_output)??oe(e.std_output_list)??ue(e.std_output)}function le(e){if(!e)return;let n=e.std_output_list;if(!(!Array.isArray(n)||n.length===0||n.length>64)&&n.every(t=>typeof t=="string"&&t.length<=262144))return n}function ue(e){return typeof e=="string"&&e.length>0&&e.length<=262144?e:void 0}function oe(e){if(!Array.isArray(e))return ue(e);if(e.length===0||e.length>64||!e.every(t=>typeof t=="string"))return;let n=e.join(`
`);return n.length<=262144?n:void 0}var Ve=/class\s+Solution|def\s+\w+\s*\(|func\s+\w+|impl\s+Solution|var\s+\w+\s*=\s*function|public\s+class|^\s*(?:int|char|void|double|bool|struct)\b[^=\n]*\(/m,$e="Couldn't load this problem's testcases. Press Run to capture them.",ze="This testcase is too large to draw.",Ke="cpp",Be=1e4,de=/\/interpret_solution\/?$|\/interpret_solution\//,I=/\/submissions\/detail\/([^/?]+)\/check\/?/,Qe=new Set(["PENDING","STARTED"]),Je=32,l=null,pe=!1,u=!1,fe=0,f=new Map,c=new Map;function Ye(e){if(e.source===window&&e.origin===location.origin&&j(e.data)){if(e.data.type==="trace"){pe=e.data.enabled;return}e.data.enabled?Tn():vn()}}window.addEventListener("message",Ye);function We(e){let t=e.cmView?.rootView?.view?.state?.doc?.toString();return typeof t=="string"?t:null}function O(){for(let e of document.querySelectorAll(".cm-content")){let n=We(e);if(n!==null&&Ve.test(n))return n}return""}function ge(){let e=location.pathname.match(/\/problems\/([^/]+)/)?.[1]??"";return e.length<=128?e:""}function P(e){return typeof e=="string"&&e.length>0&&e.length<=32}function Ze(){try{let e=localStorage.getItem("global_lang");return e?JSON.parse(e):void 0}catch{return}}function en(){return(document.querySelector("[id^='headlessui-listbox-button'], button[data-state]")?.textContent??"").trim().toLowerCase().replace(/[^a-z0-9+#]/g,"")}function H(e){if(P(e))return e;let n=Ze();if(P(n))return n;let t=en();return P(t)?t:Ke}function nn(e){window.postMessage({channel:h,type:"snapshot",payload:e},location.origin)}function he(){window.postMessage(F(),location.origin)}function N(e,n){e.queue=e.queue.then(()=>l===e?n():void 0).catch(()=>{})}function me(e){!u||l!==e||!e.snapshot||e.posted===e.snapshot||(e.posted=e.snapshot,nn(e.snapshot))}function S(e,n){e.snapshot=n,me(e)}function q(e,n,t,r,s){let o=t.every(p=>p.length<=65536),i={cases:o?t:[],code:r.length<=262144?r:"",lang:s,slug:e.slug,source:n,at:Date.now()};return e.params&&(i.params=e.params),o||(i.captureError=ze),i}function tn(e,n){return e.length===n.length&&e.every((t,r)=>t===n[r])}function rn(){let e=window.__NEXT_DATA__;if(e!==void 0)return e;try{let n=document.getElementById("__NEXT_DATA__")?.textContent;return n?JSON.parse(n):void 0}catch{return}}function sn(){return g?d:window.fetch}async function on(e){let n=new AbortController,t=setTimeout(()=>n.abort(),Be);try{let r=await sn().call(window,"/graphql",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({query:Q,variables:{titleSlug:e}}),signal:n.signal});return r.ok?ee(await r.json()):null}catch{return null}finally{clearTimeout(t)}}async function an(e){return Z(rn(),e)??await on(e)}function ye(e,n){try{return re(sessionStorage.getItem(te(e)),n)}catch{return null}}function ln(e){e.loading=!0,N(e,async()=>{let n=await an(e.slug);if(l!==e)return;e.loading=!1;let t=n?W(n):null;if(e.loaded=t!==null,e.lineCount=t?.lineCount??null,t?.params?e.params=t.params:delete e.params,e.snapshot?.source==="network")return;let r=ye(e.slug,e.lineCount)??t?.cases??[],s=q(e,"editor",r,O(),H());r.length===0&&(s.captureError=$e),S(e,s)})}function _e(e){return l?.slug===e||(l&&he(),Ne(),l={slug:e,lineCount:null,loaded:!1,loading:!1,queue:Promise.resolve(),snapshot:null,posted:null,latestRun:-1}),l}function ke(e){!e.loaded&&!e.loading&&ln(e)}function un(e){if(!e.loaded||!e.snapshot)return;let n=ye(e.slug,e.lineCount);if(!n)return;let t=q(e,"editor",n,O(),H());tn(t.cases,e.snapshot.cases)||S(e,t)}function dn(e){if(typeof e!="string")return null;let n=E(e);if(!n||typeof n.data_input!="string")return null;let t={dataInput:n.data_input};return typeof n.typed_code=="string"&&(t.code=n.typed_code),typeof n.lang=="string"&&(t.lang=n.lang),t}function fn(e){let n=dn(e),t=ge();if(!n||!t)return;let r=_e(t);ke(r);let s=fe;fe+=1;let o={sequence:s,state:r,snapshot:null};return f.set(s,o),be(),N(r,()=>{let i=se(n.dataInput,r.lineCount)??r.snapshot?.cases??[];o.snapshot=q(r,"network",i,n.code??O(),H(n.lang)),r.latestRun=s,S(r,o.snapshot)}),s}function cn(e){return typeof e=="string"?e:e instanceof URL?e.href:e.url}function A(e){return typeof e=="object"&&e!==null?{...e}:null}function E(e){try{return A(JSON.parse(e))}catch{return null}}async function pn(e){try{return A(await e.clone().json())}catch{return null}}function gn(e){let n=e?.interpret_id;return typeof n=="string"&&n.length>0?n:void 0}function hn(){let e;for(let[n,t]of f)(!e||t.sequence<e.sequence)&&(e={map:f,key:n,sequence:t.sequence});for(let[n,t]of c)(!e||t.sequence<e.sequence)&&(e={map:c,key:n,sequence:t.sequence});e&&e.map.delete(e.key)}function be(){for(;f.size+c.size>Je;)hn()}function Ne(){f.clear(),c.clear()}function Se(e,n){let t=f.get(n);if(!t)return;f.delete(n);let r=gn(e);r&&(c.set(r,t),be())}function Ae(e,n){let t=n?.state;if(typeof t!="string"||Qe.has(t))return;let r=I.exec(e)?.[1];if(!r)return;let s=c.get(r);if(!s)return;c.delete(r);let o=ae(n),i=le(n);N(s.state,()=>{if(!s.snapshot||s.sequence!==s.state.latestRun)return;let p={...s.snapshot,at:Date.now()};o!==void 0&&(p.stdout=o),i!==void 0&&(p.stdoutByCase=i),S(s.state,p)})}function mn(e){let n=pe?B(e):null;return n===null?e:(b=!0,n)}function D(e){try{return{sequence:fn(e),body:mn(e)}}catch{return{sequence:void 0,body:e}}}function Ee(e,n){n!==void 0&&e.then(async t=>Se(await pn(t),n)).catch(()=>{})}async function yn(e,n,t){let r;try{r=await n.clone().text()}catch{r=void 0}let s=D(r),o;if(typeof s.body=="string"&&s.body!==r)try{o=d.call(e,new Request(n,{body:s.body}),t)}catch{o=void 0}return o??=d.call(e,n,t),Ee(o,s.sequence),o}function _n(e,n,t){if(n instanceof Request&&t?.body===void 0)return yn(e,n,t);let r=D(t?.body),s=d.call(e,n,r.body!==t?.body&&t?{...t,body:r.body}:t);return Ee(s,r.sequence),s}function kn(e,n){let t=new Headers(e.headers);t.delete("content-length"),t.delete("content-encoding");let r=new Response(JSON.stringify(n),{status:e.status,statusText:e.statusText,headers:t});return Object.defineProperty(r,"url",{value:e.url,configurable:!0}),Object.defineProperty(r,"redirected",{value:e.redirected,configurable:!0}),r}async function bn(e,n,t,r){let s=await d.call(e,t,r),o;try{o=E(await s.clone().text()),Ae(n,o)}catch{return s}let i=o?y(o):null;return i?kn(s,i):s}function Nn(e,n){for(let t=Object.getPrototypeOf(e);t;t=Object.getPrototypeOf(t)){let r=Object.getOwnPropertyDescriptor(t,n);if(r)return r.get}}function k(e,n){let t=Nn(e,n);return t?t.call(e):e[n]}function Sn(e){let n=E(e),t=n?y(n):null;return t?JSON.stringify(t):e}function ce(e){let n;return t=>(n&&n.raw===t||(n={raw:t,clean:e(t)}),n.clean)}function An(e){let n=ce(Sn),t=ce(r=>{if(typeof r=="string")return n(r);let s=A(r);return(s&&y(s))??r});try{Object.defineProperty(e,"responseText",{configurable:!0,get(){let r=k(e,"responseText");return typeof r=="string"?n(r):r}}),Object.defineProperty(e,"response",{configurable:!0,get(){let r=k(e,"response");return e.responseType===""||e.responseType==="text"||e.responseType==="json"?t(r):r}})}catch{return}}function En(e){if(e.responseType==="json")return A(k(e,"response"));if(e.responseType===""||e.responseType==="text"){let n=k(e,"responseText");return typeof n=="string"?E(n):null}return null}var g=!1,b=!1,d,G,_,C=new WeakMap;function xn(){g||(d=window.fetch,window.fetch=function(n,t){let r=cn(n);return I.test(r)&&(u||b)?bn(this,r,n,t):u&&de.test(r)?_n(this,n,t):d.call(this,n,t)},G=XMLHttpRequest.prototype.open,_=XMLHttpRequest.prototype.send,C=new WeakMap,XMLHttpRequest.prototype.open=function(n,t,...r){return C.set(this,String(t)),G.call(this,n,t,...r)},XMLHttpRequest.prototype.send=function(n){let t=C.get(this)??"",r=I.test(t);if(r&&(u||b)&&An(this),!u)return _.call(this,n);let s=de.test(t),o=s?D(n):{sequence:void 0,body:n};return(s||r)&&this.addEventListener("load",()=>{try{let i=En(this);s?o.sequence!==void 0&&Se(i,o.sequence):Ae(t,i)}catch{return}},{once:!0}),_.call(this,o.body??null)},g=!0)}function wn(){g&&(window.fetch=d,XMLHttpRequest.prototype.open=G,XMLHttpRequest.prototype.send=_,g=!1)}function Tn(){let e=ge();if(!e||u&&l?.slug===e)return;u=!0,xn();let n=_e(e);ke(n),N(n,()=>{un(n),me(n)})}function vn(){u&&(u=!1,Ne(),b||wn(),l&&(l.posted=null),he())}})();
