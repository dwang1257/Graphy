"use strict";(()=>{var y="graphy:page";function D(){return{channel:y,type:"clear"}}function Ne(e,t){return typeof e=="object"&&e!==null&&e.channel===t}function X(e,t,n=!1){return typeof e=="string"&&e.length<=t&&(!n||e.length>0)}function F(e){if(typeof e!="object"||e===null)return!1;let t=e;return X(t.name,128,!0)&&X(t.type,128,!0)}function G(e){return Ne(e,y)?(e.type==="trace"||e.type==="hooks")&&typeof e.enabled=="boolean":!1}var j="\\ue000",we=/\u{E000}[^\n]*\n?/gu;function h(e){return e.includes("\uE000")?e.replace(we,""):e}function U(e,t){return e.flatMap(n=>typeof n!="string"?[n]:t&&n.startsWith("\uE000")&&h(n)===""?[]:[h(n)])}function _(e){let t={...e},n=e.code_output;return typeof n=="string"?t.code_output=h(n):Array.isArray(n)&&(t.code_output=U(n,!0)),Array.isArray(e.std_output_list)&&(t.std_output_list=U(e.std_output_list,!1)),typeof e.std_output=="string"&&(t.std_output=h(e.std_output)),JSON.stringify(t)===JSON.stringify(e)?null:t}var Te={background:["#ffffff"],nodeFill:["#eef2ff"],nodeStroke:["#4f46e5"],nodeText:["#111827","#1e1b4b"],rootFill:["#4f46e5"],rootStroke:["#3730a3"],terminalText:["#94a3b8"],edgeColor:["#64748b"],edgeText:["#475569"],cycleColor:["#e11d48"],cellFill:["#c7d2fe"],cellEmptyFill:["#f8fafc"],cellStroke:["#cbd5e1"],cellText:["#1e293b"],gutterText:["#94a3b8"]};var At=Object.keys(Te);var E=100;var A="GRAPHY_TRACE_V2",be=4e3,Ee=1e5,Ae=`
# ${A}
def __graphy_install(G):
    import sys
    import builtins
    import functools
    from collections import deque

    S = "${j}"
    LET = "abcdefghijklmnopqrstuvwxy"
    MAX_INPUT = ${E}
    MAX_ALLOC = ${E*2}
    MAX_OPS = ${be}
    MAX_LINES = ${Ee}
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
`;function xe(e){return e.includes(A)?e:`${e.replace(/\s+$/,"")}
${Ae}`}function B(e){if(typeof e!="string")return null;try{let t=JSON.parse(e);if(typeof t!="object"||t===null)return null;let n={...t},r=n.typed_code;return typeof r!="string"||n.lang!=="python3"||r.includes(A)?null:JSON.stringify({...n,typed_code:xe(r)})}catch{return null}}var Pe="QD_TESTCASE_CACHE_",K="query($titleSlug: String!) { question(titleSlug: $titleSlug) { exampleTestcaseList metaData } }";function a(e){return typeof e=="object"&&e!==null&&!Array.isArray(e)?e:null}function Q(e){if(typeof e=="string")try{return JSON.parse(e)}catch{return}}function R(e){return e.map(t=>t.trim()).join(`
`)}function $(e){return R(e.trim().split(/\r?\n/))}function Le(e){let t=a(Q(e));if(!t)return null;if(t.systemdesign===!0)return{lineCount:2};let n=t.params;return!Array.isArray(n)||n.length===0||n.length>32||!n.every(F)?null:{lineCount:n.length,params:n.map(({name:r,type:o})=>({name:r,type:o}))}}function Me(e){return Array.isArray(e)?e.filter(t=>typeof t=="string").map($).slice(0,64):[]}function z(e){let t=Le(e.metaData),n={cases:Me(e.exampleTestcaseList),lineCount:t?.lineCount??null};return t?.params&&(n.params=t.params),n}function J(e,t){let n=a(a(a(a(e)?.props)?.pageProps)?.dehydratedState)?.queries;if(!Array.isArray(n))return null;for(let r of n){let o=a(r),s=o?.queryKey;if(!Array.isArray(s)||s[0]!=="questionDetail"||a(s[1])?.titleSlug!==t)continue;let i=Y(a(a(o?.state)?.data)?.question);if(i)return i}return null}function W(e){return Y(a(a(e)?.data)?.question)}function Y(e){let t=a(e);return t?{exampleTestcaseList:t.exampleTestcaseList,metaData:t.metaData}:null}function V(e){return Pe+e}function Z(e,t){if(e===null)return null;let n=Q(e);if(!Array.isArray(n)||n.length===0||n.length>64)return null;let r=[];for(let o of n){if(!Array.isArray(o)||o.length===0||!o.every(s=>typeof s=="string")||t!==null&&o.length!==t||o.some(s=>/[\r\n]/.test(s)))return null;r.push(R(o))}return r}function ve(e,t){if(e.length===0||e.length%t!==0)return null;let n=[];for(let r=0;r<e.length;r+=t)n.push(R(e.slice(r,r+t)));return n}function ee(e,t){if(e.trim()==="")return null;let n=e.split(/\r?\n/);for(;n.at(-1)?.trim()==="";)n.pop();return((t!==null&&t>0?ve(n,t):null)??[$(e)]).slice(0,64)}function re(e){if(e)return te(e.code_output)??te(e.std_output_list)??se(e.std_output)}function oe(e){if(!e)return;let t=e.std_output_list;if(!(!Array.isArray(t)||t.length===0||t.length>64)&&t.every(n=>typeof n=="string"&&n.length<=262144))return t}function se(e){return typeof e=="string"&&e.length>0&&e.length<=262144?e:void 0}function te(e){if(!Array.isArray(e))return se(e);if(e.length===0||e.length>64||!e.every(n=>typeof n=="string"))return;let t=e.join(`
`);return t.length<=262144?t:void 0}var Oe=/class\s+Solution|def\s+\w+\s*\(|func\s+\w+|impl\s+Solution|var\s+\w+\s*=\s*function|public\s+class|^\s*(?:int|char|void|double|bool|struct)\b[^=\n]*\(/m,Xe="Couldn't load this problem's testcases. Press Run to capture them.",De="This testcase is too large to draw.",Fe="cpp",Ge=1e4,ie=/\/interpret_solution\/?$|\/interpret_solution\//,v=/\/submissions\/detail\/([^/?]+)\/check\/?/,Ue=new Set(["PENDING","STARTED"]),je=32,l=null,ue=!1,u=!1,ae=0,d=new Map,f=new Map;function Be(e){if(e.source===window&&e.origin===location.origin&&G(e.data)){if(e.data.type==="trace"){ue=e.data.enabled;return}e.data.enabled?St():kt()}}window.addEventListener("message",Be);function Ke(e){let n=e.cmView?.rootView?.view?.state?.doc?.toString();return typeof n=="string"?n:null}function I(){for(let e of document.querySelectorAll(".cm-content")){let t=Ke(e);if(t!==null&&Oe.test(t))return t}return""}function ce(){let e=location.pathname.match(/\/problems\/([^/]+)/)?.[1]??"";return e.length<=128?e:""}function L(e){return typeof e=="string"&&e.length>0&&e.length<=32}function Qe(){try{let e=localStorage.getItem("global_lang");return e?JSON.parse(e):void 0}catch{return}}function $e(){return(document.querySelector("[id^='headlessui-listbox-button'], button[data-state]")?.textContent??"").trim().toLowerCase().replace(/[^a-z0-9+#]/g,"")}function q(e){if(L(e))return e;let t=Qe();if(L(t))return t;let n=$e();return L(n)?n:Fe}function ze(e){window.postMessage({channel:y,type:"snapshot",payload:e},location.origin)}function de(){window.postMessage(D(),location.origin)}function N(e,t){e.queue=e.queue.then(()=>l===e?t():void 0).catch(()=>{})}function fe(e){!u||l!==e||!e.snapshot||e.posted===e.snapshot||(e.posted=e.snapshot,ze(e.snapshot))}function w(e,t){e.snapshot=t,fe(e)}function H(e,t,n,r,o){let s=n.every(p=>p.length<=65536),i={cases:s?n:[],code:r.length<=262144?r:"",lang:o,slug:e.slug,source:t,at:Date.now()};return e.params&&(i.params=e.params),s||(i.captureError=De),i}function Je(e,t){return e.length===t.length&&e.every((n,r)=>n===t[r])}function We(){let e=window.__NEXT_DATA__;if(e!==void 0)return e;try{let t=document.getElementById("__NEXT_DATA__")?.textContent;return t?JSON.parse(t):void 0}catch{return}}function Ye(){return g?c:window.fetch}async function Ve(e){let t=new AbortController,n=setTimeout(()=>t.abort(),Ge);try{let r=await Ye().call(window,"/graphql",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({query:K,variables:{titleSlug:e}}),signal:t.signal});return r.ok?W(await r.json()):null}catch{return null}finally{clearTimeout(n)}}async function Ze(e){return J(We(),e)??await Ve(e)}function pe(e,t){try{return Z(sessionStorage.getItem(V(e)),t)}catch{return null}}function et(e){e.loading=!0,N(e,async()=>{let t=await Ze(e.slug);if(l!==e)return;e.loading=!1;let n=t?z(t):null;if(e.loaded=n!==null,e.lineCount=n?.lineCount??null,n?.params?e.params=n.params:delete e.params,e.snapshot?.source==="network")return;let r=pe(e.slug,e.lineCount)??n?.cases??[],o=H(e,"editor",r,I(),q());r.length===0&&(o.captureError=Xe),w(e,o)})}function ge(e){return l?.slug===e||(l&&de(),_e(),l={slug:e,lineCount:null,loaded:!1,loading:!1,queue:Promise.resolve(),snapshot:null,posted:null,latestRun:-1}),l}function ye(e){!e.loaded&&!e.loading&&et(e)}function tt(e){if(!e.loaded||!e.snapshot)return;let t=pe(e.slug,e.lineCount);if(!t)return;let n=H(e,"editor",t,I(),q());Je(n.cases,e.snapshot.cases)||w(e,n)}function nt(e){if(typeof e!="string")return null;let t=b(e);if(!t||typeof t.data_input!="string")return null;let n={dataInput:t.data_input};return typeof t.typed_code=="string"&&(n.code=t.typed_code),typeof t.lang=="string"&&(n.lang=t.lang),n}function rt(e){let t=nt(e),n=ce();if(!t||!n)return;let r=ge(n);ye(r);let o=ae;ae+=1;let s={sequence:o,state:r,snapshot:null};return d.set(o,s),he(),N(r,()=>{let i=ee(t.dataInput,r.lineCount)??r.snapshot?.cases??[];s.snapshot=H(r,"network",i,t.code??I(),q(t.lang)),r.latestRun=o,w(r,s.snapshot)}),o}function ot(e){return typeof e=="string"?e:e instanceof URL?e.href:e.url}function T(e){return typeof e=="object"&&e!==null?{...e}:null}function b(e){try{return T(JSON.parse(e))}catch{return null}}async function st(e){try{return T(await e.clone().json())}catch{return null}}function it(e){let t=e?.interpret_id;return typeof t=="string"&&t.length>0?t:void 0}function at(){let e;for(let[t,n]of d)(!e||n.sequence<e.sequence)&&(e={map:d,key:t,sequence:n.sequence});for(let[t,n]of f)(!e||n.sequence<e.sequence)&&(e={map:f,key:t,sequence:n.sequence});e&&e.map.delete(e.key)}function he(){for(;d.size+f.size>je;)at()}function _e(){d.clear(),f.clear()}function me(e,t){let n=d.get(t);if(!n)return;d.delete(t);let r=it(e);r&&(f.set(r,n),he())}function Se(e,t){let n=t?.state;if(typeof n!="string"||Ue.has(n))return;let r=v.exec(e)?.[1];if(!r)return;let o=f.get(r);if(!o)return;f.delete(r);let s=re(t),i=oe(t);N(o.state,()=>{if(!o.snapshot||o.sequence!==o.state.latestRun)return;let p={...o.snapshot,at:Date.now()};s!==void 0&&(p.stdout=s),i!==void 0&&(p.stdoutByCase=i),w(o.state,p)})}function lt(e){let t=ue?B(e):null;return t===null?e:(k=!0,t)}function O(e){try{return{sequence:rt(e),body:lt(e)}}catch{return{sequence:void 0,body:e}}}function ke(e,t){t!==void 0&&e.then(async n=>me(await st(n),t)).catch(()=>{})}async function ut(e,t,n){let r;try{r=await t.clone().text()}catch{r=void 0}let o=O(r),s;if(typeof o.body=="string"&&o.body!==r)try{s=c.call(e,new Request(t,{body:o.body}),n)}catch{s=void 0}return s??=c.call(e,t,n),ke(s,o.sequence),s}function ct(e,t,n){if(t instanceof Request&&n?.body===void 0)return ut(e,t,n);let r=O(n?.body),o=c.call(e,t,r.body!==n?.body&&n?{...n,body:r.body}:n);return ke(o,r.sequence),o}function dt(e,t){let n=new Headers(e.headers);n.delete("content-length"),n.delete("content-encoding");let r=new Response(JSON.stringify(t),{status:e.status,statusText:e.statusText,headers:n});return Object.defineProperty(r,"url",{value:e.url,configurable:!0}),Object.defineProperty(r,"redirected",{value:e.redirected,configurable:!0}),r}async function ft(e,t,n,r){let o=await c.call(e,n,r),s;try{s=b(await o.clone().text()),Se(t,s)}catch{return o}let i=s?_(s):null;return i?dt(o,i):o}function pt(e,t){for(let n=Object.getPrototypeOf(e);n;n=Object.getPrototypeOf(n)){let r=Object.getOwnPropertyDescriptor(n,t);if(r)return r.get}}function S(e,t){let n=pt(e,t);return n?n.call(e):e[t]}function gt(e){let t=b(e),n=t?_(t):null;return n?JSON.stringify(n):e}function le(e){let t;return n=>(t&&t.raw===n||(t={raw:n,clean:e(n)}),t.clean)}function yt(e){let t=le(gt),n=le(r=>{if(typeof r=="string")return t(r);let o=T(r);return(o&&_(o))??r});try{Object.defineProperty(e,"responseText",{configurable:!0,get(){let r=S(e,"responseText");return typeof r=="string"?t(r):r}}),Object.defineProperty(e,"response",{configurable:!0,get(){let r=S(e,"response");return e.responseType===""||e.responseType==="text"||e.responseType==="json"?n(r):r}})}catch{return}}function ht(e){if(e.responseType==="json")return T(S(e,"response"));if(e.responseType===""||e.responseType==="text"){let t=S(e,"responseText");return typeof t=="string"?b(t):null}return null}var g=!1,k=!1,c,C,m,M=new WeakMap;function _t(){g||(c=window.fetch,window.fetch=function(t,n){let r=ot(t);return v.test(r)&&(u||k)?ft(this,r,t,n):u&&ie.test(r)?ct(this,t,n):c.call(this,t,n)},C=XMLHttpRequest.prototype.open,m=XMLHttpRequest.prototype.send,M=new WeakMap,XMLHttpRequest.prototype.open=function(t,n,...r){return M.set(this,String(n)),C.call(this,t,n,...r)},XMLHttpRequest.prototype.send=function(t){let n=M.get(this)??"",r=v.test(n);if(r&&(u||k)&&yt(this),!u)return m.call(this,t);let o=ie.test(n),s=o?O(t):{sequence:void 0,body:t};return(o||r)&&this.addEventListener("load",()=>{try{let i=ht(this);o?s.sequence!==void 0&&me(i,s.sequence):Se(n,i)}catch{return}},{once:!0}),m.call(this,s.body??null)},g=!0)}function mt(){g&&(window.fetch=c,XMLHttpRequest.prototype.open=C,XMLHttpRequest.prototype.send=m,g=!1)}function St(){let e=ce();if(!e||u&&l?.slug===e)return;u=!0,_t();let t=ge(e);ye(t),N(t,()=>{tt(t),fe(t)})}function kt(){u&&(u=!1,_e(),k||mt(),l&&(l.posted=null),de())}})();
