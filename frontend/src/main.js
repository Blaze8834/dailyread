import { SimulationCanvas, computeScore } from "./canvas.js";

const canvasEl = document.getElementById("game-canvas");
const hudTimeEl = document.getElementById("hud-time");
const hudScoreEl = document.getElementById("hud-score");
const playNameEl = document.getElementById("play-name");
const syncStatusEl = document.getElementById("sync-status");
const attemptStatusEl = document.getElementById("attempt-status");
const connectionStatusEl = document.getElementById("connection-status");
const radialMenu = document.getElementById("radial-menu");

const simulation = new SimulationCanvas(canvasEl, hudTimeEl, hudScoreEl);

const loadBtn = document.getElementById("load-play");
const startBtn = document.getElementById("start-sim");
const stopBtn = document.getElementById("stop-sim");
const submitBtn = document.getElementById("submit-attempt");

let play = null;
let longPressTimer = null;
let lastPress = null;

loadBtn.addEventListener("click", () => loadPlay());
startBtn.addEventListener("click", () => simulation.start());
stopBtn.addEventListener("click", () => simulation.stop());
submitBtn.addEventListener("click", () => submitAttempt());

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

function openRadialMenu(x, y) {
  if (!play) return;
  radialMenu.innerHTML = "";
  const routes = play.routes || [];
  const radius = 90;
  const rect = radialMenu.getBoundingClientRect();
  const localX = x - rect.left;
  const localY = y - rect.top;
  routes.forEach((route, index) => {
    const angle = (index / routes.length) * Math.PI * 2 - Math.PI / 2;
    const btn = document.createElement("button");
    btn.className = "route-button";
    btn.style.background = route.color;
    btn.style.left = `${localX + Math.cos(angle) * radius}px`;
    btn.style.top = `${localY + Math.sin(angle) * radius}px`;
    btn.textContent = route.name;
    btn.addEventListener("click", () => {
      simulation.setRoute(route.id);
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

async function loadPlay() {
  const response = await fetch("/api/play/today");
  if (!response.ok) {
    playNameEl.textContent = "No play available";
    return;
  }
  play = await response.json();
  playNameEl.textContent = play.name;
  simulation.setPlay(play);
  cacheLastPlay(play);
}

async function submitAttempt() {
  if (!play) return;
  const attempt = {
    play_id: play.id,
    route_id: simulation.selectedRouteId || play.routes?.[0]?.id,
    events: simulation.events,
    score: computeScore(play, simulation.events),
    client_id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  };

  const queued = await queueAttempt(attempt);
  attemptStatusEl.textContent = queued
    ? "Attempt queued for sync."
    : "Attempt submitted.";
}

async function queueAttempt(attempt) {
  if (!navigator.onLine) {
    await saveAttemptOffline(attempt);
    updateSyncStatus();
    return true;
  }

  try {
    const response = await fetch("/api/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(attempt),
    });
    if (!response.ok) throw new Error("Failed to submit");
    updateSyncStatus();
    return false;
  } catch (error) {
    await saveAttemptOffline(attempt);
    updateSyncStatus();
    return true;
  }
}

async function syncQueuedAttempts() {
  if (!navigator.onLine) return;
  const queued = await getQueuedAttempts();
  for (const attempt of queued) {
    try {
      const response = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attempt),
      });
      if (response.ok) {
        await deleteQueuedAttempt(attempt.client_id);
      }
    } catch (error) {
      break;
    }
  }
  updateSyncStatus();
}

function updateSyncStatus() {
  if (!navigator.onLine) {
    syncStatusEl.textContent = "Offline";
    syncStatusEl.style.color = "#fbbf24";
    return;
  }
  getQueuedAttempts().then((queued) => {
    if (queued.length) {
      syncStatusEl.textContent = `Syncing (${queued.length})`;
      syncStatusEl.style.color = "#fbbf24";
    } else {
      syncStatusEl.textContent = "Synced";
      syncStatusEl.style.color = "#22c55e";
    }
  });
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

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("dailyread", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("attempts")) {
        db.createObjectStore("attempts", { keyPath: "client_id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveAttemptOffline(attempt) {
  const db = await openDb();
  const tx = db.transaction("attempts", "readwrite");
  tx.objectStore("attempts").put(attempt);
  return tx.complete;
}

async function getQueuedAttempts() {
  const db = await openDb();
  const tx = db.transaction("attempts", "readonly");
  const store = tx.objectStore("attempts");
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function deleteQueuedAttempt(clientId) {
  const db = await openDb();
  const tx = db.transaction("attempts", "readwrite");
  tx.objectStore("attempts").delete(clientId);
  return tx.complete;
}

window.addEventListener("online", () => {
  updateConnectionStatus();
  syncQueuedAttempts();
});
window.addEventListener("offline", updateConnectionStatus);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js");
}

loadPlay();
updateConnectionStatus();
updateSyncStatus();
setInterval(syncQueuedAttempts, 10000);
