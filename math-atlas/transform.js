export function computeAnchoredTransform(width, height, node, scale, layout = {}) {
  const anchorX = width * node.x / 100;
  const anchorY = height * node.y / 100;
  const targetX = layout.targetX ?? anchorX;
  const targetY = layout.targetY ?? anchorY;
  const offsetLeft = layout.offsetLeft ?? 0;
  const offsetTop = layout.offsetTop ?? 0;

  return {
    tx: targetX - offsetLeft - anchorX * scale,
    ty: targetY - offsetTop - anchorY * scale
  };
}

export function relatedNodeIds(edges, selectedId) {
  return new Set(
    edges
      .filter(([fromId, toId]) => fromId === selectedId || toId === selectedId)
      .flat()
      .filter((nodeId) => nodeId !== selectedId)
  );
}

export function relativeCenter(rect, containerRect) {
  return {
    targetX: rect.left + rect.width / 2 - containerRect.left,
    targetY: rect.top + rect.height / 2 - containerRect.top
  };
}

export function isExplorableNode(selected, related) {
  return selected || related;
}

export function projectRelativePoint(anchor, deltaPercent, sceneSize, scale) {
  return anchor + deltaPercent / 100 * sceneSize * scale;
}

export function resolveResizeScale(currentScale, responsiveScale, userAdjustedScale) {
  return userAdjustedScale ? currentScale : responsiveScale;
}

export function clampScale(scale, min = 1.25, max = 2.6) {
  return Math.min(max, Math.max(min, scale));
}

export function computeMinimapFocus(layout, transform, mapWidth = 120, mapHeight = 88) {
  const { sceneWidth, sceneHeight, viewportWidth, viewportHeight, offsetLeft, offsetTop } = layout;
  const { tx, ty, scale } = transform;
  const width = viewportWidth / scale / sceneWidth * mapWidth;
  const height = viewportHeight / scale / sceneHeight * mapHeight;
  const x = (-offsetLeft - tx) / scale / sceneWidth * mapWidth;
  const y = (-offsetTop - ty) / scale / sceneHeight * mapHeight;

  return {
    x: Math.max(0, Math.min(mapWidth - width, x)),
    y: Math.max(0, Math.min(mapHeight - height, y)),
    width,
    height
  };
}
