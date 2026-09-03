import{a as e,c as t,n,r,s as i,t as a,u as o}from"./protocol-Bjd-AAV3.js";var s=`graphy-root`,c=40,l=320,u=220,d=`
:host { all: initial; }
.shell {
  position: fixed;
  z-index: 2147483646;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 0 0 1px oklch(0% 0 0 / 0.08), 0 12px 32px oklch(0% 0 0 / 0.18);
  background: oklch(99% 0.004 250);
  transition: height 160ms cubic-bezier(0.16, 1, 0.3, 1);
  display: none;
}
.shell[data-resizing="true"] { transition: none; }
.shell[data-open="true"] { display: block; }
.shell iframe { width: 100%; height: 100%; border: 0; display: block; }
.launcher {
  position: fixed;
  z-index: 2147483645;
  right: 20px;
  bottom: 20px;
  height: 36px;
  padding: 0 14px;
  border: 0;
  border-radius: 8px;
  background: oklch(62% 0.19 255);
  color: oklch(99% 0.01 255);
  font: 600 12px/36px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  letter-spacing: -0.01em;
  cursor: pointer;
  box-shadow: 0 4px 16px oklch(62% 0.19 255 / 0.35);
}
.launcher:hover { background: oklch(56% 0.19 255); }
.launcher[hidden] { display: none; }
`,f=class{frameUrl;root;frameOrigin;shell;frame;launcher;state={...e};ready=!1;pending=new Map;saveTimer;resizeFrame;pendingResize={dx:0,dy:0};restored;constructor(e){this.frameUrl=e;let t=new URL(e);this.frameOrigin=`${t.protocol}//${t.host}`,document.getElementById(s)?.remove();let n=document.createElement(`div`);n.id=s,n.style.cssText=`all: initial; position: static;`,this.root=n.attachShadow({mode:`closed`}),(document.body??document.documentElement).appendChild(n),this.restored=this.build()}async build(){let e=document.createElement(`style`);e.textContent=d,this.shell=document.createElement(`div`),this.shell.className=`shell`,this.shell.dataset.open=`false`,this.frame=document.createElement(`iframe`),this.frame.src=this.frameUrl,this.frame.setAttribute(`title`,`Graphy visualizer`),this.shell.appendChild(this.frame),this.launcher=document.createElement(`button`),this.launcher.className=`launcher`,this.launcher.textContent=`Graphy`,this.launcher.addEventListener(`click`,()=>this.open()),this.root.append(e,this.shell,this.launcher),window.addEventListener(`message`,this.onMessage),window.addEventListener(`resize`,this.clamp);let t=await i();this.state=t,(t.x<0||t.y<0)&&this.placeDefault(),this.apply()}placeDefault(){this.state.x=Math.max(16,window.innerWidth-this.state.width-24),this.state.y=Math.max(16,window.innerHeight-this.state.height-24)}apply(){let e=this.state.collapsed?c:this.state.height;Object.assign(this.shell.style,{left:`${this.state.x}px`,top:`${this.state.y}px`,width:`${this.state.width}px`,height:`${e}px`}),this.shell.dataset.open=String(this.state.open),this.launcher.hidden=this.state.open}clamp=()=>{this.state.x=Math.min(Math.max(0,this.state.x),Math.max(0,window.innerWidth-80)),this.state.y=Math.min(Math.max(0,this.state.y),Math.max(0,window.innerHeight-40)),this.apply()};persist(){window.clearTimeout(this.saveTimer),this.saveTimer=window.setTimeout(()=>void o(this.state),400)}open(){this.state.open=!0,this.state.collapsed=!1,this.apply(),this.persist()}get isOpen(){return this.state.open}toggle(){this.state.open?this.close():this.open()}close(){this.state.open=!1,this.apply(),this.persist()}send(e){if(!this.ready){this.pending.set(e.type,e);return}this.frame.contentWindow?.postMessage(e,this.frameOrigin)}destroy(){window.removeEventListener(`message`,this.onMessage),window.removeEventListener(`resize`,this.clamp),document.getElementById(s)?.remove()}onMessage=e=>{if(e.source!==this.frame.contentWindow||e.origin!==this.frameOrigin)return;let t=e.data;if(r(t))switch(t.type){case`ready`:{this.ready=!0;let e=[...this.pending.values()];this.pending.clear();for(let t of e)this.send(t);break}case`close`:this.close();break;case`collapse`:this.state.collapsed=t.collapsed,this.apply(),this.persist();break;case`move`:this.state.x+=t.dx,this.state.y+=t.dy,this.clamp();break;case`resize`:if(this.pendingResize.dx+=t.dx,this.pendingResize.dy+=t.dy,this.resizeFrame!==void 0)break;this.shell.dataset.resizing=`true`,this.resizeFrame=requestAnimationFrame(()=>{this.resizeFrame=void 0;let{dx:e,dy:t}=this.pendingResize;this.pendingResize={dx:0,dy:0},(e!==0||t!==0)&&(this.state.width=Math.max(l,this.state.width+e),this.state.height=Math.max(u,this.state.height+t),this.apply())});break;case`persist`:delete this.shell.dataset.resizing,this.persist()}}},p=/^\/problems\/[^/]+/,m=null,h=null,g=!1;function _(){let e=document.createElement(`script`);e.src=chrome.runtime.getURL(`injected.js`),e.async=!1,e.addEventListener(`load`,()=>e.remove()),(document.head??document.documentElement).prepend(e)}function v(){let e=document.documentElement;if(e.classList.contains(`dark`)||e.dataset.theme===`dark`)return!0;let t=getComputedStyle(document.body??e).backgroundColor.match(/\d+/g)?.slice(0,3).map(Number);return!t||t.length<3?!1:(t[0]*299+t[1]*587+t[2]*114)/1e3<128}function y(){return p.test(location.pathname)}function b(){if(m)return;m=new f(chrome.runtime.getURL(`src/panel/index.html`)),h&&S(h);let e=m;Promise.all([e.restored,t()]).then(([,t])=>{m===e&&(t.autoOpen||e.isOpen)&&e.open()})}function x(){m?.destroy(),m=null}function S(e){m?.send({channel:a,type:`snapshot`,payload:e,pageIsDark:g})}window.addEventListener(`message`,e=>{if(e.source!==window)return;let t=e.data;n(t)&&(h=t.payload,S(t.payload))}),chrome.runtime.onMessage.addListener(e=>{e?.type===`graphy:toggle`&&(m?m.toggle():b())});function C(){let e=location.pathname,t=()=>{location.pathname!==e&&(e=location.pathname,h=null,y()?b():x())},n=e=>{let n=history[e];history[e]=function(...e){let r=n.apply(this,e);return queueMicrotask(t),r}};n(`pushState`),n(`replaceState`),window.addEventListener(`popstate`,t),window.setInterval(t,1e3)}function w(){let e=!1;new MutationObserver(()=>{e||(e=!0,requestAnimationFrame(()=>{e=!1;let t=v();t!==g&&(g=t,m?.send({channel:a,type:`theme`,pageIsDark:t}))}))}).observe(document.documentElement,{attributes:!0,attributeFilter:[`class`,`data-theme`]})}function T(){g=v(),y()&&b(),C(),w()}_(),document.readyState===`loading`?document.addEventListener(`DOMContentLoaded`,T,{once:!0}):T();