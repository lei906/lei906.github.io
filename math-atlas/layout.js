import { layers } from "./taxonomy.js";
export const depths = layers.map(layer => layer.id);

// Fixed compositions preserve spatial memory without falling into a repeated grid.
const sparseDesktop = [[35, 4.1], [58, 2.9], [78, 6], [44, 9.4], [67, 10.8]];
const denseDesktop = [[33, 2.5], [54, 3.1], [77, 2.7], [39, 6.3], [61, 6.9],
  [80, 6], [32, 10.3], [52, 11.2], [74, 10.4]];
const sparseMobile = [[12, 4.8], [57, 5.8], [18, 8.1], [60, 9.3], [32, 11.5]];
const denseMobile = [[10, 4.3], [57, 5.2], [16, 6.3], [61, 7.1], [9, 8.3],
  [54, 9.1], [18, 10.3], [60, 11.2], [12, 12.3]];

export function layoutNodes(nodes, width) {
  const counts = new Map();
  const totals = new Map(depths.map(depth => [depth, nodes.filter(node => node.depth === depth).length]));
  return nodes.map(node => {
    const layer = depths.indexOf(node.depth);
    const order = counts.get(layer) || 0;
    counts.set(layer, order + 1);
    const compact = width <= 540;
    const dense = totals.get(node.depth) > 5;
    const composition = compact ? (dense ? denseMobile : sparseMobile) : (dense ? denseDesktop : sparseDesktop);
    const [baseX, offsetY] = composition[order];
    const variation = [0, -2, 1, -1, 2, -3, 1][layer];
    const x = baseX + variation;
    const top = layer * 100 / 7;
    const y = top + offsetY + (layer % 2 ? .25 : 0);
    return { ...node, x, y };
  });
}

export function interpolateCamera(from, to, progress) {
  const t = 1 - Math.pow(1 - progress, 3);
  return { scale: from.scale + (to.scale - from.scale) * t,
    tx: from.tx + (to.tx - from.tx) * t,
    ty: from.ty + (to.ty - from.ty) * t };
}

export function zoomAt(camera, anchor, scale) {
  const ratio = scale / camera.scale;
  return { scale, tx: anchor.x - (anchor.x - camera.tx) * ratio,
    ty: anchor.y - (anchor.y - camera.ty) * ratio };
}

export function visibleMapBounds(rect, viewportHeight, width) {
  return { left: 20, right: width - 20,
    top: Math.max(0, -rect.top) + 130,
    bottom: Math.min(rect.height, viewportHeight - rect.top) - 100 };
}

// Reserve full text bounds; skip candidates that do not fit instead of clamping them together.
export function placeRelations(anchor, count, bounds, compact = false, exclusion = null) {
  const halfWidth = compact ? 68 : 88;
  const candidates = [];
  const stepX = compact ? 100 : 175;
  const stepY = compact ? 108 : 155;
  for (let row = -3; row <= 3; row += 1) {
    for (let col = -3; col <= 3; col += 1) {
      if (!row && !col) continue;
      const x = anchor.x + col * stepX;
      const y = anchor.y + row * stepY;
      if (x - halfWidth < bounds.left || x + halfWidth > bounds.right ||
          y - 65 < bounds.top || y + 50 > bounds.bottom) continue;
      if (exclusion && x + halfWidth + 12 > exclusion.left && x - halfWidth - 12 < exclusion.right &&
          y + 50 + 12 > exclusion.top && y - 65 - 12 < exclusion.bottom) continue;
      candidates.push({ x, y, distance: Math.hypot(x - anchor.x, y - anchor.y) });
    }
  }
  const sorted = candidates.toSorted((a, b) => a.distance - b.distance);
  const placed = [];
  for (const point of sorted) {
    if (placed.length === count) break;
    if (placed.some(other => Math.abs(other.x - point.x) < halfWidth * 2 + 12 && Math.abs(other.y - point.y) < 100)) continue;
    placed.push(point);
  }
  return placed;
}
