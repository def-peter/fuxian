const { app, BrowserWindow } = require('electron');
const { writeFileSync } = require('node:fs');

const waitForResult = async (window) => {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const result = await window.webContents.executeJavaScript('globalThis.__prototypeResult');
    if (result?.flowTotal > 0) return result;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error('Paged.js did not finish within 30 seconds.');
};

app.whenReady().then(async () => {
  console.log(`Loading prototype URL: ${process.argv[2]}`);
  const window = new BrowserWindow({
    height: 900,
    show: false,
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    width: 1440,
  });
  window.webContents.on('console-message', (details) => {
    console.log(`[renderer:${details.level}] ${details.message}`);
  });
  window.webContents.on('did-finish-load', () => console.log('Prototype page finished loading.'));
  window.webContents.on('did-fail-load', (_event, code, description) => {
    console.error(`Prototype load failed (${code}): ${description}`);
  });
  await window.loadURL(process.argv[2]);
  const result = await waitForResult(window);
  const pdf = await window.webContents.printToPDF({
    margins: { marginType: 'none' },
    pageSize: 'A4',
    preferCSSPageSize: true,
    printBackground: true,
  });
  writeFileSync(process.argv[3], pdf);
  console.log(`PROTOTYPE_RESULT:${JSON.stringify(result)}`);
  app.quit();
});

app.on('window-all-closed', () => app.quit());
