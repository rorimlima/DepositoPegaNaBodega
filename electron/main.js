const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let serverProcess;

const PORT = 3847;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 400,
    minHeight: 600,
    title: 'Depósito Pega na Bodega',
    autoHideMenuBar: true,
    show: false, // Mostrar somente quando carregado
    backgroundColor: '#020617', // slate-950 para evitar flash branco
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Abrir links externos no navegador padrão
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Mostrar janela quando o conteúdo estiver pronto
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  const appUrl = `http://localhost:${PORT}`;

  // Aguardar o servidor Next.js ficar pronto
  const waitForServer = (retries = 120) => {
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
  // Em produção empacotada, usar o standalone server.js
  // Em desenvolvimento, usar next start
  const appDir = path.join(__dirname, '..');
  const standaloneServer = path.join(appDir, '.next', 'standalone', 'server.js');
  const fs = require('fs');

  if (fs.existsSync(standaloneServer)) {
    // ── Modo Standalone (produção empacotada) ──
    console.log('[Electron] Iniciando servidor standalone...');
    
    // O standalone precisa das pastas public e .next/static copiadas
    const standaloneDir = path.join(appDir, '.next', 'standalone');
    
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
    const nextPath = path.join(appDir, 'node_modules', '.bin', process.platform === 'win32' ? 'next.cmd' : 'next');

    serverProcess = spawn(nextPath, ['start', '--port', String(PORT)], {
      cwd: appDir,
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
