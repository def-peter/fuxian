# Resolve clicked links from source documents

Finished documents are isolated from the application shell. Relative anchors must not inherit the renderer's development-server or installed-app URL. Both reading modes intercept explicit link clicks and send the author's `href` plus a known source-document path through narrow preload IPC; the main process decodes once, resolves from that source's directory, and validates the actual target at click time. Parent traversal is legitimate author intent. Markdown targets reuse document-session opening, while supported non-executable files use the system default application. Current-document fragments stay in the preview; HTTP(S) opens in the system browser.

Local targets use an explicit document/media extension allowlist, canonical-path checks, and non-executable permissions on Unix. We query native file associations before opening because Electron's `shell.openPath` reports only a generic failure string: macOS uses the existing NSWorkspace helper, and Windows queries the effective `ASSOCSTR_PROGID`, including packaged apps without executable commands. Raw registry defaults and `ASSOCSTR_EXECUTABLE` alone cannot reliably represent the user's default app.

Failures update one dismissible, localized, bottom-right alert without changing the source or document session. Its optional containing-folder action resolves the same original request and rechecks access. Arbitrary directory links and portable local links in exported PDFs remain outside this decision.

References: [Electron shell](https://www.electronjs.org/docs/latest/api/shell), [Windows association strings](https://learn.microsoft.com/en-us/windows/win32/api/shlwapi/ne-shlwapi-assocstr).
