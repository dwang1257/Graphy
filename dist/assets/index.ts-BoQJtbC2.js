import{a as e,c as t,d as n,n as r,r as i,s as a,t as o}from"./protocol-DoAl25pV.js";var s=`graphy-root`,c=42,l=320,u=220,d=`
:host { all: initial; }
.shell {
  position: fixed;
  z-index: 2147483646;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(0, 0, 0, 0.08);
  background: #ffffff;
  transition: height 120ms ease;
  display: none;
}
.shell[data-open="true"] { display: block; }
.shell iframe { width: 100%; height: 100%; border: 0; display: block; }
.launcher {
  position: fixed;
  z-index: 2147483645;
  right: 20px;
  bottom: 20px;
  height: 40px;
  padding: 0 16px;
  border: 0;
  border-radius: 20px;
  background: #4f46e5;
  color: #ffffff;
  font: 600 13px/40px ui-sans-serif, system-ui, -apple-system, sans-serif;
  letter-spacing: 0.01em;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(79, 70, 229, 0.4);
}
.launcher:hover { background: #4338ca; }
.launcher[hidden] { display: none; }
`,f=class{frameUrl;root;shell;frame;launcher;state={...e};ready=!1;pending=new Map;saveTimer;restored;constructor(e){this.frameUrl=e,document.getElementById(s)?.remove();let t=document.createElement(`div`);t.id=s,t.style.cssText=`all: initial; position: static;`,this.root=t.attachShadow({mode:`open`}),(document.body??document.documentElement).appendChild(t),this.restored=this.build()}async build(){let e=document.createElement(`style`);e.textContent=d,this.shell=document.createElement(`div`),this.shell.className=`shell`,this.shell.dataset.open=`false`,this.frame=document.createElement(`iframe`),this.frame.src=this.frameUrl,this.frame.setAttribute(`title`,`Graphy visualizer`),this.shell.appendChild(this.frame),this.launcher=document.createElement(`button`),this.launcher.className=`launcher`,this.launcher.textContent=`Graphy`,this.launcher.addEventListener(`click`,()=>this.open()),this.root.append(e,this.shell,this.launcher),window.addEventListener(`message`,this.onMessage),window.addEventListener(`resize`,this.clamp);let t=await a();this.state=t,(t.x<0||t.y<0)&&this.placeDefault(),this.apply()}placeDefault(){this.state.x=Math.max(16,window.innerWidth-this.state.width-24),this.state.y=Math.max(16,window.innerHeight-this.state.height-24)}apply(){let e=this.state.collapsed?c:this.state.height;Object.assign(this.shell.style,{left:`${this.state.x}px`,top:`${this.state.y}px`,width:`${this.state.width}px`,height:`${e}px`}),this.shell.dataset.open=String(this.state.open),this.launcher.hidden=this.state.open}clamp=()=>{this.state.x=Math.min(Math.max(0,this.state.x),Math.max(0,window.innerWidth-80)),this.state.y=Math.min(Math.max(0,this.state.y),Math.max(0,window.innerHeight-40)),this.apply()};persist(){window.clearTimeout(this.saveTimer),this.saveTimer=window.setTimeout(()=>void n(this.state),400)}open(){this.state.open=!0,this.state.collapsed=!1,this.apply(),this.persist()}get isOpen(){return this.state.open}toggle(){this.state.open?this.close():this.open()}close(){this.state.open=!1,this.apply(),this.persist()}send(e){if(!this.ready){this.pending.set(e.type,e);return}this.frame.contentWindow?.postMessage(e,`*`)}destroy(){window.removeEventListener(`message`,this.onMessage),window.removeEventListener(`resize`,this.clamp),document.getElementById(s)?.remove()}onMessage=e=>{if(e.source!==this.frame.contentWindow)return;let t=e.data;if(i(t))switch(t.type){case`ready`:{this.ready=!0;let e=[...this.pending.values()];this.pending.clear();for(let t of e)this.send(t);break}case`close`:this.close();break;case`collapse`:this.state.collapsed=t.collapsed,this.apply(),this.persist();break;case`move`:this.state.x+=t.dx,this.state.y+=t.dy,this.clamp();break;case`resize`:this.state.width=Math.max(l,this.state.width+t.dx),this.state.height=Math.max(u,this.state.height+t.dy),this.apply();break;case`persist`:this.persist()}}},p=/^\/problems\/[^/]+/,m=null,h=null,g=!1;function _(){let e=document.createElement(`script`);e.src=chrome.runtime.getURL(`injected.js`),e.async=!1,e.addEventListener(`load`,()=>e.remove()),(document.head??document.documentElement).prepend(e)}function v(){let e=document.documentElement;if(e.classList.contains(`dark`)||e.dataset.theme===`dark`)return!0;let t=getComputedStyle(document.body??e).backgroundColor.match(/\d+/g)?.slice(0,3).map(Number);return!t||t.length<3?!1:(t[0]*299+t[1]*587+t[2]*114)/1e3<128}function y(){return p.test(location.pathname)}function b(){if(m)return;m=new f(chrome.runtime.getURL(`src/panel/index.html`)),h&&S(h);let e=m;Promise.all([e.restored,t()]).then(([,t])=>{m===e&&(t.autoOpen||e.isOpen)&&e.open()})}function x(){m?.destroy(),m=null}function S(e){m?.send({channel:o,type:`snapshot`,payload:e,pageIsDark:g})}window.addEventListener(`message`,e=>{if(e.source!==window)return;let t=e.data;r(t)&&(h=t.payload,S(t.payload))}),chrome.runtime.onMessage.addListener(e=>{e?.type===`graphy:toggle`&&(m?m.toggle():b())});function C(){let e=location.pathname,t=()=>{location.pathname!==e&&(e=location.pathname,h=null,y()?b():x())},n=e=>{let n=history[e];history[e]=function(...e){let r=n.apply(this,e);return queueMicrotask(t),r}};n(`pushState`),n(`replaceState`),window.addEventListener(`popstate`,t),window.setInterval(t,1e3)}function w(){let e=!1;new MutationObserver(()=>{e||(e=!0,requestAnimationFrame(()=>{e=!1;let t=v();t!==g&&(g=t,m?.send({channel:o,type:`theme`,pageIsDark:t}))}))}).observe(document.documentElement,{attributes:!0,attributeFilter:[`class`,`data-theme`]})}function T(){g=v(),y()&&b(),C(),w()}_(),document.readyState===`loading`?document.addEventListener(`DOMContentLoaded`,T,{once:!0}):T();