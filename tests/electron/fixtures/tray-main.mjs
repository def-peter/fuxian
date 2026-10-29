// Exercise real application commands and native menus without adding test icons to the user's OS.
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const electron = require('electron');

const state = { trays: [] };
globalThis.fuxianTrayTest = state;
class TestTray extends EventEmitter {
  constructor(icon) {
    super();
    this.icon = icon;
    this.destroyed = false;
    state.trays.push(this);
  }
  isDestroyed() {
    return this.destroyed;
  }
  destroy() {
    this.destroyed = true;
  }
  setToolTip(value) {
    this.tooltip = value;
  }
  setContextMenu(menu) {
    this.menu = menu;
    if (process.env.FUXIAN_E2E_TRAY_INITIAL_COMMAND && !state.initialCommandSent) {
      state.initialCommandSent = true;
      queueMicrotask(() =>
        menu.getMenuItemById(process.env.FUXIAN_E2E_TRAY_INITIAL_COMMAND).click(),
      );
    }
  }
}
globalThis.fuxianCreateTestTray = (icon) => new TestTray(icon);
electron.app.on('quit', () => {
  writeFileSync(
    process.env.FUXIAN_E2E_TRAY_EXIT_MARKER,
    JSON.stringify({
      destroyed: state.trays.map((tray) => tray.destroyed),
    }),
  );
});
state.ready = import(
  new URL('../../../apps/desktop/out/main/index.js', import.meta.url).href
).catch((error) => {
  state.error = error.message;
});
