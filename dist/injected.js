"use strict";(()=>{var L="graphy:page";var E="GRAPHY_TRACE_V1",$=new Set(["python","python3"]),F=`
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
`;function G(e){return e.includes(E)?e:`${e.replace(/\s+$/,"")}
${F}`}function S(e){if(typeof e!="string")return null;try{let t=JSON.parse(e);if(typeof t.typed_code!="string"||typeof t.lang!="string"||!$.has(t.lang)||t.typed_code.includes(E))return null;let n=t.typed_code;return t.typed_code=G(n),{body:JSON.stringify(t),originalCode:n}}catch{return null}}function A(e){if(!e)return;let t=_(e.code_output);if(t!==void 0)return t;let n=_(e.std_output_list);if(n!==void 0)return n;if(typeof e.std_output=="string"&&e.std_output.length>0)return e.std_output}function _(e){if(typeof e=="string"&&e.length>0)return e;if(Array.isArray(e)){let t=e.filter(n=>typeof n=="string");return t.length===0?void 0:t.join(`
`)}}async function C(e,t){let n=t??(()=>!0),r=e.tabs(),a=e.selectedIndex(r);try{if(r.length===0){if(!n())return{cases:[],captureError:"Testcase capture was cancelled"};let l=e.readMountedParameters();return l===null?{cases:[]}:{cases:[l.join(`
`)]}}let i=[];for(let l of r){if(!n())return{cases:[],captureError:"Testcase capture was cancelled"};e.select(l);try{let s=await e.waitUntilSettled(l,n);i.push(s.join(`
`))}catch(s){if(!n())return{cases:[],captureError:"Testcase capture was cancelled"};let o=s instanceof Error?s.message:String(s);return{cases:[],captureError:`Case ${l.index+1}: ${o}`}}}return{cases:i}}finally{await X(e,r,a)}}async function X(e,t,n){if(n<0)return;let r=t.find(a=>a.index===n);if(r&&e.selectedIndex(t)!==n)try{e.select(r),await e.waitUntilSettled(r,()=>!0)}catch{}}var B='[data-e2e-locator="console-testcase-tag"]',J='[data-e2e-locator="console-testcase-input"]',z='[data-e2e-locator="console-result"]',Y=/^Case\s+\d+$/i,W=/^(Input|输入)$/;function k(e){return e.replace(/\s+/g," ").trim()}function K(e){return e.getAttribute("aria-selected")==="true"||e.getAttribute("aria-current")==="true"||e.getAttribute("data-state")==="active"}function Q(e){return String(e.className).includes("bg-fill-3")}function Z(e){return e.matches("textarea")?e.value:e.querySelector("textarea")?.value??null}function ee(e){let n=e.querySelector(".cm-content")?.cmView?.rootView?.view?.state?.doc?.toString();if(typeof n=="string")return n;let r=Z(e);return r!==null?r:typeof e.textContent=="string"?e.textContent:null}function te(e,t){return e.querySelector?.(t)??e.querySelectorAll?.(t)[0]??null}function ne(e){return Y.test(k(e.textContent??""))}function R(e){let t=Array.from(e.querySelectorAll("div,button")).filter(ne),n=t.filter(a=>{let i=String(a.className);return a.tagName==="BUTTON"||i.includes("cursor-pointer")}),r=n.length>0?n:t;return r.filter(a=>!r.some(i=>i!==a&&i.contains?.(a)))}function x(e){let t=te(e,z);if(!t)return null;let n=t;for(let r=0;r<10&&n;r+=1){if(R(n).length>0)return n;n=n.parentElement}return t.parentElement}function re(e){let t=Array.from(e.querySelectorAll("div")).find(r=>String(r.className).includes("font-menlo"));if(t)return(t.textContent??"").trim();let n=(e.textContent??"").trim();return n&&n.replace(/^[^\n=]*=\s*/,"").trim()||null}function se(e){let t=x(e);if(!t)return null;let r=Array.from(t.querySelectorAll("div")).find(i=>W.test(k(i.textContent??""))&&i.children.length===0)?.nextElementSibling;if(!r)return null;let a=Array.from(r.children,i=>re(i));return a.length>0&&a.every(i=>i!==null)?a:null}function oe(e){let t=Array.from(e.querySelectorAll(J));if(t.length===0)return null;let n=t.map(ee);return n.every(r=>r!==null)?n:null}function M(e,t){let n=null,r=()=>{let s=Array.from(e.querySelectorAll(B),(u,c)=>({element:u,index:c}));if(s.length>0)return s;let o=x(e);return o?R(o).map((u,c)=>({element:u,index:c})):[]},a=s=>{if(n){let o=s.find(u=>u.element===n);if(o)return o.index}return s.find(o=>K(o.element)||Q(o.element))?.index??-1},i=()=>oe(e)??se(e);return{tabs:r,selectedIndex:a,select:s=>{n=s.element,s.element.click()},readMountedParameters:i,waitUntilSettled:(s,o)=>new Promise((u,c)=>{let d=null,p=!1,m=y=>{p||(p=!0,t.clearTimeout(V),y())},V=t.setTimeout(()=>{m(()=>c(new Error("Timed out waiting for testcase inputs to settle")))},2e3),b=()=>{if(p)return;if(!o()){m(()=>c(new Error("Testcase capture was superseded")));return}let y=a(r())===s.index?i():null;if(y!==null){let N=JSON.stringify(y);if(N===d){m(()=>u(y));return}d=N}else d=null;t.requestAnimationFrame(b)};t.requestAnimationFrame(b)})}}var ie=/class\s+Solution|def\s+\w+\s*\(|func\s+\w+|impl\s+Solution|var\s+\w+\s*=\s*function|public\s+class|^\s*(?:int|char|void|double|bool|struct)\b[^=\n]*\(/m,ae=M(document,window),H="",w=0,f=null,P=Promise.resolve();function le(e){let n=e.cmView?.rootView?.view?.state?.doc?.toString();return typeof n=="string"?n:null}function ue(){for(let e of document.querySelectorAll(".cm-content")){let t=le(e);if(t!==null&&ie.test(t))return t}return""}function v(){return location.pathname.match(/\/problems\/([^/]+)/)?.[1]??""}function ce(){try{let t=localStorage.getItem("global_lang");if(t)return JSON.parse(t)}catch{}return(document.querySelector("[id^='headlessui-listbox-button'], button[data-state]")?.textContent??"").trim().toLowerCase().replace(/[^a-z0-9+#]/g,"")||"cpp"}function fe(e){window.postMessage({channel:L,type:"snapshot",payload:e},location.origin)}function de(){return w+=1,w}function pe(e,t,n=!1){let r=v();if(!r)return;let a=de();P=P.then(async()=>{if(a!==w)return;let l=()=>a===w;f&&f.slug!==r&&(f=null);let s=f?.cases??[],o;if(n){let d=await C(ae,l);if(!l())return;let p=v();if(!p)return;f&&f.slug!==p&&(f=null),s=d.cases,o=d.captureError;let m=f&&f.cases.length>0?f:null;o||s.length===0?m?(s=m.cases,o=void 0):o&&(s=[]):f={slug:p,cases:s}}if(e==="network"){let d=t?.cases;(!f||f.cases.length===0)&&!o&&d&&d.length>0?s=d:f&&f.cases.length>0&&(s=f.cases,o=void 0)}let u={cases:s,code:t?.code??ue(),lang:t?.lang??ce(),slug:r,source:e,at:Date.now()};o&&(u.captureError=o),t?.stdout!==void 0&&(u.stdout=t.stdout);let c=`${u.cases.join("")}${u.code}${u.lang}${u.captureError??""}`;e==="editor"&&c===H||(H=c,fe(u))}).then(()=>{},()=>{})}function ge(e){if(typeof e!="string")return null;try{let t=JSON.parse(e);return typeof t.data_input!="string"?null:{cases:[t.data_input],code:typeof t.typed_code=="string"?t.typed_code:void 0,lang:typeof t.lang=="string"?t.lang:void 0}}catch{return null}}var h=/\/interpret_solution\/?$|\/interpret_solution\//,T=/\/submissions\/detail\/([^/?]+)\/check\/?/,me=new Set(["PENDING","STARTED"]),g=null;function ye(e){return typeof e=="string"?e:e instanceof URL?e.href:e.url}function j(e){return typeof e=="object"&&e!==null?e:null}function he(e){try{return j(JSON.parse(e))}catch{return null}}async function q(e){try{return j(await e.clone().json())}catch{return null}}function we(e){let t=e?.interpret_id;return typeof t=="string"&&t.length>0?t:void 0}function I(e){g={override:ge(e)??void 0}}function D(e){let t=we(e);t&&g&&(g.id=t)}function O(e,t){if(!g)return;let n=t?.state;if(typeof n!="string"||me.has(n))return;let r=T.exec(e)?.[1];if(g.id&&r!==g.id)return;let a={...g.override},i=A(t);i!==void 0&&(a.stdout=i),g=null,pe("network",a,!0)}function U(e){let t=S(e);return{remember:e,send:t?t.body:e}}function Ee(){let e=window.fetch;window.fetch=function(i,l){let s=ye(i),o=l;try{if(h.test(s)){let c=U(l?.body);I(c.remember),c.send!==l?.body&&l&&(o={...l,body:c.send})}}catch{}let u=e.call(this,i,o);return u.then(async c=>{if(h.test(s)){D(await q(c));return}T.test(s)&&O(s,await q(c))}).catch(()=>{}),u};let t=XMLHttpRequest.prototype.open,n=XMLHttpRequest.prototype.send,r=new WeakMap;XMLHttpRequest.prototype.open=function(i,l,...s){return r.set(this,String(l)),t.call(this,i,l,...s)},XMLHttpRequest.prototype.send=function(i){let l=r.get(this)??"",s=i;try{if(h.test(l)){let o=U(i);I(o.remember),s=o.send}}catch{}return this.addEventListener("load",()=>{try{let o=he(String(this.responseText??""));h.test(l)?D(o):T.test(l)&&O(l,o)}catch{}}),n.call(this,s??null)}}Ee();})();
