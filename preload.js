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
  dayFinishedNotified: false,
};

function tick() {
  if (!state.running) return;

  if (state.mode === "work") {

    // ⏱ start-of-day notification (only once, at 0)
    if (!state.dayStartedNotified && state.workElapsed === 0 && state.running) {
      ipcRenderer.send("timer:day-start");
      state.dayStartedNotified = true;
    }

    state.cycleRemaining = Math.max(0, state.cycleRemaining - 1);
    state.workElapsed++;

    // 🏁 8 hour completion notification
    if (!state.dayFinishedNotified && state.workElapsed >= state.workDayLimit) {
      ipcRenderer.send("timer:day-finish");
      state.dayFinishedNotified = true;
    }

    if (state.cycleRemaining === 0) {
      state.mode = "break";
      state.breakRemaining = state.breakBlock;
      ipcRenderer.send("timer:break");
    }
  } else {
    state.breakRemaining = Math.max(0, state.breakRemaining - 1);

    if (state.breakRemaining === 0) {
      state.mode = "work";
      state.cycleRemaining = state.workBlock;
    }
  }
}

setInterval(tick, 1000);

contextBridge.exposeInMainWorld("timer", {
  start: () => {
    state.running = true;
    ipcRenderer.send("timer:start");
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
    ipcRenderer.send("timer:reset");
  },

  getState: () => state
});