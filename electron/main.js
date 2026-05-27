const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

let mainWindow;
let serverProcess;

const PORT = 3847;

function getAppRoot() {
  // Em produção empacotada: app.getAppPath() = resources/app/
  // Em desenvolvimento: __dirname = electron/ → pai = raiz do projeto
  return app.isPackaged ? app.getAppPath() : path.join(__dirname, '..');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 400,
    minHeight: 600,
    title: 'Depósito Pega na Bodega',
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#020617',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  const appUrl = `http://localhost:${PORT}`;

  const waitForServer = (retries = 150) => {
    return new Promise((resolve, reject) => {
      const check = (attempt) => {
        http.get(appUrl, (res) => {
          resolve();
        }).on('error', () => {
          if (attempt >= retries) {
            reject(new Error('Servidor Next.js não iniciou a tempo'));
          } else {
            setTimeout(() => check(attempt + 1), 500);
          }
        });
      };
      check(0);
    });
  };

  waitForServer()
    .then(() => {
      mainWindow.loadURL(appUrl);
    })
    .catch((err) => {
      console.error('Erro ao aguardar servidor:', err);
      mainWindow.loadURL(`data:text/html;charset=utf-8,
        <html>
          <body style="background:#020617;color:#e2e8f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column">
            <h2 style="color:#f87171">⚠️ Erro ao iniciar o servidor</h2>
            <p style="color:#94a3b8;max-width:400px;text-align:center">${err.message}</p>
            <p style="color:#64748b;font-size:12px;margin-top:16px">Tente fechar e abrir o programa novamente.</p>
          </body>
        </html>`);
      mainWindow.show();
    });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startNextServer() {
  const appRoot = getAppRoot();
  const standaloneServer = path.join(appRoot, '.next', 'standalone', 'server.js');

  console.log('[Electron] App root:', appRoot);
  console.log('[Electron] Standalone path:', standaloneServer);
  console.log('[Electron] Exists:', fs.existsSync(standaloneServer));
  console.log('[Electron] Is packaged:', app.isPackaged);

  if (fs.existsSync(standaloneServer)) {
    // ── Modo Standalone (produção) ──
    console.log('[Electron] Iniciando servidor standalone...');
    
    const standaloneDir = path.join(appRoot, '.next', 'standalone');

    // Copiar .env.local para standalone se existir na raiz
    const envSource = path.join(appRoot, '.env.local');
    const envDest = path.join(standaloneDir, '.env.local');
    if (fs.existsSync(envSource) && !fs.existsSync(envDest)) {
      try { fs.copyFileSync(envSource, envDest); } catch (e) { console.warn('[Electron] Não foi possível copiar .env.local:', e.message); }
    }

    serverProcess = spawn(process.execPath, [standaloneServer], {
      cwd: standaloneDir,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(PORT),
        HOSTNAME: 'localhost',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } else {
    // ── Fallback: usar next start (dev/teste local) ──
    console.log('[Electron] Standalone não encontrado, usando next start...');
    const nextPath = path.join(appRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'next.cmd' : 'next');

    serverProcess = spawn(nextPath, ['start', '--port', String(PORT)], {
      cwd: appRoot,
      env: { ...process.env, NODE_ENV: 'production' },
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }

  serverProcess.stdout.on('data', (data) => {
    console.log(`[Next.js] ${data.toString()}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[Next.js ERR] ${data.toString()}`);
  });

  serverProcess.on('error', (err) => {
    console.error('Erro ao iniciar Next.js:', err);
  });

  serverProcess.on('exit', (code) => {
    console.log(`[Next.js] Processo encerrou com código ${code}`);
  });
}

app.whenReady().then(() => {
  startNextServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
