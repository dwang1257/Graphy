"use strict";(()=>{var N="graphy:page";var E="GRAPHY_TRACE_V1",X=new Set(["python","python3"]),B=`
# ${E}
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
`;function J(e){return e.includes(E)?e:`${e.replace(/\s+$/,"")}
${B}`}function S(e){if(typeof e!="string")return null;try{let t=JSON.parse(e);if(typeof t.typed_code!="string"||typeof t.lang!="string"||!X.has(t.lang)||t.typed_code.includes(E))return null;let n=t.typed_code;return t.typed_code=J(n),{body:JSON.stringify(t),originalCode:n}}catch{return null}}function C(e){if(!e)return;let t=_(e.code_output);if(t!==void 0)return t;let n=_(e.std_output_list);if(n!==void 0)return n;if(typeof e.std_output=="string"&&e.std_output.length>0)return e.std_output}function _(e){if(typeof e=="string"&&e.length>0)return e;if(Array.isArray(e)){let t=e.filter(n=>typeof n=="string");return t.length===0?void 0:t.join(`
`)}}async function k(e,t){let n=t??(()=>!0),s=e.tabs(),a=e.selectedIndex(s);try{if(s.length===0){if(!n())return{cases:[],captureError:"Testcase capture was cancelled"};let u=e.readMountedParameters();return u===null?{cases:[]}:{cases:[u.join(`
`)]}}let o=[];for(let u of s){if(!n())return{cases:[],captureError:"Testcase capture was cancelled"};e.select(u);try{let r=await e.waitUntilSettled(u,n);o.push(r.join(`
`))}catch(r){if(!n())return{cases:[],captureError:"Testcase capture was cancelled"};let i=r instanceof Error?r.message:String(r);return{cases:[],captureError:`Case ${u.index+1}: ${i}`}}}return{cases:o}}finally{await Y(e,s,a,n)}}async function Y(e,t,n,s){if(n<0)return;let a=t.find(o=>o.index===n);if(a&&e.selectedIndex(t)!==n)try{e.select(a),await e.waitUntilSettled(a,s)}catch{}}var W='[data-e2e-locator="console-testcase-tag"]',z='[data-e2e-locator="console-testcase-input"]',K='[data-e2e-locator="console-result"]',Q=/^Case\s+\d+$/i,Z=/^(Input|输入)$/;function A(e){return e.replace(/\s+/g," ").trim()}function R(e){return e.getAttribute("aria-selected")==="true"||e.getAttribute("aria-current")==="true"||e.getAttribute("data-state")==="active"}function x(e){return String(e.className).includes("bg-fill-3")}function ee(e){return e.matches("textarea")?e.value:e.querySelector("textarea")?.value??null}function te(e){let n=e.querySelector(".cm-content")?.cmView?.rootView?.view?.state?.doc?.toString();if(typeof n=="string")return n;let s=ee(e);return s!==null?s:typeof e.textContent=="string"?e.textContent:null}function ne(e,t){return e.querySelector?.(t)??e.querySelectorAll?.(t)[0]??null}function re(e){return Q.test(A(e.textContent??""))}function M(e){let t=Array.from(e.querySelectorAll("div,button")).filter(re),n=t.filter(a=>{let o=String(a.className);return a.tagName==="BUTTON"||o.includes("cursor-pointer")}),s=n.length>0?n:t;return s.filter(a=>!s.some(o=>o!==a&&o.contains?.(a)))}function P(e){let t=ne(e,K);if(!t)return null;let n=t;for(let s=0;s<10&&n;s+=1){if(M(n).length>0)return n;n=n.parentElement}return t.parentElement}function se(e){let t=Array.from(e.querySelectorAll("div")).find(s=>String(s.className).includes("font-menlo"));if(t)return(t.textContent??"").trim();let n=(e.textContent??"").trim();return n&&n.replace(/^[^\n=]*=\s*/,"").trim()||null}function oe(e){let t=P(e);if(!t)return null;let s=Array.from(t.querySelectorAll("div")).find(o=>Z.test(A(o.textContent??""))&&o.children.length===0)?.nextElementSibling;if(!s)return null;let a=Array.from(s.children,o=>se(o));return a.length>0&&a.every(o=>o!==null)?a:null}function ie(e){let t=Array.from(e.querySelectorAll(z));if(t.length===0)return null;let n=t.map(te);return n.every(s=>s!==null)?n:null}function ae(e,t){if(e.length!==t.length)return!1;for(let n=0;n<e.length;n+=1)if(e[n]!==t[n])return!1;return!0}function ue(e,t){if(t){if(t===e.element)return!0;if(typeof t.isConnected!="boolean"||t.isConnected)return!1}return R(e.element)||x(e.element)}function H(e,t){let n=null,s=()=>{let r=Array.from(e.querySelectorAll(W),(l,c)=>({element:l,index:c}));if(r.length>0)return r;let i=P(e);return i?M(i).map((l,c)=>({element:l,index:c})):[]},a=r=>{if(n){let i=r.find(l=>l.element===n);if(i)return i.index}return r.find(i=>R(i.element)||x(i.element))?.index??-1},o=()=>ie(e)??oe(e);return{tabs:s,selectedIndex:a,select:r=>{n=r.element,r.element.click()},readMountedParameters:o,waitUntilSettled:(r,i)=>new Promise((l,c)=>{let d=null,p=!1,m=!1,T=y=>{p||(p=!0,t.clearTimeout(F),y())},F=t.setTimeout(()=>{T(()=>c(new Error("Timed out waiting for testcase inputs to settle")))},2e3),G=()=>{if(p)return;if(!i()){T(()=>c(new Error("Testcase capture was superseded")));return}let y=ue(r,n)?o():null;if(y!==null){if(d!==null&&ae(d,y)){T(()=>l(y));return}d=y}else d=null;L()},L=()=>{p||m||(m=!0,t.requestAnimationFrame(()=>{m=!1,G()}))};L()})}}var le=/class\s+Solution|def\s+\w+\s*\(|func\s+\w+|impl\s+Solution|var\s+\w+\s*=\s*function|public\s+class|^\s*(?:int|char|void|double|bool|struct)\b[^=\n]*\(/m,ce=H(document,window),v="",w=0,f=null,q=Promise.resolve();function fe(e){let n=e.cmView?.rootView?.view?.state?.doc?.toString();return typeof n=="string"?n:null}function de(){for(let e of document.querySelectorAll(".cm-content")){let t=fe(e);if(t!==null&&le.test(t))return t}return""}function I(){return location.pathname.match(/\/problems\/([^/]+)/)?.[1]??""}function pe(){try{let t=localStorage.getItem("global_lang");if(t)return JSON.parse(t)}catch{}return(document.querySelector("[id^='headlessui-listbox-button'], button[data-state]")?.textContent??"").trim().toLowerCase().replace(/[^a-z0-9+#]/g,"")||"cpp"}function ge(e){window.postMessage({channel:N,type:"snapshot",payload:e},location.origin)}function me(){return w+=1,w}function ye(e,t,n=!1){let s=I();if(!s)return;let a=me();q=q.then(async()=>{if(a!==w)return;let u=()=>a===w;f&&f.slug!==s&&(f=null);let r=f?.cases??[],i;if(n){let d=await k(ce,u);if(!u())return;let p=I();if(!p||p!==s)return;f&&f.slug!==p&&(f=null),r=d.cases,i=d.captureError;let m=f&&f.cases.length>0?f:null;i||r.length===0?m?(r=m.cases,i=void 0):i&&(r=[]):f={slug:p,cases:r}}if(e==="network"){let d=t?.cases;(!f||f.cases.length===0)&&!i&&d&&d.length>0?r=d:f&&f.cases.length>0&&(r=f.cases,i=void 0)}let l={cases:r,code:t?.code??de(),lang:t?.lang??pe(),slug:s,source:e,at:Date.now()};i&&(l.captureError=i),t?.stdout!==void 0&&(l.stdout=t.stdout);let c=`${l.cases.join("")}${l.code}${l.lang}${l.captureError??""}`;e==="editor"&&c===v||(v=c,ge(l))}).then(()=>{},()=>{})}function he(e){if(typeof e!="string")return null;try{let t=JSON.parse(e);return typeof t.data_input!="string"?null:{cases:[t.data_input],code:typeof t.typed_code=="string"?t.typed_code:void 0,lang:typeof t.lang=="string"?t.lang:void 0}}catch{return null}}var h=/\/interpret_solution\/?$|\/interpret_solution\//,b=/\/submissions\/detail\/([^/?]+)\/check\/?/,we=new Set(["PENDING","STARTED"]),g=null;function Te(e){return typeof e=="string"?e:e instanceof URL?e.href:e.url}function $(e){return typeof e=="object"&&e!==null?e:null}function Ee(e){try{return $(JSON.parse(e))}catch{return null}}async function D(e){try{return $(await e.clone().json())}catch{return null}}function be(e){let t=e?.interpret_id;return typeof t=="string"&&t.length>0?t:void 0}function O(e){g={override:he(e)??void 0}}function U(e){let t=be(e);t&&g&&(g.id=t)}function j(e,t){if(!g)return;let n=t?.state;if(typeof n!="string"||we.has(n))return;let s=b.exec(e)?.[1];if(g.id&&s!==g.id)return;let a={...g.override},o=C(t);o!==void 0&&(a.stdout=o),g=null,ye("network",a,!0)}function V(e){let t=S(e);return{remember:e,send:t?t.body:e}}function Le(){let e=window.fetch;window.fetch=function(o,u){let r=Te(o),i=u;try{if(h.test(r)){let c=V(u?.body);O(c.remember),c.send!==u?.body&&u&&(i={...u,body:c.send})}}catch{}let l=e.call(this,o,i);return l.then(async c=>{if(h.test(r)){U(await D(c));return}b.test(r)&&j(r,await D(c))}).catch(()=>{}),l};let t=XMLHttpRequest.prototype.open,n=XMLHttpRequest.prototype.send,s=new WeakMap;XMLHttpRequest.prototype.open=function(o,u,...r){return s.set(this,String(u)),t.call(this,o,u,...r)},XMLHttpRequest.prototype.send=function(o){let u=s.get(this)??"",r=o;try{if(h.test(u)){let i=V(o);O(i.remember),r=i.send}}catch{}return(h.test(u)||b.test(u))&&this.addEventListener("load",()=>{try{let i=Ee(String(this.responseText??""));h.test(u)?U(i):j(u,i)}catch{}},{once:!0}),n.call(this,r??null)}}Le();})();
