# AntV Infographic 浏览器与 Electron 集成评估

> 调研日期：2026-08-28。资料仅采用 AntV Infographic 官方文档、官方仓库与 npm 官方包元数据。版本与体积是调研日快照。

## 结论

Issue #24 已完成发布构建中的隔离渲染验证并进入正式实现。实现不照搬 Vega-Lite：它使用官方 `Infographic` 与 `exportToSVG`，在可终止的 ES module Web Worker 中运行官方浏览器渲染器，并用 LinkeDOM 提供离线 DOM。最多同时运行两个 Worker；取消或 external revision 会直接终止对应 Worker。

AntV Infographic 的官方输入是 Mermaid-like `Infographic Syntax`，官方文档自身使用 ` ```infographic ` 代码块；运行时接收语法字符串并默认生成 SVG。因此 MVP 应只认规范 fence `infographic`，不接受 `antv-infographic`、`infographic-js` 等别名。[官方语法](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/site/src/content/learn/infographic-syntax.en.md#L5-L10) [语法入口](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/site/src/content/learn/infographic-syntax.en.md#L62-L88)

它归入 Fuxian 的 **rendered visual block**，但既不是 Mermaid/PlantUML diagram block，也不是表达量化数据的 Vega-Lite visualization block。实现新增 **infographic block（信息图块）** 子类，共享 readiness、源码查看、复制、全屏、失败占位和 PDF 快照能力，并保留信息图作者样式。

## 实现与验证结果

- 仅识别官方文档使用的规范 fence `infographic`；未知语言仍按普通代码块显示。
- 固定使用 `@antv/infographic@0.2.20`。官方模板和主题必须精确匹配；动画、交互、插图、词云、自定义 design、任意 attributes 和自定义字体均被拒绝。
- 全部真实网络请求被 Worker 拦截。`lucide/...`、`mdi/...` 和可匹配的简短图标名从随应用发布的 Iconify JSON 集合解析；未找到的图标明确失败，不回退到官方搜索服务。
- 专用 sanitizer 精确保留官方 `foreignObject > span` 纯文本结构及有限排版样式，同时删除其他 HTML、事件、URL、图片与危险 SVG/CSS。
- 预览、全屏、复制渲染结果和 PDF 复用同一份清理后 SVG snapshot。Electron 测试确认预览与 PDF 的 SVG `outerHTML` 完全一致，且 PDF 可提取中文标题“浮现发布流程”。
- production Electron 构建与 CSP 下渲染通过。未压缩构建产物约为：Worker 344 KB、AntV runtime 1.715 MB、Lucide 数据 589 KB、MDI 数据 2.958 MB；这些模块均按需加载，不进入首屏同步路径。

## 当前包与 API

调研时 npm `latest` 为 `@antv/infographic@0.2.20`，包处于 `0.x`。它导出浏览器入口和独立的 `@antv/infographic/ssr` 入口，许可证为 MIT；直接依赖包括 D3、AntV layout/hierarchy、Rough.js、LinkeDOM 和 PostCSS。[包元数据](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/package.json#L1-L44) [依赖](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/package.json#L99-L112) [MIT License](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/LICENSE)

浏览器主 API 是 `new Infographic(options)`、`render()`、`update()`、`toDataURL()` 和 `destroy()`。`rendered` 事件只表示同步 SVG 已生成，异步资源完成后另发 `loaded`；`destroy()` 会清理节点、editor 和监听器。[官方 API](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/site/src/content/reference/infographic-api.en.md#L5-L18) [render 生命周期](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/src/runtime/Infographic.tsx#L99-L129) [销毁](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/src/runtime/Infographic.tsx#L207-L214)

浏览器路径把 SVG DOM 插入指定 container；`toDataURL()` 可导出 SVG 或 PNG，省略类型时默认 PNG。Fuxian 应直接取得 SVG snapshot，不走 canvas/PNG。[导出 API](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/site/src/content/reference/infographic-api.en.md#L91-L105) 官方 UMD build target 为 ES2015，但没有 Electron 或具体浏览器版本兼容声明；Electron Chromium 仍需用实际发布构建验证。[build target](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/vite.config.ts#L5-L27)

官方还提供 `renderToString()`，在非浏览器环境用 LinkeDOM 生成 SVG 字符串。[SSR 文档](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/site/src/content/learn/index.en.md#L172-L190) 它会修改 `globalThis` 注入 DOM 类，并用 Node 的 `setImmediate` 模拟动画帧；这不是官方承诺的浏览器 Web Worker API。[DOM shim](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/src/ssr/dom-shim.ts#L1-L12) [frame shim](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/src/ssr/dom-shim.ts#L96-L117)

## DSL 与安全边界

语法描述 `template`、`design`、`data` 和 `theme`，并支持 list、sequence、hierarchy、compare、statistics 与 relation 数据。[语法结构](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/site/src/content/learn/infographic-syntax.en.md#L62-L88) 它不是纯数据格式：schema 对 item、attributes、主题文字/形状和 `theme.base.global` 等位置允许未知字段。[官方 schema](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/src/syntax/schema.ts#L30-L49) [主题 schema](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/src/syntax/schema.ts#L68-L105) 这些字段最终可进入 SVG `setAttribute()` 或 HTML span style，因此不能只依赖上游 parser；Fuxian 必须在渲染前建立字段 allowlist，并在渲染后结构化清理 SVG/HTML。[属性写入](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/src/utils/svg.ts#L24-L46) [全局属性应用](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/src/renderer/composites/base.ts#L6-L17)

模板名也不应直接交给运行时。未知名称会自动选择 Levenshtein 距离最近的内置模板，而不是失败；Fuxian 应先与 `getTemplates()` 的固定集合做精确匹配。[模板解析](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/src/templates/registry.ts#L10-L20) [模糊匹配实现](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/src/templates/utils.ts#L74-L110)

官方源码及发布 UMD 产物未发现 `eval()` 或 `new Function()`，所以没有已知 `unsafe-eval` 要求；但官方未声明 CSP 兼容性，仍须在 Fuxian production CSP 下实测整个依赖图。应关闭 editor、plugins、interactions 和动画，并拒绝超出静态阅读范围的配置。

## 资源与网络

默认行为不是离线、fail-closed：

- `icon`/`illus` 支持内联 data URI、远程 URL、官方搜索服务和自定义 loader。[资源协议](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/site/src/content/learn/resources.en.md#L9-L79)
- 即使指定资源加载失败或自定义 loader 返回空，运行时仍会回退到远程图标搜索。[loader fallback](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/src/resource/loader.ts#L14-L52)
- 搜索地址由库固定，并通过 `fetch()` 请求；搜索结果还可以继续触发远程资源加载。[search loader](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/src/resource/loaders/search.ts#L1-L39) [服务地址](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/src/constants/service.ts#L1)
- 默认字体 Alibaba PuHuiTi、思源、霞鹜文楷等均指向 `assets.antv.antgroup.com`，浏览器渲染会插入远程 stylesheet link。[内置字体](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/src/renderer/fonts/built-in.ts#L1-L40) [字体加载](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/src/renderer/fonts/loader.ts#L109-L156)
- SSR 输出还会注入远程 XML stylesheet processing instruction。[SSR stylesheet](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/src/ssr/renderer.ts#L53-L71)

MVP 应拒绝 `icon`、`illus`、remote/search/custom/data URI 和自定义字体，固定使用 Fuxian 打包字体，并在隔离环境与 finished-document iframe 双重设置 `connect-src 'none'`。以后若需要图标，应另行加入经过许可与清理的本地资源集合，而不是启用官方网络回退。

## SVG、文本与清理

官方宣称默认输出高质量 SVG。[README](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/README.md#L49-L60) 实际正文通常不是 SVG `<text>`，而是 `<foreignObject><span>`；这样浏览器中可选择、可换行，但没有通用的结构化无障碍语义。[文本创建](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/src/utils/text.ts#L13-L32) [HTML text style](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/src/utils/text.ts#L131-L171)

本地 `0.2.20` SSR spike 的一个两项列表输出 2,799 字节，包含 4 个 `foreignObject` 和 2 个 SVG `text`；两次输出逐字相同，但带外部字体 stylesheet。另一次阻断 fetch 的 spike 输出 2,809 字节、无 image/use/网络请求；所有作者 label/desc 仍都位于 `foreignObject`，SVG `text` 仅是序号。

这与 Fuxian 当前 sanitizer 冲突：它删除所有 `foreignObject`。直接复用会让信息图看似有形状却丢失主要文字。不能简单放开任意 HTML；正式方案需二选一并做安全回归：

1. 仅保留精确的 `foreignObject > span`，只允许纯文本、几何属性和有限排版 CSS；拒绝 event、URL、HTML、image、animation 与导航。
2. 将 span 文本与换行转换为纯 SVG `<text>/<tspan>`。安全边界更简单，但必须验证中文换行、测量、对齐和模板视觉一致性。

无论采用哪条路线，block wrapper 都要提供可访问名称；信息图本体不能被当作具有结构语义的图表。复制渲染结果应复制**已清理 SVG**。

## 取消、确定性与 PDF

浏览器 `render()` 是同步入口，官方 API 不接受 `AbortSignal`；`destroy()` 只能事后清理。SSR 自带的十秒 `Promise.race()` 也只是停止等待，不会中断同步 parser/layout 或已经开始的异步资源工作。[浏览器 render](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/src/runtime/Infographic.tsx#L82-L97) [SSR timeout](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/src/ssr/renderer.ts#L24-L49)

因此必须保留 Vega-Lite 已验证的任务原则：revision/task id、最多两个并发任务、过期结果丢弃、超时或取消时终止隔离执行环境。但不能直接复用现有 browser Web Worker renderer：浏览器 API 依赖 `document`，SSR shim 又依赖 Node 全局。优先 spike `@antv/infographic/ssr` 在独立 Node worker thread 或 Electron utility process 中的生产打包、CSP、终止与内存回收；若坚持 Web Worker，需要验证 LinkeDOM 与 Node shim 改造，不能假设可用。

确定性要求：固定包版本、精确模板、静态配置、Fuxian 本地字体、禁止资源与动画，并限制 source bytes、语法深度、数据项/关系数、布局时间、SVG bytes、元素数和尺寸。个别源码路径使用随机 ID；Rough.js 已固定 seed，但仍应比较两次渲染的清理后 SVG 与截图。[随机 ID](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/src/utils/uuid.ts#L1-L10) [Rough seed](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/src/renderer/stylize/rough.ts#L13-L21)

屏幕、全屏、复制和 PDF 必须复用同一份已清理 SVG snapshot，PDF 窗口不得重跑 Infographic。这样也避免浏览器 DOM 测量、字体或随机 ID 在导出路径漂移。PDF readiness 需等待隔离任务、资源清理和字体 ready。

## 体积与许可

npm registry 快照：`0.2.20` tarball 约 1.775 MB，unpacked 8,225,193 bytes / 1,732 files；官方 UMD minified 文件本地测得 877,959 bytes，gzip 约 288,714 bytes。官方仓库的 size-limit 仍写 500 KB，因此最终判断必须以 Fuxian 的 Vite lazy chunk、asar 和安装包增量为准。[npm registry metadata](https://registry.npmjs.org/@antv/infographic/0.2.20) [官方 size-limit](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/package.json#L158-L167)

主包为 MIT，与 Fuxian 的开源协议兼容。[License](https://github.com/antvis/Infographic/blob/2ea1894255e4002c7735586778be86d13ec30346/LICENSE)

## 首版边界

production spike 已通过，首版按以下边界交付：

1. canonical `infographic` fence，仅接受显式、精确、已测试的内置模板。
2. 仅接受 bounded data 与安全主题字段；图标只来自随应用发布的 Lucide/MDI 数据。拒绝 illustrations、自定义 attributes/fonts、animation、editor 和 interactions。
3. 在可终止的独立执行环境中渲染，并保留连续 external revision、超时和两任务并发上限。
4. 建立 `foreignObject` 专用清理策略，验证中文换行、文本选择、键盘全屏、复制和 accessibility fallback。
5. 固定本地字体，并确认全过程零网络、无外部 URI、无可执行属性。
6. 在 adaptive、A4、自定义 document width 下验证比例；屏幕/PDF 逐字复用同一 snapshot。
7. 每次升级 `@antv/infographic` 都重新检查 lazy chunks、打包内容、官方示例视觉、中文换行、清理器和 PDF 一致性。

扩大模板、主题字段或资源范围必须另行评估，不能因为官方网页 demo 可以渲染，就绕过 Fuxian 的离线、安全、可取消和确定性边界。
