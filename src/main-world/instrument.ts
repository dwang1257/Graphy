/** Marker so a Run payload is never instrumented twice. */
export const GRAPHY_TRACE_MARK = "GRAPHY_TRACE_V1";

const PYTHON_LANGS = new Set(["python", "python3"]);

/**
 * Appends a Python tracer that tags TreeNodes with Graphy's level-order ids
 * and prints one `#graphy walk n0 n1 …` line as the solution walks them.
 * Runs only inside the judge — the editor buffer is not changed.
 */
export const PYTHON_TRACER = `
# ${GRAPHY_TRACE_MARK}
def __graphy_install():
    import sys

    ids = {}
    last = None
    walk = []
    depth = 0

    def tag(root):
        ids.clear()
        if root is None:
            return
        from collections import deque
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

    def emit(nid):
        nonlocal last
        if nid == last:
            return
        last = nid
        walk.append(nid)

    def flush():
        nonlocal last
        if walk:
            print("#graphy walk " + " ".join(walk))
            walk.clear()
        last = None

    def is_tree(obj):
        return obj is not None and hasattr(obj, "left") and hasattr(obj, "right") and hasattr(obj, "val")

    def tracer(frame, event, arg):
        if event != "line":
            return tracer
        name = frame.f_code.co_name
        if name.startswith("__graphy"):
            return tracer
        loc = frame.f_locals
        current = None
        for key in ("node", "curr", "root", "head", "p", "q"):
            val = loc.get(key)
            nid = ids.get(id(val)) if val is not None else None
            if nid:
                current = nid
                break
        if current is None:
            for val in loc.values():
                nid = ids.get(id(val)) if val is not None else None
                if nid:
                    current = nid
                    break
        if current:
            emit(current)
        return tracer

    def wrap(fn):
        def __graphy_wrapped(*args, **kwargs):
            nonlocal depth
            if depth == 0:
                for item in args:
                    if is_tree(item):
                        tag(item)
                        break
                sys.settrace(tracer)
            depth += 1
            try:
                return fn(*args, **kwargs)
            finally:
                depth -= 1
                if depth == 0:
                    sys.settrace(None)
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
