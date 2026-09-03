# 纸张预览分页方案调研

> 调研日期：2026-08-29。面向 Issue #29 与当前 Electron 44 架构；资料仅采用 CSS/HTML 标准、Chromium/Electron 官方接口与源码，以及 Paged.js、Vivliostyle 官方文档和源码。Paged.js 源码基于 `6b0ff8089f472a17247e44671da93d2d931e656e`，Vivliostyle 基于 `c789c7f282a79c3a6dbb45e7805432a82272a5a9`。

## 结论

**Chromium 没有可供网页或 Electron renderer 使用的“屏幕打印页盒”API。** Blink 只有在 `Document::Printing()` 时才启用 paginated layout；内部 `PrintContext` 能取得 `PageCount()` 和 `PageRect()`，但进入打印模式会改变布局，源码明确要求此时不要把内容绘制到屏幕。[Blink paginated layout](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/core/layout/layout_view.cc#552) [PrintContext](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/core/page/print_context.cc#59) Chromium DevTools Protocol 对外只提供 viewport/content metrics，以及返回 PDF 数据流的 `printToPDF`，没有页盒或页数 DOM API。[CDP Page domain](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-getLayoutMetrics) [CDP printToPDF](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-printToPDF)

CSS Paged Media 定义了有限宽高的 page box，`@page` 控制其尺寸和边距；A4 是 `210mm × 297mm`。它允许打印输出在屏幕上模拟，但没有要求浏览器把 page box 暴露为元素。[CSS Paged Media](https://www.w3.org/TR/css-page-3/#page-model) [page size](https://www.w3.org/TR/css-page-3/#page-size-prop) CSS 绝对单位固定为 `1in = 96px`，但规范建议屏幕以 reference pixel 为锚、打印以物理单位为锚，所以屏幕“794px A4”只是比例表示，排版规则应始终以 `mm` 写入共享 `@page` CSS。[CSS Values](https://www.w3.org/TR/css-values-4/#absolute-lengths)

因此不建议继续用现有连续 iframe 加 CSS 高度线模拟分页，也不建议用原生 multi-column 作为产品实现。列盒是匿名 fragmentainer，虽能保留一份 DOM，却不能逐页查询、垂直排列或可靠地与 Chromium 打印分页一一对应。[CSS Multi-column](https://www.w3.org/TR/css-multicol-1/#column-box) Issue #29 需要一个在屏幕 DOM 中显式生成页面的分页层。

**建议先采用 Paged.js 做隔离原型；通过下述验收后再作为正式引擎。** 它是 MIT，与 Fuxian 的 MIT 许可兼容，并以真实 DOM 生成 `.pagedjs_page` 页面。Vivliostyle 的技术能力更完整，但 `@vivliostyle/core` 官方包是 AGPL-3.0；在 Fuxian 保持 MIT 的前提下不应直接嵌入，除非项目整体调整许可或取得额外授权。[Paged.js license](https://github.com/pagedjs/pagedjs/blob/6b0ff8089f472a17247e44671da93d2d931e656e/LICENSE.md) [Vivliostyle Core package](https://github.com/vivliostyle/vivliostyle.js/blob/c789c7f282a79c3a6dbb45e7805432a82272a5a9/packages/core/package.json) [Vivliostyle license](https://github.com/vivliostyle/vivliostyle.js/blob/c789c7f282a79c3a6dbb45e7805432a82272a5a9/LICENSE)

## 引擎对比

| 能力             | Chromium 原生                              | Paged.js                                                                                                             | Vivliostyle Core/Viewer                                                                                                |
| ---------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 屏幕 A4 页盒     | 无公开页盒 DOM；只能生成 PDF               | 将内容拆为固定尺寸、可样式化的页面 DOM；官方定位就是浏览器内 paginated preview                                       | 原生提供 single/spread、zoom、fit、page border 和默认纸型                                                              |
| 页数             | `printToPDF` 不返回页数，只能事后解析 PDF  | `Previewer.preview()` 返回 flow，含 `pages` 与 `total`                                                               | `renderAllPages=true` 时给出精确 `epageCount`；关闭时官方说明只是 rough page count                                     |
| 结算与重排       | 应用只能在调用打印前建立 readiness barrier | 分页前加载字体，布局时等待 `img`；完成后不会因任意动态 DOM 自动全量重排，应由 Fuxian 重新 `preview()`                | `COMPLETE`、pagination progress、图片等待与 resize relayout 更完整；动态图表仍应先结算后整份 reload                    |
| 锚点、查找、选择 | 连续 DOM 最自然，但无页盒                  | 输出仍是 live DOM；拆分延续块会移除重复 `id`、保留 `data-ref`，可在输出 DOM 上重建 Fuxian find/reading-position 索引 | Viewer 自带 internal navigation、find 与 selection；Core 公共 API 没有 find，接入现有 Fuxian controller 需专用 adapter |
| Electron PDF     | 原生打印连续文档，屏幕无法预知真实分页     | 官方支持直接打印已分页 DOM；print CSS 令每个 `.pagedjs_page` 强制换页                                                | 官方 Viewer 支持浏览器打印，`printHTML` 在 `COMPLETE` 后回调打印                                                       |
| 许可与集成       | 无新增许可                                 | MIT；但源码大量使用当前 realm 的全局 `window/document`，必须在预览 iframe 自身运行                                   | AGPL-3.0；API 可显式接收 `window`、`viewportElement` 和 `documentObject`，技术适配更整洁但许可不合适                   |

Paged.js 官方说明其通过 CSS columns fragmentation 把 HTML 转为屏幕页面，并可直接由浏览器保存为 PDF。[工作原理](https://pagedjs.org/en/documentation/1-the-big-picture/) `Previewer` 返回完整 flow；Chunker 暴露页面数组和总数，并在完成前等待字体。[Previewer source](https://github.com/pagedjs/pagedjs/blob/6b0ff8089f472a17247e44671da93d2d931e656e/src/polyfill/previewer.js#L168-L207) [Chunker source](https://github.com/pagedjs/pagedjs/blob/6b0ff8089f472a17247e44671da93d2d931e656e/src/chunker/chunker.js#L260-L306) 图片在断页测量前等待 load/error；ResizeObserver 虽能发现 page overflow，但 Chunker 在 `rendered` 后明确不再 reflow，所以异步 SVG/图表不能在分页后原位替换。[image wait](https://github.com/pagedjs/pagedjs/blob/6b0ff8089f472a17247e44671da93d2d931e656e/src/chunker/layout.js#L173-L216) [post-render overflow](https://github.com/pagedjs/pagedjs/blob/6b0ff8089f472a17247e44671da93d2d931e656e/src/chunker/chunker.js#L672-L704)

Vivliostyle 的官方 Viewer 明确区分 `renderAllPages=true` 的精确打印/页数与按需渲染的粗略页数；Core API 还提供 `ReadyState.COMPLETE`、page sizes、internal URL navigation、自动 resize 和 fit-to-screen。[Viewer guide](https://docs.vivliostyle.org/en/viewer/vivliostyle-viewer/) [Core API](https://docs.vivliostyle.org/en/reference/api/) 其 `renderAllPages()` 会等待所有 page fetcher 中的图片完成，官方 Viewer 的 find 也直接在分页 DOM 上使用 Range/Selection。[image readiness](https://github.com/vivliostyle/vivliostyle.js/blob/c789c7f282a79c3a6dbb45e7805432a82272a5a9/packages/core/src/vivliostyle/epub.ts#L3352-L3404) [Viewer find](https://github.com/vivliostyle/vivliostyle.js/blob/c789c7f282a79c3a6dbb45e7805432a82272a5a9/packages/viewer/src/viewmodels/find-box.ts#L119-L225) 技术评分高于 Paged.js，但不能绕过许可结论。

## Fuxian 实施边界

当前屏幕路径由 `FinishedDocumentFrame` 加载无脚本 `srcDoc`，父 renderer 的 `bindFinishedDocument()` 直接管理 iframe DOM；PDF 则在独立隐藏窗口重新渲染 Markdown 和图表，再调用 `printToPDF()`。Paged.js 不能直接由父 renderer 指向任意 `Document`：其 polisher、parser、layout 都依赖模块所在 realm 的全局 `window/document`。原型必须验证一个**专用纸张 iframe runtime**，仅加载随应用打包的固定版本分页脚本；不要把 Paged.js 样式注入 application shell，也不要把它放进 `markdown-renderer` 或 `document-theme`。

建议流水线：

1. 在隔离 staging document 中渲染 Markdown，等待 `RenderCoordinator.whenReady()`、图片、`document.fonts.ready` 和连续稳定帧；Mermaid、PlantUML、Vega-Lite、Infographic 均先成为清理后的 inline SVG。
2. 以 immutable revision snapshot 调用一次 Paged.js。新 revision、字号、行高或纸张设置到来时取消/丢弃旧结果，整份重新分页；新分页完成前继续显示上一份成功结果。
3. 分页成功后再对输出 DOM 建立 heading、`data-ref`、find Range 与 reading-position 索引。Paged.js 为元素增加稳定 `data-ref`，并从跨页延续 clone 删除重复 `id`，适合建立“source ref → page/fragment”映射。[references](https://github.com/pagedjs/pagedjs/blob/6b0ff8089f472a17247e44671da93d2d931e656e/src/chunker/parser.js#L64-L90) [split IDs](https://github.com/pagedjs/pagedjs/blob/6b0ff8089f472a17247e44671da93d2d931e656e/src/utils/dom.js#L552-L577)
4. 图表源码/全屏按钮不要进入分页流。当前 toolbar 会占据正文高度；纸张模式应由 iframe 外 overlay 或页边距 action rail 锚定到图表，否则屏幕断点会因“不打印的按钮”与 PDF 不一致。
5. 缩放只作用于分页完成后的 pages viewport；`fit width`、`100%` 不能改变 A4 page area，窗口变窄时缩放整页并保留最小外边距。

默认 CSS 使用 `@page { size: A4; margin: 18mm 16mm; }` 作为首轮视觉原型值；这是产品默认，不是标准规定值，应在 Pencil/实机评审后锁定。现有 `document width: A4` 继续表示连续模式宽度，不能复用为纸张模式状态。

## PDF 一致性策略

Paged.js 输出可以通过 Electron `printToPDF()` 做一页对一页打印：它的官方流程就是把浏览器内分页结果交给浏览器 Print/Save as PDF，自带 print CSS 也为每个 `.pagedjs_page` 强制 page break。[Paged.js print guide](https://pagedjs.org/en/documentation/2-getting-started-with-paged.js/) [base print CSS](https://github.com/pagedjs/pagedjs/blob/6b0ff8089f472a17247e44671da93d2d931e656e/src/polisher/base.js#L666-L708) 但 Electron 只承诺打印当前 WebContents，并不理解 Paged flow；因此 one-to-one 仍是必须由 E2E 锁定的集成契约，不是 Electron 的结构化 API 保证。

不要让屏幕与导出各自独立分页。最佳路径是把已验收 revision 的 **Paged page DOM + 生成 CSS** 冻结成 export snapshot，隐藏导出窗口只恢复该 snapshot，不再解析 Markdown 或重新运行图表引擎。

Electron 调用固定为 A4、背景开启、CSS page size 优先，并显式把 Electron margins 设为 zero；Electron 的默认 PDF margins 是 `1cm`，不能依赖隐式覆盖。[Electron printToPDF](https://www.electronjs.org/docs/latest/api/web-contents#contentsprinttopdfoptions) 导出前等待静态页 DOM 连续两帧 fingerprint 不变，导出后用现有 `pdfjs-dist` 读取真实 PDF 页数，强制等于 Paged `flow.total`。同时抽取每页首尾 heading/ref 做 screen/PDF 位置回归；只比页数不足以发现少图或跨页裁切。

## 超大内容策略

分页引擎不能替代内容策略。CSS Fragmentation 规定图片等 replaced elements、scroll container 和单行文本通常是 monolithic；没有合法断点时 UA 甚至可以任意切割其 graphical representation，结果不适合作为产品保证。[possible breaks](https://www.w3.org/TR/css-break-3/#possible-breaks) [breaking rules](https://www.w3.org/TR/css-break-3/#breaking-rules)

- 表格：允许按行/行组跨页，重复 `thead`，单元格文字可换行；不要给整个 table 或所有 row 设置 `break-inside: avoid`。单行高于 page area 必须有专项 fixture。
- 代码：纸张模式继续 `white-space: pre-wrap; overflow-wrap: anywhere`，不打印横向 scrollbar。
- 图片、KaTeX、inline SVG 与图表：保持 live DOM 和可选择文本，按 page area 同时限制 `max-inline-size` 与 `max-block-size`、等比缩小、`break-inside: avoid`；超高图表宁可缩小或显示明确占位，不栅格化、不静默裁切。
- 失败占位：作为普通可分页 block 保留 source kind 与错误摘要；不得因分页删除内容。

## 原型验收门槛

只有以下项目通过，才把 Paged.js 写入正式 ADR 并开始完整 UI：

1. 同一 fixture 覆盖中文字体、图片、长表格/代码、KaTeX 与四类图表；完成异步结算后页数连续两次一致。
2. 连续/纸张切换、external revision 与排版设置变更都按 heading + ref 恢复位置，旧 revision 永不覆盖新结果。
3. 大纲锚点、全文查找、高亮、跨页选择、复制、外链、图表源码和全屏操作保持可用。
4. macOS/Windows Electron E2E 中 screen page count 等于 PDF page count，并逐页渲染验证关键元素与末尾内容。
5. CSP、iframe sandbox、无网络分页、打包后的脚本加载和 100+ 页文档性能通过；分页失败保留上一成功版本并给出可重试错误。

若 Paged.js 原型无法在不削弱 iframe 隔离的情况下运行，或复杂 fixture 的 screen/PDF 断点仍不稳定，应暂停 #29，而不是自研分页器。下一候选只能是在明确解决 AGPL 许可后评估 Vivliostyle Core。
