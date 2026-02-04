export class SimulationCanvas {
  constructor(canvas, hudTimeEl, hudScoreEl) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.hudTimeEl = hudTimeEl;
    this.hudScoreEl = hudScoreEl;

    this.play = null;
    this.entities = [];
    this.routes = [];
    this.objectives = [];
    this.controlledId = null;
    this.selectedRouteId = null;

    this.time = 0;
    this.running = false;
    this.lastFrame = null;
    this.events = [];
    this.score = 0;

    this.view = { x: 0, y: 0, scale: 1 };
    this.activeCollisions = new Set();
    this.zoneStates = new Map();

    this.randomSeed = Date.now();
    this.rng = mulberry32(this.randomSeed);

    this.bindInteractions();
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * devicePixelRatio;
    this.canvas.height = rect.height * devicePixelRatio;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(devicePixelRatio, devicePixelRatio);
  }

  setPlay(play) {
    this.play = play;
    this.entities = play.entities.map((entity) => ({
      ...entity,
      _state: { pathIndex: 0, progress: 0, direction: 1, drift: { x: 0, y: 0 }, jitter: 0 },
    }));
    this.routes = play.routes;
    this.objectives = play.objectives;
    const controlled = this.entities.find((e) => e.behavior === "controlled");
    this.controlledId = controlled?.id ?? null;
    this.selectedRouteId = null;
    this.time = 0;
    this.running = false;
    this.events = [];
    this.score = 0;
    this.activeCollisions.clear();
    this.zoneStates.clear();
    this.randomSeed = Date.now();
    this.rng = mulberry32(this.randomSeed);
    this.render();
  }

  setRoute(routeId) {
    this.selectedRouteId = routeId;
    this.recordEvent("route_selected", { route_id: routeId });
    const entity = this.getControlled();
    if (entity) {
      entity._state.pathIndex = 0;
      entity._state.progress = 0;
    }
  }

  start() {
    if (!this.play) return;
    this.running = true;
    this.lastFrame = null;
    this.recordEvent("start");
    requestAnimationFrame((t) => this.loop(t));
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.recordEvent("stop");
  }

  loop(timestamp) {
    if (!this.running) return;
    if (!this.lastFrame) this.lastFrame = timestamp;
    const delta = (timestamp - this.lastFrame) / 1000;
    this.lastFrame = timestamp;
    this.time += delta;
    this.update(delta);
    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  update(delta) {
    const controlled = this.getControlled();
    this.entities.forEach((entity) => {
      if (entity.behavior === "controlled") {
        this.updateControlled(entity, delta);
      } else if (typeof entity.behavior === "string") {
        if (entity.behavior === "static") return;
      } else if (entity.behavior?.type === "patrol") {
        this.updatePatrol(entity, entity.behavior, delta);
      } else if (entity.behavior?.type === "follow") {
        this.updateFollow(entity, entity.behavior, delta);
      } else if (entity.behavior?.type === "random") {
        this.updateRandom(entity, entity.behavior, delta);
      }
    });

    if (controlled) {
      this.detectCollisions(controlled);
      this.detectZones(controlled);
    }

    this.score = computeScore(this.play, this.events);
    this.hudTimeEl.textContent = this.time.toFixed(1);
    this.hudScoreEl.textContent = this.score.toFixed(1);
  }

  updateControlled(entity, delta) {
    const route = this.routes.find((r) => r.id === this.selectedRouteId);
    if (!route || route.points.length === 0) return;
    moveAlongPath(entity, route.points, 120, delta);
  }

  updatePatrol(entity, behavior, delta) {
    const path = behavior.path || [];
    if (!path.length) return;
    moveAlongPath(entity, path, behavior.speed || 40, delta, true);
  }

  updateFollow(entity, behavior, delta) {
    const target = this.entities.find((e) => e.id === behavior.target);
    if (!target) return;
    const speed = behavior.speed || 50;
    const dx = target.x - entity.x;
    const dy = target.y - entity.y;
    const dist = Math.hypot(dx, dy) || 1;
    entity.x += (dx / dist) * speed * delta;
    entity.y += (dy / dist) * speed * delta;
  }

  updateRandom(entity, behavior, delta) {
    const speed = behavior.speed || 30;
    entity._state.jitter -= delta;
    if (entity._state.jitter <= 0) {
      entity._state.jitter = 0.5 + this.rng() * 1.5;
      const angle = this.rng() * Math.PI * 2;
      entity._state.drift = { x: Math.cos(angle), y: Math.sin(angle) };
    }
    entity.x += entity._state.drift.x * speed * delta;
    entity.y += entity._state.drift.y * speed * delta;
  }

  detectCollisions(controlled) {
    this.entities.forEach((entity) => {
      if (entity.id === controlled.id) return;
      const dist = Math.hypot(entity.x - controlled.x, entity.y - controlled.y);
      const key = `${controlled.id}-${entity.id}`;
      if (dist < entity.radius + controlled.radius) {
        if (!this.activeCollisions.has(key)) {
          this.activeCollisions.add(key);
          this.recordEvent("collision", { with: entity.id });
        }
      } else {
        this.activeCollisions.delete(key);
      }
    });
  }

  detectZones(controlled) {
    this.objectives.forEach((objective) => {
      if (objective.type !== "reach_zone") return;
      const { x, y, radius } = objective.params;
      const dist = Math.hypot(controlled.x - x, controlled.y - y);
      const inside = dist <= radius;
      const wasInside = this.zoneStates.get(objective.id) || false;
      if (inside && !wasInside) {
        this.zoneStates.set(objective.id, true);
        this.recordEvent("entered_zone", { zone_id: objective.id });
      } else if (!inside && wasInside) {
        this.zoneStates.set(objective.id, false);
        this.recordEvent("exit_zone", { zone_id: objective.id });
      }
    });
  }

  recordEvent(type, payload = {}) {
    this.events.push({ t: parseFloat(this.time.toFixed(2)), type, payload });
  }

  render() {
    if (!this.play) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.scale(this.view.scale, this.view.scale);
    ctx.translate(this.view.x, this.view.y);

    drawField(ctx, this.play.canvas.width, this.play.canvas.height);

    this.routes.forEach((route) => {
      ctx.beginPath();
      route.points.forEach((point, idx) => {
        if (idx === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.strokeStyle = route.id === this.selectedRouteId ? route.color : `${route.color}88`;
      ctx.lineWidth = route.id === this.selectedRouteId ? 4 : 2;
      ctx.stroke();
    });

    this.entities.forEach((entity) => {
      ctx.beginPath();
      ctx.arc(entity.x, entity.y, entity.radius, 0, Math.PI * 2);
      ctx.fillStyle = entity.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#0f172a";
      ctx.stroke();

      if (entity.label) {
        ctx.fillStyle = "#f8fafc";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(entity.label, entity.x, entity.y);
      }
    });

    this.objectives.forEach((objective) => {
      if (objective.type !== "reach_zone") return;
      const { x, y, radius } = objective.params;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    ctx.restore();
  }

  bindInteractions() {
    window.addEventListener("resize", () => this.resize());

    let isDragging = false;
    let lastPoint = null;

    this.canvas.addEventListener("pointerdown", (event) => {
      if (event.button === 2) return;
      isDragging = true;
      lastPoint = { x: event.clientX, y: event.clientY };
    });
    this.canvas.addEventListener("pointermove", (event) => {
      if (!isDragging || !lastPoint) return;
      const dx = (event.clientX - lastPoint.x) / this.view.scale;
      const dy = (event.clientY - lastPoint.y) / this.view.scale;
      this.view.x += dx;
      this.view.y += dy;
      lastPoint = { x: event.clientX, y: event.clientY };
      this.render();
    });
    this.canvas.addEventListener("pointerup", () => {
      isDragging = false;
      lastPoint = null;
    });
    this.canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      const zoom = event.deltaY < 0 ? 1.1 : 0.9;
      this.view.scale = Math.min(2.5, Math.max(0.6, this.view.scale * zoom));
      this.render();
    });
  }

  getControlled() {
    return this.entities.find((e) => e.id === this.controlledId);
  }
}

function drawField(ctx, width, height) {
  ctx.fillStyle = "#0f7a3c";
  ctx.fillRect(0, 0, width, height);

  const endZoneWidth = width * 0.1;
  ctx.fillStyle = "#0b5fff";
  ctx.fillRect(0, 0, endZoneWidth, height);
  ctx.fillStyle = "#dc2626";
  ctx.fillRect(width - endZoneWidth, 0, endZoneWidth, height);

  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, width, height);

  const yardCount = 10;
  for (let i = 1; i < yardCount; i += 1) {
    const x = (width / yardCount) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.strokeStyle = i % 2 === 0 ? "rgba(248, 250, 252, 0.45)" : "rgba(248, 250, 252, 0.25)";
    ctx.lineWidth = i % 2 === 0 ? 2 : 1;
    ctx.stroke();
  }

  const hashGap = height * 0.22;
  for (let i = 1; i < yardCount; i += 1) {
    const x = (width / yardCount) * i;
    drawHashMarks(ctx, x, height, hashGap);
  }

  ctx.fillStyle = "rgba(248, 250, 252, 0.6)";
  ctx.font = "18px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("DAILYREAD", endZoneWidth / 2, height / 2);
  ctx.fillText("DAILYREAD", width - endZoneWidth / 2, height / 2);
}

function drawHashMarks(ctx, x, height, gap) {
  const top = height / 2 - gap;
  const bottom = height / 2 + gap;
  ctx.strokeStyle = "rgba(248, 250, 252, 0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, top - 16);
  ctx.lineTo(x, top + 16);
  ctx.moveTo(x, bottom - 16);
  ctx.lineTo(x, bottom + 16);
  ctx.stroke();
}

function moveAlongPath(entity, points, speed, delta, loop = false) {
  if (!points.length) return;
  const state = entity._state;
  let idx = state.pathIndex;
  let target = points[idx];
  const dx = target.x - entity.x;
  const dy = target.y - entity.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) {
    idx += 1;
    if (idx >= points.length) {
      idx = loop ? 0 : points.length - 1;
      if (!loop) return;
    }
    state.pathIndex = idx;
    target = points[idx];
  }
  const step = speed * delta;
  const angle = Math.atan2(target.y - entity.y, target.x - entity.x);
  entity.x += Math.cos(angle) * step;
  entity.y += Math.sin(angle) * step;
}

export function computeScore(play, events) {
  if (!play) return 0;
  const objectives = play.objectives || [];
  const collisions = events.filter((event) => event.type === "collision");

  const zoneTimes = new Map();
  const activeEntries = new Map();
  const firstEntries = new Map();

  events.forEach((event) => {
    if (event.type === "entered_zone") {
      const zoneId = event.payload?.zone_id;
      if (!zoneId) return;
      activeEntries.set(zoneId, event.t);
      if (!firstEntries.has(zoneId)) firstEntries.set(zoneId, event.t);
    }
    if (event.type === "exit_zone") {
      const zoneId = event.payload?.zone_id;
      if (!zoneId) return;
      const start = activeEntries.get(zoneId);
      if (start !== undefined) {
        zoneTimes.set(zoneId, (zoneTimes.get(zoneId) || 0) + (event.t - start));
        activeEntries.delete(zoneId);
      }
    }
  });

  let score = 0;
  objectives.forEach((objective) => {
    if (objective.type === "reach_zone") {
      const timeLimit = objective.params?.time_limit ?? 60;
      const firstEntry = firstEntries.get(objective.id);
      if (firstEntry !== undefined && firstEntry <= timeLimit) {
        score += 100;
      }
      score += zoneTimes.get(objective.id) || 0;
    }
    if (objective.type === "avoid_collision") {
      score -= collisions.length * 50;
    }
    if (objective.type === "time_bonus") {
      const completeTime = firstEntries.get(objective.id);
      if (completeTime !== undefined) {
        score += Math.max(0, 60 - completeTime) * 2;
      }
    }
  });

  return Math.round(score * 10) / 10;
}

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
