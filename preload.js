console.log("PRELOAD LOADED");

const { contextBridge, ipcRenderer } = require("electron");

/* =========================
   LOGS
========================= */
let logs = [];

/* =========================
   STATE
========================= */
let state = {
  running: false,
  mode: "work",

  workElapsed: 0,
  workDayLimit: 8 * 60 * 60,

  breakBlock: 30 * 60,
  breakRemaining: 30 * 60,

  dayStartedNotified: false,
  dayFinishedNotified: false
};

/* =========================
   TIMING CORE
========================= */

// Work timing
let workStartTimestamp = null;
let pausedElapsed = 0;

// Break timing
let breakStartTimestamp = null;

/* =========================
   LOGGING
========================= */
function addLog(type) {
  const entry = {
    type,
    timestamp: new Date().toISOString()
  };

  logs.push(entry);
  console.log("[LOG]", type, entry.timestamp);
}

/* =========================
   WORK UPDATE
========================= */
function updateWork() {
  if (!state.running || state.mode !== "work") return;
  if (!workStartTimestamp) return;

  const now = Date.now();

  state.workElapsed =
    Math.floor((now - workStartTimestamp) / 1000) + pausedElapsed;

  // Cap at 8 hours
  if (state.workElapsed >= state.workDayLimit) {
    state.workElapsed = state.workDayLimit;
    state.running = false;

    if (!state.dayFinishedNotified) {
      ipcRenderer.send("timer:day-finish");
      addLog("DAY_FINISHED");
      state.dayFinishedNotified = true;
    }
  }

  // Start-of-day event
  if (!state.dayStartedNotified && state.workElapsed === 0) {
    ipcRenderer.send("timer:day-start");
    addLog("DAY_STARTED");
    state.dayStartedNotified = true;
  }
}

/* =========================
   BREAK UPDATE
========================= */
function updateBreak() {
  if (!state.running || state.mode !== "break") return;
  if (!breakStartTimestamp) return;

  const now = Date.now();
  const elapsed = Math.floor((now - breakStartTimestamp) / 1000);

  state.breakRemaining = Math.max(0, state.breakBlock - elapsed);

  if (state.breakRemaining === 0) {
    stopBreak();
  }
}

/* =========================
   MAIN LOOP
========================= */
function tick() {
  updateWork();
  updateBreak();
}

setInterval(tick, 1000);

/* =========================
   WORK CONTROLS (TOGGLE FIX)
========================= */
function startWork() {
  if (state.running && state.mode === "work") return;

  state.running = true;
  state.mode = "work";

  workStartTimestamp = Date.now() - pausedElapsed * 1000;

  addLog("WORK_START");
  ipcRenderer.send("timer:start");
}

function pauseWork() {
  if (!state.running) return;

  state.running = false;

  pausedElapsed = state.workElapsed;
  workStartTimestamp = null;

  addLog("WORK_PAUSE");
  ipcRenderer.send("timer:pause");
}

function toggleWork() {
  if (state.mode !== "work") return;

  if (state.running) {
    pauseWork();
  } else {
    startWork();
  }
}

/* =========================
   BREAK CONTROLS
========================= */
function startBreak() {
  if (state.mode === "break") return;

  state.mode = "break";
  breakStartTimestamp = Date.now();
  state.breakRemaining = state.breakBlock;

  addLog("BREAK_START");
  ipcRenderer.send("timer:break");
}

function stopBreak() {
  if (state.mode !== "break") return;

  state.mode = "work";

  breakStartTimestamp = null;

  // resume work properly
  workStartTimestamp = Date.now() - state.workElapsed * 1000;

  addLog("BREAK_END");
  ipcRenderer.send("timer:work");
}

/* =========================
   API EXPOSED
========================= */
contextBridge.exposeInMainWorld("timer", {

  toggleWork,

  reset: () => {
    state.running = false;
    state.mode = "work";

    state.workElapsed = 0;
    state.breakRemaining = state.breakBlock;

    state.dayStartedNotified = false;
    state.dayFinishedNotified = false;

    workStartTimestamp = null;
    breakStartTimestamp = null;
    pausedElapsed = 0;

    addLog("RESET");
    ipcRenderer.send("timer:reset");
  },

  startBreak,
  stopBreak,

  exportLogs: () => {
    const pad = (n) => String(n).padStart(2, "0");

    const date = new Date();
    const fileName =
      `work-log-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.txt`;

    const lines = logs.map(l => {
      const t = new Date(l.timestamp);
      return `[${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}] ${l.type}`;
    });

    const content = [
      "WORK TIMER LOG",
      `Generated: ${date.toDateString()}`,
      "=========================",
      "",
      ...lines
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();

    URL.revokeObjectURL(url);

    addLog("EXPORT_LOGS");
  },

  getState: () => state
});

/* =========================
   WINDOW CONTROLS
========================= */
contextBridge.exposeInMainWorld("windowControls", {
  minimizeToTray: () => ipcRenderer.send("window:minimize-to-tray")
});