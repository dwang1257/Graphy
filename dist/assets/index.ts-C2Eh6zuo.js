import{a as e,c as t,h as n,n as r,o as i,r as a,s as o,t as s,u as c}from"./protocol-DO3sKs1S.js";function l(){return{top:0,right:46,width:40,height:40}}function u(e){let t=l();return{left:e.x+e.width-t.right-t.width,top:e.y+t.top}}var d=`cubic-bezier(0.16, 1, 0.3, 1)`;function f(e,t){return[{clipPath:e},{clipPath:t}]}function p(e,t,n=!1){return`inset(0px 0px ${!t||n?0:Math.max(0,e-40)}px 0px round 12px)`}function m(e,t){return!e.open||e.shrunk||!t}function h(e,t=!1){return{iframe:{width:e.width,height:e.height},shell:{width:e.width,height:e.shrunk&&t?40:e.height},clipPath:p(e.height,e.shrunk,t)}}function g(e,t,n,r){let i=r.settle===!0,{shell:a,iframe:o,clipPath:s}=h(n,i);e.dataset.open=String(n.open),e.dataset.shrunk=String(n.shrunk),e.dataset.animate=String(r.animate);let c={left:`${n.x}px`,top:`${n.y}px`,width:`${a.width}px`,height:`${a.height}px`};r.clipPath!==!1&&(c.clipPath=i?s:r.clipPath??s),Object.assign(e.style,c),Object.assign(t.style,{width:`${o.width}px`,height:`${o.height}px`})}var _=[`nw`,`ne`,`sw`,`se`];function v(e,t){let n=Math.min(Math.max(280,e.width),Math.max(280,t.width)),r=Math.min(Math.max(180,e.height),Math.max(180,t.height));return{x:Math.min(Math.max(0,e.x),Math.max(0,t.width-n)),y:Math.min(Math.max(0,e.y),Math.max(0,t.height-r)),width:n,height:r}}function y(e,t,n){b(e),g(e,t,n,{animate:!1,settle:n.shrunk})}function b(e){e.style.transform=``,e.style.transformOrigin=``,e.style.willChange=``}function x(e,t=`se`){return{left:t.includes(`w`)?e.x:e.x+e.width-16,top:t.includes(`n`)?e.y:e.y+e.height-16}}function S(e,t,n,r,i,a){t<n&&(t=n,i&&(e=a-t)),e<0&&(e=0,i&&(t=a));let o=Math.max(n,r-e);return t>o&&(t=o,i&&(e=a-t)),{pos:e,size:t}}function C(e,t,n,r){let i=t.includes(`w`),a=t.includes(`n`),o=e.x+e.width,s=e.y+e.height,c=i?e.x+n.dx:e.x,l=a?e.y+n.dy:e.y,u=i?o-c:e.width+n.dx,d=a?s-l:e.height+n.dy;return{pos:c,size:u}=S(c,u,280,r.width,i,o),{pos:l,size:d}=S(l,d,180,r.height,a,s),{x:c,y:l,width:u,height:d}}var w=l(),T=`graphy-root`,E=`
:host {
  all: initial;
  --color-paper: oklch(99% 0.004 250);
  --color-ink: oklch(22% 0.02 255);
  --color-accent: oklch(46% 0.18 305);
  --color-accent-ink: oklch(98% 0.012 305);
  --color-rule: oklch(84% 0.012 250);
  --color-focus: oklch(48% 0.2 305);
  --font-body: "Inter Tight", ui-sans-serif, system-ui, sans-serif;
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
`,D={nw:`Resize panel from top left`,ne:`Resize panel from top right`,sw:`Resize panel from bottom left`,se:`Resize panel from bottom right`};function O(e,t){e.set(t.type===`shrunk`?`shrunk`:`content`,t)}function k(e,t){let n=document.createElement(`button`);return n.className=e,n.type=`button`,t&&n.setAttribute(`aria-label`,t),n}var A=class{frameUrl;options;root;frameOrigin;shell;frame;shrinkHit;resizeHits;launcher;resizing=null;state={...o};ready=!1;pending=new Map;saveTimer;clipAnim;clipSettled=!0;resizePointerId;moveRaf=null;pendingDx=0;pendingDy=0;restored;constructor(e,t={}){this.frameUrl=e,this.options=t;let n=new URL(e);this.frameOrigin=`${n.protocol}//${n.host}`,document.getElementById(T)?.remove();let r=document.createElement(`div`);r.id=T,r.style.cssText=`all: initial; position: static;`,this.root=r.attachShadow({mode:`closed`}),(document.body??document.documentElement).appendChild(r),this.restored=this.build()}async build(){let e=document.createElement(`style`);e.textContent=E,this.shell=document.createElement(`div`),this.shell.className=`shell`,this.shell.dataset.open=`false`,this.frame=document.createElement(`iframe`),this.frame.setAttribute(`title`,`Graphy Visualizer`),this.shell.appendChild(this.frame),this.shrinkHit=k(`shrink-hit`,`Shrink panel`),this.shrinkHit.addEventListener(`click`,this.onShrinkClick),this.resizeHits={};for(let e of _){let t=k(`resize-hit`,D[e]);t.dataset.corner=e,t.addEventListener(`pointerdown`,this.onResizePointerDown),this.resizeHits[e]=t}this.launcher=k(`launcher`),this.launcher.textContent=`Graphy`,this.launcher.addEventListener(`click`,()=>this.open());let t=document.createElement(`link`);t.rel=`stylesheet`,t.href=`https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;700;800&display=swap`,this.root.append(t,e,this.shell,this.shrinkHit,..._.map(e=>this.resizeHits[e]),this.launcher),window.addEventListener(`message`,this.onMessage),window.addEventListener(`resize`,this.clamp);let n=await c();this.state=n,(n.x<0||n.y<0)&&this.placeDefault(),this.state.open&&this.ensureFrame(),this.clamp()}ensureFrame(){this.frame.getAttribute(`src`)||(this.frame.src=this.frameUrl)}placeDefault(){this.state.x=Math.max(16,window.innerWidth-this.state.width-24),this.state.y=Math.max(16,window.innerHeight-this.state.height-24)}paint(e,t){g(this.shell,this.frame,this.state,{animate:!1,settle:e,...t===void 0?{}:{clipPath:t}}),this.launcher.hidden=this.state.open,this.syncHits()}apply(){this.clipAnim?.cancel(),this.clipAnim=void 0,this.clipSettled=!0,b(this.shell),this.paint(this.state.shrunk)}onShrinkClick=()=>{this.setShrunk(!this.state.shrunk)};setShrunk(e){if(this.state.shrunk===e){this.send({channel:s,type:`shrunk`,shrunk:e});return}this.abortResize();let t=this.state.height,n=p(t,this.state.shrunk);this.state.shrunk=e;let r=p(t,e);this.clipAnim?.cancel(),this.clipSettled=!1,this.paint(!1,n);let i=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches;this.clipAnim=this.shell.animate(f(n,r),{duration:i?0:160,easing:d,fill:`forwards`}),this.clipAnim.onfinish=()=>{this.clipAnim?.cancel(),this.state.shrunk===e&&(this.clipSettled=!0,this.paint(this.state.shrunk))},this.send({channel:s,type:`shrunk`,shrunk:e}),this.persist()}viewport(){return{width:window.innerWidth,height:window.innerHeight}}clamp=()=>{if(this.resizing)return;let e=this.viewport(),t=this.state.shrunk?40:this.state.height,n=v({x:this.state.x,y:this.state.y,width:this.state.width,height:t},e);this.state.x=n.x,this.state.y=n.y,this.state.width=n.width,this.state.shrunk||(this.state.height=n.height),this.apply()};syncHits(e=this.state){let t=u(e);Object.assign(this.shrinkHit.style,{left:`${t.left}px`,top:`${t.top}px`,width:`${w.width}px`,height:`${w.height}px`}),this.shrinkHit.hidden=!this.state.open,this.shrinkHit.setAttribute(`aria-label`,this.state.shrunk?`Expand panel`:`Shrink panel`),this.shrinkHit.setAttribute(`aria-pressed`,String(this.state.shrunk));let n=m(this.state,this.clipSettled);for(let t of _){let r=x(e,t);Object.assign(this.resizeHits[t].style,{left:`${r.left}px`,top:`${r.top}px`}),this.resizeHits[t].hidden=n}}listenResize(e,t){if(t){e.addEventListener(`pointermove`,this.onResizePointerMove),e.addEventListener(`pointerup`,this.onResizePointerUp),e.addEventListener(`pointercancel`,this.onResizePointerUp);return}e.removeEventListener(`pointermove`,this.onResizePointerMove),e.removeEventListener(`pointerup`,this.onResizePointerUp),e.removeEventListener(`pointercancel`,this.onResizePointerUp)}abortResize(){let e=this.resizing?.hit;if(this.resizing&&(this.resizing=null,e&&this.listenResize(e,!1)),this.resizePointerId!==void 0){try{e?.releasePointerCapture(this.resizePointerId)}catch{}this.resizePointerId=void 0}b(this.shell)}onResizePointerDown=e=>{if(e.button!==0||this.state.shrunk||!this.clipSettled)return;let t=e.currentTarget;if(!(t instanceof HTMLButtonElement))return;let n=t.dataset.corner;if(_.includes(n)){e.preventDefault(),y(this.shell,this.frame,this.state),this.syncHits(),this.resizePointerId=e.pointerId;try{t.setPointerCapture(e.pointerId)}catch{}this.resizing={startX:e.clientX,startY:e.clientY,x:this.state.x,y:this.state.y,width:this.state.width,height:this.state.height,corner:n,hit:t},this.listenResize(t,!0)}};liveRect(e){let t=this.resizing;return C({x:t.x,y:t.y,width:t.width,height:t.height},t.corner,{dx:e.clientX-t.startX,dy:e.clientY-t.startY},this.viewport())}onResizePointerMove=e=>{if(!this.resizing)return;let t=this.liveRect(e);y(this.shell,this.frame,{...this.state,...t}),this.syncHits(t)};onResizePointerUp=e=>{if(!this.resizing)return;let t=this.liveRect(e);this.listenResize(this.resizing.hit,!1),this.resizing=null,this.resizePointerId=void 0,Object.assign(this.state,t),this.syncHits(),this.persist(),this.apply()};flushMove(){this.moveRaf!==null&&(cancelAnimationFrame(this.moveRaf),this.moveRaf=null),(this.pendingDx!==0||this.pendingDy!==0)&&(this.state.x+=this.pendingDx,this.state.y+=this.pendingDy,this.pendingDx=0,this.pendingDy=0,this.clamp())}persist(){window.clearTimeout(this.saveTimer),this.saveTimer=window.setTimeout(()=>void n(this.state),400)}setOpen(e){let t=this.state.open!==e;this.state.open=e,e&&this.ensureFrame(),this.apply(),this.persist(),t&&this.options.onOpenChange?.(e)}open(){this.setOpen(!0)}get isOpen(){return this.state.open}toggle(){this.state.open?this.close():this.open()}close(){this.setOpen(!1)}send(e){if(!this.ready){O(this.pending,e);return}this.frame.contentWindow?.postMessage(e,this.frameOrigin)}destroy(){this.clipAnim?.cancel(),this.abortResize(),this.shrinkHit.removeEventListener(`click`,this.onShrinkClick);for(let e of Object.values(this.resizeHits))e.removeEventListener(`pointerdown`,this.onResizePointerDown);window.removeEventListener(`message`,this.onMessage),window.removeEventListener(`resize`,this.clamp),this.moveRaf!==null&&cancelAnimationFrame(this.moveRaf),document.getElementById(T)?.remove()}onMessage=e=>{if(e.source!==this.frame.contentWindow||e.origin!==this.frameOrigin)return;let t=e.data;if(a(t))switch(t.type){case`ready`:{this.ready=!0;let e=[...this.pending.values()];this.pending.clear();for(let t of e)this.send(t);this.send({channel:s,type:`shrunk`,shrunk:this.state.shrunk});break}case`close`:this.close();break;case`move`:if(this.pendingDx+=t.dx,this.pendingDy+=t.dy,this.moveRaf!==null)break;this.moveRaf=requestAnimationFrame(()=>{this.moveRaf=null,this.state.x+=this.pendingDx,this.state.y+=this.pendingDy,this.pendingDx=0,this.pendingDy=0,this.clamp()});break;case`persist`:this.flushMove(),this.persist();break;case`setShrunk`:this.setShrunk(t.shrunk)}}};function j(e){window.postMessage(i(e),location.origin)}function M(t){window.postMessage(e(t),location.origin)}var N=/^\/problems\/[^/]+/,P=null,F=`absent`,I=!1;function L(){j(I),M(I)}function R(){F=`loading`;let e=document.createElement(`script`);e.src=chrome.runtime.getURL(`injected.js`),e.async=!1,e.addEventListener(`load`,()=>{e.remove(),F=`loaded`,L()}),(document.head??document.documentElement).prepend(e)}function z(e){I=e,F===`loaded`?L():F===`absent`&&e&&R()}function B(){return N.test(location.pathname)}function V(){z(P?.isOpen===!0)}function H(){if(P)return;P=new A(chrome.runtime.getURL(`src/panel/index.html`),{onOpenChange:()=>V()});let e=P;Promise.all([e.restored,t()]).then(([,t])=>{P===e&&(t&&!e.isOpen&&e.open(),V())})}function U(){z(!1),P?.destroy(),P=null}function W(e){P?.isOpen&&P.send({channel:s,type:`snapshot`,payload:e})}function G(){P?.send({channel:s,type:`clear`})}window.addEventListener(`message`,e=>{if(e.source!==window||e.origin!==location.origin)return;let t=e.data;r(t)&&(t.type===`clear`?G():W(t.payload))}),chrome.runtime.onMessage.addListener(e=>{e?.type===`graphy:toggle`&&(P?P.toggle():H())});function K(){let e=location.pathname;navigation.addEventListener(`currententrychange`,()=>{location.pathname!==e&&(e=location.pathname,B()?(H(),V()):(G(),U()))})}function q(){B()&&H(),K()}document.readyState===`loading`?document.addEventListener(`DOMContentLoaded`,q,{once:!0}):q();