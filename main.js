const { app, BrowserWindow, ipcMain, Tray, Menu, Notification } = require("electron");
const path = require("path");

let mainWindow;
let tray;

let notifiedMilestones = new Set();

/* =========================
   NOTIFICATIONS (optional)
   ========================= */

function notify(title, body) {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
}

/* =========================
   IPC EVENTS
   ========================= */

ipcMain.on("timer:day-start", () => {
  notify("Work Day Started", "Timer has begun from 00:00:00");
});

ipcMain.on("timer:pause", () => console.log("PAUSE RECEIVED"));
ipcMain.on("timer:reset", () => {
  console.log("RESET RECEIVED")
  notifiedMilestones.clear();}
);


ipcMain.on("timer:break", () => {
  console.log("BREAK RECEIVED");
  notify("Break Time", "Take a short break");
});

ipcMain.on("timer:work", () => {
  console.log("WORK RECEIVED");
  notify("Work Time", "Back to focus");
});

ipcMain.on("timer:day-finish", () => {
  notify("Work Day Complete", "8-hour work session finished");
});

ipcMain.on("window:minimize-to-tray", () => {
  if (mainWindow) {
    mainWindow.hide();
  }
});

ipcMain.on("timer:tick", (event, workSeconds) => {

  // Every 30 minutes
  if (
    workSeconds > 0 &&
    workSeconds % (30 * 60) === 0 &&
    !notifiedMilestones.has(workSeconds)
  ) {
    const minutes = workSeconds / 60;

    notify(
      "Work Progress",
      `${minutes} minutes completed.`
    );

    notifiedMilestones.add(workSeconds);
  }

  // 2.5 hour mark
  if (
    workSeconds === 150 * 60 &&
    !notifiedMilestones.has("2.5h")
  ) {
    notify(
      "Break Recommended",
      "You've worked 2 and a half hours. Please take a break."
    );

    notifiedMilestones.add("2.5h");
  }

  // 5 hour mark
  if (
    workSeconds === 300 * 60 &&
    !notifiedMilestones.has("5h")
  ) {
    notify(
      "Break Recommended",
      "You've worked 5 hours. Please take a break."
    );

    notifiedMilestones.add("5h");
  }

});

/* =========================
   TRAY SETUP
   ========================= */

function createTray() {
  tray = new Tray(path.join(__dirname, "tray.png")); // add any 16x16/32x32 png

  const menu = Menu.buildFromTemplate([
    {
      label: "Show Timer",
      click: () => mainWindow.show()
    },
    {
      label: "Pause",
      click: () => mainWindow.webContents.send("tray:pause")
    },
    {
      label: "Quit",
      click: () => app.quit()
    }
  ]);

  tray.setToolTip("Work Timer");
  tray.setContextMenu(menu);

  tray.on("click", () => {
    mainWindow.show();
  });
}

/* =========================
   WINDOW
   ========================= */

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 360,
    height: 360,

    alwaysOnTop: true,
    frame: false,
    transparent: true,
    resizable: false,

    skipTaskbar: false,

    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile("index.html");

  mainWindow.setAlwaysOnTop(true, "screen-saver");

  /* =========================
     MINIMIZE → TRAY (KEY PART)
     ========================= */
  mainWindow.on("minimize", (e) => {
    e.preventDefault();
    mainWindow.hide(); // instead of minimizing
  });

  mainWindow.on("close", (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

/* =========================
   APP LIFECYCLE
   ========================= */

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on("before-quit", () => {
  app.isQuitting = true;
});