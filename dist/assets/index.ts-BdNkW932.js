import{a as e,c as t,h as n,n as r,o as i,r as a,s as o,t as s,u as c}from"./protocol-Bj6fm7vz.js";function l(){return{top:0,right:46,width:40,height:40}}function u(e){let t=l();return{left:e.x+e.width-t.right-t.width,top:e.y+t.top}}var d=`cubic-bezier(0.16, 1, 0.3, 1)`;function f(e,t){for(let[n,r]of Object.entries(t))e.style.setProperty(n,r)}function p(){let e=new WeakMap;return(t,n)=>{let r=e.get(t);r||(r=new Map,e.set(t,r));for(let[e,i]of Object.entries(n))r.get(e)!==i&&(r.set(e,i),t.style.setProperty(e,i))}}function m(e,t){return[{clipPath:e},{clipPath:t}]}function h(e,t,n=!1){return`inset(0px 0px ${!t||n?0:Math.max(0,e-40)}px 0px round 12px)`}function g(e,t){return!e.open||e.shrunk||!t}function _(e,t=!1){return{iframe:{width:e.width,height:e.height},shell:{width:e.width,height:e.shrunk&&t?40:e.height},clipPath:h(e.height,e.shrunk,t)}}function v(e,t,n,r={}){let i=r.settle===!0,a=r.write??f,{shell:o,iframe:s,clipPath:c}=_(n,i),l=String(n.open);e.dataset.open!==l&&(e.dataset.open=l);let u={left:`${n.x}px`,top:`${n.y}px`,width:`${o.width}px`,height:`${o.height}px`};r.clipPath!==!1&&(u[`clip-path`]=i?c:r.clipPath??c),a(e,u),a(t,{width:`${s.width}px`,height:`${s.height}px`})}var y=[`nw`,`ne`,`sw`,`se`];function b(e,t){let n=Math.min(Math.max(280,e.width),Math.max(280,t.width)),r=Math.min(Math.max(180,e.height),Math.max(180,t.height));return{x:Math.min(Math.max(0,e.x),Math.max(0,t.width-n)),y:Math.min(Math.max(0,e.y),Math.max(0,t.height-r)),width:n,height:r}}function x(e,t=`se`){return{left:t.includes(`w`)?e.x:e.x+e.width-16,top:t.includes(`n`)?e.y:e.y+e.height-16}}function S(e,t,n,r,i,a){t<n&&(t=n,i&&(e=a-t)),e<0&&(e=0,i&&(t=a));let o=Math.max(n,r-e);return t>o&&(t=o,i&&(e=a-t)),{pos:e,size:t}}function C(e,t,n,r){let i=t.includes(`w`),a=t.includes(`n`),o=e.x+e.width,s=e.y+e.height,c=i?e.x+n.dx:e.x,l=a?e.y+n.dy:e.y,u=i?o-c:e.width+n.dx,d=a?s-l:e.height+n.dy;return{pos:c,size:u}=S(c,u,280,r.width,i,o),{pos:l,size:d}=S(l,d,180,r.height,a,s),{x:c,y:l,width:u,height:d}}var w=l(),T=`graphy-root`,E=`
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
.shrink-hit,
.resize-hit {
  appearance: none;
  -webkit-appearance: none;
  position: fixed;
  z-index: 1;
  padding: 0;
  border: 0;
  background: transparent;
  touch-action: none;
}
.shrink-hit {
  width: ${w.width}px;
  height: ${w.height}px;
  cursor: pointer;
}
.resize-hit {
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
}
.resize-hit[data-corner="ne"],
.resize-hit[data-corner="sw"] { cursor: nesw-resize; }
.shrink-hit[hidden],
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
`,D={nw:`Resize panel from top left`,ne:`Resize panel from top right`,sw:`Resize panel from bottom left`,se:`Resize panel from bottom right`};function O(e,t){e.set(t.type===`shrunk`?`shrunk`:`content`,t)}function k(e,t){let n=document.createElement(`button`);return n.className=e,n.type=`button`,t&&n.setAttribute(`aria-label`,t),n}function A(e,t,n){e.getAttribute(t)!==n&&e.setAttribute(t,n)}function j(e,t){e.hidden!==t&&(e.hidden=t)}var M=class{frameUrl;options;root;frameOrigin;write=p();layer;shell;frame;shrinkHit;resizeHits;launcher;resizing=null;state={...o};anchor={x:0,y:0};ready=!1;pending=new Map;saveTimer;clipAnim;clipSettled=!0;resizePointerId;resizeRaf=null;moveRaf=null;pendingDx=0;pendingDy=0;restored;constructor(e,t={}){this.frameUrl=e,this.options=t;let n=new URL(e);this.frameOrigin=`${n.protocol}//${n.host}`,document.getElementById(T)?.remove();let r=document.createElement(`div`);r.id=T,r.style.cssText=`all: initial; position: static;`,this.root=r.attachShadow({mode:`closed`}),(document.body??document.documentElement).appendChild(r),this.restored=this.build()}async build(){let e=document.createElement(`style`);e.textContent=E,this.layer=document.createElement(`div`),this.layer.className=`layer`,this.shell=document.createElement(`div`),this.shell.className=`shell`,this.shell.dataset.open=`false`,this.frame=document.createElement(`iframe`),this.frame.setAttribute(`title`,`Graphy visualizer`),this.shell.appendChild(this.frame),this.shrinkHit=k(`shrink-hit`,`Shrink panel`),this.shrinkHit.addEventListener(`click`,this.onShrinkClick),this.resizeHits={};for(let e of y){let t=k(`resize-hit`,D[e]);t.dataset.corner=e,t.addEventListener(`pointerdown`,this.onResizePointerDown),this.resizeHits[e]=t}this.launcher=k(`launcher`),this.launcher.textContent=`Graphy`,this.launcher.addEventListener(`click`,()=>this.open()),this.layer.append(this.shell,this.shrinkHit,...y.map(e=>this.resizeHits[e])),this.root.append(e,this.layer,this.launcher),window.addEventListener(`message`,this.onMessage),window.addEventListener(`resize`,this.clamp);let t=await c();this.state=t,(t.x<0||t.y<0)&&this.placeDefault(),this.state.open&&this.ensureFrame(),this.clamp()}ensureFrame(){this.frame.getAttribute(`src`)||(this.frame.src=this.frameUrl)}placeDefault(){this.state.x=Math.max(16,window.innerWidth-this.state.width-24),this.state.y=Math.max(16,window.innerHeight-this.state.height-24)}layout(e=this.state,t){v(this.shell,this.frame,{...this.state,...e},{settle:this.clipSettled&&this.state.shrunk,clipPath:t??(this.clipSettled?void 0:!1),write:this.write}),this.anchor={x:e.x,y:e.y},this.write(this.layer,{transform:``}),j(this.launcher,this.state.open),this.syncHits(e)}paintOffset(){let e=this.state.x-this.anchor.x,t=this.state.y-this.anchor.y;this.write(this.layer,{transform:e===0&&t===0?``:`translate3d(${e}px, ${t}px, 0px)`})}apply(){this.clipAnim?.cancel(),this.clipAnim=void 0,this.clipSettled=!0,this.layout()}onShrinkClick=()=>{this.setShrunk(!this.state.shrunk)};setShrunk(e){if(this.state.shrunk===e){this.send({channel:s,type:`shrunk`,shrunk:e});return}this.abortResize();let t=this.state.height,n=h(t,this.state.shrunk);this.state.shrunk=e;let r=h(t,e);this.clipAnim?.cancel(),this.clipSettled=!1,this.layout(this.state,n);let i=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches;this.clipAnim=this.shell.animate(m(n,r),{duration:i?0:160,easing:d,fill:`forwards`}),this.clipAnim.onfinish=()=>{this.clipAnim?.cancel(),this.state.shrunk===e&&(this.clipSettled=!0,this.layout())},this.send({channel:s,type:`shrunk`,shrunk:e}),this.persist()}viewport(){return{width:window.innerWidth,height:window.innerHeight}}clampedBox(){let{x:e,y:t,width:n,height:r,shrunk:i}=this.state,a=b({x:e,y:t,width:n,height:i?40:r},this.viewport());return{x:a.x,y:a.y,width:a.width,height:i?r:a.height}}clamp=()=>{this.resizing||(Object.assign(this.state,this.clampedBox()),this.apply())};moveBy(e,t){if(this.resizing)return;this.state.x+=e,this.state.y+=t;let n=this.clampedBox(),r=n.width!==this.state.width||n.height!==this.state.height;Object.assign(this.state,n),r?this.apply():this.paintOffset()}syncHits(e){let t=u(e);this.write(this.shrinkHit,{left:`${t.left}px`,top:`${t.top}px`}),j(this.shrinkHit,!this.state.open),A(this.shrinkHit,`aria-label`,this.state.shrunk?`Expand panel`:`Shrink panel`),A(this.shrinkHit,`aria-pressed`,String(this.state.shrunk));let n=g(this.state,this.clipSettled);for(let t of y){let r=x(e,t),i=this.resizeHits[t];this.write(i,{left:`${r.left}px`,top:`${r.top}px`}),j(i,n)}}listenResize(e,t){if(t){e.addEventListener(`pointermove`,this.onResizePointerMove),e.addEventListener(`pointerup`,this.onResizePointerUp),e.addEventListener(`pointercancel`,this.onResizePointerUp);return}e.removeEventListener(`pointermove`,this.onResizePointerMove),e.removeEventListener(`pointerup`,this.onResizePointerUp),e.removeEventListener(`pointercancel`,this.onResizePointerUp)}cancelResizeFrame(){this.resizeRaf!==null&&(cancelAnimationFrame(this.resizeRaf),this.resizeRaf=null)}abortResize(){this.cancelResizeFrame();let e=this.resizing?.hit;if(this.resizing&&(this.resizing=null,e&&this.listenResize(e,!1)),this.resizePointerId!==void 0){try{e?.releasePointerCapture(this.resizePointerId)}catch{}this.resizePointerId=void 0}}onResizePointerDown=e=>{if(e.button!==0||this.state.shrunk||!this.clipSettled||this.resizing)return;let t=e.currentTarget;if(!(t instanceof HTMLButtonElement))return;let n=t.dataset.corner;if(y.includes(n)){e.preventDefault(),this.flushMove(),this.layout(),this.resizePointerId=e.pointerId;try{t.setPointerCapture(e.pointerId)}catch{}this.resizing={startX:e.clientX,startY:e.clientY,pointerX:e.clientX,pointerY:e.clientY,x:this.state.x,y:this.state.y,width:this.state.width,height:this.state.height,corner:n,hit:t},this.listenResize(t,!0)}};liveRect(){let e=this.resizing;return C({x:e.x,y:e.y,width:e.width,height:e.height},e.corner,{dx:e.pointerX-e.startX,dy:e.pointerY-e.startY},this.viewport())}trackResizePointer(e){!this.resizing||e.type===`pointercancel`||(this.resizing.pointerX=e.clientX,this.resizing.pointerY=e.clientY)}onResizePointerMove=e=>{this.resizing&&(this.trackResizePointer(e),this.resizeRaf===null&&(this.resizeRaf=requestAnimationFrame(()=>{this.resizeRaf=null,this.resizing&&this.layout(this.liveRect())})))};onResizePointerUp=e=>{if(!this.resizing)return;this.cancelResizeFrame(),this.trackResizePointer(e);let t=this.liveRect();this.listenResize(this.resizing.hit,!1),this.resizing=null,this.resizePointerId=void 0,Object.assign(this.state,t),this.persist(),this.apply()};flushMove(){if(this.moveRaf!==null&&(cancelAnimationFrame(this.moveRaf),this.moveRaf=null),this.pendingDx===0&&this.pendingDy===0)return;let e=this.pendingDx,t=this.pendingDy;this.pendingDx=0,this.pendingDy=0,this.moveBy(e,t)}persist(){window.clearTimeout(this.saveTimer),this.saveTimer=window.setTimeout(()=>void n(this.state),400)}setOpen(e){let t=this.state.open!==e;this.state.open=e,e&&this.ensureFrame(),this.apply(),this.persist(),t&&this.options.onOpenChange?.(e)}open(){this.setOpen(!0)}get isOpen(){return this.state.open}toggle(){this.state.open?this.close():this.open()}close(){this.setOpen(!1)}send(e){if(!this.ready){O(this.pending,e);return}this.frame.contentWindow?.postMessage(e,this.frameOrigin)}destroy(){this.clipAnim?.cancel(),this.abortResize(),this.shrinkHit.removeEventListener(`click`,this.onShrinkClick);for(let e of Object.values(this.resizeHits))e.removeEventListener(`pointerdown`,this.onResizePointerDown);window.removeEventListener(`message`,this.onMessage),window.removeEventListener(`resize`,this.clamp),this.moveRaf!==null&&cancelAnimationFrame(this.moveRaf),document.getElementById(T)?.remove()}onMessage=e=>{if(e.source!==this.frame.contentWindow||e.origin!==this.frameOrigin)return;let t=e.data;if(a(t))switch(t.type){case`ready`:{this.ready=!0;let e=[...this.pending.values()];this.pending.clear();for(let t of e)this.send(t);this.send({channel:s,type:`shrunk`,shrunk:this.state.shrunk});break}case`close`:this.close();break;case`move`:if(this.pendingDx+=t.dx,this.pendingDy+=t.dy,this.moveRaf!==null)break;this.moveRaf=requestAnimationFrame(()=>{this.moveRaf=null,this.flushMove()});break;case`persist`:this.flushMove(),this.layout(),this.persist();break;case`setShrunk`:this.setShrunk(t.shrunk)}}};function N(e){window.postMessage(i(e),location.origin)}function P(t){window.postMessage(e(t),location.origin)}var F=/^\/problems\/[^/]+/,I=null,L=`absent`,R=!1;function z(){N(R),P(R)}function B(){L=`loading`;let e=document.createElement(`script`);e.src=chrome.runtime.getURL(`injected.js`),e.async=!1,e.addEventListener(`load`,()=>{e.remove(),L=`loaded`,z()}),(document.head??document.documentElement).prepend(e)}function V(e){R=e,L===`loaded`?z():L===`absent`&&e&&B()}function H(){return F.test(location.pathname)}function U(){V(I?.isOpen===!0)}function W(){if(I)return;I=new M(chrome.runtime.getURL(`src/panel/index.html`),{onOpenChange:()=>U()});let e=I;Promise.all([e.restored,t()]).then(([,t])=>{I===e&&(t&&!e.isOpen&&e.open(),U())})}function G(){V(!1),I?.destroy(),I=null}function K(e){I?.isOpen&&I.send({channel:s,type:`snapshot`,payload:e})}function q(){I?.send({channel:s,type:`clear`})}window.addEventListener(`message`,e=>{if(e.source!==window||e.origin!==location.origin)return;let t=e.data;r(t)&&(t.type===`clear`?q():K(t.payload))}),chrome.runtime.onMessage.addListener(e=>{e?.type===`graphy:toggle`&&(I?I.toggle():W())});function J(){let e=location.pathname;navigation.addEventListener(`currententrychange`,()=>{location.pathname!==e&&(e=location.pathname,H()?(W(),U()):(q(),G()))})}function Y(){H()&&W(),J()}document.readyState===`loading`?document.addEventListener(`DOMContentLoaded`,Y,{once:!0}):Y();