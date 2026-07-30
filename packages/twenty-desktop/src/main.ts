import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  type MenuItemConstructorOptions,
  shell,
} from 'electron';

import { classifyNavigation } from './navigation-policy';
import { resolveServerUrl } from './server-url';
import { readWindowState, writeWindowState } from './window-state';

const APPLICATION_USER_MODEL_ID = 'com.twenty.internal.desktop';
const CLOUDFLARE_DOH_URL = 'https://cloudflare-dns.com/dns-query';
const DIRECT_NETWORK_SWITCH = 'twenty-direct-network';
const FAILED_LOAD_ERROR_CODE_ABORTED = -3;
const INITIAL_LOAD_TIMEOUT_MS = 20_000;

let desktopWindow: BrowserWindow | null = null;
let isShowingConnectionError = false;
let isRelaunchingForDirectNetwork = false;

const getOfflineResourcePath = (filename: string) =>
  app.isPackaged
    ? path.join(process.resourcesPath, 'offline', filename)
    : path.join(__dirname, '..', 'resources', filename);

const getApplicationIconPath = () =>
  app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(
        __dirname,
        '..',
        '..',
        'twenty-front',
        'public',
        'images',
        'icons',
        'android',
        'android-launchericon-512-512.png',
      );

const focusDesktopWindow = () => {
  if (!desktopWindow || desktopWindow.isDestroyed()) {
    return;
  }

  if (desktopWindow.isMinimized()) {
    desktopWindow.restore();
  }

  desktopWindow.show();
  desktopWindow.focus();
};

const installApplicationMenu = () => {
  const editMenu: MenuItemConstructorOptions = {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
    ],
  };

  const viewSubmenu: MenuItemConstructorOptions[] = [
    { role: 'resetZoom' },
    { role: 'zoomIn' },
    { role: 'zoomOut' },
    { type: 'separator' },
    { role: 'togglefullscreen' },
  ];

  if (!app.isPackaged) {
    viewSubmenu.push(
      { type: 'separator' },
      { role: 'reload' },
      { role: 'toggleDevTools' },
    );
  }

  const menuTemplate: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    editMenu,
    { label: 'View', submenu: viewSubmenu },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'close' }],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
};

const loadConnectionErrorPage = async (
  serverUrl: URL,
  errorCode: number,
  errorDescription: string,
) => {
  const window = desktopWindow;

  if (!window || window.isDestroyed()) {
    return;
  }

  isShowingConnectionError = true;

  try {
    await window.loadFile(getOfflineResourcePath('offline.html'), {
      query: {
        errorCode: String(errorCode),
        errorDescription,
        serverUrl: serverUrl.href,
      },
    });
  } catch {
    if (desktopWindow === window && !window.isDestroyed()) {
      isShowingConnectionError = false;
    }
  }
};

const openExternalDestination = async (destination: string) => {
  try {
    await shell.openExternal(destination);
  } catch {
    // The operating system may not have a handler for mailto or tel links.
  }
};

const configureNavigation = (window: BrowserWindow, serverUrl: URL) => {
  const handleNavigation = (event: Electron.Event, destination: string) => {
    const decision = classifyNavigation(destination, serverUrl.origin);

    if (decision === 'internal') {
      isShowingConnectionError = false;
      return;
    }

    event.preventDefault();

    if (decision === 'external') {
      void openExternalDestination(destination);
    }
  };

  window.webContents.on('will-navigate', handleNavigation);
  window.webContents.on('will-redirect', handleNavigation);
  window.webContents.on('will-attach-webview', (event) =>
    event.preventDefault(),
  );

  window.webContents.setWindowOpenHandler(({ url }) => {
    const decision = classifyNavigation(url, serverUrl.origin);

    if (decision === 'internal') {
      void window.loadURL(url);
    } else if (decision === 'external') {
      void openExternalDestination(url);
    }

    return { action: 'deny' };
  });
};

const configurePermissions = (window: BrowserWindow, serverUrl: URL) => {
  const isAllowedClipboardPermission = (
    requestingUrl: string,
    permission: string,
  ) => {
    try {
      return (
        new URL(requestingUrl).origin === serverUrl.origin &&
        permission === 'clipboard-sanitized-write'
      );
    } catch {
      return false;
    }
  };

  window.webContents.session.setPermissionRequestHandler(
    (requestingWebContents, permission, callback) => {
      callback(
        isAllowedClipboardPermission(
          requestingWebContents.getURL(),
          permission,
        ),
      );
    },
  );

  window.webContents.session.setPermissionCheckHandler(
    (_requestingWebContents, permission, requestingOrigin) =>
      isAllowedClipboardPermission(requestingOrigin, permission),
  );
};

const configureDownloads = (window: BrowserWindow) => {
  window.webContents.session.on('will-download', (_event, item) => {
    const suggestedFilename = path
      .basename(item.getFilename())
      .replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_');
    const savePath = dialog.showSaveDialogSync(window, {
      defaultPath: path.join(app.getPath('downloads'), suggestedFilename),
    });

    if (!savePath) {
      item.cancel();
      return;
    }

    item.setSavePath(savePath);
  });
};

const getDirectNetworkRelaunchArguments = (serverUrl: URL) => {
  const existingBypassRules =
    app.commandLine.getSwitchValue('proxy-bypass-list');
  const bypassRules = [
    existingBypassRules,
    serverUrl.hostname,
    new URL(CLOUDFLARE_DOH_URL).hostname,
  ]
    .filter(Boolean)
    .join(',');
  const replacedSwitches = [
    'dns-over-https-mode',
    'dns-over-https-templates',
    'proxy-bypass-list',
  ];
  const retainedArguments = process.argv
    .slice(1)
    .filter(
      (argument) =>
        !replacedSwitches.some(
          (replacedSwitch) =>
            argument === `--${replacedSwitch}` ||
            argument.startsWith(`--${replacedSwitch}=`),
        ),
    );

  return [
    ...retainedArguments,
    `--${DIRECT_NETWORK_SWITCH}`,
    `--proxy-bypass-list=${bypassRules}`,
    '--dns-over-https-mode=secure',
    `--dns-over-https-templates=${CLOUDFLARE_DOH_URL}`,
  ];
};

const relaunchWithDirectNetworkFallback = (
  isUsingDirectNetworkFallback: boolean,
  serverUrl: URL,
) => {
  if (isUsingDirectNetworkFallback || isRelaunchingForDirectNetwork) {
    return false;
  }

  isRelaunchingForDirectNetwork = true;

  try {
    const relaunchedProcess = spawn(
      process.execPath,
      getDirectNetworkRelaunchArguments(serverUrl),
      {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      },
    );

    relaunchedProcess.unref();
  } catch {
    isRelaunchingForDirectNetwork = false;
    return false;
  }

  // Chromium can block normal Electron shutdown while resolving a hung proxy.
  process.kill(process.pid, 'SIGKILL');

  return true;
};

const createDesktopWindow = async (
  serverUrl: URL,
  isUsingDirectNetworkFallback: boolean,
) => {
  isShowingConnectionError = false;
  const persistedState = readWindowState(app.getPath('userData'));

  desktopWindow = new BrowserWindow({
    backgroundColor: '#fcfcfc',
    height: persistedState.height,
    icon: fs.existsSync(getApplicationIconPath())
      ? getApplicationIconPath()
      : undefined,
    minHeight: 640,
    minWidth: 900,
    show: false,
    title: 'Twenty CRM',
    webPreferences: {
      contextIsolation: true,
      devTools: !app.isPackaged,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
    width: persistedState.width,
    ...(persistedState.x === undefined ? {} : { x: persistedState.x }),
    ...(persistedState.y === undefined ? {} : { y: persistedState.y }),
  });

  configureNavigation(desktopWindow, serverUrl);
  configurePermissions(desktopWindow, serverUrl);
  configureDownloads(desktopWindow);

  desktopWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, _validatedUrl, isMainFrame) => {
      if (
        isMainFrame &&
        errorCode !== FAILED_LOAD_ERROR_CODE_ABORTED &&
        !isShowingConnectionError
      ) {
        if (
          relaunchWithDirectNetworkFallback(
            isUsingDirectNetworkFallback,
            serverUrl,
          )
        ) {
          return;
        }

        void loadConnectionErrorPage(serverUrl, errorCode, errorDescription);
      }
    },
  );
  desktopWindow.webContents.on('did-finish-load', () => {
    if (!desktopWindow || desktopWindow.isDestroyed()) {
      return;
    }

    try {
      if (
        new URL(desktopWindow.webContents.getURL()).origin === serverUrl.origin
      ) {
        isShowingConnectionError = false;
      }
    } catch {
      // The local connection page uses a file URL and has no server origin.
    }
  });

  desktopWindow.once('ready-to-show', () => desktopWindow?.show());
  desktopWindow.on('close', () => {
    if (!desktopWindow || desktopWindow.isDestroyed()) {
      return;
    }

    const bounds = desktopWindow.getNormalBounds();
    writeWindowState(app.getPath('userData'), {
      ...bounds,
      isMaximized: desktopWindow.isMaximized(),
    });
  });
  desktopWindow.on('closed', () => {
    desktopWindow = null;
  });

  if (persistedState.isMaximized) {
    desktopWindow.maximize();
  }

  const initialLoadTimeout = setTimeout(() => {
    if (
      relaunchWithDirectNetworkFallback(isUsingDirectNetworkFallback, serverUrl)
    ) {
      return;
    }

    if (desktopWindow && !desktopWindow.isDestroyed()) {
      desktopWindow.webContents.stop();
      void loadConnectionErrorPage(
        serverUrl,
        0,
        'The server connection timed out.',
      );
    }
  }, INITIAL_LOAD_TIMEOUT_MS);

  try {
    await desktopWindow.loadURL(serverUrl.href);
  } catch (error) {
    if (
      !isRelaunchingForDirectNetwork &&
      !isShowingConnectionError &&
      !relaunchWithDirectNetworkFallback(
        isUsingDirectNetworkFallback,
        serverUrl,
      )
    ) {
      await loadConnectionErrorPage(
        serverUrl,
        0,
        error instanceof Error ? error.message : 'Unable to reach the server',
      );
    }
  } finally {
    clearTimeout(initialLoadTimeout);
  }
};

const startApplication = async () => {
  let serverUrl: URL;

  try {
    const configuredServerUrl = app.isPackaged
      ? undefined
      : process.env.TWENTY_DESKTOP_SERVER_URL;

    serverUrl = resolveServerUrl(configuredServerUrl, {
      allowInsecureLoopback: !app.isPackaged,
    });
  } catch (error) {
    await app.whenReady();
    dialog.showErrorBox(
      'Invalid Twenty server address',
      error instanceof Error ? error.message : 'Invalid server URL',
    );
    app.quit();
    return;
  }

  const isUsingDirectNetworkFallback = app.commandLine.hasSwitch(
    DIRECT_NETWORK_SWITCH,
  );

  const hasSingleInstanceLock = app.requestSingleInstanceLock();

  if (!hasSingleInstanceLock) {
    app.quit();
    return;
  }

  app.on('second-instance', focusDesktopWindow);

  await app.whenReady();

  app.setAppUserModelId(APPLICATION_USER_MODEL_ID);
  installApplicationMenu();
  await createDesktopWindow(serverUrl, isUsingDirectNetworkFallback);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createDesktopWindow(serverUrl, isUsingDirectNetworkFallback);
    } else {
      focusDesktopWindow();
    }
  });
};

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

void startApplication();
