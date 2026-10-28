import { layers, topics, allNodes } from "./taxonomy.js";

export const nodes = allNodes;
export const overviewNodes = topics;
export const depthLabel = Object.fromEntries(layers.map((layer, index) =>
  [layer.id, `${String(index + 1).padStart(2, "0")} ${layer.label}｜${layer.subtitle}`]));
export const detailByNode = Object.fromEntries(nodes.map(node => [node.id, {
  summary: node.kind === "topic" ? `展开 ${node.children.length} 个分支，选择你感兴趣的知识。` :
    `${topics.find(topic => topic.id === node.parentId).label} · ${node.label}`,
  discussions: []
}]));

export function relationsFor(id) {
  const node = nodes.find(item => item.id === id);
  if (!node) return [];
  if (node.kind === "topic") return node.children;
  const parent = topics.find(item => item.id === node.parentId);
  return [parent, ...parent.children.filter(item => item.id !== id)];
}

export function safeSourceUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash &&
      ((url.hostname === "www.zhihu.com" && /^\/answer\/\d+$/.test(url.pathname)) ||
       (url.hostname === "zhuanlan.zhihu.com" && /^\/p\/\d+$/.test(url.pathname))) ? url.href : null;
  } catch { return null; }
}
