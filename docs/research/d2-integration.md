# D2 浏览器与 Electron 集成评估

> 调研日期：2026-08-29。只采用 D2 官方文档、官方仓库、GitHub Release 与 npm 官方包元数据。官方源码快照为 `702e1c8d02ab154e3bb56fce2094d319042d1b03`，文档快照为 `2ac8014bc0ce48dbf3bf7e9943354be7a18b77b0`。

## 结论：暂缓生产接入

D2 **语言与 Markdown 围栏兼容，可以接入 Fuxian 的现有图表架构**；但截至调研日，官方稳定 npm 包 `@d2lang/d2@0.1.33` 不满足可靠接入门槛，因此不要立即提交生产实现。

- 可以只识别 canonical fence `d2`，由现有 Remark/Rehype 链路把代码块原文转为 `RenderTask`。D2 不需要再次把整个 fence 当 Markdown 解析，因此不会复现正文 Markmap 的内容截断问题。
- 官方当前源码已经为请求增加 id 关联，并提供终止 Worker、拒绝未完成请求的 `dispose()`；[README](https://github.com/d2lang/d2/blob/702e1c8d02ab154e3bb56fce2094d319042d1b03/d2js/js/README.md#dispose-promiseltvoidgt) 与[并发测试](https://github.com/d2lang/d2/blob/702e1c8d02ab154e3bb56fce2094d319042d1b03/d2js/js/test/unit/concurrency.test.js)明确覆盖这些行为。
- 但 npm `latest` 仍是 2026-08-07 发布的 `0.1.33`，早于 D2 `v0.8.2`（2026-08-24）；实际官方 tarball 仍用单一 `currentResolve/currentReject`，没有 `dispose()`，而且声明的 `./worker` 导出文件未打入包中。这与当前源码/README 不一致，无法安全承接 Fuxian 同文档多任务、revision 取消和超时。[npm 元数据与 tarball](https://registry.npmjs.org/@d2lang/d2/0.1.33) [v0.8.2 Release](https://github.com/d2lang/d2/releases/tag/v0.8.2) [当前请求实现](https://github.com/d2lang/d2/blob/702e1c8d02ab154e3bb56fce2094d319042d1b03/d2js/js/src/index.js)

**Go 条件：**等待官方发布一个与当前源码一致的稳定 npm 版本，再锁定精确版本并完成下面的 Worker、SVG 安全和打包 spike。不要依赖 nightly、私有字段终止 Worker，或把上游源码/生成产物复制进仓库。

## Authoring contract

首版仅识别 `d2`，不识别 `d2-incomplete` 等文档站内部名称：

````markdown
```d2
client -> api: request
api -> database: query
```
````

Fuxian 当前从 `<pre><code class="language-d2">` 的 text children 收集完整源码，适合 D2 的任意多行语法。D2 自身的多行文本使用可变 pipe delimiter，例如 `|md ... |`、`|||ts ... |||` 或自定义特殊字符；这些都不会被 Markdown fence 解析器解释。[D2 block strings](https://d2lang.com/tour/text/#advanced-block-strings)

唯一标准 Markdown 边界是：D2 的 Markdown label 若包含一行反引号 fence，外层也不能使用同长度反引号。无需发明非标准“四反引号语法”；作者可直接使用 CommonMark 原生 tilde fence：

    ~~~d2
    note: |md
      ```js
      console.log('inside D2')
      ```
    |
    ~~~

实现测试必须覆盖 backtick/tilde 两种外层围栏、pipe block、中文、空行、D2 内部 Markdown fence，以及 fence 后正文不丢失。

## 推荐运行边界

官方 D2.js 是 Go WebAssembly 包装器，在浏览器和 Node 中都通过 Worker 执行 `compile -> render -> SVG`；浏览器构建把 WASM/Worker 内容打入本地产物，源码明确说明加载时不发起外部依赖请求。[D2.js usage](https://github.com/d2lang/d2/blob/702e1c8d02ab154e3bb56fce2094d319042d1b03/d2js/js/README.md#usage) [browser platform](https://github.com/d2lang/d2/blob/702e1c8d02ab154e3bb56fce2094d319042d1b03/d2js/js/src/platform.browser.js)

稳定版本可用后，优先做**按需加载、最多两个独立 Worker、每任务可硬终止**的 renderer，复用 Vega-Lite/Infographic 的排队模型。每次输出使用 `noXMLTag: true` 和按 task/revision 派生的唯一 `salt`；官方说明 `salt` 用于避免同页多图 ID 冲突。[RenderOptions](https://github.com/d2lang/d2/blob/702e1c8d02ab154e3bb56fce2094d319042d1b03/d2js/js/README.md#renderoptions)

不要允许 fence 自动读取磁盘。字符串形式 `compile(source)` 只创建内存中的 `index`；官方 imports API 也要求调用方显式提供 `fs` map。因此首版让所有 `@import` 明确失败，后续若支持，只能传入经过文档目录授权的显式文件映射。[D2.js imports](https://github.com/d2lang/d2/blob/702e1c8d02ab154e3bb56fce2094d319042d1b03/d2js/js/README.md#imports) [D2 import syntax](https://d2lang.com/tour/imports/)

## SVG 与安全边界

D2 官方 SVG 不能直接交给现有通用 sanitizer：

- 官方 SVG 用 `<foreignObject>` 渲染 Markdown，并注入 CSS；Fuxian 目前会删除非 Infographic 的全部 `foreignObject`，所以直接接入会出现“图形在、Markdown/代码文字消失”。[SVG export behavior](https://d2lang.com/tour/exports/#svg) [D2 SVG renderer](https://github.com/d2lang/d2/blob/702e1c8d02ab154e3bb56fce2094d319042d1b03/d2renderers/d2svg/d2svg.go)
- D2 的 Markdown renderer 启用了 Goldmark `WithUnsafe()`，允许原始 HTML；它的 `sanitizeLinks` 只处理 `href` 中的 `&`，不是 XSS sanitizer。[Markdown source](https://github.com/d2lang/d2/blob/702e1c8d02ab154e3bb56fce2094d319042d1b03/lib/textmeasure/markdown.go#L81-L103) [link handling](https://github.com/d2lang/d2/blob/702e1c8d02ab154e3bb56fce2094d319042d1b03/lib/textmeasure/links.go)
- D2 允许任意 URL icon/image、外部 link 和 tooltip；SVG 会输出 `<image href>`、`<a href>` 和 `foreignObject`。首版应拒绝或删除 image/icon 与外链，unwrap anchor，保留清理后的纯文本 `<title>`；不能静默保留可能联网或执行自定义协议的 URI。[icons](https://d2lang.com/tour/icons/) [interactivity](https://d2lang.com/tour/interactive/)
- D2 专用 sanitizer 必须对 foreignObject XHTML 使用元素/属性 allowlist，删除 raw `style/script/form/input/iframe/object/embed` 等作者 HTML，并只保留 D2 生成且经过 CSS 解析/策略校验的样式。当前仅检查 `url(...)` 的通用逻辑不足以证明安全。
- D2 会嵌入字体以匹配布局。若保留受控 data-font，需要同时调整 preview CSP（`font-src data:`）；若剥离字体，必须验证中文、粗斜体、Markdown 和代码块不会溢出或裁切。屏幕、全屏、复制与 PDF 应复用同一份清理后 SVG 快照。

## 包体与许可证

调研日 `@d2lang/d2@0.1.33` 的 npm tarball 为约 **21.3 MB**、unpacked **59.8 MB**；其中 browser bundle 约 **8.2 MB**，Node ESM/CJS 各带约 **22.1 MB WASM** 和 **3.7 MB ELK**。必须用 Fuxian production build、asar 和安装包 diff 重新度量，避免 renderer bundle 与生产 `node_modules` 重复收录。[npm package metadata](https://registry.npmjs.org/@d2lang/d2/0.1.33)

D2.js 是 MPL-2.0，不会迫使独立文件组成的 Fuxian 整体改用 MPL，但分发 Covered Software 时有许可证、源码可获得性及 notices 义务。[官方 MPL-2.0](https://github.com/d2lang/d2/blob/702e1c8d02ab154e3bb56fce2094d319042d1b03/d2js/js/LICENSE.txt) 当前 npm tarball 实际未包含源码仓库声明的 `LICENSE.txt` 和 `THIRD_PARTY_NOTICES.txt`，发布前必须从锁定版本的官方源码补齐合规交付方案，不能假设包管理器已经代办。

## 实施门槛与测试

1. 锁定包含 request id、`dispose()`、实际 `./worker` 文件和许可证材料的稳定 npm 版本，并核对 `d2.version()` 与目标 D2 release。
2. production CSP 下验证 lazy import、WASM、Worker 创建与硬取消；浏览器实现使用 blob Worker，因此须实测最小 `worker-src`/WASM CSP，而不是放宽为通用 `unsafe-eval`。
3. 为 D2 建立独立 SVG/XHTML sanitizer，使用恶意 raw HTML、`javascript:` link、远程/相对/data image、CSS URL、超大图与元素洪泛测试。
4. 验证普通图、ELK/Dagre、sequence、class/SQL table、Markdown、代码、LaTeX、中文、主题与 sketch；不支持的 images/imports/multi-board 必须给出明确错误，不能生成残缺图。
5. 覆盖 revision 替换、超时、重试、连续多图、源码/全屏/复制、屏幕与 PDF SVG 同源，以及 macOS/Windows 打包离线运行。
