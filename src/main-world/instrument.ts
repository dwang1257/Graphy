import { PYTHON_SENTINEL } from "../core/traceWire.js";
import { NODE_LIMIT } from "../settings/schema.js";

export const GRAPHY_TRACE_MARK = "GRAPHY_TRACE_V2";
export const MAX_TRACE_OPS = 4000;
export const MAX_TRACE_LINES = 100_000;

export const PYTHON_TRACER = `
# ${GRAPHY_TRACE_MARK}
def __graphy_install(G):
    import sys
    import builtins
    import functools
    from collections import deque

    S = "${PYTHON_SENTINEL}"
    LET = "abcdefghijklmnopqrstuvwxy"
    MAX_INPUT = ${NODE_LIMIT}
    MAX_ALLOC = ${NODE_LIMIT * 2}
    MAX_OPS = ${MAX_TRACE_OPS}
    MAX_LINES = ${MAX_TRACE_LINES}
    MAX_SCAN = 1024
    WATCH = frozenset(("val", "left", "right", "next"))
    LINKS = ("left", "right", "next")
    TREE = {"left": "<", "right": ">"}
    PAIRS = (("r", "c"), ("i", "j"), ("row", "col"), ("x", "y"))
    TR = {9: 95, 10: 95, 11: 95, 12: 95, 13: 95, 32: 95, 44: 95}
    MISSING = object()
    FN = type(__graphy_install)
    HOME = __graphy_install.__code__
    FILE = HOME.co_filename
    FIRST = HOME.co_firstlineno
    SKIP = set()
    raw = object.__getattribute__

    class State(object):
        pass

    st = State()
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
        st.grid = None
        st.gpane = ""
        st.gsnap = None
        st.cell = None
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
        return type(first) is list and all(type(r) is list for r in a)

    def tag_args(args):
        total = 0
        for i in range(1, min(len(args), len(LET) + 1)):
            a = args[i]
            p = LET[i - 1] if i > 1 else ""
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
            elif st.grid is None and is_grid(a) and sum(len(r) for r in a) <= MAX_INPUT:
                st.grid = a
                st.gpane = p
                st.gsnap = [r[:] if type(r) is list else r for r in a]
            if total > MAX_INPUT:
                return False
        return True

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
        M = {}
        fr = set()
        for k, v in loc.items():
            r = ids.get(id(v))
            if r is not None:
                if k != "self" and k.isascii() and k.isidentifier():
                    M[k] = r
                continue
            t = type(v)
            if (t is list or t is deque or t is set or t is tuple) and id(v) not in st.inputs:
                found = contents(v)
                if found:
                    fr |= found
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
        if st.grid is not None:
            grid(loc)
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

    def grid(loc):
        g = st.grid
        snap = st.gsnap
        p = st.gpane
        for ri in range(min(len(g), len(snap))):
            row = g[ri]
            old = snap[ri]
            if row == old:
                continue
            for ci in range(min(len(row), len(old))):
                if row[ci] != old[ci]:
                    cid = p + str(ri) + "." + str(ci)
                    if cid not in st.visited:
                        st.visited.add(cid)
                        emit(cid)
            snap[ri] = row[:] if type(row) is list else row
        for a, b in PAIRS:
            rv = loc.get(a)
            cv = loc.get(b)
            if type(rv) is int and type(cv) is int and 0 <= rv < len(snap) and 0 <= cv < len(snap[rv]):
                if st.cell != (rv, cv):
                    st.cell = (rv, cv)
                    emit("@=" + p + str(rv) + "." + str(cv))
                return

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
        if not tag_args(args):
            return
        if not st.kinds and st.grid is None:
            return
        if not st.ids and st.grid is None and not names_node(fn):
            return
        patch()
        st.top = frame
        st.saved = sys.gettrace()
        st.on = True
        sys.settrace(gtrace)

    def finish(fn, ret, ok):
        st.closing = st.on and ok
        stop()
        try:
            if st.closing:
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
        if not name.startswith("_") and type(attr) is FN:
            setattr(sol, name, wrap(attr))

__graphy_install(globals())
`;

export function instrumentPython(code: string): string {
  if (code.includes(GRAPHY_TRACE_MARK)) return code;
  return `${code.replace(/\s+$/, "")}\n${PYTHON_TRACER}`;
}

export function instrumentRunBody(body: unknown): string | null {
  if (typeof body !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== "object" || parsed === null) return null;
    const run: Record<string, unknown> = { ...parsed };
    const code = run.typed_code;
    if (typeof code !== "string" || run.lang !== "python3" || code.includes(GRAPHY_TRACE_MARK)) return null;
    return JSON.stringify({ ...run, typed_code: instrumentPython(code) });
  } catch {
    return null;
  }
}
