import{a as e,c as t,h as n,n as r,o as i,r as a,s as o,t as s,u as c}from"./protocol-BlOzJiD5.js";var l=`cubic-bezier(0.16, 1, 0.3, 1)`,u=[`nw`,`ne`,`sw`,`se`];function d(e,t){for(let[n,r]of Object.entries(t))e.style.setProperty(n,r)}function f(){let e=new WeakMap;return(t,n)=>{let r=e.get(t);r||(r=new Map,e.set(t,r));for(let[e,i]of Object.entries(n))r.get(e)!==i&&(r.set(e,i),t.style.setProperty(e,i))}}function p(e,t){return[{clipPath:e},{clipPath:t}]}function m(e,t,n=!1){return`inset(0px 0px ${!t||n?0:Math.max(0,e-40)}px 0px round 12px)`}function h(e,t,n,r={}){let i=r.settle===!0,a=r.write??d,o=String(n.open);e.dataset.open!==o&&(e.dataset.open=o);let s={left:`${n.x}px`,top:`${n.y}px`,width:`${n.width}px`,height:`${n.shrunk&&i?40:n.height}px`};r.clipPath!==!1&&(s[`clip-path`]=i||r.clipPath===void 0?m(n.height,n.shrunk,i):r.clipPath),a(e,s),a(t,{width:`${n.width}px`,height:`${n.height}px`})}function g(e,t){let n=Math.min(Math.max(280,e.width),Math.max(280,t.width)),r=Math.min(Math.max(180,e.height),Math.max(180,t.height));return{x:Math.min(Math.max(0,e.x),Math.max(0,t.width-n)),y:Math.min(Math.max(0,e.y),Math.max(0,t.height-r)),width:n,height:r}}function _(e,t){return{left:t.includes(`w`)?e.x+4-16:e.x+e.width-4,top:t.includes(`n`)?e.y+4-16:e.y+e.height-4}}function v(e,t,n,r,i,a){t<n&&(t=n,i&&(e=a-t)),e<0&&(e=0,i&&(t=a));let o=Math.max(n,r-e);return t>o&&(t=o,i&&(e=a-t)),{pos:e,size:t}}function y(e,t,n,r){let i=t.includes(`w`),a=t.includes(`n`),o=e.x+e.width,s=e.y+e.height,c=i?e.x+n.dx:e.x,l=a?e.y+n.dy:e.y,u=v(c,i?o-c:e.width+n.dx,280,r.width,i,o),d=v(l,a?s-l:e.height+n.dy,180,r.height,a,s);return{x:u.pos,y:d.pos,width:u.size,height:d.size}}var b=`graphy-root`,x=`
:host {
  all: initial;
  --color-paper: oklch(99% 0.004 250);
  --color-ink: oklch(22% 0.02 255);
  --color-accent: oklch(46% 0.18 305);
  --color-accent-ink: oklch(98% 0.012 305);
  --color-focus: oklch(48% 0.2 305);
  --font-body: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.layer {
  position: fixed;
  z-index: 2147483647;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
  transform: translate3d(0, 0, 0);
}
.shell {
  position: fixed;
  z-index: 0;
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
.resize-hit {
  appearance: none;
  -webkit-appearance: none;
  position: fixed;
  z-index: 1;
  padding: 0;
  border: 0;
  background: transparent;
  touch-action: none;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
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
  font: 600 12px/34px var(--font-body);
  letter-spacing: 0;
  cursor: pointer;
  box-shadow: none;
}
@media (hover: hover) {
  .launcher:hover { background: var(--color-ink); border-color: var(--color-ink); color: var(--color-paper); }
}
.launcher:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
.launcher:active { transform: translateY(1px); }
.launcher[hidden] { display: none; }
`,S={nw:`Resize panel from top left`,ne:`Resize panel from top right`,sw:`Resize panel from bottom left`,se:`Resize panel from bottom right`};function C(e,t){e.set(t.type===`shrunk`?`shrunk`:`content`,t)}function w(e){let t=document.createElement(`div`);return t.className=e,t}function T(e,t){let n=document.createElement(`button`);return n.className=e,n.type=`button`,t&&n.setAttribute(`aria-label`,t),n}function E(e){let t=T(`resize-hit`,S[e]);return t.dataset.corner=e,t}function D(e,t){e.hidden!==t&&(e.hidden=t)}var O=class{frameUrl;options;root;frameOrigin;write=f();layer=w(`layer`);shell=w(`shell`);frame=document.createElement(`iframe`);resizeHits={nw:E(`nw`),ne:E(`ne`),sw:E(`sw`),se:E(`se`)};launcher=T(`launcher`);resizing=null;state={...o};anchor={x:0,y:0};ready=!1;pending=new Map;saveTimer;clipAnim;clipSettled=!0;resizeRaf=null;moveRaf=null;pendingDx=0;pendingDy=0;restored;constructor(e,t={}){this.frameUrl=e,this.options=t;let n=new URL(e);this.frameOrigin=`${n.protocol}//${n.host}`,document.getElementById(b)?.remove();let r=document.createElement(`div`);r.id=b,r.style.cssText=`all: initial; position: static;`,this.root=r.attachShadow({mode:`closed`}),(document.body??document.documentElement).appendChild(r);let i=document.createElement(`style`);i.textContent=x,this.shell.dataset.open=`false`,this.frame.setAttribute(`title`,`Graphy visualizer`),this.shell.appendChild(this.frame);for(let e of Object.values(this.resizeHits))e.addEventListener(`pointerdown`,this.onResizePointerDown);this.launcher.textContent=`Graphy`,this.launcher.addEventListener(`click`,()=>this.open()),this.layer.append(this.shell,...u.map(e=>this.resizeHits[e])),this.root.append(i,this.layer,this.launcher),window.addEventListener(`message`,this.onMessage),window.addEventListener(`resize`,this.clamp),this.restored=this.restore()}async restore(){this.state=await c(),(this.state.x<0||this.state.y<0)&&this.placeDefault(),this.state.open&&this.ensureFrame(),this.clamp()}ensureFrame(){this.frame.getAttribute(`src`)||(this.frame.src=this.frameUrl)}placeDefault(){this.state.x=Math.max(16,window.innerWidth-this.state.width-24),this.state.y=Math.max(16,window.innerHeight-this.state.height-24)}layout(e=this.state,t){h(this.shell,this.frame,{...this.state,...e},{settle:this.clipSettled&&this.state.shrunk,clipPath:t??(this.clipSettled?void 0:!1),write:this.write}),this.anchor={x:e.x,y:e.y},this.write(this.layer,{transform:``}),D(this.launcher,this.state.open),this.syncHits(e)}paintOffset(){let e=this.state.x-this.anchor.x,t=this.state.y-this.anchor.y;this.write(this.layer,{transform:e===0&&t===0?``:`translate3d(${e}px, ${t}px, 0px)`})}apply(){this.clipAnim?.cancel(),this.clipAnim=void 0,this.clipSettled=!0,this.layout()}setShrunk(e){if(this.state.shrunk===e){this.send({channel:s,type:`shrunk`,shrunk:e});return}this.abortResize();let t=m(this.state.height,!e),n=m(this.state.height,e);this.state.shrunk=e,this.clipAnim?.cancel(),this.clipSettled=!1,this.layout(this.state,t);let r=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches;this.clipAnim=this.shell.animate(p(t,n),{duration:r?0:160,easing:l,fill:`forwards`}),this.clipAnim.onfinish=()=>{this.clipAnim?.cancel(),this.state.shrunk===e&&(this.clipSettled=!0,this.layout())},this.send({channel:s,type:`shrunk`,shrunk:e}),this.persist()}viewport(){return{width:window.innerWidth,height:window.innerHeight}}clampedBox(){let{x:e,y:t,width:n,height:r,shrunk:i}=this.state,a=g({x:e,y:t,width:n,height:i?40:r},this.viewport());return{x:a.x,y:a.y,width:a.width,height:i?r:a.height}}clamp=()=>{this.resizing||(Object.assign(this.state,this.clampedBox()),this.apply())};moveBy(e,t){if(this.resizing)return;this.state.x+=e,this.state.y+=t;let n=this.clampedBox(),r=n.width!==this.state.width||n.height!==this.state.height;Object.assign(this.state,n),r?this.apply():this.paintOffset()}syncHits(e){let t=!this.state.open||this.state.shrunk||!this.clipSettled;for(let n of u){let r=_(e,n),i=this.resizeHits[n];this.write(i,{left:`${r.left}px`,top:`${r.top}px`}),D(i,t)}}listenResize(e,t){if(t){e.addEventListener(`pointermove`,this.onResizePointerMove),e.addEventListener(`pointerup`,this.onResizePointerUp),e.addEventListener(`pointercancel`,this.onResizePointerUp);return}e.removeEventListener(`pointermove`,this.onResizePointerMove),e.removeEventListener(`pointerup`,this.onResizePointerUp),e.removeEventListener(`pointercancel`,this.onResizePointerUp)}cancelResizeFrame(){this.resizeRaf!==null&&(cancelAnimationFrame(this.resizeRaf),this.resizeRaf=null)}abortResize(){this.cancelResizeFrame();let e=this.resizing;if(e){this.resizing=null,this.listenResize(e.hit,!1);try{e.hit.releasePointerCapture(e.pointerId)}catch{}}}onResizePointerDown=e=>{if(e.button!==0||this.state.shrunk||!this.clipSettled||this.resizing)return;let t=u.find(t=>this.resizeHits[t]===e.currentTarget);if(!t)return;let n=this.resizeHits[t];e.preventDefault(),this.flushMove(),this.layout();try{n.setPointerCapture(e.pointerId)}catch{}let{x:r,y:i,width:a,height:o}=this.state;this.resizing={start:{x:r,y:i,width:a,height:o},corner:t,hit:n,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,pointerX:e.clientX,pointerY:e.clientY},this.listenResize(n,!0)};liveRect(e){return y(e.start,e.corner,{dx:e.pointerX-e.startX,dy:e.pointerY-e.startY},this.viewport())}trackResizePointer(e){!this.resizing||e.type===`pointercancel`||(this.resizing.pointerX=e.clientX,this.resizing.pointerY=e.clientY)}onResizePointerMove=e=>{this.resizing&&(this.trackResizePointer(e),this.resizeRaf===null&&(this.resizeRaf=requestAnimationFrame(()=>{this.resizeRaf=null,this.resizing&&this.layout(this.liveRect(this.resizing))})))};onResizePointerUp=e=>{let t=this.resizing;t&&(this.cancelResizeFrame(),this.trackResizePointer(e),this.listenResize(t.hit,!1),this.resizing=null,Object.assign(this.state,this.liveRect(t)),this.persist(),this.apply())};flushMove(){if(this.moveRaf!==null&&(cancelAnimationFrame(this.moveRaf),this.moveRaf=null),this.pendingDx===0&&this.pendingDy===0)return;let e=this.pendingDx,t=this.pendingDy;this.pendingDx=0,this.pendingDy=0,this.moveBy(e,t)}persist(){window.clearTimeout(this.saveTimer),this.saveTimer=window.setTimeout(()=>void n(this.state),400)}setOpen(e){let t=this.state.open!==e;this.state.open=e,e&&this.ensureFrame(),this.apply(),this.persist(),t&&this.options.onOpenChange?.(e)}get isOpen(){return this.state.open}open(){this.setOpen(!0)}close(){this.setOpen(!1)}toggle(){this.setOpen(!this.state.open)}send(e){if(!this.ready){C(this.pending,e);return}this.frame.contentWindow?.postMessage(e,this.frameOrigin)}destroy(){this.clipAnim?.cancel(),this.abortResize(),window.removeEventListener(`message`,this.onMessage),window.removeEventListener(`resize`,this.clamp),this.moveRaf!==null&&cancelAnimationFrame(this.moveRaf),document.getElementById(b)?.remove()}onMessage=e=>{if(e.source!==this.frame.contentWindow||e.origin!==this.frameOrigin)return;let t=e.data;if(a(t))switch(t.type){case`ready`:{this.ready=!0;let e=[...this.pending.values()];this.pending.clear();for(let t of e)this.send(t);this.send({channel:s,type:`shrunk`,shrunk:this.state.shrunk});break}case`close`:this.close();break;case`move`:if(this.pendingDx+=t.dx,this.pendingDy+=t.dy,this.moveRaf!==null)break;this.moveRaf=requestAnimationFrame(()=>{this.moveRaf=null,this.flushMove()});break;case`persist`:this.flushMove(),this.layout(),this.persist();break;case`setShrunk`:this.setShrunk(t.shrunk)}}};function k(e){window.postMessage(i(e),location.origin)}function A(t){window.postMessage(e(t),location.origin)}var j=/^\/problems\/[^/]+/,M=null,N=`absent`,P=!1;function F(){k(P),A(P)}function I(){N=`loading`;let e=document.createElement(`script`);e.src=chrome.runtime.getURL(`injected.js`),e.async=!1,e.addEventListener(`load`,()=>{e.remove(),N=`loaded`,F()}),(document.head??document.documentElement).prepend(e)}function L(e){P=e,N===`loaded`?F():N===`absent`&&e&&I()}function R(){return j.test(location.pathname)}function z(){L(M?.isOpen===!0)}function B(){if(M)return;let e=new O(chrome.runtime.getURL(`src/panel/index.html`),{onOpenChange:z});M=e,Promise.all([e.restored,t()]).then(([,t])=>{M===e&&(t&&!e.isOpen&&e.open(),z())})}function V(){L(!1),M?.destroy(),M=null}function H(e){M?.isOpen&&M.send({channel:s,type:`snapshot`,payload:e})}function U(){M?.send({channel:s,type:`clear`})}window.addEventListener(`message`,e=>{if(e.source!==window||e.origin!==location.origin)return;let t=e.data;r(t)&&(t.type===`clear`?U():H(t.payload))}),chrome.runtime.onMessage.addListener(e=>{e?.type===`graphy:toggle`&&(M?M.toggle():B())});function W(){let e=location.pathname;navigation.addEventListener(`currententrychange`,()=>{location.pathname!==e&&(e=location.pathname,R()?(B(),z()):(U(),V()))})}function G(){R()&&B(),W()}document.readyState===`loading`?document.addEventListener(`DOMContentLoaded`,G,{once:!0}):G();