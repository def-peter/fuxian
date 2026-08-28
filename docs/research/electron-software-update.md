# Electron software-update architecture

> 调研日期：2026-08-28。结论针对 Electron 44、electron-builder 26.15.3、Windows NSIS、macOS DMG/ZIP 和 GitHub Releases；资料仅采用官方文档与上游源码。

## Recommendation

采用与现有 builder 版本线匹配的 `electron-updater@6.8.9`，由 Electron **主进程**独占更新器，renderer 只通过窄类型 IPC 接收状态和发起“检查、下载、重启安装”。不要使用 Electron 内置 `autoUpdater`，也不要自行实现版本比较、下载、校验或安装。`electron-updater` 会消费 builder 写入安装包的 `app-update.yml`，并支持 GitHub、更新元数据、下载进度、Windows 签名校验和 staged rollout；官方明确要求不要再调用 `setFeedURL`。[官方指南](https://github.com/electron-userland/electron-builder/blob/electron-builder%4026.15.3/website/docs/features/auto-update.md) [6.8.9 包元数据](https://github.com/electron-userland/electron-builder/blob/electron-builder%4026.15.3/packages/electron-updater/package.json)

建议首版策略：

- 只使用稳定 `latest` channel：`allowPrerelease = false`、`allowDowngrade = false`。
- `autoDownload = false`、`autoInstallOnAppQuit = false`、`disableWebInstaller = true`。启动后延迟检查一次，并在“帮助 > 检查更新…”提供手动入口；发现版本后由用户决定下载，完成后明确选择“重启并更新”。这些选项及默认行为见 [AppUpdater 源码](https://github.com/electron-userland/electron-builder/blob/electron-builder%4026.15.3/packages/electron-updater/src/AppUpdater.ts)。
- 状态机固定为 `idle/checking/available/downloading/downloaded/up-to-date/error/unsupported`，包含当前版本、目标版本、进度和可重试错误；不要把服务器 URL、文件路径或任意 release HTML 暴露给 renderer。
- 仅在 `app.isPackaged` 且为 `win32`/`darwin` 时启用真实更新器。开发 UI 使用注入的 fake adapter；上游也明确建议用安装后的应用测试真实更新，而不是依赖开发模式。[调试建议](https://github.com/electron-userland/electron-builder/blob/electron-builder%4026.15.3/website/docs/features/auto-update.md#debugging)

## Current release gaps

| Current state                                                     | Consequence                                                                                                          | Required change                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `def-peter/fuxian` 必须保持 public                                | 普通用户不能匿名读取 private Release；private provider 要求在**用户机器**提供 `GH_TOKEN`，官方明确称其不适合一般用户 | 发布工作流在仓库不是 public 时直接失败。绝不能把 GitHub token 打进应用。[private repo 限制](https://github.com/electron-userland/electron-builder/blob/electron-builder%4026.15.3/website/docs/features/auto-update.md#private-github-update-repo)                                                                                                                             |
| CI 设置 `CSC_IDENTITY_AUTO_DISCOVERY=false`，`mac.notarize=false` | macOS 自动更新不能工作，下载应用也会触发 Gatekeeper                                                                  | 使用 Developer ID Application 签名并 notarize；Electron 明确说明 Squirrel.Mac 必须签名，面向分发的 macOS 构建需要签名后公证。[Electron code signing](https://github.com/electron/electron/blob/v44.0.0/docs/tutorial/code-signing.md)                                                                                                                                          |
| mac target 只有 DMG                                               | `MacUpdater` 实际安装 ZIP；只有 `latest-mac.yml`/DMG 仍会报 `ZIP file not provided`                                  | 改为 `dmg` + `zip`，Release 同时上传两个架构的 ZIP。[官方 target 要求](https://github.com/electron-userland/electron-builder/blob/electron-builder%4026.15.3/website/docs/features/auto-update.md#auto-updatable-targets) [MacUpdater 源码](https://github.com/electron-userland/electron-builder/blob/electron-builder%4026.15.3/packages/electron-updater/src/MacUpdater.ts) |
| workflow 只上传 `.exe`/`.dmg`                                     | 客户端找不到 channel metadata，无法校验或差分下载                                                                    | 上传 `latest.yml`、`latest-mac.yml`、NSIS EXE、macOS ZIP、DMG 及生成的 `.blockmap`。                                                                                                                                                                                                                                                                                           |
| 两个 macOS matrix job 各自产生同名 `latest-mac.yml`               | 一个架构的 metadata 会覆盖另一个                                                                                     | 在一次 builder invocation 中构建 `--x64 --arm64`，让 builder 合成唯一 metadata；两架构仍分别做 packaged smoke test。                                                                                                                                                                                                                                                           |

Windows NSIS 是受支持 target，且 updater 在 `app-update.yml` 存在 `publisherName` 时默认验证下载 EXE 的签名；缺少 publisher 时源码会跳过此验证。因此首个可自动更新的生产版本应先完成 Windows 签名，不能把“SHA-512 完整性”误当作“发布者真实性”。[NSIS 验签源码](https://github.com/electron-userland/electron-builder/blob/electron-builder%4026.15.3/packages/electron-updater/src/NsisUpdater.ts#L109-L123) Windows 可使用 Azure Artifact Signing（有地区限制）或受信任的云/HSM 证书；Electron 不建议向普通用户分发未签名应用。[Electron Windows signing](https://github.com/electron/electron/blob/v44.0.0/docs/tutorial/code-signing.md#signing-windows-builds)

## Implementation boundary

新增一个可注入的 main-process `UpdateService`，负责事件订阅、并发检查去重、生命周期清理和 `quitAndInstall()`；生产 adapter 包装 `electron-updater`，测试 adapter 不访问网络。扩展 `@fuxian/shared-types`、preload bridge 和主进程 handlers，所有输入按已有 IPC 方式验证。帮助菜单触发同一个 service；设置页“关于”区显示版本和状态，主窗口可显示非阻塞更新提示。用户确认重启前先等待现有 document-session 持久化队列完成。

单元测试覆盖状态转换、重复检查、下载进度、错误重试、非 packaged/不支持平台、IPC 输入和 listener 清理；Electron E2E 通过 fake adapter 覆盖中文 UI，不访问 GitHub。真实 updater 不能只靠 mock 验收。

## Release and update verification

1. 同步根包与 desktop 包 SemVer，运行 format、lint、typecheck、Vitest、Electron E2E 和 packaged smoke tests。
2. CI 使用相同证书身份构建签名 Windows NSIS，以及签名、notarized 的 macOS x64/arm64 DMG+ZIP；不要继续设置 `CSC_IDENTITY_AUTO_DISCOVERY=false`。使用 builder 支持的 `CSC_*` 和 Apple API key secrets，机密只保存在 GitHub Actions secrets。[builder signing variables](https://github.com/electron-userland/electron-builder/blob/electron-builder%4026.15.3/website/docs/features/code-signing/code-signing.md) [notarization options](https://github.com/electron-userland/electron-builder/blob/electron-builder%4026.15.3/packages/app-builder-lib/src/options/macOptions.ts#L238-L250)
3. 汇总并验证完整 asset 集；解析 `latest*.yml`，确认每个 URL 均有同名 asset 且 size/SHA-512 匹配。验证 Authenticode、`codesign --verify --deep --strict` 和 notarization ticket。
4. 先创建 GitHub **draft**，上传并核验全部 assets 后再发布为 stable/latest，避免客户端看见半套文件。GitHub 的 latest endpoint 排除 draft 和 prerelease；electron-updater stable provider 正是从 `/releases/latest` 取得 tag，再读取该 tag 下的 channel 文件。[GitHub latest release](https://docs.github.com/en/rest/releases/releases#get-the-latest-release) [GitHubProvider 源码](https://github.com/electron-userland/electron-builder/blob/electron-builder%4026.15.3/packages/electron-updater/src/providers/GitHubProvider.ts)
5. 正式发布前，用同一签名身份制作一个较低版本和候选版本，通过临时 public/generic HTTPS feed 在三种目标（Windows x64、macOS x64、macOS arm64）完成“检查 → 下载 → 重启安装 → 会话恢复 → 新版本号”全链路。然后才发布 GitHub Release。

无法及时取得签名凭据时，可以发布明确标注的预览安装包，但不应宣称具备生产自动更新：macOS 路径必然不可用，Windows 也失去发布者验签。
