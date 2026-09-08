"use strict";(()=>{var E="graphy:page";var b="GRAPHY_TRACE_V1",X=new Set(["python","python3"]),J=`
# ${b}
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
`;function Y(e){return e.includes(b)?e:`${e.replace(/\s+$/,"")}
${J}`}function C(e){if(typeof e!="string")return null;try{let t=JSON.parse(e);if(typeof t.typed_code!="string"||typeof t.lang!="string"||!X.has(t.lang)||t.typed_code.includes(b))return null;let n=t.typed_code;return t.typed_code=Y(n),{body:JSON.stringify(t),originalCode:n}}catch{return null}}function S(e){if(!e)return;let t=L(e.code_output);if(t!==void 0)return t;let n=L(e.std_output_list);if(n!==void 0)return n;if(typeof e.std_output=="string"&&e.std_output.length>0)return e.std_output}function A(e){if(!e)return;let t=e.std_output_list;if(!(!Array.isArray(t)||t.length===0)&&t.every(n=>typeof n=="string"))return t}function L(e){if(typeof e=="string"&&e.length>0)return e;if(Array.isArray(e)){let t=e.filter(n=>typeof n=="string");return t.length===0?void 0:t.join(`
`)}}async function R(e,t){let n=t??(()=>!0),o=e.tabs(),u=e.selectedIndex(o);try{if(o.length===0){if(!n())return{cases:[],captureError:"Testcase capture was cancelled"};let a=e.readMountedParameters();return a===null?{cases:[]}:{cases:[a.join(`
`)]}}let s=[];for(let a of o){if(!n())return{cases:[],captureError:"Testcase capture was cancelled"};e.select(a);try{let r=await e.waitUntilSettled(a,n);s.push(r.join(`
`))}catch(r){if(!n())return{cases:[],captureError:"Testcase capture was cancelled"};let i=r instanceof Error?r.message:String(r);return{cases:[],captureError:`Case ${a.index+1}: ${i}`}}}return{cases:s}}finally{await W(e,o,u,n)}}async function W(e,t,n,o){if(n<0)return;let u=t.find(s=>s.index===n);if(u&&e.selectedIndex(t)!==n)try{e.select(u),await e.waitUntilSettled(u,o)}catch{}}var z='[data-e2e-locator="console-testcase-tag"]',K='[data-e2e-locator="console-testcase-input"]',Q='[data-e2e-locator="console-result"]',Z=/^Case\s+\d+$/i,ee=/^(Input|输入)$/;function k(e){return e.replace(/\s+/g," ").trim()}function x(e){return e.getAttribute("aria-selected")==="true"||e.getAttribute("aria-current")==="true"||e.getAttribute("data-state")==="active"}function M(e){return String(e.className).includes("bg-fill-3")}function te(e){return e.matches("textarea")?e.value:e.querySelector("textarea")?.value??null}function ne(e){let n=e.querySelector(".cm-content")?.cmView?.rootView?.view?.state?.doc?.toString();if(typeof n=="string")return n;let o=te(e);return o!==null?o:typeof e.textContent=="string"?e.textContent:null}function re(e,t){return e.querySelector?.(t)??e.querySelectorAll?.(t)[0]??null}function oe(e){return Z.test(k(e.textContent??""))}function P(e){let t=Array.from(e.querySelectorAll("div,button")).filter(oe),n=t.filter(u=>{let s=String(u.className);return u.tagName==="BUTTON"||s.includes("cursor-pointer")}),o=n.length>0?n:t;return o.filter(u=>!o.some(s=>s!==u&&s.contains?.(u)))}function H(e){let t=re(e,Q);if(!t)return null;let n=t;for(let o=0;o<10&&n;o+=1){if(P(n).length>0)return n;n=n.parentElement}return t.parentElement}function se(e){let t=Array.from(e.querySelectorAll("div")).find(o=>String(o.className).includes("font-menlo"));if(t)return(t.textContent??"").trim();let n=(e.textContent??"").trim();return n&&n.replace(/^[^\n=]*=\s*/,"").trim()||null}function ie(e){let t=H(e);if(!t)return null;let o=Array.from(t.querySelectorAll("div")).find(s=>ee.test(k(s.textContent??""))&&s.children.length===0)?.nextElementSibling;if(!o)return null;let u=Array.from(o.children,s=>se(s));return u.length>0&&u.every(s=>s!==null)?u:null}function ae(e){let t=Array.from(e.querySelectorAll(K));if(t.length===0)return null;let n=t.map(ne);return n.every(o=>o!==null)?n:null}function ue(e,t){if(e.length!==t.length)return!1;for(let n=0;n<e.length;n+=1)if(e[n]!==t[n])return!1;return!0}function le(e,t){if(t){if(t===e.element)return!0;if(typeof t.isConnected!="boolean"||t.isConnected)return!1}return x(e.element)||M(e.element)}function v(e,t){let n=null,o=()=>{let r=Array.from(e.querySelectorAll(z),(l,c)=>({element:l,index:c}));if(r.length>0)return r;let i=H(e);return i?P(i).map((l,c)=>({element:l,index:c})):[]},u=r=>{if(n){let i=r.find(l=>l.element===n);if(i)return i.index}return r.find(i=>x(i.element)||M(i.element))?.index??-1},s=()=>ae(e)??ie(e);return{tabs:o,selectedIndex:u,select:r=>{n=r.element,r.element.click()},readMountedParameters:s,waitUntilSettled:(r,i)=>new Promise((l,c)=>{let f=null,p=!1,m=!1,w=y=>{p||(p=!0,t.clearTimeout(F),y())},F=t.setTimeout(()=>{w(()=>c(new Error("Timed out waiting for testcase inputs to settle")))},2e3),G=()=>{if(p)return;if(!i()){w(()=>c(new Error("Testcase capture was superseded")));return}let y=le(r,n)?s():null;if(y!==null){if(f!==null&&ue(f,y)){w(()=>l(y));return}f=y}else f=null;T()},T=()=>{p||m||(m=!0,t.requestAnimationFrame(()=>{m=!1,G()}))};T()})}}var ce=/class\s+Solution|def\s+\w+\s*\(|func\s+\w+|impl\s+Solution|var\s+\w+\s*=\s*function|public\s+class|^\s*(?:int|char|void|double|bool|struct)\b[^=\n]*\(/m,de=v(document,window),q="",_=0,d=null,I=Promise.resolve();function fe(e){let n=e.cmView?.rootView?.view?.state?.doc?.toString();return typeof n=="string"?n:null}function pe(){for(let e of document.querySelectorAll(".cm-content")){let t=fe(e);if(t!==null&&ce.test(t))return t}return""}function D(){return location.pathname.match(/\/problems\/([^/]+)/)?.[1]??""}function ge(){try{let t=localStorage.getItem("global_lang");if(t)return JSON.parse(t)}catch{}return(document.querySelector("[id^='headlessui-listbox-button'], button[data-state]")?.textContent??"").trim().toLowerCase().replace(/[^a-z0-9+#]/g,"")||"cpp"}function me(e){window.postMessage({channel:E,type:"snapshot",payload:e},location.origin)}function ye(){return _+=1,_}function he(e,t,n=!1){let o=D();if(!o)return;let u=ye();I=I.then(async()=>{if(u!==_)return;let a=()=>u===_;d&&d.slug!==o&&(d=null);let r=d?.cases??[],i;if(n){let f=await R(de,a);if(!a())return;let p=D();if(!p||p!==o)return;d&&d.slug!==p&&(d=null),r=f.cases,i=f.captureError;let m=d&&d.cases.length>0?d:null;i||r.length===0?m?(r=m.cases,i=void 0):i&&(r=[]):d={slug:p,cases:r}}if(e==="network"){let f=t?.cases;(!d||d.cases.length===0)&&!i&&f&&f.length>0?r=f:d&&d.cases.length>0&&(r=d.cases,i=void 0)}let l={cases:r,code:t?.code??pe(),lang:t?.lang??ge(),slug:o,source:e,at:Date.now()};i&&(l.captureError=i),t?.stdout!==void 0&&(l.stdout=t.stdout),t?.stdoutByCase!==void 0&&(l.stdoutByCase=t.stdoutByCase);let c=`${l.cases.join("")}${l.code}${l.lang}${l.captureError??""}`;e==="editor"&&c===q||(q=c,me(l))}).then(()=>{},()=>{})}function _e(e){if(typeof e!="string")return null;try{let t=JSON.parse(e);return typeof t.data_input!="string"?null:{cases:[t.data_input],code:typeof t.typed_code=="string"?t.typed_code:void 0,lang:typeof t.lang=="string"?t.lang:void 0}}catch{return null}}var h=/\/interpret_solution\/?$|\/interpret_solution\//,N=/\/submissions\/detail\/([^/?]+)\/check\/?/,we=new Set(["PENDING","STARTED"]),g=null;function be(e){return typeof e=="string"?e:e instanceof URL?e.href:e.url}function $(e){return typeof e=="object"&&e!==null?e:null}function Ne(e){try{return $(JSON.parse(e))}catch{return null}}async function O(e){try{return $(await e.clone().json())}catch{return null}}function Te(e){let t=e?.interpret_id;return typeof t=="string"&&t.length>0?t:void 0}function j(e){g={override:_e(e)??void 0}}function U(e){let t=Te(e);t&&g&&(g.id=t)}function B(e,t){if(!g)return;let n=t?.state;if(typeof n!="string"||we.has(n))return;let o=N.exec(e)?.[1];if(g.id&&o!==g.id)return;let u={...g.override},s=S(t);s!==void 0&&(u.stdout=s);let a=A(t);a!==void 0&&(u.stdoutByCase=a),g=null,he("network",u,!0)}function V(e){let t=C(e);return{remember:e,send:t?t.body:e}}function Ee(){let e=window.fetch;window.fetch=function(s,a){let r=be(s),i=a;try{if(h.test(r)){let c=V(a?.body);j(c.remember),c.send!==a?.body&&a&&(i={...a,body:c.send})}}catch{}let l=e.call(this,s,i);return l.then(async c=>{if(h.test(r)){U(await O(c));return}N.test(r)&&B(r,await O(c))}).catch(()=>{}),l};let t=XMLHttpRequest.prototype.open,n=XMLHttpRequest.prototype.send,o=new WeakMap;XMLHttpRequest.prototype.open=function(s,a,...r){return o.set(this,String(a)),t.call(this,s,a,...r)},XMLHttpRequest.prototype.send=function(s){let a=o.get(this)??"",r=s;try{if(h.test(a)){let i=V(s);j(i.remember),r=i.send}}catch{}return(h.test(a)||N.test(a))&&this.addEventListener("load",()=>{try{let i=Ne(String(this.responseText??""));h.test(a)?U(i):B(a,i)}catch{}},{once:!0}),n.call(this,r??null)}}Ee();})();
