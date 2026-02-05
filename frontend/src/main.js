import { SimulationCanvas } from "./canvas.js";
import { FORMATIONS, FORMATION_TAGS, ROUTES } from "./catalogs.js";

const canvasEl = document.getElementById("game-canvas");
const hudTimeEl = document.getElementById("hud-time");
const hudScoreEl = document.getElementById("hud-score");
const playNameEl = document.getElementById("play-name");
const syncStatusEl = document.getElementById("sync-status");
const attemptStatusEl = document.getElementById("attempt-status");
const connectionStatusEl = document.getElementById("connection-status");
const radialMenu = document.getElementById("radial-menu");
const routeListEl = document.getElementById("route-list");
const coverageRevealEl = document.getElementById("coverage-reveal");
const formationEl = document.getElementById("formation");
const formationSubsetEl = document.getElementById("formation-subset");
const formationTagEl = document.getElementById("formation-tag");

const toggleRoutesEl = document.getElementById("toggle-routes");
const toggleLabelsEl = document.getElementById("toggle-labels");
const toggleFieldEl = document.getElementById("toggle-field");
const toggleContrastEl = document.getElementById("toggle-contrast");

const authStatusEl = document.getElementById("auth-status");
const registerBtn = document.getElementById("register");
const loginBtn = document.getElementById("login");
const logoutBtn = document.getElementById("logout");
const googleLoginBtn = document.getElementById("google-login");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");

const adminPanelEl = document.getElementById("admin-panel");
const overrideNameEl = document.getElementById("override-name");
const overrideSetBtn = document.getElementById("override-set");
const overrideClearBtn = document.getElementById("override-clear");

const loadBtn = document.getElementById("load-play");
const startBtn = document.getElementById("start-sim");
const stopBtn = document.getElementById("stop-sim");
const submitBtn = document.getElementById("submit-attempt");

const simulation = new SimulationCanvas(canvasEl, hudTimeEl, hudScoreEl);

let play = null;
let longPressTimer = null;
let lastPress = null;
let selectedReceiver = null;

const receiverOrder = ["wr1", "wr2", "wr3", "te", "rb"];

let routeCatalog = [...ROUTES];
let formationsCatalog = { ...FORMATIONS };
let formationTagsCatalog = [...FORMATION_TAGS];

loadBtn.addEventListener("click", () => loadPlay());
startBtn.addEventListener("click", () => simulation.start());
stopBtn.addEventListener("click", () => simulation.stop());
submitBtn.addEventListener("click", () => submitAttempt());

registerBtn.addEventListener("click", () => authRequest("/api/auth/register"));
loginBtn.addEventListener("click", () => authRequest("/api/auth/login"));
logoutBtn.addEventListener("click", () => authRequest("/api/auth/logout"));

googleLoginBtn.addEventListener("click", () => {
  window.location.href = "/auth/google";
});

overrideSetBtn.addEventListener("click", () => setOverride());
overrideClearBtn.addEventListener("click", () => clearOverride());

formationEl.addEventListener("change", () => updateFormationSubsets());
formationSubsetEl.addEventListener("change", () => applyFormation());
formationTagEl.addEventListener("change", () => applyFormation());

[toggleRoutesEl, toggleLabelsEl, toggleFieldEl, toggleContrastEl].forEach((el) => {
  el.addEventListener("change", () => updateSettings());
});

canvasEl.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  openRadialMenu(event.clientX, event.clientY);
});

canvasEl.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "touch") {
    lastPress = { x: event.clientX, y: event.clientY };
    longPressTimer = setTimeout(() => {
      openRadialMenu(lastPress.x, lastPress.y);
    }, 500);
  }
});

canvasEl.addEventListener("pointerup", () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
});

canvasEl.addEventListener("click", (event) => {
  const rect = canvasEl.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const hit = simulation.entities.find((entity) => {
    if (entity.type !== "player" || entity.id === "qb") return false;
    const dist = Math.hypot(entity.x - x, entity.y - y);
    return dist < entity.radius + 6;
  });
  if (hit) {
    selectedReceiver = hit.id;
    simulation.setSelectedReceiver(hit.id);
    renderRouteList();
  }
});

window.addEventListener("keydown", (event) => {
  if (!play) return;
  const key = event.key;
  if (key >= "1" && key <= "5") {
    const idx = parseInt(key, 10) - 1;
    const receiverId = receiverOrder[idx];
    if (simulation.running) {
      simulation.triggerPass(receiverId);
    } else {
      selectedReceiver = receiverId;
      simulation.setSelectedReceiver(receiverId);
      renderRouteList();
    }
  }
  if (!simulation.running && selectedReceiver) {
    if (event.key === "ArrowUp") simulation.applyMotion(0, -10);
    if (event.key === "ArrowDown") simulation.applyMotion(0, 10);
    if (event.key === "ArrowLeft") simulation.applyMotion(-10, 0);
    if (event.key === "ArrowRight") simulation.applyMotion(10, 0);
    if (event.key.toLowerCase() === "q") cycleRoute(-1);
    if (event.key.toLowerCase() === "e") cycleRoute(1);
  }
});

function openRadialMenu(x, y) {
  if (!play || !selectedReceiver) return;
  radialMenu.innerHTML = "";
  const routes = routeCatalog;
  const radius = 90;
  const rect = radialMenu.getBoundingClientRect();
  const localX = x - rect.left;
  const localY = y - rect.top;
  routes.forEach((route, index) => {
    const angle = (index / routes.length) * Math.PI * 2 - Math.PI / 2;
    const btn = document.createElement("button");
    btn.className = "route-button";
    btn.style.background = "#38bdf8";
    btn.style.left = `${localX + Math.cos(angle) * radius}px`;
    btn.style.top = `${localY + Math.sin(angle) * radius}px`;
    btn.textContent = route.replace(/_/g, " ");
    btn.addEventListener("click", () => {
      setRouteForReceiver(route);
      closeRadialMenu();
    });
    radialMenu.appendChild(btn);
  });
}

function closeRadialMenu() {
  radialMenu.innerHTML = "";
}

window.addEventListener("click", (event) => {
  if (!radialMenu.contains(event.target)) {
    closeRadialMenu();
  }
});

function setRouteForReceiver(route) {
  if (!selectedReceiver) return;
  if (!routeCatalog.includes(route)) return;
  simulation.setRoute(selectedReceiver, route.toUpperCase());
  renderRouteList();
}

function renderRouteList() {
  routeListEl.innerHTML = "";
  routeCatalog.forEach((route) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "secondary";
    row.style.marginBottom = "6px";
    row.textContent = route.replace(/_/g, " ");
    if (selectedReceiver && simulation.routeSelections[selectedReceiver] === route.toUpperCase()) {
      row.classList.add("active");
    }
    row.addEventListener("click", () => {
      setRouteForReceiver(route);
    });
    routeListEl.appendChild(row);
  });
}

function cycleRoute(direction) {
  const routes = routeCatalog;
  const current = simulation.routeSelections[selectedReceiver] || routes[0].toUpperCase();
  const idx = routes.findIndex((r) => r.toUpperCase() === current);
  const next = routes[(idx + direction + routes.length) % routes.length];
  setRouteForReceiver(next);
}

async function loadPlay() {
  const response = await fetch("/api/play/today");
  if (!response.ok) {
    playNameEl.textContent = "No play available";
    return;
  }
  play = await response.json();
  routeCatalog = [...(play.catalogs?.routes || ROUTES)];
  formationsCatalog = { ...(play.catalogs?.formations || FORMATIONS) };
  formationTagsCatalog = [...(play.catalogs?.formation_tags || FORMATION_TAGS)];
  playNameEl.textContent = play.name;
  simulation.setPlay(play);
  applyReceiverLabels();
  applyBasePlan(play);
  selectedReceiver = receiverOrder[0];
  simulation.setSelectedReceiver(selectedReceiver);
  updateFormationOptions();
  renderRouteList();
  cacheLastPlay(play);
  coverageRevealEl.textContent = "";
}

function applyBasePlan(currentPlay) {
  (currentPlay.base_plan || []).forEach((item) => {
    simulation.routeSelections[item.receiver_id] = item.route_id;
  });
  simulation.render();
}

async function submitAttempt() {
  if (!play) return;
  const payload = {
    play_name: play.name,
    play_date: play.play_date,
    route_selections: simulation.routeSelections,
    events: simulation.events,
  };
  const response = await fetch("/api/attempts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    attemptStatusEl.textContent = "Attempt submission failed.";
    return;
  }
  const data = await response.json();
  attemptStatusEl.textContent = `Score: ${data.score}`;
  coverageRevealEl.textContent = `Coverage: ${data.coverage}`;
}

async function authRequest(path) {
  const payload = { email: emailEl.value, password: passwordEl.value };
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    authStatusEl.textContent = "Auth failed";
    return;
  }
  await loadMe();
}

async function loadMe() {
  const response = await fetch("/api/me");
  if (!response.ok) return;
  const data = await response.json();
  if (data.authenticated) {
    authStatusEl.textContent = `Signed in as ${data.email}`;
    adminPanelEl.style.display = data.is_admin ? "flex" : "none";
  } else {
    authStatusEl.textContent = "Not signed in";
    adminPanelEl.style.display = "none";
  }
}

async function setOverride() {
  const response = await fetch("/api/admin/override", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ play_name: overrideNameEl.value }),
  });
  if (response.ok) loadPlay();
}

async function clearOverride() {
  const response = await fetch("/api/admin/override", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ play_name: "" }),
  });
  if (response.ok) loadPlay();
}

function updateFormationOptions() {
  formationEl.innerHTML = "";
  Object.keys(formationsCatalog).forEach((formation) => {
    const option = document.createElement("option");
    option.value = formation;
    option.textContent = formation;
    formationEl.appendChild(option);
  });
  formationTagEl.innerHTML = "";
  formationTagsCatalog.forEach((tag) => {
    const option = document.createElement("option");
    option.value = tag;
    option.textContent = tag;
    formationTagEl.appendChild(option);
  });
  updateFormationSubsets();
}

function updateFormationSubsets() {
  const formation = formationEl.value;
  formationSubsetEl.innerHTML = "";
  (formationsCatalog[formation] || []).forEach((subset) => {
    const option = document.createElement("option");
    option.value = subset;
    option.textContent = subset;
    formationSubsetEl.appendChild(option);
  });
  applyFormation();
}

function applyFormation() {
  if (!play) return;
  const subset = formationSubsetEl.value || (formationsCatalog[formationEl.value] || ["base"])[0];
  play.formation = `${formationEl.value} ${subset}`;
  play.formation_tag = formationTagEl.value;
  const positions = formationLayout(play.formation, play.formation_tag);
  simulation.entities.forEach((entity) => {
    if (entity.type !== "player") return;
    const pos = positions[entity.id];
    if (!pos) return;
    entity.x = pos.x;
    entity.y = pos.y;
  });
  simulation.render();
}

function formationLayout(formation, tag) {
  const centerX = 450;
  const qbY = 550;
  const positions = {
    qb: { x: centerX, y: qbY },
    wr1: { x: centerX - 220, y: 435 },
    wr2: { x: centerX, y: 415 },
    wr3: { x: centerX + 220, y: 435 },
    te: { x: centerX + 70, y: qbY - 25 },
    rb: { x: centerX - 70, y: qbY - 10 },
  };

  const isEmpty = formation.includes("empty");
  if (isEmpty) {
    positions.rb = { x: centerX + 300, y: 430 };
  }

  if (formation.includes("trips")) {
    positions.wr1 = { x: centerX + 120, y: 430 };
    positions.wr2 = { x: centerX + 220, y: 420 };
    positions.wr3 = { x: centerX + 320, y: 410 };
  }
  if (tag === "bunch") {
    positions.wr1 = { x: centerX + 120, y: 445 };
    positions.wr2 = { x: centerX + 145, y: 430 };
    positions.wr3 = { x: centerX + 170, y: 415 };
  }
  if (tag === "nasty") {
    positions.wr1 = { x: centerX - 120, y: 450 };
    positions.wr2 = { x: centerX - 60, y: 425 };
    positions.wr3 = { x: centerX, y: 410 };
  }
  positions.te = { x: centerX + 70, y: qbY - 25 };
  if (!isEmpty) {
    positions.rb = { x: centerX - 70, y: qbY - 10 };
  }

  return positions;
}

function applyReceiverLabels() {
  const labels = {
    wr1: "1 WR1",
    wr2: "2 WR2",
    wr3: "3 WR3",
    te: "4 TE",
    rb: "5 RB",
    qb: "QB",
  };
  simulation.entities.forEach((entity) => {
    if (labels[entity.id]) {
      entity.label = labels[entity.id];
    }
  });
}

function updateSettings() {
  const nextSettings = {
    showRoutes: toggleRoutesEl.checked,
    showLabels: toggleLabelsEl.checked,
    showField: toggleFieldEl.checked,
    highContrast: toggleContrastEl.checked,
  };
  simulation.setSettings(nextSettings);
}

function updateConnectionStatus() {
  connectionStatusEl.textContent = navigator.onLine
    ? "Online"
    : "Offline - attempts will queue";
}

async function cacheLastPlay(playData) {
  try {
    const cache = await caches.open("dailyread-play");
    await cache.put(
      new Request("/api/play/today"),
      new Response(JSON.stringify(playData), {
        headers: { "Content-Type": "application/json" },
      })
    );
  } catch (error) {
    // ignore cache errors
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js");
}

loadMe();
loadPlay();
updateConnectionStatus();
updateSettings();
renderRouteList();

window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);
