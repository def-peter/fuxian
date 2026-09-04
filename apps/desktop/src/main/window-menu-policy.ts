interface WindowMenuTarget {
  setAutoHideMenuBar(hide: boolean): void;
  setMenuBarVisibility(visible: boolean): void;
}

export const configureWindowMenu = (window: WindowMenuTarget, platform: NodeJS.Platform): void => {
  if (platform !== 'win32') return;
  window.setAutoHideMenuBar(false);
  window.setMenuBarVisibility(false);
};
