/** Marker so a Run payload is never instrumented twice. */
export const GRAPHY_TRACE_MARK = "GRAPHY_TRACE_V1";

const PYTHON_LANGS = new Set(["python", "python3"]);

/**
 * Appends a Python tracer that tags TreeNodes with Graphy's level-order ids
 * and prints one `#graphy/[visits and (id,left,right) patches]` line per Solution call.
 * Runs only inside the judge — the editor buffer is not changed.
 *
 * Line events fire *before* the line runs, so topology is snapshotted at line
 * start (state after the previous line) and once more on unwind.
 */
export const PYTHON_TRACER = `
# ${GRAPHY_TRACE_MARK}
def __graphy_install():
    import sys
    from collections import deque

    ids = {}
    last = None
    last_topo = None
    root_obj = None
    depth = 0
    buf = []

    def fmt(item):
        if isinstance(item, tuple):
            a, b, c = item
            return "(%s,%s,%s)" % (a, "None" if b is None else b, "None" if c is None else c)
        return str(item)

    def flush():
        print("#graphy/[" + ",".join(fmt(item) for item in buf) + "]")
        del buf[:]

    def tag(root):
        nonlocal root_obj
        ids.clear()
        root_obj = root
        if root is None:
            return
        q = deque([root])
        ids[id(root)] = "n0"
        cursor = 1
        while q:
            node = q.popleft()
            for child in (getattr(node, "left", None), getattr(node, "right", None)):
                cid = "n" + str(cursor)
                cursor += 1
                if child is not None:
                    ids[id(child)] = cid
                    q.append(child)

    def dump_map():
        if root_obj is None:
            return {}
        out = {}
        q = deque([root_obj])
        seen = set()
        while q:
            node = q.popleft()
            nid = ids.get(id(node))
            if not nid or nid in seen:
                continue
            seen.add(nid)
            left = getattr(node, "left", None)
            right = getattr(node, "right", None)
            lid = ids.get(id(left)) if left is not None else None
            rid = ids.get(id(right)) if right is not None else None
            out[nid] = (lid, rid)
            if left is not None and lid:
                q.append(left)
            if right is not None and rid:
                q.append(right)
        return out

    def nid_int(nid):
        return int(nid[1:]) if nid and nid[0] == "n" else None

    def emit_topo_if_changed():
        nonlocal last_topo
        curr = dump_map()
        if curr == last_topo:
            return
        prev = last_topo or {}
        last_topo = curr
        for nid, kids in curr.items():
            if prev.get(nid) == kids:
                continue
            lid, rid = kids
            buf.append((nid_int(nid), nid_int(lid) if lid else None, nid_int(rid) if rid else None))

    def emit_current(nid):
        nonlocal last
        if nid == last:
            return
        last = nid
        buf.append(nid_int(nid))

    def is_tree(obj):
        return obj is not None and hasattr(obj, "left") and hasattr(obj, "right") and hasattr(obj, "val")

    def pick_current(loc):
        for key in ("node", "curr", "root", "head", "p", "q"):
            val = loc.get(key)
            nid = ids.get(id(val)) if val is not None else None
            if nid:
                return nid
        for val in loc.values():
            nid = ids.get(id(val)) if val is not None else None
            if nid:
                return nid
        return None

    def tracer(frame, event, arg):
        if event != "line":
            return tracer
        name = frame.f_code.co_name
        if name.startswith("__graphy"):
            return tracer
        emit_topo_if_changed()
        current = pick_current(frame.f_locals)
        if current:
            emit_current(current)
        return tracer

    def wrap(fn):
        def __graphy_wrapped(*args, **kwargs):
            nonlocal depth, last, last_topo
            if depth == 0:
                last = None
                last_topo = None
                del buf[:]
                for item in args:
                    if is_tree(item):
                        tag(item)
                        break
                last_topo = dump_map()
                sys.settrace(tracer)
            depth += 1
            try:
                return fn(*args, **kwargs)
            finally:
                depth -= 1
                if depth == 0:
                    sys.settrace(None)
                    emit_topo_if_changed()
                    flush()
        return __graphy_wrapped

    try:
        sol = Solution
    except NameError:
        return
    for name, attr in list(vars(sol).items()):
        if name.startswith("_") or not callable(attr):
            continue
        setattr(sol, name, wrap(attr))

__graphy_install()
`;

/** Appends the tracer unless this buffer is already instrumented. */
export function instrumentPython(code: string): string {
  if (code.includes(GRAPHY_TRACE_MARK)) return code;
  return `${code.replace(/\s+$/, "")}\n${PYTHON_TRACER}`;
}

export interface InstrumentedRun {
  body: string;
  originalCode: string;
}

/**
 * Rewrites a LeetCode `interpret_solution` JSON body for Python.
 * Returns null when there is nothing to change (wrong lang, bad JSON, already traced).
 */
export function instrumentRunBody(body: unknown): InstrumentedRun | null {
  if (typeof body !== "string") return null;
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    if (typeof parsed.typed_code !== "string") return null;
    if (typeof parsed.lang !== "string" || !PYTHON_LANGS.has(parsed.lang)) return null;
    if (parsed.typed_code.includes(GRAPHY_TRACE_MARK)) return null;
    const originalCode = parsed.typed_code;
    parsed.typed_code = instrumentPython(originalCode);
    return { body: JSON.stringify(parsed), originalCode };
  } catch {
    return null;
  }
}
