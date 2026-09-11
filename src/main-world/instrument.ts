export const GRAPHY_TRACE_MARK = "GRAPHY_TRACE_V1";

const PYTHON_LANGS = new Set(["python", "python3"]);

export const PYTHON_TRACER = `
# ${GRAPHY_TRACE_MARK}
def __graphy_install():
    import sys
    from collections import deque

    ids = {}
    buf = []
    tagged = []
    st = {
        "last": None,
        "last_topo": None,
        "root_obj": None,
        "mode": None,
        "depth": 0,
        "grid": None,
        "last_cell": None,
        "cursor": 0,
        "busy": False,
    }
    PREFERRED = ("node", "curr", "prev", "root", "head", "dummy", "p", "q", "l1", "l2", "l3")
    GRID_KEYS = ("grid", "board", "matrix", "mat")
    CELL_PAIRS = (("r", "c"), ("i", "j"), ("row", "col"), ("x", "y"))

    def nn(v):
        return "None" if v is None else v

    def fmt(item):
        if not isinstance(item, tuple):
            return str(item)
        n = len(item)
        if n == 2:
            return "(%s,%s)" % item
        if n == 4:
            a, b, c, d = item
            return "(%s,%s,%s,%s)" % (a, nn(b), nn(c), d)
        a, b, c = item
        return "(%s,%s,%s)" % (a, nn(b), nn(c))

    def flush():
        print("#graphy/[" + ",".join(fmt(item) for item in buf) + "]")
        del buf[:]

    def nid_int(nid):
        return int(nid[1:]) if nid and nid[0] == "n" else None

    def child_nid(node, attr):
        child = getattr(node, attr, None)
        return ids.get(id(child)) if child is not None else None

    def node_val(node):
        v = getattr(node, "val", 0)
        return v if isinstance(v, int) and not isinstance(v, bool) else 0

    def is_tree(obj):
        return obj is not None and hasattr(obj, "left") and hasattr(obj, "right") and hasattr(obj, "val")

    def is_list(obj):
        return obj is not None and hasattr(obj, "val") and hasattr(obj, "next") and not is_tree(obj)

    def is_grid(obj):
        if not isinstance(obj, (list, tuple)) or not obj:
            return False
        first = obj[0]
        if isinstance(first, str):
            n = len(first)
            return n > 0 and all(isinstance(row, str) and len(row) == n for row in obj)
        if isinstance(first, (list, tuple)):
            return all(isinstance(row, (list, tuple)) for row in obj)
        return False

    def is_index(v):
        return isinstance(v, int) and not isinstance(v, bool)

    def grid_shape(obj):
        return (len(obj), len(obj[0])) if obj is not None and is_grid(obj) else None

    def first_match(pred, *seqs):
        for seq in seqs:
            for item in seq:
                if pred(item):
                    return item
        return None

    def tag(root):
        ids.clear()
        del tagged[:]
        st["root_obj"] = root
        st["mode"] = "tree"
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

    def claim(node):
        nid = "n" + str(st["cursor"])
        ids[id(node)] = nid
        tagged.append(node)
        st["cursor"] += 1
        return nid

    def tag_list(head, reset=True):
        if reset:
            ids.clear()
            del tagged[:]
            st["cursor"] = 0
        st["root_obj"] = head if reset or st["root_obj"] is None else st["root_obj"]
        st["mode"] = "list"
        node = head
        while node is not None and id(node) not in ids:
            claim(node)
            node = getattr(node, "next", None)

    def tag_new_chain(head):
        node = head
        while node is not None and id(node) not in ids:
            nid = claim(node)
            buf.append((nid_int(nid), nid_int(child_nid(node, "next")), None, node_val(node)))
            node = getattr(node, "next", None)

    def dump_map():
        root_obj = st["root_obj"]
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

    def dump_list_map():
        out = {}
        for node in tagged:
            nid = ids.get(id(node))
            if nid:
                out[nid] = child_nid(node, "next")
        return out

    def emit_topo_if_changed():
        mode = st["mode"]
        if mode == "tree":
            curr = dump_map()
        elif mode == "list":
            curr = dump_list_map()
        else:
            return
        if curr == st["last_topo"]:
            return
        prev = st["last_topo"] or {}
        st["last_topo"] = curr
        for nid, kids in curr.items():
            if prev.get(nid) == kids:
                continue
            if mode == "tree":
                lid, rid = kids
                buf.append((nid_int(nid), nid_int(lid), nid_int(rid)))
            else:
                buf.append((nid_int(nid), nid_int(kids), None))

    def pick_cell(loc):
        shape = grid_shape(st["grid"])
        if shape is None:
            for key in GRID_KEYS:
                shape = grid_shape(loc.get(key))
                if shape:
                    break
        if shape is None:
            return None
        rows, cols = shape
        for a, b in CELL_PAIRS:
            r, c = loc.get(a), loc.get(b)
            if is_index(r) and is_index(c) and 0 <= r < rows and 0 <= c < cols:
                return (r, c)
        return None

    def nid_of(val):
        return ids.get(id(val)) if val is not None else None

    def pick_current(loc):
        for key in PREFERRED:
            nid = nid_of(loc.get(key))
            if nid:
                return nid
        for val in loc.values():
            nid = nid_of(val)
            if nid:
                return nid
        return None

    def discover_lists(loc):
        if st["mode"] != "list":
            return
        before = st["cursor"]
        for val in list(loc.values()):
            if is_list(val) and id(val) not in ids:
                tag_new_chain(val)
        for node in list(tagged):
            nxt = getattr(node, "next", None)
            if is_list(nxt) and id(nxt) not in ids:
                tag_new_chain(nxt)
        if st["cursor"] != before and st["last_topo"] is not None:
            prev = dict(st["last_topo"])
            for nid, kid in dump_list_map().items():
                prev.setdefault(nid, kid)
            st["last_topo"] = prev

    def tracer(frame, event, arg):
        if event != "line" or st["busy"] or frame.f_code.co_name.startswith("__graphy"):
            return tracer
        st["busy"] = True
        try:
            loc = frame.f_locals
            if st["mode"] == "list":
                discover_lists(loc)
            emit_topo_if_changed()
            current = pick_current(loc)
            if current and current != st["last"]:
                st["last"] = current
                buf.append(nid_int(current))
            cell = pick_cell(loc)
            if cell and cell != st["last_cell"]:
                st["last_cell"] = cell
                buf.append(cell)
        finally:
            st["busy"] = False
        return tracer

    def wrap(fn):
        def __graphy_wrapped(*args, **kwargs):
            if st["depth"] == 0:
                st.update(last=None, last_topo=None, mode=None, grid=None, last_cell=None, cursor=0)
                del buf[:]
                del tagged[:]
                tree = first_match(is_tree, args)
                if tree is not None:
                    tag(tree)
                else:
                    n = 0
                    for seq in (args, kwargs.values()):
                        for item in seq:
                            if is_list(item):
                                tag_list(item, reset=(n == 0))
                                n += 1
                                if n >= 3:
                                    break
                        if n:
                            break
                st["grid"] = first_match(is_grid, args, kwargs.values())
                dump = {"tree": dump_map, "list": dump_list_map}.get(st["mode"])
                if dump:
                    st["last_topo"] = dump()
                sys.settrace(tracer)
            st["depth"] += 1
            try:
                return fn(*args, **kwargs)
            finally:
                st["depth"] -= 1
                if st["depth"] == 0:
                    sys.settrace(None)
                    emit_topo_if_changed()
                    flush()
        return __graphy_wrapped

    try:
        sol = Solution
    except NameError:
        return
    for name, attr in list(vars(sol).items()):
        if not name.startswith("_") and callable(attr):
            setattr(sol, name, wrap(attr))

__graphy_install()
`;

export function instrumentPython(code: string): string {
  if (code.includes(GRAPHY_TRACE_MARK)) return code;
  return `${code.replace(/\s+$/, "")}\n${PYTHON_TRACER}`;
}

export interface InstrumentedRun {
  body: string;
  originalCode: string;
}

export function instrumentRunBody(body: unknown): InstrumentedRun | null {
  if (typeof body !== "string") return null;
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const code = parsed.typed_code;
    const lang = parsed.lang;
    if (typeof code !== "string" || typeof lang !== "string") return null;
    if (!PYTHON_LANGS.has(lang) || code.includes(GRAPHY_TRACE_MARK)) return null;
    parsed.typed_code = instrumentPython(code);
    return { body: JSON.stringify(parsed), originalCode: code };
  } catch {
    return null;
  }
}
