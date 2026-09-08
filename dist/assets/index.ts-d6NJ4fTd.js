import{a as e,c as t,d as n,n as r,r as i,s as a,t as o}from"./protocol-RsZfVuRJ.js";function s(){return{top:0,right:46,width:40,height:40}}function c(e){let t=s();return{left:e.x+e.width-t.right-t.width,top:e.y+t.top}}var l=`cubic-bezier(0.16, 1, 0.3, 1)`;function u(e,t){return[{clipPath:e},{clipPath:t}]}function d(e,t,n=!1){return!t||n?`inset(0px)`:`inset(0px 0px ${Math.max(0,e-40)}px 0px)`}function f(e,t){return!e.open||e.shrunk||!t}function p(e,t=!1){return{iframe:{width:e.width,height:e.height},shell:{width:e.width,height:e.shrunk&&t?40:e.height},clipPath:d(e.height,e.shrunk,t)}}function m(e,t,n,r){let{shell:i,iframe:a,clipPath:o}=p(n,r.settle===!0);e.dataset.open=String(n.open),e.dataset.shrunk=String(n.shrunk),e.dataset.animate=String(r.animate);let s={left:`${n.x}px`,top:`${n.y}px`,width:`${i.width}px`,height:`${i.height}px`};r.clipPath!==!1&&(s.clipPath=r.clipPath??o),Object.assign(e.style,s),Object.assign(t.style,{width:`${a.width}px`,height:`${a.height}px`})}function h(e,t,n){let r=Math.max(280,t.width-n.x),i=Math.max(180,t.height-n.y);return{width:Math.min(r,Math.max(280,e.width)),height:Math.min(i,Math.max(180,e.height))}}function g(e,t){return{sx:t.width/e.width,sy:t.height/e.height}}function _(e,t,n){let{sx:r,sy:i}=g(t,n);e.style.willChange=`transform`,e.style.transformOrigin=`top left`,e.style.transform=`scale(${r}, ${i})`}function v(e){e.style.transform=``,e.style.transformOrigin=``,e.style.willChange=``}function y(e){return{left:e.x+e.width-16,top:e.y+e.height-16}}var b=s(),x=`graphy-root`,S=`
:host {
  all: initial;
  --color-paper: oklch(99% 0.004 250);
  --color-ink: oklch(22% 0.02 255);
  --color-accent: oklch(62% 0.19 255);
  --color-accent-ink: oklch(99% 0.01 255);
  --color-rule: oklch(84% 0.012 250);
  --color-focus: oklch(62% 0.19 255);
  --font-body: "Outfit", ui-sans-serif, system-ui, sans-serif;
}
.shell {
  position: fixed;
  z-index: 2147483646;
  border: 0;
  border-radius: 0;
  overflow: hidden;
  clip-path: inset(0);
  box-shadow: none;
  background: transparent;
  display: none;
}
.shell[data-open="true"] { display: block; }
.shell iframe {
  position: absolute;
  top: 0;
  left: 0;
  border: 0;
  display: block;
  transform: translateZ(0);
}
.shrink-hit {
  appearance: none;
  -webkit-appearance: none;
  position: fixed;
  z-index: 2147483647;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  touch-action: none;
}
.shrink-hit[hidden] { display: none; }
.resize-hit {
  appearance: none;
  -webkit-appearance: none;
  position: fixed;
  z-index: 2147483647;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: nwse-resize;
  touch-action: none;
}
.resize-hit::after {
  content: "";
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 7px;
  height: 7px;
  border-right: 1px solid var(--color-ink);
  border-bottom: 1px solid var(--color-ink);
  opacity: 0.45;
}
.resize-hit[hidden] { display: none; }
.launcher {
  appearance: none;
  -webkit-appearance: none;
  position: fixed;
  z-index: 2147483645;
  right: 20px;
  bottom: 20px;
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--color-accent);
  border-radius: 0;
  background: var(--color-accent);
  color: var(--color-accent-ink);
  font: 600 12px/36px var(--font-body);
  letter-spacing: -0.01em;
  cursor: pointer;
  box-shadow: none;
}
.launcher:hover { background: var(--color-ink); border-color: var(--color-ink); color: var(--color-paper); }
.launcher:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
.launcher:active { transform: translateY(1px); }
.launcher[hidden] { display: none; }
`,C=class{frameUrl;root;frameOrigin;shell;frame;shrinkHit;resizeHit;launcher;resizing=null;state={...e};ready=!1;pending=new Map;saveTimer;clipAnim;clipSettled=!0;resizeCommit;resizePointerId;restored;constructor(e){this.frameUrl=e;let t=new URL(e);this.frameOrigin=`${t.protocol}//${t.host}`,document.getElementById(x)?.remove();let n=document.createElement(`div`);n.id=x,n.style.cssText=`all: initial; position: static;`,this.root=n.attachShadow({mode:`closed`}),(document.body??document.documentElement).appendChild(n),this.restored=this.build()}async build(){let e=document.createElement(`style`);e.textContent=S,this.shell=document.createElement(`div`),this.shell.className=`shell`,this.shell.dataset.open=`false`,this.frame=document.createElement(`iframe`),this.frame.src=this.frameUrl,this.frame.setAttribute(`title`,`Graphy visualizer`),this.shell.appendChild(this.frame),this.shrinkHit=document.createElement(`button`),this.shrinkHit.className=`shrink-hit`,this.shrinkHit.type=`button`,this.shrinkHit.setAttribute(`aria-label`,`Shrink panel`),this.shrinkHit.addEventListener(`click`,this.onShrinkClick),this.resizeHit=document.createElement(`button`),this.resizeHit.className=`resize-hit`,this.resizeHit.type=`button`,this.resizeHit.setAttribute(`aria-label`,`Resize panel`),this.resizeHit.addEventListener(`pointerdown`,this.onResizePointerDown),this.launcher=document.createElement(`button`),this.launcher.className=`launcher`,this.launcher.textContent=`Graphy`,this.launcher.addEventListener(`click`,()=>this.open());let t=document.createElement(`link`);t.rel=`stylesheet`,t.href=`https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&display=swap`,this.root.append(t,e,this.shell,this.shrinkHit,this.resizeHit,this.launcher),window.addEventListener(`message`,this.onMessage),window.addEventListener(`resize`,this.clamp);let n=await a();this.state=n,(n.x<0||n.y<0)&&this.placeDefault(),this.clamp()}placeDefault(){this.state.x=Math.max(16,window.innerWidth-this.state.width-24),this.state.y=Math.max(16,window.innerHeight-this.state.height-24)}apply(){this.clipAnim?.cancel(),this.clipAnim=void 0,this.clipSettled=!0,v(this.shell),m(this.shell,this.frame,this.state,{animate:!1,settle:this.state.shrunk}),this.launcher.hidden=this.state.open,this.syncHits()}onShrinkClick=()=>{this.setShrunk(!this.state.shrunk)};setShrunk(e){if(this.state.shrunk===e){this.send({channel:o,type:`shrunk`,shrunk:e});return}this.abortResize();let t=this.state.height,n=d(t,this.state.shrunk);this.state.shrunk=e;let r=d(t,e);this.clipAnim?.cancel(),this.clipSettled=!1,m(this.shell,this.frame,this.state,{animate:!1,settle:!1,clipPath:n}),this.launcher.hidden=this.state.open,this.syncHits();let i=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches;this.clipAnim=this.shell.animate(u(n,r),{duration:i?0:160,easing:l,fill:`forwards`}),this.clipAnim.onfinish=()=>{this.clipAnim?.cancel(),this.state.shrunk===e&&(this.clipSettled=!0,m(this.shell,this.frame,this.state,{animate:!1,settle:this.state.shrunk,clipPath:r}),this.syncHits())},this.send({channel:o,type:`shrunk`,shrunk:e}),this.persist()}clamp=()=>{if(this.resizing)return;let e=h({width:this.state.width,height:this.state.height},{width:window.innerWidth,height:window.innerHeight},{x:this.state.x,y:this.state.y});this.state.width=e.width,this.state.height=e.height,this.state.x=Math.min(Math.max(0,this.state.x),Math.max(0,window.innerWidth-80)),this.state.y=Math.min(Math.max(0,this.state.y),Math.max(0,window.innerHeight-40)),this.apply()};syncHits(){let e=c(this.state);Object.assign(this.shrinkHit.style,{left:`${e.left}px`,top:`${e.top}px`,width:`${b.width}px`,height:`${b.height}px`}),this.shrinkHit.hidden=!this.state.open,this.shrinkHit.setAttribute(`aria-label`,this.state.shrunk?`Expand panel`:`Shrink panel`),this.shrinkHit.setAttribute(`aria-pressed`,String(this.state.shrunk));let t=y(this.state);Object.assign(this.resizeHit.style,{left:`${t.left}px`,top:`${t.top}px`}),this.resizeHit.hidden=f(this.state,this.clipSettled)}commitResizeLayout(){this.resizeCommit!==void 0&&(window.cancelAnimationFrame(this.resizeCommit),this.resizeCommit=void 0),v(this.shell),m(this.shell,this.frame,this.state,{animate:!1,settle:this.state.shrunk}),this.syncHits()}abortResize(){if(this.resizing&&(this.resizing=null,this.resizeHit.removeEventListener(`pointermove`,this.onResizePointerMove),this.resizeHit.removeEventListener(`pointerup`,this.onResizePointerUp),this.resizeHit.removeEventListener(`pointercancel`,this.onResizePointerUp)),this.resizePointerId!==void 0){try{this.resizeHit.releasePointerCapture(this.resizePointerId)}catch{}this.resizePointerId=void 0}this.resizeCommit!==void 0&&(window.cancelAnimationFrame(this.resizeCommit),this.resizeCommit=void 0),v(this.shell)}onResizePointerDown=e=>{if(!(e.button!==0||this.state.shrunk||!this.clipSettled)){e.preventDefault(),this.commitResizeLayout(),this.shell.style.willChange=`transform`,this.resizePointerId=e.pointerId;try{this.resizeHit.setPointerCapture(e.pointerId)}catch{}this.resizing={startX:e.clientX,startY:e.clientY,width:this.state.width,height:this.state.height},this.resizeHit.addEventListener(`pointermove`,this.onResizePointerMove),this.resizeHit.addEventListener(`pointerup`,this.onResizePointerUp),this.resizeHit.addEventListener(`pointercancel`,this.onResizePointerUp)}};liveSize(e){let t=this.resizing;return t?h({width:t.width+(e.clientX-t.startX),height:t.height+(e.clientY-t.startY)},{width:window.innerWidth,height:window.innerHeight},{x:this.state.x,y:this.state.y}):{width:this.state.width,height:this.state.height}}onResizePointerMove=e=>{if(!this.resizing)return;let t=this.liveSize(e);_(this.shell,this.resizing,t);let n=c({...this.state,width:t.width});Object.assign(this.shrinkHit.style,{left:`${n.left}px`,top:`${n.top}px`}),Object.assign(this.resizeHit.style,{left:`${this.state.x+t.width-16}px`,top:`${this.state.y+t.height-16}px`})};onResizePointerUp=e=>{if(!this.resizing)return;let t=this.liveSize(e);this.resizing=null,this.resizeHit.removeEventListener(`pointermove`,this.onResizePointerMove),this.resizeHit.removeEventListener(`pointerup`,this.onResizePointerUp),this.resizeHit.removeEventListener(`pointercancel`,this.onResizePointerUp),this.resizePointerId=void 0,this.state.width=t.width,this.state.height=t.height,this.syncHits(),this.persist(),this.resizeCommit=window.requestAnimationFrame(()=>{this.resizeCommit=window.requestAnimationFrame(()=>{this.resizeCommit=void 0,!this.resizing&&(v(this.shell),this.apply())})})};persist(){window.clearTimeout(this.saveTimer),this.saveTimer=window.setTimeout(()=>void n(this.state),400)}open(){this.state.open=!0,this.apply(),this.persist()}get isOpen(){return this.state.open}toggle(){this.state.open?this.close():this.open()}close(){this.state.open=!1,this.apply(),this.persist()}send(e){if(!this.ready){this.pending.set(e.type,e);return}this.frame.contentWindow?.postMessage(e,this.frameOrigin)}destroy(){this.clipAnim?.cancel(),this.abortResize(),this.shrinkHit.removeEventListener(`click`,this.onShrinkClick),this.resizeHit.removeEventListener(`pointerdown`,this.onResizePointerDown),window.removeEventListener(`message`,this.onMessage),window.removeEventListener(`resize`,this.clamp),document.getElementById(x)?.remove()}onMessage=e=>{if(e.source!==this.frame.contentWindow||e.origin!==this.frameOrigin)return;let t=e.data;if(i(t))switch(t.type){case`ready`:{this.ready=!0;let e=[...this.pending.values()];this.pending.clear();for(let t of e)this.send(t);this.send({channel:o,type:`shrunk`,shrunk:this.state.shrunk});break}case`close`:this.close();break;case`move`:this.state.x+=t.dx,this.state.y+=t.dy,this.clamp();break;case`persist`:this.persist();break;case`setShrunk`:this.setShrunk(t.shrunk)}}},w=/^\/problems\/[^/]+/,T=null,E=null;function D(){let e=document.createElement(`script`);e.src=chrome.runtime.getURL(`injected.js`),e.async=!1,e.addEventListener(`load`,()=>e.remove()),(document.head??document.documentElement).prepend(e)}function O(){return w.test(location.pathname)}function k(){if(T)return;T=new C(chrome.runtime.getURL(`src/panel/index.html`)),E&&j(E);let e=T;Promise.all([e.restored,t()]).then(([,t])=>{T===e&&(t.autoOpen||e.isOpen)&&e.open()})}function A(){T?.destroy(),T=null}function j(e){T?.send({channel:o,type:`snapshot`,payload:e})}window.addEventListener(`message`,e=>{if(e.source!==window)return;let t=e.data;r(t)&&(E=t.payload,j(t.payload))}),chrome.runtime.onMessage.addListener(e=>{e?.type===`graphy:toggle`&&(T?T.toggle():k())});function M(){let e=location.pathname,t=()=>{location.pathname!==e&&(e=location.pathname,E=null,O()?k():A())},n=e=>{let n=history[e];history[e]=function(...e){let r=n.apply(this,e);return queueMicrotask(t),r}};n(`pushState`),n(`replaceState`),window.addEventListener(`popstate`,t),window.setInterval(t,1e3)}function N(){O()&&k(),M()}D(),document.readyState===`loading`?document.addEventListener(`DOMContentLoaded`,N,{once:!0}):N();