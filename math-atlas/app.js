import { nodes, overviewNodes, relationsFor, detailByNode, depthLabel, safeSourceUrl } from "./data.js?v=14";
import { layers } from "./taxonomy.js";
import { loadBranchSources } from "./content.js?v=14";
import { clampScale } from "./transform.js?v=12";
import { depths, layoutNodes, interpolateCamera, zoomAt, visibleMapBounds, placeRelations } from "./layout.js?v=15";

const $ = (selector) => document.querySelector(selector);
const viewport = $("#icebergViewport");
const scene = $("#scene");
const nodesLayer = $("#nodesLayer");
const focusLayer = $("#focusLayer");
const focusUi = $("#focusUi");
const graph = $("#graphLines");
const panel = $("#discussionPanel");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let camera = { scale: 1, tx: 0, ty: 0 };
let selectedId = null;
let anchor = null;
let snapshot = null;
let cameraFrame = 0;
let viewportFrame = 0;
let readingScroll = null;
let currentRelations = [];
let layout = [];
let mapSize = { width: viewport.clientWidth, height: viewport.clientHeight };
let lastMapScroll = 0;
let sourceRequest = 0;

function nodeById(id) { return nodes.find(node => node.id === id); }
function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function nodeElement(node, className = "node", tag = "button") {
  const el = element(tag, className);
  if (tag === "button") el.type = "button";
  el.dataset.nodeId = node.id;
  el.dataset.depth = node.depth;
  el.setAttribute("aria-label", "探索" + node.label);
  el.append(element("span", "node-orb"), element("span", "node-label", node.label));
  el.querySelector(".node-orb").setAttribute("aria-hidden", "true");
  return el;
}
function elementAnchor(el) {
  const rect = el.getBoundingClientRect();
  const map = viewport.getBoundingClientRect();
  return { x: rect.left + rect.width / 2 - map.left, y: rect.top + rect.height / 2 - map.top };
}
function renderOverview() {
  mapSize = { width: viewport.clientWidth, height: viewport.clientHeight };
  layout = layoutNodes(overviewNodes, viewport.clientWidth);
  nodesLayer.replaceChildren(...layout.map(node => {
    const button = nodeElement(node);
    button.style.left = node.x + "%";
    button.style.top = node.y + "%";
    button.addEventListener("click", () => selectNode(node.id, elementAnchor(button)));
    return button;
  }));
}
function paintCamera() {
  scene.style.transform = `translate3d(${camera.tx}px,${camera.ty}px,0) scale(${camera.scale})`;
}
function animateCamera(target, duration = 620) {
  cancelAnimationFrame(cameraFrame);
  const from = { ...camera };
  const started = performance.now();
  if (reducedMotion.matches) { camera = target; paintCamera(); return; }
  function frame(now) {
    const progress = Math.min(1, (now - started) / duration);
    camera = interpolateCamera(from, target, progress);
    paintCamera();
    if (progress < 1) cameraFrame = requestAnimationFrame(frame);
  }
  cameraFrame = requestAnimationFrame(frame);
}
function buildRelations(node) {
  return relationsFor(node.id).map(item => ({ id: item.id, label: item.label }));
}
function renderDiscussion(node) {
  const detail = detailByNode[node.id];
  $("#discussionTitle").textContent = node.label;
  $("#nodeSummary").textContent = detail.summary;
  $("#discussionList").replaceChildren(...detail.discussions.map(item => {
    const article = element("article", "discussion-card");
    const url = safeSourceUrl(item.url);
    const title = element("h3", "", item.title);
    if (url) {
      const link = element("a", "source-link", item.title);
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      title.replaceChildren(link);
    }
    article.append(title, element("p", "", item.summary),
      element("small", "", url ? "知乎原文 ↗" : "原文暂不可用"));
    return article;
  }));
  if (!detail.discussions.length) {
    $("#discussionList").append(element("p", "empty-content", node.kind === "topic" ?
      "请选择上方具体分支，查看对应的知乎内容。" : "这个分支的内容正在整理，暂未发布已核验的匹配。"));
  }
  $("#relatedList").replaceChildren(...currentRelations.map(item => {
    const link = element(item.id ? "button" : "span", item.id ? "related-link" : "related-info", item.label);
    if (item.id) {
      link.type = "button";
      link.setAttribute("aria-label", "探索" + item.label);
      link.addEventListener("click", () => {
        // A reading-list item is not a map coordinate: return to the current map anchor.
        if (panel.classList.contains("is-below")) returnToMap();
        selectNode(item.id, { ...anchor });
      });
    }
    return link;
  }));
  if (node.kind === "branch") renderSources(node);
}
async function renderSources(node) {
  const request = ++sourceRequest;
  $("#discussionList").replaceChildren(element("p", "empty-content", "正在读取内容…"));
  try {
    const sources = await loadBranchSources(node.id);
    if (selectedId !== node.id || request !== sourceRequest) return;
    if (!sources.length) {
      $("#discussionList").replaceChildren(element("p", "empty-content", "这个分支的内容正在整理，暂未发布已核验的匹配。"));
      return;
    }
    $("#discussionList").replaceChildren(...sources.map(source => {
      const article = element("article", "discussion-card");
      const title = element("h3", "");
      const link = element("a", "source-link", source.title);
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      title.append(link);
      article.append(title, element("p", "", source.summary), element("small", "", "知乎原文 ↗"));
      return article;
    }));
  } catch {
    if (selectedId !== node.id || request !== sourceRequest) return;
    const retry = element("button", "related-link", "重新加载");
    retry.type = "button";
    retry.addEventListener("click", () => renderSources(node));
    $("#discussionList").replaceChildren(element("p", "empty-content", "内容暂时无法加载，请稍后重试。"), retry);
  }
}
function selectPanelSide() {
  const width = viewport.clientWidth;
  const isBelow = width < 1100 || window.innerHeight < 650;
  panel.classList.toggle("is-below", isBelow);
  panel.classList.toggle("on-right", !isBelow && anchor.x < width / 2);
  panel.hidden = false;
  $("#readDiscussions").hidden = !isBelow;
  $("#readDiscussions").textContent = nodeById(selectedId).kind === "topic" ?
    `全部 ${currentRelations.length} 个分支 ↓` : "查看知乎内容 ↓";
}
function drawFocus() {
  if (!selectedId || readingScroll !== null) return;
  const node = nodeById(selectedId);
  const rect = viewport.getBoundingClientRect();
  const width = viewport.clientWidth;
  const bounds = visibleMapBounds(rect, window.innerHeight, width);
  selectPanelSide();
  if (!panel.classList.contains("is-below")) {
    if (panel.classList.contains("on-right")) bounds.right -= 370;
    else bounds.left += 370;
  }
  updateHud(rect);
  graph.setAttribute("viewBox", `0 0 ${width} ${viewport.clientHeight}`);
  graph.replaceChildren();
  focusLayer.replaceChildren();
  const marker = nodeElement(node, "focus-node selected", "div");
  marker.tabIndex = -1;
  marker.setAttribute("role", "group");
  marker.style.left = anchor.x + "px";
  marker.style.top = anchor.y + "px";
  marker.classList.toggle("label-left", anchor.x > width - 150);
  marker.setAttribute("aria-label", "当前知识点：" + node.label);
  marker.append(element("small", "current-label", "当前知识点"));
  focusLayer.append(marker);
  const labelRect = marker.querySelector(".node-label").getBoundingClientRect();
  const exclusion = { left: Math.min(anchor.x - 54, labelRect.left - rect.left),
    right: Math.max(anchor.x + 54, labelRect.right - rect.left), top: anchor.y - 54, bottom: anchor.y + 54 };
  const positions = placeRelations(anchor, currentRelations.length, bounds, width <= 540, exclusion);
  positions.forEach((point, index) => {
    const relation = currentRelations[index];
    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    line.classList.add(relation.id ? "knowledge-link" : "information-link");
    line.setAttribute("d", `M${anchor.x},${anchor.y} Q${(anchor.x + point.x) / 2},${anchor.y} ${point.x},${point.y}`);
    graph.append(line);
    const button = relation.id ? nodeElement(nodeById(relation.id), "focus-node is-action") : element("div", "focus-node is-static");
    if (!relation.id) button.append(element("span", "node-orb"), element("span", "node-label", relation.label));
    button.append(element("small", "", relation.id ? "点击探索" : "关系信息 · 仅展示"));
    button.style.left = point.x + "px";
    button.style.top = point.y + "px";
    if (relation.id) {
      button.addEventListener("click", () => selectNode(relation.id, elementAnchor(button)));
    }
    focusLayer.append(button);
  });
  $("#depthPosition").textContent = depthLabel[node.depth];
  document.querySelectorAll(".mini-bands i").forEach((item, index) => item.classList.toggle("is-active", index === depths.indexOf(node.depth)));
}
function updateHud(rect = viewport.getBoundingClientRect()) {
  focusUi.style.setProperty("--ui-top", Math.max(16, -rect.top + 16) + "px");
  focusUi.style.setProperty("--ui-bottom", Math.min(rect.height - 64, window.innerHeight - rect.top - 66) + "px");
  if (anchor && anchor.y + rect.top > 100 && anchor.y + rect.top < window.innerHeight - 80) lastMapScroll = window.scrollY;
}
function selectNode(id, point) {
  if (id === selectedId) return;
  const first = selectedId === null;
  if (first) snapshot = { scroll: window.scrollY, firstId: id };
  selectedId = id;
  const viewportRect = viewport.getBoundingClientRect();
  const top = Math.max(0, -viewportRect.top) + 170;
  const bottom = Math.min(viewport.clientHeight, window.innerHeight - viewportRect.top) - 140;
  anchor = { x: point.x, y: Math.max(top, Math.min(bottom, point.y)) };
  lastMapScroll = window.scrollY;
  currentRelations = buildRelations(nodeById(id));
  nodesLayer.inert = true;
  viewport.classList.add("has-selection");
  focusUi.hidden = false;
  renderDiscussion(nodeById(id));
  const current = nodeById(id);
  $("#breadcrumb").textContent = depthLabel[current.depth] + " / " +
    (current.parentId ? nodeById(current.parentId).label + " / " : "") + current.label;
  drawFocus();
  const scale = first ? (viewport.clientWidth <= 540 ? 1.7 : 2.2) : clampScale(camera.scale + .16);
  animateCamera(zoomAt(camera, anchor, scale));
  updateZoomControls(scale);
  $("#announcement").textContent = "已展开" + nodeById(id).label + "，可探索关联知识或查看讨论。";
  focusLayer.querySelector(".selected")?.focus({ preventScroll: true });
}
function resetOverview() {
  if (!selectedId) return;
  const saved = snapshot;
  selectedId = null;
  anchor = null;
  readingScroll = null;
  focusUi.hidden = true;
  panel.hidden = true;
  nodesLayer.inert = false;
  viewport.classList.remove("has-selection");
  animateCamera({ scale: 1, tx: 0, ty: 0 }, 420);
  window.scrollTo({ top: saved.scroll, behavior: "instant" });
  const button = nodesLayer.querySelector(`[data-node-id="${saved.firstId}"]`);
  button?.focus({ preventScroll: true });
  snapshot = null;
  $("#announcement").textContent = "已返回七层全景。";
}
function updateZoomControls(scale) {
  $("#zoomIn").disabled = scale >= 2.6;
  $("#zoomOut").disabled = scale <= 1.25;
}
function changeZoom(delta) {
  if (!selectedId) return;
  const scale = clampScale(camera.scale + delta);
  animateCamera(zoomAt(camera, anchor, scale), 320);
  updateZoomControls(scale);
}
function returnToMap() {
  window.scrollTo({ top: readingScroll ?? lastMapScroll, behavior: "instant" });
  readingScroll = null;
  drawFocus();
  $("#readDiscussions").focus({ preventScroll: true });
}
$("#readDiscussions").addEventListener("click", () => {
  readingScroll = window.scrollY;
  panel.scrollIntoView({ behavior: "instant", block: "start" });
  panel.focus({ preventScroll: true });
});
$("#returnToMap").addEventListener("click", returnToMap);
$("#backButton").addEventListener("click", resetOverview);
$("#zoomIn").addEventListener("click", () => changeZoom(.2));
$("#zoomOut").addEventListener("click", () => changeZoom(-.2));
window.addEventListener("keydown", event => {
  if (event.key === "Escape" && selectedId) resetOverview();
});
window.addEventListener("scroll", () => {
  cancelAnimationFrame(viewportFrame);
  viewportFrame = requestAnimationFrame(() => {
    if (selectedId && readingScroll === null) updateHud();
  });
}, { passive: true });
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const oldSize = mapSize;
    const focusedId = focusLayer.contains(document.activeElement) ? document.activeElement.dataset.nodeId : null;
    renderOverview();
    if (selectedId) {
      cancelAnimationFrame(cameraFrame);
      const world = { x: (anchor.x - camera.tx) / camera.scale / oldSize.width,
        y: (anchor.y - camera.ty) / camera.scale / oldSize.height };
      anchor = { x: Math.max(32, Math.min(mapSize.width - 32, anchor.x / oldSize.width * mapSize.width)),
        y: Math.max(130, Math.min(mapSize.height - 100, anchor.y / oldSize.height * mapSize.height)) };
      camera = { ...camera, tx: anchor.x - world.x * mapSize.width * camera.scale,
        ty: anchor.y - world.y * mapSize.height * camera.scale };
      paintCamera();
      drawFocus();
      if (focusedId) focusLayer.querySelector(`[data-node-id="${focusedId}"]`)?.focus({ preventScroll: true });
    }
  }, 120);
});
$(".layer-labels").replaceChildren(...layers.map((layer, index) => {
  const item = element("li", "");
  item.dataset.depth = layer.id;
  item.style.setProperty("--layer-y", `${index * 100 / 7 + 2.7}%`);
  const text = element("div", "");
  text.append(element("h2", "", layer.label), element("p", "", layer.subtitle));
  item.append(element("span", "", String(index + 1).padStart(2, "0")), text);
  return item;
}));
$(".mini-bands").replaceChildren(...layers.map(() => element("i", "")));
renderOverview();

async function updateDatasetBadge() {
  const badge = $("#datasetBadge");
  if (!badge) return;
  try {
    const response = await fetch("./content-index.json", { cache: "no-cache" });
    if (!response.ok) return;
    const index = await response.json();
    if (!Number.isSafeInteger(index.totalContents) ||
        !Number.isSafeInteger(index.completedContents) ||
        !Number.isSafeInteger(index.publishedContents)) return;
    const published = index.publishedContents.toLocaleString("zh-CN");
    const completed = index.completedContents.toLocaleString("zh-CN");
    const total = index.totalContents.toLocaleString("zh-CN");
    badge.textContent = window.innerWidth <= 1300
      ? `200 分支 · ${published} 篇已关联`
      : `200 个知识分支 · ${published} 篇已关联 · ${completed}/${total} 篇已审读`;
  } catch {
    // The existing static count remains if the optional progress fetch fails.
  }
}

updateDatasetBadge();
