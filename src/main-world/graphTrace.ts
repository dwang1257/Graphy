export const GRAPHY_GRAPH_TRACE_MARK = "GRAPHY_GRAPH_TRACE_V1";

export const PYTHON_GRAPH_TRACE = `
# ${GRAPHY_GRAPH_TRACE_MARK}
def fmt(item):
    if isinstance(item, tuple):
        if len(item) == 2:
            return "(%s,%s)" % item
        a, b, c = item
        return "(%s,%s,%s)" % (a, "None" if b is None else b, "None" if c is None else c)
    return str(item)

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

def _graphy_is_index(v):
    return isinstance(v, int) and not isinstance(v, bool)

def _graphy_shape(obj):
    return (len(obj), len(obj[0])) if obj is not None and is_grid(obj) else None

def pick_cell(loc):
    shape = _graphy_shape(grid)
    if shape is None:
        for key in ("grid", "board", "matrix", "mat"):
            shape = _graphy_shape(loc.get(key))
            if shape:
                break
    if shape is None:
        return None
    rows, cols = shape
    for a, b in (("r", "c"), ("i", "j"), ("row", "col"), ("x", "y")):
        r, c = loc.get(a), loc.get(b)
        if _graphy_is_index(r) and _graphy_is_index(c) and 0 <= r < rows and 0 <= c < cols:
            return (r, c)
    return None

def emit_cell(r, c):
    global last_cell
    cell = (r, c)
    if cell != last_cell:
        last_cell = cell
        buf.append(cell)
`;
