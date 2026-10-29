# ADR 0036: Add native desktop tray shortcuts

Fuxian provides a macOS menu-bar icon and a Windows notification-area icon while the application is running. Their localized native menus expose Show Main Window, New Markdown, Open Markdown, Settings, and Quit, reusing the same application commands and unsaved-change guards as existing entry points.

The icon is a shortcut, not background-residency policy. Closing a window keeps existing platform behavior, quitting still exits the application, and no login-startup setting is added. Tray Quit reveals an existing main window so an unsaved-change prompt cannot remain hidden or minimized. The tray is destroyed only on `will-quit`, after any unsaved-change confirmation has completed; canceling Quit must leave the icon usable.

New and Open can recreate the main window. Main-process command delivery waits for the renderer to subscribe, and new-document delivery additionally waits for session restoration so a recovered draft cannot be replaced silently. Restoration runs once per window: applying the saved interface language or changing it later must not reload the session over newly created documents or unsaved edits. macOS uses a transparent template mark at standard and Retina resolutions; Windows uses a multi-resolution color ICO. Packaging verifies these assets are present.

Hidden Electron tests omit OS tray icons by default. Dedicated tray tests inject only the native icon surface; they retain real Electron menus, preload delivery, document guards, language updates, and window lifecycle. Native macOS and Windows visual acceptance remains separate from these hidden tests.
