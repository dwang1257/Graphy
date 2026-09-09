import{a as e,c as t,d as n,n as r,r as i,s as a,t as o}from"./protocol-DFTuw6k4.js";function s(){return{top:0,right:46,width:40,height:40}}function c(e){let t=s();return{left:e.x+e.width-t.right-t.width,top:e.y+t.top}}var l=`cubic-bezier(0.16, 1, 0.3, 1)`;function u(e,t){return[{clipPath:e},{clipPath:t}]}function d(e,t,n=!1){return`inset(0px 0px ${!t||n?0:Math.max(0,e-40)}px 0px round 12px)`}function f(e,t){return!e.open||e.shrunk||!t}function p(e,t=!1){return{iframe:{width:e.width,height:e.height},shell:{width:e.width,height:e.shrunk&&t?40:e.height},clipPath:d(e.height,e.shrunk,t)}}function m(e,t,n,r){let{shell:i,iframe:a,clipPath:o}=p(n,r.settle===!0);e.dataset.open=String(n.open),e.dataset.shrunk=String(n.shrunk),e.dataset.animate=String(r.animate);let s={left:`${n.x}px`,top:`${n.y}px`,width:`${i.width}px`,height:`${i.height}px`};r.clipPath!==!1&&(s.clipPath=r.settle===!0?o:r.clipPath??o),Object.assign(e.style,s),Object.assign(t.style,{width:`${a.width}px`,height:`${a.height}px`})}var h=[`nw`,`ne`,`sw`,`se`];function g(e,t,n){let r=Math.max(280,t.width-n.x),i=Math.max(180,t.height-n.y);return{width:Math.min(r,Math.max(280,e.width)),height:Math.min(i,Math.max(180,e.height))}}function _(e,t){return{sx:t.width/e.width,sy:t.height/e.height}}function v(e){let t=e.includes(`w`)?`right`:`left`;return`${e.includes(`n`)?`bottom`:`top`} ${t}`}function y(e,t,n,r=`se`){let{sx:i,sy:a}=_(t,n);e.style.willChange=`transform`,e.style.transformOrigin=v(r),e.style.transform=`scale(${i}, ${a})`}function b(e){e.style.transform=``,e.style.transformOrigin=``,e.style.willChange=``}function x(e,t=`se`){return{left:t.includes(`w`)?e.x:e.x+e.width-16,top:t.includes(`n`)?e.y:e.y+e.height-16}}function S(e,t,n,r){let i=t.includes(`w`),a=t.includes(`n`),o=e.x+e.width,s=e.y+e.height,c=i?e.x+n.dx:e.x,l=a?e.y+n.dy:e.y,u=i?o-c:e.width+n.dx,d=a?s-l:e.height+n.dy;u<280&&(u=280,i&&(c=o-u)),d<180&&(d=180,a&&(l=s-d)),c<0&&(c=0,i&&(u=o)),l<0&&(l=0,a&&(d=s));let f=Math.max(280,r.width-c),p=Math.max(180,r.height-l);return u>f&&(u=f,i&&(c=o-u)),d>p&&(d=p,a&&(l=s-d)),{x:c,y:l,width:u,height:d}}var C=s(),w=`graphy-root`,T=`
:host {
  all: initial;
  --color-paper: oklch(99% 0.004 250);
  --color-ink: oklch(22% 0.02 255);
  --color-accent: oklch(46% 0.18 305);
  --color-accent-ink: oklch(98% 0.012 305);
  --color-rule: oklch(84% 0.012 250);
  --color-focus: oklch(48% 0.2 305);
  --font-body: "Outfit", ui-sans-serif, system-ui, sans-serif;
}
.shell {
  position: fixed;
  z-index: 2147483646;
  border: 0;
  border-radius: 12px;
  overflow: hidden;
  clip-path: inset(0 round 12px);
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
.resize-hit[data-corner="ne"],
.resize-hit[data-corner="sw"] { cursor: nesw-resize; }
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
  text-transform: capitalize;
  cursor: pointer;
  box-shadow: none;
}
.launcher:hover { background: var(--color-ink); border-color: var(--color-ink); color: var(--color-paper); }
.launcher:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
.launcher:active { transform: translateY(1px); }
.launcher[hidden] { display: none; }
`,E={nw:`Resize panel from top left`,ne:`Resize panel from top right`,sw:`Resize panel from bottom left`,se:`Resize panel from bottom right`},D=class{frameUrl;root;frameOrigin;shell;frame;shrinkHit;resizeHits;launcher;resizing=null;state={...e};ready=!1;pending=new Map;saveTimer;clipAnim;clipSettled=!0;resizeCommit;resizePointerId;restored;constructor(e){this.frameUrl=e;let t=new URL(e);this.frameOrigin=`${t.protocol}//${t.host}`,document.getElementById(w)?.remove();let n=document.createElement(`div`);n.id=w,n.style.cssText=`all: initial; position: static;`,this.root=n.attachShadow({mode:`closed`}),(document.body??document.documentElement).appendChild(n),this.restored=this.build()}async build(){let e=document.createElement(`style`);e.textContent=T,this.shell=document.createElement(`div`),this.shell.className=`shell`,this.shell.dataset.open=`false`,this.frame=document.createElement(`iframe`),this.frame.src=this.frameUrl,this.frame.setAttribute(`title`,`Graphy Visualizer`),this.shell.appendChild(this.frame),this.shrinkHit=document.createElement(`button`),this.shrinkHit.className=`shrink-hit`,this.shrinkHit.type=`button`,this.shrinkHit.setAttribute(`aria-label`,`Shrink panel`),this.shrinkHit.addEventListener(`click`,this.onShrinkClick),this.resizeHits={};for(let e of h){let t=document.createElement(`button`);t.className=`resize-hit`,t.type=`button`,t.dataset.corner=e,t.setAttribute(`aria-label`,E[e]),t.addEventListener(`pointerdown`,this.onResizePointerDown),this.resizeHits[e]=t}this.launcher=document.createElement(`button`),this.launcher.className=`launcher`,this.launcher.textContent=`Graphy`,this.launcher.addEventListener(`click`,()=>this.open());let t=document.createElement(`link`);t.rel=`stylesheet`,t.href=`https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&display=swap`,this.root.append(t,e,this.shell,this.shrinkHit,...h.map(e=>this.resizeHits[e]),this.launcher),window.addEventListener(`message`,this.onMessage),window.addEventListener(`resize`,this.clamp);let n=await a();this.state=n,(n.x<0||n.y<0)&&this.placeDefault(),this.clamp()}placeDefault(){this.state.x=Math.max(16,window.innerWidth-this.state.width-24),this.state.y=Math.max(16,window.innerHeight-this.state.height-24)}apply(){this.clipAnim?.cancel(),this.clipAnim=void 0,this.clipSettled=!0,b(this.shell),m(this.shell,this.frame,this.state,{animate:!1,settle:this.state.shrunk}),this.launcher.hidden=this.state.open,this.syncHits()}onShrinkClick=()=>{this.setShrunk(!this.state.shrunk)};setShrunk(e){if(this.state.shrunk===e){this.send({channel:o,type:`shrunk`,shrunk:e});return}this.abortResize();let t=this.state.height,n=d(t,this.state.shrunk);this.state.shrunk=e;let r=d(t,e);this.clipAnim?.cancel(),this.clipSettled=!1,m(this.shell,this.frame,this.state,{animate:!1,settle:!1,clipPath:n}),this.launcher.hidden=this.state.open,this.syncHits();let i=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches;this.clipAnim=this.shell.animate(u(n,r),{duration:i?0:160,easing:l,fill:`forwards`}),this.clipAnim.onfinish=()=>{this.clipAnim?.cancel(),this.state.shrunk===e&&(this.clipSettled=!0,m(this.shell,this.frame,this.state,{animate:!1,settle:this.state.shrunk}),this.syncHits())},this.send({channel:o,type:`shrunk`,shrunk:e}),this.persist()}clamp=()=>{if(this.resizing)return;let e=g({width:this.state.width,height:this.state.height},{width:window.innerWidth,height:window.innerHeight},{x:this.state.x,y:this.state.y});this.state.width=e.width,this.state.height=e.height,this.state.x=Math.min(Math.max(0,this.state.x),Math.max(0,window.innerWidth-80)),this.state.y=Math.min(Math.max(0,this.state.y),Math.max(0,window.innerHeight-40)),this.apply()};syncHits(e=this.state){let t=c(e);Object.assign(this.shrinkHit.style,{left:`${t.left}px`,top:`${t.top}px`,width:`${C.width}px`,height:`${C.height}px`}),this.shrinkHit.hidden=!this.state.open,this.shrinkHit.setAttribute(`aria-label`,this.state.shrunk?`Expand panel`:`Shrink panel`),this.shrinkHit.setAttribute(`aria-pressed`,String(this.state.shrunk));let n=f(this.state,this.clipSettled);for(let t of h){let r=x(e,t);Object.assign(this.resizeHits[t].style,{left:`${r.left}px`,top:`${r.top}px`}),this.resizeHits[t].hidden=n}}commitResizeLayout(){this.resizeCommit!==void 0&&(window.cancelAnimationFrame(this.resizeCommit),this.resizeCommit=void 0),b(this.shell),m(this.shell,this.frame,this.state,{animate:!1,settle:this.state.shrunk}),this.syncHits()}abortResize(){let e=this.resizing?.hit;if(this.resizing&&(this.resizing=null,e?.removeEventListener(`pointermove`,this.onResizePointerMove),e?.removeEventListener(`pointerup`,this.onResizePointerUp),e?.removeEventListener(`pointercancel`,this.onResizePointerUp)),this.resizePointerId!==void 0){try{e?.releasePointerCapture(this.resizePointerId)}catch{}this.resizePointerId=void 0}this.resizeCommit!==void 0&&(window.cancelAnimationFrame(this.resizeCommit),this.resizeCommit=void 0),b(this.shell)}onResizePointerDown=e=>{if(e.button!==0||this.state.shrunk||!this.clipSettled)return;let t=e.currentTarget;if(!(t instanceof HTMLButtonElement))return;let n=t.dataset.corner;if(h.includes(n)){e.preventDefault(),this.commitResizeLayout(),this.shell.style.willChange=`transform`,this.resizePointerId=e.pointerId;try{t.setPointerCapture(e.pointerId)}catch{}this.resizing={startX:e.clientX,startY:e.clientY,x:this.state.x,y:this.state.y,width:this.state.width,height:this.state.height,corner:n,hit:t},t.addEventListener(`pointermove`,this.onResizePointerMove),t.addEventListener(`pointerup`,this.onResizePointerUp),t.addEventListener(`pointercancel`,this.onResizePointerUp)}};liveRect(e){let t=this.resizing;return t?S({x:t.x,y:t.y,width:t.width,height:t.height},t.corner,{dx:e.clientX-t.startX,dy:e.clientY-t.startY},{width:window.innerWidth,height:window.innerHeight}):{x:this.state.x,y:this.state.y,width:this.state.width,height:this.state.height}}onResizePointerMove=e=>{let t=this.resizing;if(!t)return;let n=this.liveRect(e);y(this.shell,t,n,t.corner),this.syncHits(n)};onResizePointerUp=e=>{let t=this.resizing;if(!t)return;let n=this.liveRect(e),r=t.hit;this.resizing=null,r.removeEventListener(`pointermove`,this.onResizePointerMove),r.removeEventListener(`pointerup`,this.onResizePointerUp),r.removeEventListener(`pointercancel`,this.onResizePointerUp),this.resizePointerId=void 0,this.state.x=n.x,this.state.y=n.y,this.state.width=n.width,this.state.height=n.height,this.syncHits(),this.persist(),this.resizeCommit=window.requestAnimationFrame(()=>{this.resizeCommit=window.requestAnimationFrame(()=>{this.resizeCommit=void 0,!this.resizing&&(b(this.shell),this.apply())})})};persist(){window.clearTimeout(this.saveTimer),this.saveTimer=window.setTimeout(()=>void n(this.state),400)}open(){this.state.open=!0,this.apply(),this.persist()}get isOpen(){return this.state.open}toggle(){this.state.open?this.close():this.open()}close(){this.state.open=!1,this.apply(),this.persist()}send(e){if(!this.ready){this.pending.set(e.type,e);return}this.frame.contentWindow?.postMessage(e,this.frameOrigin)}destroy(){this.clipAnim?.cancel(),this.abortResize(),this.shrinkHit.removeEventListener(`click`,this.onShrinkClick);for(let e of Object.values(this.resizeHits))e.removeEventListener(`pointerdown`,this.onResizePointerDown);window.removeEventListener(`message`,this.onMessage),window.removeEventListener(`resize`,this.clamp),document.getElementById(w)?.remove()}onMessage=e=>{if(e.source!==this.frame.contentWindow||e.origin!==this.frameOrigin)return;let t=e.data;if(i(t))switch(t.type){case`ready`:{this.ready=!0;let e=[...this.pending.values()];this.pending.clear();for(let t of e)this.send(t);this.send({channel:o,type:`shrunk`,shrunk:this.state.shrunk});break}case`close`:this.close();break;case`move`:this.state.x+=t.dx,this.state.y+=t.dy,this.clamp();break;case`persist`:this.persist();break;case`setShrunk`:this.setShrunk(t.shrunk)}}},O=/^\/problems\/[^/]+/,k=null,A=null;function j(){let e=document.createElement(`script`);e.src=chrome.runtime.getURL(`injected.js`),e.async=!1,e.addEventListener(`load`,()=>e.remove()),(document.head??document.documentElement).prepend(e)}function M(){return O.test(location.pathname)}function N(){if(k)return;k=new D(chrome.runtime.getURL(`src/panel/index.html`)),A&&F(A);let e=k;Promise.all([e.restored,t()]).then(([,t])=>{k===e&&(t.autoOpen||e.isOpen)&&e.open()})}function P(){k?.destroy(),k=null}function F(e){k?.send({channel:o,type:`snapshot`,payload:e})}window.addEventListener(`message`,e=>{if(e.source!==window)return;let t=e.data;r(t)&&(A=t.payload,F(t.payload))}),chrome.runtime.onMessage.addListener(e=>{e?.type===`graphy:toggle`&&(k?k.toggle():N())});function I(){let e=location.pathname,t=()=>{location.pathname!==e&&(e=location.pathname,A=null,M()?N():P())},n=e=>{let n=history[e];history[e]=function(...e){let r=n.apply(this,e);return queueMicrotask(t),r}};n(`pushState`),n(`replaceState`),window.addEventListener(`popstate`,t),window.setInterval(t,1e3)}function L(){M()&&N(),I()}j(),document.readyState===`loading`?document.addEventListener(`DOMContentLoaded`,L,{once:!0}):L();