console.log("PRELOAD LOADED");

const { contextBridge, ipcRenderer } = require("electron");

let state = {
  running: false,
  mode: "work",

  workBlock: 2 * 60 * 60,
  breakBlock: 20 * 60,

  cycleRemaining: 2 * 60 * 60,
  breakRemaining: 20 * 60,

  workElapsed: 0,
  workDayLimit: 8 * 60 * 60,

  dayStartedNotified: false,
  dayFinishedNotified: false
};

// 🔥 REAL TIME TRACKING
let startTimestamp = null;

function tick() {
  if (!state.running) return;

  const now = Date.now();
  const elapsedSeconds = Math.floor((now - startTimestamp) / 1000);

  // Stop at 8 hours
  if (elapsedSeconds >= state.workDayLimit) {
    state.workElapsed = state.workDayLimit;
    state.running = false;

    if (!state.dayFinishedNotified) {
      ipcRenderer.send("timer:day-finish");
      state.dayFinishedNotified = true;
    }

    return;
  }

  state.workElapsed = elapsedSeconds;

  // 🔁 WORK / BREAK CYCLE CALCULATION
  const totalCycleLength = state.workBlock + state.breakBlock;
  const positionInCycle = elapsedSeconds % totalCycleLength;

  if (positionInCycle < state.workBlock) {
    // WORK MODE
    if (state.mode !== "work") {
      state.mode = "work";
      ipcRenderer.send("timer:work");
    }

    state.cycleRemaining = state.workBlock - positionInCycle;
  } else {
    // BREAK MODE
    if (state.mode !== "break") {
      state.mode = "break";
      ipcRenderer.send("timer:break");
    }

    state.breakRemaining =
      state.breakBlock - (positionInCycle - state.workBlock);
  }

  // 🟢 Day start notification (only once)
  if (!state.dayStartedNotified && state.workElapsed === 0) {
    ipcRenderer.send("timer:day-start");
    state.dayStartedNotified = true;
  }
}

setInterval(tick, 1000);

/* =========================
   EXPOSED APIs
   ========================= */

contextBridge.exposeInMainWorld("timer", {
  start: () => {
    if (!state.running) {
      state.running = true;

      // preserve elapsed time if resuming
      startTimestamp = Date.now() - state.workElapsed * 1000;

      ipcRenderer.send("timer:start");
    }
  },

  pause: () => {
    state.running = false;
    ipcRenderer.send("timer:pause");
  },

  reset: () => {
    state.running = false;
    state.mode = "work";

    state.workElapsed = 0;
    state.cycleRemaining = state.workBlock;
    state.breakRemaining = state.breakBlock;

    state.dayStartedNotified = false;
    state.dayFinishedNotified = false;

    startTimestamp = null;

    ipcRenderer.send("timer:reset");
  },

  getState: () => state
});

// ✅ Window controls (for your custom X button)
contextBridge.exposeInMainWorld("windowControls", {
  minimizeToTray: () => ipcRenderer.send("window:minimize-to-tray")
});