"use strict";(()=>{var S="graphy:page";var k="GRAPHY_TRACE_V1",V=new Set(["python","python3"]),B=`
# ${k}
def __graphy_install():
    import sys

    ids = {}
    last = None
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
        print("#graphy current " + nid)
        print("#graphy visit " + nid)

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
`;function J(e){return e.includes(k)?e:`${e.replace(/\s+$/,"")}
${B}`}function R(e){if(typeof e!="string")return null;try{let t=JSON.parse(e);if(typeof t.typed_code!="string"||typeof t.lang!="string"||!V.has(t.lang)||t.typed_code.includes(k))return null;let n=t.typed_code;return t.typed_code=J(n),{body:JSON.stringify(t),originalCode:n}}catch{return null}}var z=/^\s*#?graphy\s+(current|curr|visit|enqueue|dequeue|frontier|clear)(?:\s+(.+))?\s*$/i;function E(e){return z.test(e)}var Y=["code_output","std_output_list","std_output"];function C(e){if(!e)return;let t=x(e.code_output);if(t!==void 0)return t;let n=x(e.std_output_list);if(n!==void 0)return n;if(typeof e.std_output=="string"&&e.std_output.length>0)return e.std_output}function x(e){if(typeof e=="string"&&e.length>0)return e;if(Array.isArray(e)){let t=e.filter(n=>typeof n=="string");return t.length===0?void 0:t.join(`
`)}}function _(e){let t;for(let n of Y){let r=W(e[n]);r&&(t??={...e},t[n]=r)}return t?{body:t,changed:!0}:{body:e,changed:!1}}function W(e){if(typeof e=="string"){let t=e.split(/\r?\n/),n=t.filter(r=>!E(r));return n.length===t.length?void 0:n.join(`
`)}if(Array.isArray(e)){let t=e.filter(n=>typeof n!="string"||!E(n));return t.length===e.length?void 0:t}}async function v(e,t){let n=t??(()=>!0),r=e.tabs(),o=e.selectedIndex(r);try{if(r.length===0){if(!n())return{cases:[],captureError:"Testcase capture was cancelled"};let g=e.readMountedParameters();return g===null?{cases:[]}:{cases:[g.join(`
`)]}}let i=[];for(let g of r){if(!n())return{cases:[],captureError:"Testcase capture was cancelled"};e.select(g);try{let u=await e.waitUntilSettled(g,n);i.push(u.join(`
`))}catch(u){if(!n())return{cases:[],captureError:"Testcase capture was cancelled"};let l=u instanceof Error?u.message:String(u);return{cases:[],captureError:`Case ${g.index+1}: ${l}`}}}return{cases:i}}finally{await K(e,r,o)}}async function K(e,t,n){if(n<0)return;let r=t.find(o=>o.index===n);if(r&&e.selectedIndex(t)!==n)try{e.select(r),await e.waitUntilSettled(r,()=>!0)}catch{}}var Q='[data-e2e-locator="console-testcase-tag"]',Z='[data-e2e-locator="console-testcase-input"]',ee='[data-e2e-locator="console-result"]',te=/^Case\s+\d+$/i,ne=/^(Input|输入)$/;function A(e){return e.replace(/\s+/g," ").trim()}function re(e){return e.getAttribute("aria-selected")==="true"||e.getAttribute("aria-current")==="true"||e.getAttribute("data-state")==="active"}function se(e){return String(e.className).includes("bg-fill-3")}function oe(e){return e.matches("textarea")?e.value:e.querySelector("textarea")?.value??null}function ie(e){let n=e.querySelector(".cm-content")?.cmView?.rootView?.view?.state?.doc?.toString();if(typeof n=="string")return n;let r=oe(e);return r!==null?r:typeof e.textContent=="string"?e.textContent:null}function ue(e,t){return e.querySelector?.(t)??e.querySelectorAll?.(t)[0]??null}function ae(e){return te.test(A(e.textContent??""))}function M(e){let t=Array.from(e.querySelectorAll("div,button")).filter(ae),n=t.filter(o=>{let i=String(o.className);return o.tagName==="BUTTON"||i.includes("cursor-pointer")}),r=n.length>0?n:t;return r.filter(o=>!r.some(i=>i!==o&&i.contains?.(o)))}function H(e){let t=ue(e,ee);if(!t)return null;let n=t;for(let r=0;r<10&&n;r+=1){if(M(n).length>0)return n;n=n.parentElement}return t.parentElement}function le(e){let t=Array.from(e.querySelectorAll("div")).find(r=>String(r.className).includes("font-menlo"));if(t)return(t.textContent??"").trim();let n=(e.textContent??"").trim();return n&&n.replace(/^[^\n=]*=\s*/,"").trim()||null}function ce(e){let t=H(e);if(!t)return null;let r=Array.from(t.querySelectorAll("div")).find(i=>ne.test(A(i.textContent??""))&&i.children.length===0)?.nextElementSibling;if(!r)return null;let o=Array.from(r.children,i=>le(i));return o.length>0&&o.every(i=>i!==null)?o:null}function de(e){let t=Array.from(e.querySelectorAll(Z));if(t.length===0)return null;let n=t.map(ie);return n.every(r=>r!==null)?n:null}function P(e,t){let n=null,r=()=>{let u=Array.from(e.querySelectorAll(Q),(a,d)=>({element:a,index:d}));if(u.length>0)return u;let l=H(e);return l?M(l).map((a,d)=>({element:a,index:d})):[]},o=u=>{if(n){let l=u.find(a=>a.element===n);if(l)return l.index}return u.find(l=>re(l.element)||se(l.element))?.index??-1},i=()=>de(e)??ce(e);return{tabs:r,selectedIndex:o,select:u=>{n=u.element,u.element.click()},readMountedParameters:i,waitUntilSettled:(u,l)=>new Promise((a,d)=>{let s=null,c=!1,p=y=>{c||(c=!0,t.clearTimeout(m),y())},m=t.setTimeout(()=>{p(()=>d(new Error("Timed out waiting for testcase inputs to settle")))},2e3),L=()=>{if(c)return;if(!l()){p(()=>d(new Error("Testcase capture was superseded")));return}let y=o(r())===u.index?i():null;if(y!==null){let N=JSON.stringify(y);if(N===s){p(()=>a(y));return}s=N}else s=null;t.requestAnimationFrame(L)};t.requestAnimationFrame(L)})}}var fe=/class\s+Solution|def\s+\w+\s*\(|func\s+\w+|impl\s+Solution|var\s+\w+\s*=\s*function|public\s+class|^\s*(?:int|char|void|double|bool|struct)\b[^=\n]*\(/m,pe=P(document,window),q="",T=0,f=null,I=Promise.resolve();function ge(e){let n=e.cmView?.rootView?.view?.state?.doc?.toString();return typeof n=="string"?n:null}function me(){for(let e of document.querySelectorAll(".cm-content")){let t=ge(e);if(t!==null&&fe.test(t))return t}return""}function O(){return location.pathname.match(/\/problems\/([^/]+)/)?.[1]??""}function he(){try{let t=localStorage.getItem("global_lang");if(t)return JSON.parse(t)}catch{}return(document.querySelector("[id^='headlessui-listbox-button'], button[data-state]")?.textContent??"").trim().toLowerCase().replace(/[^a-z0-9+#]/g,"")||"cpp"}function ye(e){window.postMessage({channel:S,type:"snapshot",payload:e},location.origin)}function be(){return T+=1,T}function we(e,t,n=!1){let r=O();if(!r)return;let o=be();I=I.then(async()=>{if(o!==T)return;let g=()=>o===T;f&&f.slug!==r&&(f=null);let u=f?.cases??[],l;if(n){let s=await v(pe,g);if(!g())return;let c=O();if(!c)return;f&&f.slug!==c&&(f=null),u=s.cases,l=s.captureError;let p=f&&f.cases.length>0?f:null;l||u.length===0?p?(u=p.cases,l=void 0):l&&(u=[]):f={slug:c,cases:u}}if(e==="network"){let s=t?.cases;(!f||f.cases.length===0)&&!l&&s&&s.length>0?u=s:f&&f.cases.length>0&&(u=f.cases,l=void 0)}let a={cases:u,code:t?.code??me(),lang:t?.lang??he(),slug:r,source:e,at:Date.now()};l&&(a.captureError=l),t?.stdout!==void 0&&(a.stdout=t.stdout);let d=`${a.cases.join("")}${a.code}${a.lang}${a.captureError??""}`;e==="editor"&&d===q||(q=d,ye(a))}).then(()=>{},()=>{})}function Te(e){if(typeof e!="string")return null;try{let t=JSON.parse(e);return typeof t.data_input!="string"?null:{cases:[t.data_input],code:typeof t.typed_code=="string"?t.typed_code:void 0,lang:typeof t.lang=="string"?t.lang:void 0}}catch{return null}}var w=/\/interpret_solution\/?$|\/interpret_solution\//,b=/\/submissions\/detail\/([^/?]+)\/check\/?/,ke=new Set(["PENDING","STARTED"]),h=null;function Ee(e){return typeof e=="string"?e:e instanceof URL?e.href:e.url}function U(e){return typeof e=="object"&&e!==null?e:null}function F(e){try{return U(JSON.parse(e))}catch{return null}}async function Le(e){try{return U(await e.clone().json())}catch{return null}}function Ne(e){let t=e?.interpret_id;return typeof t=="string"&&t.length>0?t:void 0}function D(e){h={override:Te(e)??void 0}}function j(e){let t=Ne(e);t&&h&&(h.id=t)}function X(e,t){if(!h)return;let n=t?.state;if(typeof n!="string"||ke.has(n))return;let r=b.exec(e)?.[1];if(h.id&&r!==h.id)return;let o={...h.override},i=C(t);i!==void 0&&(o.stdout=i),h=null,we("network",o,!0)}function G(e){let t=F(e);if(!t)return{parsed:null,visible:e};let{body:n,changed:r}=_(t);return{parsed:t,visible:r?JSON.stringify(n):e}}async function Se(e,t){let n=await t.clone().text(),{parsed:r,visible:o}=G(n);if(X(e,r),o===n)return t;let i=new Headers(t.headers);return i.delete("content-encoding"),i.delete("content-length"),new Response(o,{status:t.status,statusText:t.statusText,headers:i})}function $(e){let t=R(e);return{remember:e,send:t?t.body:e}}function Re(){let e=window.fetch;window.fetch=function(d,s){let c=Ee(d),p=s;try{if(w.test(c)){let m=$(s?.body);D(m.remember),m.send!==s?.body&&s&&(p={...s,body:m.send})}}catch{}return e.call(this,d,p).then(async m=>{try{if(w.test(c))return j(await Le(m)),m;if(b.test(c))return await Se(c,m)}catch{}return m})};let t=XMLHttpRequest.prototype.open,n=XMLHttpRequest.prototype.send,r=Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype,"responseText"),o=Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype,"response"),i=new WeakMap,g=new WeakMap;function u(a){if(r?.get)try{return String(r.get.call(a)??"")}catch{}return g.get(a)??""}function l(a){let d=()=>G(u(a)).visible;Object.defineProperty(a,"responseText",{configurable:!0,enumerable:!0,get:d,set(s){g.set(a,String(s??""))}}),Object.defineProperty(a,"response",{configurable:!0,enumerable:!0,get(){let s=d(),c=a.responseType;if(c==="json")try{return JSON.parse(s)}catch{return null}return c===""||c==="text"?s:o?.get?o.get.call(a):s}})}XMLHttpRequest.prototype.open=function(d,s,...c){return i.set(this,String(s)),t.call(this,d,s,...c)},XMLHttpRequest.prototype.send=function(d){let s=i.get(this)??"",c=d;try{if(w.test(s)){let p=$(d);D(p.remember),c=p.send}b.test(s)&&l(this)}catch{}return this.addEventListener("load",()=>{try{let p=F(b.test(s)?u(this):String(this.responseText??""));w.test(s)?j(p):b.test(s)&&X(s,p)}catch{}}),n.call(this,c??null)}}Re();})();
