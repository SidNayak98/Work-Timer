console.log("PRELOAD LOADED");

const { contextBridge, ipcRenderer } = require("electron");

/* =========================
   STATE
========================= */

let state = {
  running: false,
  mode: "work",

  workElapsed: 0,
  workDayLimit: 8 * 60 * 60, // 8 hours

  breakBlock: 30 * 60,       // 30 min break
  breakRemaining: 30 * 60,

  dayStartedNotified: false,
  dayFinishedNotified: false
};

/* =========================
   INTERNAL TIMERS
========================= */

let workStartTimestamp = null;
let breakStartTimestamp = null;

/* =========================
   LOGGING
========================= */

let logs = [];

function addLog(type) {
  const entry = {
    type,
    timestamp: new Date().toISOString()
  };

  logs.push(entry);
  console.log("[LOG]", type, entry.timestamp);
}

/* =========================
   WORK TIMER ENGINE
========================= */

function updateWorkTime() {
  if (!workStartTimestamp) return;

  const now = Date.now();
  state.workElapsed = Math.floor((now - workStartTimestamp) / 1000);

  // 8 hour cap
  if (state.workElapsed >= state.workDayLimit) {
    state.workElapsed = state.workDayLimit;
    state.running = false;

    if (!state.dayFinishedNotified) {
      ipcRenderer.send("timer:day-finish");
      addLog("DAY_FINISHED");
      state.dayFinishedNotified = true;
    }
  }

  // Notify first start
  if (!state.dayStartedNotified && state.workElapsed === 0) {
    ipcRenderer.send("timer:day-start");
    addLog("DAY_STARTED");
    state.dayStartedNotified = true;
  }
}

/* =========================
   BREAK TIMER ENGINE
========================= */

function updateBreakTime() {
  if (!breakStartTimestamp) return;

  const now = Date.now();
  const elapsed = Math.floor((now - breakStartTimestamp) / 1000);

  state.breakRemaining = Math.max(0, state.breakBlock - elapsed);

  if (state.breakRemaining === 0) {
    stopBreak();
  }
}

/* =========================
   MAIN TICK
========================= */

function tick() {
  if (!state.running) return;

  if (state.mode === "work") {
    updateWorkTime();

    if (!state.dayStartedNotified && state.workElapsed === 0) {
      ipcRenderer.send("timer:day-start");
      state.dayStartedNotified = true;
    }
  }

  if (state.mode === "break") {
    updateBreakTime();
  }

  // 👇 NEW LINE
  ipcRenderer.send("timer:tick", state.workElapsed);
}

setInterval(tick, 1000);

/* =========================
   WORK TOGGLE (START/PAUSE)
========================= */

function toggleWork() {

  if (state.mode !== "work") return;

  if (!state.running) {
    // START / RESUME
    state.running = true;

    if (!workStartTimestamp) {
      // fresh start
      workStartTimestamp = Date.now();
    } else {
      // resume from paused time
      workStartTimestamp = Date.now() - state.workElapsed * 1000;
    }

    addLog("WORK_START");
    ipcRenderer.send("timer:start");

  } else {
    // PAUSE
    state.running = false;

    addLog("WORK_PAUSE");
    ipcRenderer.send("timer:pause");
  }
}

/* =========================
   BREAK CONTROL
========================= */

function startBreak() {
  if (state.mode === "break") return;

  state.mode = "break";
  state.running = true;

  breakStartTimestamp = Date.now();
  state.breakRemaining = state.breakBlock;

  addLog("BREAK_START");
  ipcRenderer.send("timer:break");
}

function stopBreak() {
  if (state.mode !== "break") return;

  state.mode = "work";
  breakStartTimestamp = null;

  // Resume work from existing elapsed
  workStartTimestamp = Date.now() - state.workElapsed * 1000;
  state.running = true;

  addLog("BREAK_END");
  ipcRenderer.send("timer:work");
}

/* =========================
   RESET
========================= */

function reset() {
  state.running = false;
  state.mode = "work";

  state.workElapsed = 0;
  state.breakRemaining = state.breakBlock;

  state.dayStartedNotified = false;
  state.dayFinishedNotified = false;

  workStartTimestamp = null;
  breakStartTimestamp = null;

  addLog("RESET");
  ipcRenderer.send("timer:reset");
}

/* =========================
   EXPORT LOGS
========================= */

function exportLogs() {

  const pad = (n) => String(n).padStart(2, "0");

  const date = new Date();
  const fileName =
    `work-log-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.txt`;

  const lines = logs.map(l => {
    const t = new Date(l.timestamp);
    return `[${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}] ${l.type}`;
  });

  const content = [
    `WORK TIMER LOG`,
    `Generated: ${date.toDateString()}`,
    `================================`,
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
}

/* =========================
   EXPOSE TO RENDERER
========================= */

contextBridge.exposeInMainWorld("timer", {
  toggleWork,
  startBreak,
  stopBreak,
  reset,
  exportLogs,
  getState: () => state
});

/* =========================
   WINDOW CONTROLS
========================= */

contextBridge.exposeInMainWorld("windowControls", {
  minimizeToTray: () => ipcRenderer.send("window:minimize-to-tray")
});