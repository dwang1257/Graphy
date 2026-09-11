"use strict";(()=>{var w="graphy:page";function Y(e,t){return typeof e=="object"&&e!==null&&e.channel===t}function C(e){if(!Y(e,w))return!1;let t=e;return t.type==="trace"&&typeof t.enabled=="boolean"}var N="GRAPHY_TRACE_V1",K=new Set(["python","python3"]),W=`
# ${N}
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
`;function z(e){return e.includes(N)?e:`${e.replace(/\s+$/,"")}
${W}`}function L(e){if(typeof e!="string")return null;try{let t=JSON.parse(e),n=t.typed_code,r=t.lang;return typeof n!="string"||typeof r!="string"||!K.has(r)||n.includes(N)?null:(t.typed_code=z(n),{body:JSON.stringify(t),originalCode:n})}catch{return null}}function S(e){if(!e)return;let t=x(e.code_output);if(t!==void 0)return t;let n=x(e.std_output_list);if(n!==void 0)return n;if(typeof e.std_output=="string"&&e.std_output.length>0)return e.std_output}function k(e){if(!e)return;let t=e.std_output_list;if(!(!Array.isArray(t)||t.length===0)&&t.every(n=>typeof n=="string"))return t}function x(e){if(typeof e=="string"&&e.length>0)return e;if(Array.isArray(e)){let t=e.filter(n=>typeof n=="string");return t.length===0?void 0:t.join(`
`)}}async function v(e,t){let n=t??(()=>!0),r=e.tabs(),l=e.selectedIndex(r);try{if(r.length===0){if(!n())return{cases:[],captureError:"Testcase capture was cancelled"};let a=e.readMountedParameters();return a===null?{cases:[]}:{cases:[a.join(`
`)]}}let o=[];for(let a of r){if(!n())return{cases:[],captureError:"Testcase capture was cancelled"};e.select(a);try{let s=await e.waitUntilSettled(a,n);o.push(s.join(`
`))}catch(s){if(!n())return{cases:[],captureError:"Testcase capture was cancelled"};let i=s instanceof Error?s.message:String(s);return{cases:[],captureError:`Case ${a.index+1}: ${i}`}}}return{cases:o}}finally{await Q(e,r,l,n)}}async function Q(e,t,n,r){if(n<0)return;let l=t.find(o=>o.index===n);if(l&&e.selectedIndex(t)!==n)try{e.select(l),await e.waitUntilSettled(l,r)}catch{}}var Z='[data-e2e-locator="console-testcase-tag"]',ee='[data-e2e-locator="console-testcase-input"]',te='[data-e2e-locator="console-result"]',ne=/^Case\s+\d+$/i,re=/^(Input|输入)$/;function R(e){return e.replace(/\s+/g," ").trim()}function A(e){return e.getAttribute("aria-selected")==="true"||e.getAttribute("aria-current")==="true"||e.getAttribute("data-state")==="active"}function P(e){return String(e.className).includes("bg-fill-3")}function se(e){return e.matches("textarea")?e.value:e.querySelector("textarea")?.value??null}function oe(e){let n=e.querySelector(".cm-content")?.cmView?.rootView?.view?.state?.doc?.toString();if(typeof n=="string")return n;let r=se(e);return r!==null?r:typeof e.textContent=="string"?e.textContent:null}function ie(e,t){return e.querySelector?.(t)??e.querySelectorAll?.(t)[0]??null}function ae(e){return ne.test(R(e.textContent??""))}function M(e){let t=Array.from(e.querySelectorAll("div,button")).filter(ae),n=t.filter(l=>{let o=String(l.className);return l.tagName==="BUTTON"||o.includes("cursor-pointer")}),r=n.length>0?n:t;return r.filter(l=>!r.some(o=>o!==l&&o.contains?.(l)))}function H(e){let t=ie(e,te);if(!t)return null;let n=t;for(let r=0;r<10&&n;r+=1){if(M(n).length>0)return n;n=n.parentElement}return t.parentElement}function le(e){let t=Array.from(e.querySelectorAll("div")).find(r=>String(r.className).includes("font-menlo"));if(t)return(t.textContent??"").trim();let n=(e.textContent??"").trim();return n&&n.replace(/^[^\n=]*=\s*/,"").trim()||null}function ue(e){let t=H(e);if(!t)return null;let r=Array.from(t.querySelectorAll("div")).find(o=>re.test(R(o.textContent??""))&&o.children.length===0)?.nextElementSibling;if(!r)return null;let l=Array.from(r.children,o=>le(o));return l.length>0&&l.every(o=>o!==null)?l:null}function de(e){let t=Array.from(e.querySelectorAll(ee));if(t.length===0)return null;let n=t.map(oe);return n.every(r=>r!==null)?n:null}function ce(e,t){if(e.length!==t.length)return!1;for(let n=0;n<e.length;n+=1)if(e[n]!==t[n])return!1;return!0}function fe(e,t){if(t){if(t===e.element)return!0;if(typeof t.isConnected!="boolean"||t.isConnected)return!1}return A(e.element)||P(e.element)}function q(e,t){let n=null,r=()=>{let s=Array.from(e.querySelectorAll(Z),(u,d)=>({element:u,index:d}));if(s.length>0)return s;let i=H(e);return i?M(i).map((u,d)=>({element:u,index:d})):[]},l=s=>{if(n){let i=s.find(u=>u.element===n);if(i)return i.index}return s.find(i=>A(i.element)||P(i.element))?.index??-1},o=()=>de(e)??ue(e);return{tabs:r,selectedIndex:l,select:s=>{n=s.element,s.element.click()},readMountedParameters:o,waitUntilSettled:(s,i)=>new Promise((u,d)=>{let f=null,p=!1,m=!1,b=h=>{p||(p=!0,t.clearTimeout(X),h())},X=t.setTimeout(()=>{b(()=>d(new Error("Timed out waiting for testcase inputs to settle")))},2e3),J=()=>{if(p)return;if(!i()){b(()=>d(new Error("Testcase capture was superseded")));return}let h=fe(s,n)?o():null;if(h!==null){if(f!==null&&ce(f,h)){b(()=>u(h));return}f=h}else f=null;T()},T=()=>{p||m||(m=!0,t.requestAnimationFrame(()=>{m=!1,J()}))};T()})}}var pe=/class\s+Solution|def\s+\w+\s*\(|func\s+\w+|impl\s+Solution|var\s+\w+\s*=\s*function|public\s+class|^\s*(?:int|char|void|double|bool|struct)\b[^=\n]*\(/m,ge=q(document,window),j="",_=0,c=null,I=Promise.resolve(),G=!1;function me(e){e.source===window&&e.origin===location.origin&&C(e.data)&&(G=e.data.enabled)}window.addEventListener("message",me);function he(e){let n=e.cmView?.rootView?.view?.state?.doc?.toString();return typeof n=="string"?n:null}function ye(){for(let e of document.querySelectorAll(".cm-content")){let t=he(e);if(t!==null&&pe.test(t))return t}return""}function D(){return location.pathname.match(/\/problems\/([^/]+)/)?.[1]??""}function _e(){try{let t=localStorage.getItem("global_lang");if(t)return JSON.parse(t)}catch{}return(document.querySelector("[id^='headlessui-listbox-button'], button[data-state]")?.textContent??"").trim().toLowerCase().replace(/[^a-z0-9+#]/g,"")||"cpp"}function be(e){window.postMessage({channel:w,type:"snapshot",payload:e},location.origin)}function we(){return _+=1,_}function Ne(e,t,n=!1){let r=D();if(!r)return;let l=we();I=I.then(async()=>{if(l!==_)return;let a=()=>l===_;c&&c.slug!==r&&(c=null);let s=c?.cases??[],i;if(n){let f=await v(ge,a);if(!a())return;let p=D();if(!p||p!==r)return;c&&c.slug!==p&&(c=null),s=f.cases,i=f.captureError;let m=c&&c.cases.length>0?c:null;i||s.length===0?m?(s=m.cases,i=void 0):i&&(s=[]):c={slug:p,cases:s}}if(e==="network"){let f=t?.cases;(!c||c.cases.length===0)&&!i&&f&&f.length>0?s=f:c&&c.cases.length>0&&(s=c.cases,i=void 0)}let u={cases:s,code:t?.code??ye(),lang:t?.lang??_e(),slug:r,source:e,at:Date.now()};i&&(u.captureError=i),t?.stdout!==void 0&&(u.stdout=t.stdout),t?.stdoutByCase!==void 0&&(u.stdoutByCase=t.stdoutByCase);let d=`${u.cases.join("")}${u.code}${u.lang}${u.captureError??""}`;e==="editor"&&d===j||(j=d,be(u))}).then(()=>{},()=>{})}function Ee(e){if(typeof e!="string")return null;try{let t=JSON.parse(e);return typeof t.data_input!="string"?null:{cases:[t.data_input],code:typeof t.typed_code=="string"?t.typed_code:void 0,lang:typeof t.lang=="string"?t.lang:void 0}}catch{return null}}var y=/\/interpret_solution\/?$|\/interpret_solution\//,E=/\/submissions\/detail\/([^/?]+)\/check\/?/,Te=new Set(["PENDING","STARTED"]),g=null;function Ce(e){return typeof e=="string"?e:e instanceof URL?e.href:e.url}function $(e){return typeof e=="object"&&e!==null?e:null}function Le(e){try{return $(JSON.parse(e))}catch{return null}}async function O(e){try{return $(await e.clone().json())}catch{return null}}function xe(e){let t=e?.interpret_id;return typeof t=="string"&&t.length>0?t:void 0}function U(e){g={override:Ee(e)??void 0}}function B(e){let t=xe(e);t&&g&&(g.id=t)}function F(e,t){if(!g)return;let n=t?.state;if(typeof n!="string"||Te.has(n))return;let r=E.exec(e)?.[1];if(g.id&&r!==g.id)return;let l={...g.override},o=S(t);o!==void 0&&(l.stdout=o);let a=k(t);a!==void 0&&(l.stdoutByCase=a),g=null,Ne("network",l,!0)}function V(e){let t=G?L(e):null;return{remember:e,send:t?t.body:e}}function Se(){let e=window.fetch;window.fetch=function(o,a){let s=Ce(o),i=a;try{if(y.test(s)){let d=V(a?.body);U(d.remember),d.send!==a?.body&&a&&(i={...a,body:d.send})}}catch{}let u=e.call(this,o,i);return u.then(async d=>{if(y.test(s)){B(await O(d));return}E.test(s)&&F(s,await O(d))}).catch(()=>{}),u};let t=XMLHttpRequest.prototype.open,n=XMLHttpRequest.prototype.send,r=new WeakMap;XMLHttpRequest.prototype.open=function(o,a,...s){return r.set(this,String(a)),t.call(this,o,a,...s)},XMLHttpRequest.prototype.send=function(o){let a=r.get(this)??"",s=o;try{if(y.test(a)){let i=V(o);U(i.remember),s=i.send}}catch{}return(y.test(a)||E.test(a))&&this.addEventListener("load",()=>{try{let i=Le(String(this.responseText??""));y.test(a)?B(i):F(a,i)}catch{}},{once:!0}),n.call(this,s??null)}}Se();})();
