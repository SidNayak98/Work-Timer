const { app, BrowserWindow, ipcMain, Tray, Menu, Notification } = require("electron");
const path = require("path");

let mainWindow;
let tray;

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
ipcMain.on("timer:reset", () => console.log("RESET RECEIVED"));

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