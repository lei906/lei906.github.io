import { advanceWindow } from "./floating-motion.js?v=1";

// The supplied artwork is preserved; CSS frames its illustration below live window controls.
export const floatingContent = Object.freeze({
  href: "https://www.zhihu.com/question/22212241",
  image: "./assets/math-jokes-window.png",
  alt: "数学趣味梗图：三个人物互相指着对方，分别写着显然、做梦、易证"
});

const floater = document.createElement("aside");
floater.className = "floating-window";
floater.setAttribute("aria-label", "知乎悬浮推荐");
const titlebar = document.createElement("header");
titlebar.className = "floating-window-titlebar";
const icon = document.createElement("span");
icon.className = "floating-window-icon";
icon.setAttribute("aria-hidden", "true");
const title = document.createElement("span");
title.className = "floating-window-title";
title.textContent = "数学趣闻";
titlebar.append(icon, title);
const link = document.createElement("a");
link.className = "floating-window-link";
link.href = floatingContent.href;
link.target = "_blank";
link.rel = "noopener noreferrer";
link.setAttribute("aria-label", "打开知乎问题：数学领域有哪些经典的笑话？（新标签页）");
const picture = document.createElement("img");
picture.src = floatingContent.image;
picture.alt = floatingContent.alt;
picture.draggable = false;
const headline = document.createElement("span");
headline.className = "floating-window-headline";
headline.append("数学领域有哪些", document.createElement("br"), "经典的笑话？");
const artwork = document.createElement("span");
artwork.className = "floating-window-artwork";
artwork.append(picture);
link.append(headline, artwork);
const pause = document.createElement("button");
pause.type = "button";
pause.className = "floating-window-pause";
const close = document.createElement("button");
close.type = "button";
close.className = "floating-window-close";
close.textContent = "×";
close.setAttribute("aria-label", "关闭悬浮推荐");
titlebar.append(pause, close);
floater.append(titlebar, link);
document.body.append(floater);

const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const pausedBy = new Set(motionPreference.matches ? ["manual"] : []);
let state = { x: 0, y: 0, vx: 42, vy: 30 };
let bounds = { x: 0, y: 0 };
let frame = 0;
let lastTime = null;
let dismissed = false;
const map = document.querySelector("#icebergViewport");

function paint() {
  floater.style.transform = `translate3d(${state.x}px,${state.y}px,0)`;
}
function updateBounds(initial = false) {
  bounds = { x: Math.max(0, window.innerWidth - floater.offsetWidth),
    y: Math.max(0, window.innerHeight - floater.offsetHeight) };
  state = { ...state, x: initial ? bounds.x * .8 : Math.min(state.x, bounds.x),
    y: initial ? Math.min(100, bounds.y) : Math.min(state.y, bounds.y) };
  paint();
}
function tick(time) {
  frame = 0;
  if (pausedBy.size || dismissed) return;
  const seconds = lastTime === null ? 0 : Math.min((time - lastTime) / 1000, .05);
  lastTime = time;
  state = advanceWindow(state, seconds, bounds);
  paint();
  frame = requestAnimationFrame(tick);
}
function syncAnimation() {
  cancelAnimationFrame(frame);
  frame = 0;
  lastTime = null;
  pause.textContent = pausedBy.has("manual") ? "▶" : "Ⅱ";
  pause.setAttribute("aria-label", pausedBy.has("manual") ? "继续悬浮窗运动" : "暂停悬浮窗运动");
  pause.title = pause.getAttribute("aria-label");
  pause.setAttribute("aria-pressed", String(pausedBy.has("manual")));
  if (!pausedBy.size && !dismissed) frame = requestAnimationFrame(tick);
}
function setPaused(reason, value) {
  if (value) pausedBy.add(reason);
  else pausedBy.delete(reason);
  syncAnimation();
}
floater.addEventListener("pointerenter", event => {
  if (event.pointerType !== "touch") setPaused("hover", true);
});
floater.addEventListener("pointerleave", () => setPaused("hover", false));
floater.addEventListener("pointerdown", () => setPaused("pointer", true));
window.addEventListener("pointerup", () => {
  if (pausedBy.has("pointer")) setPaused("pointer", false);
});
window.addEventListener("pointercancel", () => {
  if (pausedBy.has("pointer")) setPaused("pointer", false);
});
floater.addEventListener("focusin", () => setPaused("focus", true));
floater.addEventListener("focusout", event => {
  if (!floater.contains(event.relatedTarget)) setPaused("focus", false);
});
pause.addEventListener("click", () => setPaused("manual", !pausedBy.has("manual")));
close.addEventListener("click", () => {
  dismissed = true;
  syncAnimation();
  floater.hidden = true;
  mapObserver?.disconnect();
  document.querySelector(".brand")?.focus({ preventScroll: true });
});
document.addEventListener("visibilitychange", () => setPaused("background", document.hidden));
window.addEventListener("resize", () => {
  if (!floater.hidden) updateBounds();
});
motionPreference.addEventListener("change", event => setPaused("manual", event.matches));
function syncMap() {
  const exploring = map?.classList.contains("has-selection") || false;
  floater.hidden = dismissed || exploring;
  if (exploring) {
    pausedBy.delete("hover");
    pausedBy.delete("focus");
    pausedBy.delete("pointer");
  }
  if (!floater.hidden) updateBounds();
  setPaused("exploring", exploring);
}
const mapObserver = map ? new MutationObserver(syncMap) : null;
mapObserver?.observe(map, { attributes: true, attributeFilter: ["class"] });
updateBounds(true);
if (document.hidden) pausedBy.add("background");
syncMap();
