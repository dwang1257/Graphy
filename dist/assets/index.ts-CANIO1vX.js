import{a as e,c as t,f as n,l as r,n as i,o as a,r as o,t as s}from"./protocol-DK0tQoyk.js";function c(t){window.postMessage(e(t),location.origin)}function l(){return{top:0,right:46,width:40,height:40}}function u(e){let t=l();return{left:e.x+e.width-t.right-t.width,top:e.y+t.top}}var d=`cubic-bezier(0.16, 1, 0.3, 1)`;function f(e,t){return[{clipPath:e},{clipPath:t}]}function p(e,t,n=!1){return`inset(0px 0px ${!t||n?0:Math.max(0,e-40)}px 0px round 12px)`}function m(e,t){return!e.open||e.shrunk||!t}function h(e,t=!1){return{iframe:{width:e.width,height:e.height},shell:{width:e.width,height:e.shrunk&&t?40:e.height},clipPath:p(e.height,e.shrunk,t)}}function g(e,t,n,r){let i=r.settle===!0,{shell:a,iframe:o,clipPath:s}=h(n,i);e.dataset.open=String(n.open),e.dataset.shrunk=String(n.shrunk),e.dataset.animate=String(r.animate);let c={left:`${n.x}px`,top:`${n.y}px`,width:`${a.width}px`,height:`${a.height}px`};r.clipPath!==!1&&(c.clipPath=i?s:r.clipPath??s),Object.assign(e.style,c),Object.assign(t.style,{width:`${o.width}px`,height:`${o.height}px`})}var _=[`nw`,`ne`,`sw`,`se`];function v(e,t,n){let r=Math.max(280,t.width-n.x),i=Math.max(180,t.height-n.y);return{width:Math.min(r,Math.max(280,e.width)),height:Math.min(i,Math.max(180,e.height))}}function y(e,t,n){b(e),g(e,t,n,{animate:!1,settle:n.shrunk})}function b(e){e.style.transform=``,e.style.transformOrigin=``,e.style.willChange=``}function x(e,t=`se`){return{left:t.includes(`w`)?e.x:e.x+e.width-16,top:t.includes(`n`)?e.y:e.y+e.height-16}}function S(e,t,n,r,i,a){t<n&&(t=n,i&&(e=a-t)),e<0&&(e=0,i&&(t=a));let o=Math.max(n,r-e);return t>o&&(t=o,i&&(e=a-t)),{pos:e,size:t}}function C(e,t,n,r){let i=t.includes(`w`),a=t.includes(`n`),o=e.x+e.width,s=e.y+e.height,c=i?e.x+n.dx:e.x,l=a?e.y+n.dy:e.y,u=i?o-c:e.width+n.dx,d=a?s-l:e.height+n.dy;return{pos:c,size:u}=S(c,u,280,r.width,i,o),{pos:l,size:d}=S(l,d,180,r.height,a,s),{x:c,y:l,width:u,height:d}}var w=l(),T=`graphy-root`,E=`
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
`,D={nw:`Resize panel from top left`,ne:`Resize panel from top right`,sw:`Resize panel from bottom left`,se:`Resize panel from bottom right`};function O(e,t){let n=document.createElement(`button`);return n.className=e,n.type=`button`,t&&n.setAttribute(`aria-label`,t),n}var k=class{frameUrl;root;frameOrigin;shell;frame;shrinkHit;resizeHits;launcher;resizing=null;state={...a};ready=!1;pending=new Map;saveTimer;clipAnim;clipSettled=!0;resizePointerId;restored;constructor(e){this.frameUrl=e;let t=new URL(e);this.frameOrigin=`${t.protocol}//${t.host}`,document.getElementById(T)?.remove();let n=document.createElement(`div`);n.id=T,n.style.cssText=`all: initial; position: static;`,this.root=n.attachShadow({mode:`closed`}),(document.body??document.documentElement).appendChild(n),this.restored=this.build()}async build(){let e=document.createElement(`style`);e.textContent=E,this.shell=document.createElement(`div`),this.shell.className=`shell`,this.shell.dataset.open=`false`,this.frame=document.createElement(`iframe`),this.frame.src=this.frameUrl,this.frame.setAttribute(`title`,`Graphy Visualizer`),this.shell.appendChild(this.frame),this.shrinkHit=O(`shrink-hit`,`Shrink panel`),this.shrinkHit.addEventListener(`click`,this.onShrinkClick),this.resizeHits={};for(let e of _){let t=O(`resize-hit`,D[e]);t.dataset.corner=e,t.addEventListener(`pointerdown`,this.onResizePointerDown),this.resizeHits[e]=t}this.launcher=O(`launcher`),this.launcher.textContent=`Graphy`,this.launcher.addEventListener(`click`,()=>this.open());let n=document.createElement(`link`);n.rel=`stylesheet`,n.href=`https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&display=swap`,this.root.append(n,e,this.shell,this.shrinkHit,..._.map(e=>this.resizeHits[e]),this.launcher),window.addEventListener(`message`,this.onMessage),window.addEventListener(`resize`,this.clamp);let r=await t();this.state=r,(r.x<0||r.y<0)&&this.placeDefault(),this.clamp()}placeDefault(){this.state.x=Math.max(16,window.innerWidth-this.state.width-24),this.state.y=Math.max(16,window.innerHeight-this.state.height-24)}paint(e,t){g(this.shell,this.frame,this.state,{animate:!1,settle:e,...t===void 0?{}:{clipPath:t}}),this.launcher.hidden=this.state.open,this.syncHits()}apply(){this.clipAnim?.cancel(),this.clipAnim=void 0,this.clipSettled=!0,b(this.shell),this.paint(this.state.shrunk),c(this.state.open)}onShrinkClick=()=>{this.setShrunk(!this.state.shrunk)};setShrunk(e){if(this.state.shrunk===e){this.send({channel:s,type:`shrunk`,shrunk:e});return}this.abortResize();let t=this.state.height,n=p(t,this.state.shrunk);this.state.shrunk=e;let r=p(t,e);this.clipAnim?.cancel(),this.clipSettled=!1,this.paint(!1,n);let i=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches;this.clipAnim=this.shell.animate(f(n,r),{duration:i?0:160,easing:d,fill:`forwards`}),this.clipAnim.onfinish=()=>{this.clipAnim?.cancel(),this.state.shrunk===e&&(this.clipSettled=!0,this.paint(this.state.shrunk))},this.send({channel:s,type:`shrunk`,shrunk:e}),this.persist()}viewport(){return{width:window.innerWidth,height:window.innerHeight}}clamp=()=>{if(this.resizing)return;let e=this.viewport(),t=v({width:this.state.width,height:this.state.height},e,{x:this.state.x,y:this.state.y});this.state.width=t.width,this.state.height=t.height,this.state.x=Math.min(Math.max(0,this.state.x),Math.max(0,e.width-80)),this.state.y=Math.min(Math.max(0,this.state.y),Math.max(0,e.height-40)),this.apply()};syncHits(e=this.state){let t=u(e);Object.assign(this.shrinkHit.style,{left:`${t.left}px`,top:`${t.top}px`,width:`${w.width}px`,height:`${w.height}px`}),this.shrinkHit.hidden=!this.state.open,this.shrinkHit.setAttribute(`aria-label`,this.state.shrunk?`Expand panel`:`Shrink panel`),this.shrinkHit.setAttribute(`aria-pressed`,String(this.state.shrunk));let n=m(this.state,this.clipSettled);for(let t of _){let r=x(e,t);Object.assign(this.resizeHits[t].style,{left:`${r.left}px`,top:`${r.top}px`}),this.resizeHits[t].hidden=n}}listenResize(e,t){if(t){e.addEventListener(`pointermove`,this.onResizePointerMove),e.addEventListener(`pointerup`,this.onResizePointerUp),e.addEventListener(`pointercancel`,this.onResizePointerUp);return}e.removeEventListener(`pointermove`,this.onResizePointerMove),e.removeEventListener(`pointerup`,this.onResizePointerUp),e.removeEventListener(`pointercancel`,this.onResizePointerUp)}abortResize(){let e=this.resizing?.hit;if(this.resizing&&(this.resizing=null,e&&this.listenResize(e,!1)),this.resizePointerId!==void 0){try{e?.releasePointerCapture(this.resizePointerId)}catch{}this.resizePointerId=void 0}b(this.shell)}onResizePointerDown=e=>{if(e.button!==0||this.state.shrunk||!this.clipSettled)return;let t=e.currentTarget;if(!(t instanceof HTMLButtonElement))return;let n=t.dataset.corner;if(_.includes(n)){e.preventDefault(),y(this.shell,this.frame,this.state),this.syncHits(),this.resizePointerId=e.pointerId;try{t.setPointerCapture(e.pointerId)}catch{}this.resizing={startX:e.clientX,startY:e.clientY,x:this.state.x,y:this.state.y,width:this.state.width,height:this.state.height,corner:n,hit:t},this.listenResize(t,!0)}};liveRect(e){let t=this.resizing;return C({x:t.x,y:t.y,width:t.width,height:t.height},t.corner,{dx:e.clientX-t.startX,dy:e.clientY-t.startY},this.viewport())}onResizePointerMove=e=>{if(!this.resizing)return;let t=this.liveRect(e);y(this.shell,this.frame,{...this.state,...t}),this.syncHits(t)};onResizePointerUp=e=>{if(!this.resizing)return;let t=this.liveRect(e);this.listenResize(this.resizing.hit,!1),this.resizing=null,this.resizePointerId=void 0,Object.assign(this.state,t),this.syncHits(),this.persist(),this.apply()};persist(){window.clearTimeout(this.saveTimer),this.saveTimer=window.setTimeout(()=>void n(this.state),400)}setOpen(e){this.state.open=e,this.apply(),this.persist()}open(){this.setOpen(!0)}get isOpen(){return this.state.open}toggle(){this.state.open?this.close():this.open()}close(){this.setOpen(!1)}send(e){if(!this.ready){this.pending.set(e.type,e);return}this.frame.contentWindow?.postMessage(e,this.frameOrigin)}destroy(){this.clipAnim?.cancel(),this.abortResize(),this.shrinkHit.removeEventListener(`click`,this.onShrinkClick);for(let e of Object.values(this.resizeHits))e.removeEventListener(`pointerdown`,this.onResizePointerDown);window.removeEventListener(`message`,this.onMessage),window.removeEventListener(`resize`,this.clamp),document.getElementById(T)?.remove()}onMessage=e=>{if(e.source!==this.frame.contentWindow||e.origin!==this.frameOrigin)return;let t=e.data;if(o(t))switch(t.type){case`ready`:{this.ready=!0;let e=[...this.pending.values()];this.pending.clear();for(let t of e)this.send(t);this.send({channel:s,type:`shrunk`,shrunk:this.state.shrunk});break}case`close`:this.close();break;case`move`:this.state.x+=t.dx,this.state.y+=t.dy,this.clamp();break;case`persist`:this.persist();break;case`setShrunk`:this.setShrunk(t.shrunk)}}},A=/^\/problems\/[^/]+/,j=null,M=null;function N(){let e=document.createElement(`script`);e.src=chrome.runtime.getURL(`injected.js`),e.async=!1,e.addEventListener(`load`,()=>e.remove()),(document.head??document.documentElement).prepend(e)}function P(){return A.test(location.pathname)}function F(){if(j)return;j=new k(chrome.runtime.getURL(`src/panel/index.html`)),M&&L(M);let e=j;Promise.all([e.restored,r()]).then(([,t])=>{j===e&&((t.autoOpen||e.isOpen)&&e.open(),c(e.isOpen))})}function I(){c(!1),j?.destroy(),j=null}function L(e){j?.send({channel:s,type:`snapshot`,payload:e})}window.addEventListener(`message`,e=>{if(e.source!==window)return;let t=e.data;i(t)&&(M=t.payload,L(t.payload))}),chrome.runtime.onMessage.addListener(e=>{e?.type===`graphy:toggle`&&(j?j.toggle():F())});function R(){let e=location.pathname,t=()=>{location.pathname!==e&&(e=location.pathname,M=null,P()?F():I())},n=e=>{let n=history[e];history[e]=function(...e){let r=n.apply(this,e);return queueMicrotask(t),r}};n(`pushState`),n(`replaceState`),window.addEventListener(`popstate`,t),window.setInterval(t,1e3)}function z(){P()&&F(),R()}N(),document.readyState===`loading`?document.addEventListener(`DOMContentLoaded`,z,{once:!0}):z();