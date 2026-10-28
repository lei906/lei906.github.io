// Reflect overshoot as well as direction, including multiple collisions in one step.
export function advanceAxis(position, velocity, seconds, limit) {
  if (limit <= 0) return { position: 0, velocity };
  const start = Math.max(0, Math.min(limit, position));
  const raw = start + velocity * Math.max(0, seconds);
  const phase = ((raw % (2 * limit)) + 2 * limit) % (2 * limit);
  if (phase === 0) return { position: 0, velocity: Math.abs(velocity) };
  if (phase === limit) return { position: limit, velocity: -Math.abs(velocity) };
  return phase < limit ? { position: phase, velocity } : { position: 2 * limit - phase, velocity: -velocity };
}

export function advanceWindow(state, seconds, bounds) {
  const x = advanceAxis(state.x, state.vx, seconds, bounds.x);
  const y = advanceAxis(state.y, state.vy, seconds, bounds.y);
  return { x: x.position, y: y.position, vx: x.velocity, vy: y.velocity };
}
