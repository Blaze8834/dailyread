import { routePoints } from "./catalogs.js";

const FIELD_GREEN = "#0f7a3c";
const FIELD_LINE = "rgba(248, 250, 252, 0.4)";

export class SimulationCanvas {
  constructor(canvas, hudTimeEl, hudScoreEl) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.hudTimeEl = hudTimeEl;
    this.hudScoreEl = hudScoreEl;

    this.play = null;
    this.entities = [];
    this.routes = [];
    this.routeSelections = {};
    this.routeRolesByReceiver = {};
    this.routeRoleColors = {
      primary: "#ef4444",
      secondary: "#facc15",
      motion: "#3b82f6",
      check_release: "#a855f7",
    };
    this.selectedReceiver = null;
    this.time = 0;
    this.running = false;
    this.lastFrame = null;
    this.events = [];
    this.score = 0;
    this.settings = {
      showRoutes: true,
      showLabels: true,
      showField: true,
      highContrast: false,
    };
    this.passWindow = 6;
    this.passThrown = false;
    this.qbId = "qb";

    this.view = { x: 0, y: 0, scale: 1 };

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * devicePixelRatio;
    this.canvas.height = rect.height * devicePixelRatio;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(devicePixelRatio, devicePixelRatio);
    this.render();
  }

  setPlay(play) {
    this.play = play;
    this.entities = play.entities.map((entity) => ({
      ...entity,
      _state: { pathIndex: 0, progress: 0, target: null },
    }));
    this.routes = play.routes;
    this.routeRolesByReceiver = Object.fromEntries((play.base_plan || []).map((item) => [item.receiver_id, item.role]));
    this.routeRoleColors = { ...this.routeRoleColors, ...(play.route_role_colors || {}) };
    this.routeSelections = {};
    this.selectedReceiver = null;
    this.time = 0;
    this.running = false;
    this.events = [];
    this.passThrown = false;
    this.score = 0;
    this.render();
  }

  setSettings(nextSettings) {
    this.settings = { ...this.settings, ...nextSettings };
    this.render();
  }

  setRoute(receiverId, routeId) {
    this.routeSelections[receiverId] = routeId;
    this.recordEvent("route_selected", { receiver_id: receiverId, route_id: routeId });
    this.render();
  }

  setSelectedReceiver(receiverId) {
    this.selectedReceiver = receiverId;
    this.render();
  }

  applyMotion(dx, dy) {
    if (!this.selectedReceiver) return;
    const entity = this.entities.find((e) => e.id === this.selectedReceiver);
    if (!entity || this.running) return;
    entity.x += dx;
    entity.y += dy;
    this.render();
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

  triggerPass(targetId) {
    if (this.passThrown || !this.running) return;
    this.passThrown = true;
    const target = this.entities.find((e) => e.id === targetId);
    if (!target) return;
    const defenders = this.entities.filter((e) => e.type === "npc");
    let separation = 999;
    defenders.forEach((def) => {
      const dist = Math.hypot(def.x - target.x, def.y - target.y);
      separation = Math.min(separation, dist);
    });
    this.recordEvent("target", { receiver_id: targetId, separation: separation.toFixed(1) });
    if (separation < 18) {
      this.recordEvent("interception", { receiver_id: targetId });
    } else if (separation < 30) {
      this.recordEvent("incomplete", { receiver_id: targetId });
    } else {
      this.recordEvent("complete", { receiver_id: targetId });
    }
  }

  loop(timestamp) {
    if (!this.running) return;
    if (!this.lastFrame) this.lastFrame = timestamp;
    const delta = (timestamp - this.lastFrame) / 1000;
    this.lastFrame = timestamp;
    this.time += delta;
    this.update(delta);
    this.render();
    if (this.time >= this.passWindow) {
      this.recordEvent("sack", { reason: "timer" });
      this.running = false;
      return;
    }
    requestAnimationFrame((t) => this.loop(t));
  }

  update(delta) {
    const qb = this.entities.find((e) => e.id === this.qbId);
    this.entities.forEach((entity) => {
      if (entity.type === "player" && entity.id !== this.qbId) {
        const routeId = this.routeSelections[entity.id];
        if (!routeId) return;
        const route = this.routes.find((r) => r.id === routeId);
        if (!route) return;
        const points = routePoints(route.name.toLowerCase().replace(/\s+/g, "_"), { x: entity.x, y: entity.y });
        moveAlongPath(entity, points, 90, delta);
      }
      if (entity.type === "npc") {
        if (!qb) return;
        const isBlitz = entity.behavior?.coverage?.includes("blitz");
        if (entity.id.startsWith("de") || entity.id.startsWith("dt") || isBlitz) {
          moveTowards(entity, qb, isBlitz ? 60 : 40, delta);
        } else {
          if (!entity._state.target) {
            entity._state.target = { x: entity.x + 40, y: entity.y + 60 };
          }
          moveTowardsPoint(entity, entity._state.target, 25, delta);
        }
      }
    });

    if (qb) {
      const pressure = this.entities.some((def) => def.type === "npc" && Math.hypot(def.x - qb.x, def.y - qb.y) < 14);
      if (pressure && this.running) {
        this.recordEvent("sack", { reason: "pressure" });
        this.running = false;
      }
    }

    this.hudTimeEl.textContent = this.time.toFixed(1);
    this.hudScoreEl.textContent = this.score.toFixed(0);
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

    if (this.settings.showField) {
      drawField(ctx, this.play.canvas.width, this.play.canvas.height, this.settings.highContrast);
    } else {
      ctx.fillStyle = "#0b1220";
      ctx.fillRect(0, 0, this.play.canvas.width, this.play.canvas.height);
    }

    if (this.settings.showRoutes) {
      this.entities.forEach((entity) => {
        if (entity.type !== "player" || entity.id === this.qbId) return;
        const routeId = this.routeSelections[entity.id];
        if (!routeId) return;
        const route = this.routes.find((r) => r.id === routeId);
        if (!route) return;
        const points = routePoints(route.name.toLowerCase().replace(/\s+/g, "_"), { x: entity.x, y: entity.y });
        ctx.beginPath();
        points.forEach((point, idx) => {
          if (idx === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        const role = this.routeRolesByReceiver[entity.id];
        ctx.strokeStyle = this.routeRoleColors[role] || route.color;
        ctx.lineWidth = 3;
        ctx.stroke();
      });
    }

    this.entities.forEach((entity) => {
      ctx.beginPath();
      ctx.arc(entity.x, entity.y, entity.radius, 0, Math.PI * 2);
      ctx.fillStyle = entity.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = this.settings.highContrast ? "#f8fafc" : "#0f172a";
      ctx.stroke();

      if (this.settings.showLabels) {
        ctx.fillStyle = "#f8fafc";
        ctx.font = entity.id === this.qbId ? "bold 12px sans-serif" : "11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(entity.label || entity.id.toUpperCase(), entity.x, entity.y);
      }

      if (entity.id === this.selectedReceiver) {
        ctx.beginPath();
        ctx.arc(entity.x, entity.y, entity.radius + 6, 0, Math.PI * 2);
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    ctx.restore();
  }
}

function moveAlongPath(entity, points, speed, delta) {
  if (!points.length) return;
  const state = entity._state;
  let idx = state.pathIndex || 0;
  if (idx >= points.length) return;
  const target = points[idx];
  const dx = target.x - entity.x;
  const dy = target.y - entity.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) {
    state.pathIndex = idx + 1;
    return;
  }
  entity.x += (dx / dist) * speed * delta;
  entity.y += (dy / dist) * speed * delta;
}

function moveTowards(entity, target, speed, delta) {
  const dx = target.x - entity.x;
  const dy = target.y - entity.y;
  const dist = Math.hypot(dx, dy) || 1;
  entity.x += (dx / dist) * speed * delta;
  entity.y += (dy / dist) * speed * delta;
}

function moveTowardsPoint(entity, target, speed, delta) {
  const dx = target.x - entity.x;
  const dy = target.y - entity.y;
  const dist = Math.hypot(dx, dy) || 1;
  if (dist < 6) return;
  entity.x += (dx / dist) * speed * delta;
  entity.y += (dy / dist) * speed * delta;
}

function drawField(ctx, width, height, highContrast) {
  ctx.fillStyle = FIELD_GREEN;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = highContrast ? "#f8fafc" : FIELD_LINE;
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, width, height);

  const yardCount = 12;
  for (let i = 1; i < yardCount; i += 1) {
    const y = (height / yardCount) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const hashXLeft = width * 0.35;
  const hashXRight = width * 0.65;
  for (let i = 1; i < yardCount; i += 1) {
    const y = (height / yardCount) * i;
    ctx.beginPath();
    ctx.moveTo(hashXLeft, y - 6);
    ctx.lineTo(hashXLeft, y + 6);
    ctx.moveTo(hashXRight, y - 6);
    ctx.lineTo(hashXRight, y + 6);
    ctx.stroke();
  }
}
