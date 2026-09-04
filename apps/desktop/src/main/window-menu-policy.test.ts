import { describe, expect, it, vi } from 'vitest';
import { configureWindowMenu } from './window-menu-policy';

describe('configureWindowMenu', () => {
  it('permanently hides the native menu bar only on Windows', () => {
    const windowsTarget = {
      setAutoHideMenuBar: vi.fn(),
      setMenuBarVisibility: vi.fn(),
    };
    configureWindowMenu(windowsTarget, 'win32');
    expect(windowsTarget.setAutoHideMenuBar).toHaveBeenCalledWith(false);
    expect(windowsTarget.setMenuBarVisibility).toHaveBeenCalledWith(false);

    for (const platform of ['darwin', 'linux'] as const) {
      const target = {
        setAutoHideMenuBar: vi.fn(),
        setMenuBarVisibility: vi.fn(),
      };
      configureWindowMenu(target, platform);
      expect(target.setAutoHideMenuBar).not.toHaveBeenCalled();
      expect(target.setMenuBarVisibility).not.toHaveBeenCalled();
    }
  });
});
