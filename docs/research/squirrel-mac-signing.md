# Squirrel.Mac signing requirements

> 调研日期：2026-09-08。核对官方源码、测试和 Apple 文档，并完成隔离自签应用的连续更新实验。未修改生产更新实现；实验条件与尚未验证的分发场景分开记录。

## Conclusion

> 当前产品决定（2026-09-08）：暂缓自签自动安装，不配置长期证书或 GitHub 签名 Secrets。继续采用 ADR 0026 的应用内下载完整 DMG、用户手动安装方案；安装授权和安全确认交由 macOS 处理，不承诺后续更新免密码。以下研究与实验保留作参考，不作为当前实施计划。

Electron 内置 macOS `autoUpdater` 要求应用具有可用的代码签名，更新包必须满足旧应用的 designated requirement（DR，指定要求）。这不等价于“校验器硬编码要求付费 Developer ID”。完全未签名、默认 ad-hoc、自签证书、Developer ID 是不同状态，不能统称“未签名”。[Electron 官方说明](https://www.electronjs.org/docs/latest/api/auto-updater/#macos) [实际校验实现](https://github.com/Squirrel/Squirrel.Mac/blob/8d808803bc89ec0e2aa1450474856dfee3b00c6b/Squirrel/SQRLCodeSignature.m#L78-L90)

本仓库使用 Electron `44.0.0`；该版本 [DEPS](https://github.com/electron/electron/blob/v44.0.0/DEPS#L12-L13) 固定 Squirrel.Mac commit `8d808803bc89ec0e2aa1450474856dfee3b00c6b`。下文源码链接均固定到这两个版本，不采用当前主分支新增的更新流程。

## Exact verification path

1. Electron `AutoUpdater::SetFeedURL` 创建 `SQRLUpdater`；并非等到 `quitAndInstall` 才创建。Objective-C 异常会被捕获并转成 `delegate->OnError(error.reason)`。[Electron：90–104 行](https://github.com/electron/electron/blob/v44.0.0/shell/browser/auto_updater_mac.mm#L90-L104)
2. `SQRLUpdater` 初始化时立即调用 `currentApplicationSignature`。获取失败时，Debug 构建返回 `nil`；Release 构建抛出 `NSInternalInconsistencyException`，原因为 `Could not get code signature for running application`。[初始化：201–210 行](https://github.com/Squirrel/Squirrel.Mac/blob/8d808803bc89ec0e2aa1450474856dfee3b00c6b/Squirrel/SQRLUpdater.m#L201-L210)
3. `currentApplicationSignature` 经 `SecCodeCopySelf` 获取当前代码，再由 `SecCodeCopyDesignatedRequirement` 获取旧应用的 DR。任一 Security API 返回错误时，函数返回 `nil`。[签名读取：48–90 行](https://github.com/Squirrel/Squirrel.Mac/blob/8d808803bc89ec0e2aa1450474856dfee3b00c6b/Squirrel/SQRLCodeSignature.m#L48-L90)
4. ZIP 解包后，`verifyAndPrepareUpdate` 先用旧应用的 `self.signature` 校验新版 `.app`，成功后才调用 `prepareUpdateForInstallation` 写 ShipIt 请求并启动安装辅助进程。[准备安装：750–831 行](https://github.com/Squirrel/Squirrel.Mac/blob/8d808803bc89ec0e2aa1450474856dfee3b00c6b/Squirrel/SQRLUpdater.m#L750-L831)
5. 核心 API 为 `SecStaticCodeCheckValidityWithErrors`。flags 包含 `kSecCSCheckNestedCode`、`kSecCSStrictValidate`、`kSecCSCheckAllArchitectures`，requirement 参数直接使用旧应用的 DR。失败产生 `SQRLCodeSignatureErrorDomain`、code `-1`，附带系统失败原因；创建静态代码对象失败为 `-2`。[校验：103–147 行](https://github.com/Squirrel/Squirrel.Mac/blob/8d808803bc89ec0e2aa1450474856dfee3b00c6b/Squirrel/SQRLCodeSignature.m#L103-L147)
6. ShipIt 安装器还会从磁盘上的目标旧应用读取签名，再次校验更新包。因此只跳过更新器前半段，也不能自然得到未签名应用的原生安装通道。[安装前校验](https://github.com/Squirrel/Squirrel.Mac/blob/8d808803bc89ec0e2aa1450474856dfee3b00c6b/Squirrel/SQRLInstaller.m#L261-L269) [获取目标签名](https://github.com/Squirrel/Squirrel.Mac/blob/8d808803bc89ec0e2aa1450474856dfee3b00c6b/Squirrel/SQRLInstaller.m#L518-L538)

特别是第 1、2 步：任何声称“只下载，因此无需签名”的封装，都必须确认它是否仍会调用 Electron 原生 `setFeedURL`。只检查 `autoInstallOnAppQuit` 或是否调用 `quitAndInstall` 不足以证明绕开签名要求。

## Signing states

| 旧应用 → 新应用                                 | Squirrel 原生更新结果                  | 依据与边界                                                                                                                                                |
| ----------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 完全未签名 → 任意状态                           | 旧应用没有 DR，初始化更新器失败        | Apple 明确说明 unsigned code 没有 DR；Electron 自身测试验证未签名应用在设置 feed 时失败。给新版补签不能修复已运行旧版的初始化。                           |
| 有有效签名 → 完全未签名                         | 新版校验失败                           | 新版不能满足旧版 DR，且必须通过签名完整性校验。                                                                                                           |
| 默认 ad-hoc → 内容变化的新版                    | 通常可初始化，但不能通过跨版本 DR 校验 | 默认 ad-hoc 的 DR 绑定当前构建的 cdhash；重新构建后的 DR 不稳定。                                                                                         |
| ad-hoc + 显式稳定 DR → 满足该 DR 的新版         | 技术上可以通过这层校验                 | 官方测试就是这样签名；但 identifier-only DR 不认证发布者，不能当作可靠的发布身份。                                                                        |
| 自签代码签名证书 → 同一身份、兼容 DR 的有效新版 | 签名校验层可成立                       | Squirrel 使用旧版 DR，没有额外硬编码 Developer ID 或 notarization 条件；Apple 支持用自签证书验证 DR。实际分发、系统信任、嵌套代码和完整更新流程仍需实测。 |
| Developer ID → 满足旧版 DR 的有效新版           | 满足正常签名路径的条件                 | “两版都购买签名”并不够，新版仍需满足旧版 DR；换团队或签名类别时需检查兼容性。                                                                             |

Apple [TN3127](https://developer.apple.com/documentation/technotes/tn3127-inside-code-signing-requirements) 解释 unsigned 与默认 ad-hoc 的 DR 差异，以及身份兼容性。Electron [未签名测试](https://github.com/electron/electron/blob/v44.0.0/spec/api-autoupdater-darwin-spec.ts#L163-L198) 在 x64 验证 feed 初始化失败；该测试因 arm64 默认附带签名而跳过 arm64，不能把跳过解释成“arm64 无需签名”。Squirrel [校验测试](https://github.com/Squirrel/Squirrel.Mac/blob/8d808803bc89ec0e2aa1450474856dfee3b00c6b/SquirrelTests/SQRLCodeSignatureSpec.m) 覆盖不同要求、缺失签名、损坏资源与嵌套代码。

关键例外有直接源码证据：Squirrel 的 [sign-test-fixtures](https://github.com/Squirrel/Squirrel.Mac/blob/8d808803bc89ec0e2aa1450474856dfee3b00c6b/script/sign-test-fixtures) 使用 `codesign -s -` 和显式 identifier-only DR 签署旧版、新版，并检查新版满足该要求。这证明“所有 ad-hoc 都绝对无法更新”是不准确的。它是测试机制，不是建议 Fuxian 将发布者校验降为字符串匹配。

自签证书与 ad-hoc 也不同：前者有证书和私钥，可建立跨版本签名身份；后者不提供该发布者证明。Apple [Code Signing Tasks](https://developer.apple.com/library/archive/documentation/Security/Conceptual/CodeSigningGuide/Procedures/Procedures.html) 明确说明自签证书可以验证代码的 DR；[TN2206](https://developer.apple.com/library/archive/technotes/tn2206/) 说明具体子系统决定是否要求系统信任的 CA，自签身份与自建 CA 可以用于依赖稳定 DR 的验证。下文隔离实验进一步验证了本机上的自签 Electron 更新路径。

## Self-signed A → B → C experiment

### Scope and method

- 主机：macOS 26.5、Intel x64。Gatekeeper 启用；`csrutil status` 显示自定义 SIP 配置，多项保护关闭。本次没有修改这些设置。
- 独立应用 ID：`com.defpeter.fuxian.selfsign.hxtbda`。安装位置为用户可写临时目录，不是已安装的浮现，也不是 `/Applications`。
- 三版最小 Electron 应用使用同一临时 RSA 2048 自签代码签名证书，有效期仅两天。没有 Developer ID、公证或系统信任导入。
- Electron 44.0.0、electron-updater 6.8.9 及内置 Squirrel 均未修改。测试入口加载仓库中的 updater 模块，不代表完整生产包依赖布局已经验收。
- 本机 HTTP 服务提供真实应用 ZIP 和 SHA-512。设置 `autoDownload=false`、`autoInstallOnAppQuit=false`，依次调用检查、下载、`quitAndInstall()`。没有强制开发更新开关，没有跳过原生签名检查。
- 禁用差分下载，专门测试签名、替换与重启。未生成 blockmap，不声称已验证增量或提速。测试应用无窗口，并通过 `LSUIElement` 隐藏 Dock 图标。

### Signing tooling boundary

直接使用 `codesign --keychain ... --sign <SHA1>` 返回 `no identity found`；同一临时钥匙串的 `security find-identity` 能看到身份，但报告 `CSSMERR_TP_NOT_TRUSTED`。这不足以精确断定 CLI 失败一定由信任过滤造成。

为不改变主机信任，实验辅助程序从确切钥匙串取得 `SecIdentityRef`，经 Apple `SecCodeSignerCreate` / `SecCodeSignerAddSignatureWithErrors` 签署代码。私钥访问仅授权确切辅助程序路径，辅助程序禁用交互授权。沿用 `@electron/osx-sign` 的嵌套遍历，替换其签署调用，最后仍用原版 `codesign --verify --deep --strict` 验证。最终 DR 为：

```text
identifier "com.defpeter.fuxian.selfsign.hxtbda"
and certificate leaf = H"c13a5309e0abe9d2aee5a90628052fd98358c4e3"
```

这里绑定实际证书，并非 identifier-only 要求。删除临时钥匙串后，正确证书要求通过所有架构严格验证；换成全零证书指纹的负向验证失败，返回 code 3。

`SecCodeSigner` 是 Apple SPI，实验辅助程序不是长期发布工具。正式落地前仍需解决可维护的 CI 签名方式、私钥保管和证书连续性，不能直接搬入发版链路。[签名接口](https://github.com/apple-oss-distributions/Security/blob/main/OSX/libsecurity_codesigning/lib/SecCodeSigner.h) [身份取得](https://github.com/apple-oss-distributions/Security/blob/main/OSX/libsecurity_keychain/lib/SecIdentity.cpp#L205-L220) [签署阶段的信任处理](https://github.com/apple-oss-distributions/Security/blob/main/OSX/libsecurity_codesigning/lib/signerutils.cpp#L377-L398)

### Observed results

以下时间为 2026-09-08 UTC，来自各版本实际进程的事件记录：

| 运行条件                           | A 1.0.0 启动 | B 1.0.1 自动启动 | C 1.0.2 自动启动 | 结果                 |
| ---------------------------------- | ------------ | ---------------- | ---------------- | -------------------- |
| 临时签名钥匙串仍在，未加入搜索列表 | 02:45:41     | 02:45:54         | 02:46:07         | 两次替换、重启成功   |
| 删除两份临时签名钥匙串后复测       | 02:47:11     | 02:47:24         | 02:47:41         | 两次替换、重启仍成功 |

各版本均确认 `app.isPackaged=true`，从同一安装路径启动。ShipIt 日志记录安装成功、新进程启动成功、退出状态 0；最终磁盘版本为 `1.0.2`。全过程未请求密码。删除钥匙串后复测说明这条路径不依赖运行端保留签名私钥。

### Limits and release gate

`spctl --assess --type execute` 对自签应用返回 `rejected`（code 3）。因此“可以自签自动更新”不等于“首次联网安装被 Gatekeeper 默认认可”。测试包没有互联网下载隔离标记，也没有实测首次“仍要打开”的系统确认。

发布前仍需以下验收；通过之前，不承诺“第一次输入密码后永远不用再输”：

1. 在 SIP 默认开启的真实 Mac 上，从浏览器下载安装包，完成一次用户确认，再连续更新两次；至少覆盖 Apple Silicon。
2. 分别覆盖用户可写安装位置和 `/Applications`、管理员与普通账户。Squirrel 在应用和父目录均可写时才走无提权安装；首次 Gatekeeper 确认不会自动赋予未来目录写权限。[权限分支](https://github.com/Squirrel/Squirrel.Mac/blob/8d808803bc89ec0e2aa1450474856dfee3b00c6b/Squirrel/SQRLUpdater.m#L347-L356)
3. 用正式打包链路验证证书固定、错误签名拒绝、下载损坏/中断、安装失败恢复和完整应用功能；差分 ZIP 另做验收。
4. 已发布的完全未签名版本需手动安装一次自签过渡版。保留 GitHub 下载页和手动安装兜底，不直接切换所有用户的更新通道。

实验未覆盖真实浮现。两份临时钥匙串已删除，创建前后默认钥匙串与搜索列表均仅为原来的 `login.keychain-db`；未执行证书信任添加操作。实验私钥和 PKCS#12 文件清理，应用及缓存移至废纸篓；仓库只保留本调研记录，不保留测试身份。

## Pinned electron-updater download-only experiment

本地隔离测试使用 Electron 44.0.0 x64 的临时副本和项目锁定的
electron-updater 6.8.9。`codesign -dv` 确认该副本完全未签名；本地已有
`release/mac/浮现.app` 的同一检查也显示完全未签名。未改动应用源码、
用户安装的应用、签名证书或系统信任设置。

测试设置 `autoDownload=false`、`autoInstallOnAppQuit=false`，通过本机 HTTP
更新源提供一个有效的空 ZIP 及其 SHA-512，调用 `checkForUpdates()` 和
`downloadUpdate()`，不调用原生检查或安装。结果同时出现：

- ZIP 下载完成，`downloadUpdate()` 正常返回文件路径，`update-downloaded` 事件触发。
- 下载文件存在，独立 SHA-512 复核一致。
- Electron 原生 updater 和 electron-updater 都发出错误：
  `Could not get code signature for running application`。

这是完整下载与交接路径的真实执行，但 ZIP 不含可安装应用，不构成一次
跨版本安装实验。测试没有启动应用替换或修改任何现有应用。

原因是 [6.8.9 MacUpdater](https://github.com/electron-userland/electron-builder/blob/electron-updater%406.8.9/packages/electron-updater/src/MacUpdater.ts)
在下载完成回调中先缓存 `update.zip`，然后无条件调用原生 `setFeedURL`；
`autoInstallOnAppQuit=false` 只阻止后续原生 `checkForUpdates`，没有阻止
Squirrel 初始化。因此“只设置 false 就能获得干净的未签名下载模式”不成立。
另一方面，“没有签名连官方 ZIP 都无法下载”也不成立。

官方下载与差分计算本身不验证发布者代码签名；有匹配旧 ZIP 缓存和
blockmap 时，可以重用其差分能力。交给用户手动安装仍需应用拥有的交接逻辑，
并将下载完成处理与原生安装初始化分离。当前相关 `updateDownloaded`
方法在 TypeScript 中为 private，不是直接支持的公开替换接口；不应吞掉所有
updater 错误来假装原始流程无问题。此处为源码确认，未实测两版未签名 ZIP 的增量。

软件可以在完整校验后代为解压到暂存目录，展示 `.app` 供用户手动替换，
不要求用户亲自解压；但权限、符号链接和应用结构必须保持，且这一步属于
应用新增的交付逻辑，并非现成 Squirrel 手动安装模式。

## Developer ID, notarization, and manual ZIPs

Developer ID Application 用于签署 Mac 应用，公证提供 Apple 的检查结果，二者共同服务于互联网分发时的 Gatekeeper 验证。申请 Developer ID 属于 Apple Developer Program 的证书能力；它与“系统有没有能力产生代码签名”是两个问题。[Apple Developer ID 文档](https://developer.apple.com/help/account/certificates/create-developer-id-certificates/)

Squirrel 源码中上述 Security API 校验不能被概括为“必须公证后才能读取 ZIP”；不过普通用户从网络下载应用时，Gatekeeper 默认检查 Developer ID，并在 Catalina 及之后默认要求公证。自签证书不会自动获得这种分发信任。[Apple Gatekeeper 说明](https://support.apple.com/en-us/102445)

ZIP 手动安装不调用 Squirrel：下载、解压、退出旧应用、用新版 `.app` 替换旧版属于另一条安装流程，Squirrel 的旧版 DR 不限制 Finder 的手动文件复制。这个流程不能消除 Gatekeeper、架构兼容性或损坏签名问题。Apple 为来源可信但未识别/未公证的应用提供“系统设置 > 隐私与安全 > 仍要打开”的逐应用例外；受管理的 Mac 可能限制该选项。它是用户确认后的系统例外，不是签名或公证。[Apple 手动打开说明](https://support.apple.com/en-us/102445#openanyway)

因此，当前未签名版本能否“应用内下载 ZIP，再让用户手动替换”，需要另外核对下载器是否纯下载、是否意外初始化 Squirrel，以及下载文件的校验与交付方式；不能仅凭 Squirrel 要求签名，就否定所有应用内下载或手动更新方案。

## Online verification of first approval and later updates

补充核对日期：2026-09-08。网上官方材料能够缩小上述实验边界，不应把“本机 SIP 非默认”表述为“正常 Mac 可能必须关闭 SIP 才能更新”。

- **首次允许有明确官方流程。** Apple 为未知开发者或未公证应用提供“系统设置 > 隐私与安全 > 仍要打开”，其 Mac 使用手册包含输入登录密码，并说明系统会保存该应用的例外，今后可以正常双击打开。macOS 15 起不能再依赖旧的 Control-click 放行方式。这不是让用户全局关闭 Gatekeeper，也不是导入自签根证书。[Apple 使用手册](https://support.apple.com/en-euro/guide/mac-help/mh40616/mac) [macOS Sequoia 变更](https://developer.apple.com/news/?id=saqachfa)
- **后续更新并不只依赖系统记住首次例外。** 固定版本 Squirrel 的 `prepareAndValidateUpdateBundleURLForRequest` 会清除待安装更新应用的 quarantine，再按旧应用签名要求验证新版。`clearQuarantineForDirectory` 的注释明确将避免重复互联网下载警告列为目的。这是上游更新器自带的安装行为，不是项目另加的全局安全绕过。[Squirrel 安装器](https://github.com/Squirrel/Squirrel.Mac/blob/8d808803bc89ec0e2aa1450474856dfee3b00c6b/Squirrel/SQRLInstaller.m)
- **关闭 SIP 不是这条方案的前提。** Apple 明确列出 `/Applications` 属于第三方应用和安装器仍可写入的位置。是否免管理员密码，还取决于当前账户对目标应用与父目录的写权限；Squirrel 默认检查两者，不能将首次 Gatekeeper 的密码确认等同于永久安装授权。[Apple SIP 说明](https://support.apple.com/en-us/102149) [Squirrel 权限分支](https://github.com/Squirrel/Squirrel.Mac/blob/8d808803bc89ec0e2aa1450474856dfee3b00c6b/Squirrel/SQRLUpdater.m)
- **没有查到 Apple 对所有未来自签版本免确认的保证。** Apple 的例外说明针对以后启动该应用，未明确承诺所有变化后的自签版本继承相同许可。Apple DTS 还明确说明 Gatekeeper 可能在隔离启动以外的时机运行，具体条件未公开且会变化；管理策略、恶意软件检测与安装权限仍独立生效。macOS 13 的应用包保护另涉及更新器身份和 `NSUpdateSecurityPolicy`；WWDC 的同一开发团队规则不能直接推导成“同一自签证书必然免除 App Management 提示”。[Apple DTS：Gatekeeper Basics](https://developer.apple.com/forums/thread/706442) [管理策略和安全检查](https://support.apple.com/en-us/102445) [WWDC 2022：应用包保护](https://developer.apple.com/videos/play/wwdc2022/10096/)

**工程判断：** 官方材料与本地连续更新实验共同支持继续实施“首次手动安装并确认，之后应用内更新”的方向；保持稳定自签身份、可写安装位置和手动下载兜底。它不是已获 Apple 默认分发信任，也不是对所有系统配置的无条件承诺。最终生产包仍需在默认安全配置、带互联网隔离标记的环境验收；这不是要求用户关闭 SIP。Apple DTS 自身也建议使用未见过该产品的干净 Mac 或可恢复快照的 VM，通过 Safari 下载后按真实用户方式安装，避免缓存导致误判。[Apple：Testing a Notarised Product](https://developer.apple.com/forums/thread/130560)
