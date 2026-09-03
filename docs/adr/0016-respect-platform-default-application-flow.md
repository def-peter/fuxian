# ADR 0016: Respect platform default-application flow

## Status

Accepted

## Decision

Fuxian detects `.md` and `.markdown` associations independently in packaged Windows and macOS builds. Windows calls the supported `AssocQueryStringW` Shell API with `ASSOCSTR_PROGID` and compares the effective ProgID with `Fuxian.Markdown`. It does not infer the user choice from internal registry keys or fall back to the installer-owned class default. macOS asks Standard Additions for each extension's Launch Services default application and compares the resolved application bundle with the running bundle.

Changing the default is always an explicit user action. The per-user Windows installer registers `Fuxian` under `RegisteredApplications`, declares `.md` and `.markdown` through `Software\Fuxian\Capabilities`, and maps both extensions to the application-specific `Fuxian.Markdown` ProgID. The running application opens the matching registered-app settings page and leaves `UserChoice` confirmation to Windows. On Windows versions that do not support the registered-app deep link, the settings UI tells the user to search for `Fuxian` and confirm both extensions.

On macOS 12 and later, an application-bundled helper calls the public AppKit `NSWorkspace.setDefaultApplicationAtURL:toOpenContentTypeOfFileAtURL:completionHandler:` API for temporary `.md` and `.markdown` probes. The helper waits for the asynchronous system result, including any consent prompt, before reporting success. It is compiled as a universal executable during packaging and signed with the application when signing is enabled; its binary is not stored in Git. If macOS rejects the request or the helper is unavailable, Fuxian reveals a temporary Markdown example and presents the supported Finder “Open with” and “Change All” workflow. Fuxian never writes Windows `UserChoice` or Launch Services preferences itself.

Development builds report the feature as unavailable. Electron E2E may inject a deterministic status adapter, but it must not inspect or change the host's associations. The settings window refreshes detection whenever it regains focus and never treats registration or opening settings as proof of success.

## Consequences

Status can be fully associated, partially associated, not associated, or unavailable. Platform failures remain visible rather than producing a false success state. Installer declarations, the dedicated Markdown document icon, the status detector, the Windows ProgID, and the packaged macOS helper must evolve together.
