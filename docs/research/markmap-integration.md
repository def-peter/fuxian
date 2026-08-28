# 正文 Markmap 浏览器与 Electron 集成评估（已否决）

> 调研日期：2026-08-28。资料仅采用 Markmap 官方文档、官方仓库、API 文档与 npm 官方包元数据；源码基于提交 `99fc93e6efd4a1df01260232d818fb57955d71df`。
>
> 决策状态：本文记录的正文 `markmap` fence 方案已被 [ADR 0010](../adr/0010-derive-article-structure-map-from-content-outline.md) 取代。Fuxian 不再解析正文 Markmap，而是按需把内容目录标题树直接渲染为文章结构图。以下内容仅保留为被否决方案的研究记录。

## 结论

Issue #22 适合定位为 **快速 Markdown 思维导图**：作者在规范的 `markmap` fenced code block 内写普通 Markdown 标题和嵌套列表，Fuxian 只转换该 block。Mermaid mindmap 继续用于兼容已有文档；AntV Infographic 的 mindmap 模板用于视觉更精致、输入也更正式的成品图。

首版应采用官方 `markmap-lib` 转换 Markdown、`markmap-view` 渲染交互式 SVG，不使用 `markmap-cli`、`markmap-render`、`markmap-autoloader` 或 `markmap-toolbar`。官方也把程序化流程定义为“`markmap-lib` 生成 node tree，再由 `markmap-view` 渲染”。[官方总览](https://markmap.js.org/docs/markmap) [markmap-lib 用法](https://markmap.js.org/docs/packages--markmap-lib) [markmap-view 用法](https://markmap.js.org/docs/packages--markmap-view)

固定版本建议为：

- `markmap-lib@0.18.12`
- `markmap-view@0.18.12`
- `markmap-common@0.18.9`（两个主包的 peer dependency，直接固定可避免隐式漂移）

这是调研日的 npm `latest` 快照；三个包均为 `0.x`，升级必须重新验证转换结果、SVG 结构、交互、PDF 与打包体积。[markmap-lib 元数据](https://registry.npmjs.org/markmap-lib/latest) [markmap-view 元数据](https://registry.npmjs.org/markmap-view/latest) [markmap-common 元数据](https://registry.npmjs.org/markmap-common/latest)

## Authoring contract

只识别 canonical fence `markmap`，内容就是该思维导图自己的 Markdown：

````markdown
```markmap
# 浮现
## 快速阅读
- Markdown
- PDF
## 图表
- Mermaid
- PlantUML
```
````

标题最多六级是 Markdown 本身的限制；更深层级使用嵌套列表。[官方 FAQ](https://markmap.js.org/docs/faq) 官方 `Transformer.transform(markdown)` 先用 Markdown-it 生成 HTML，再转换成 `IPureNode` tree；节点只包含 HTML 字符串、payload 和 children，适合从 Worker 传回渲染线程。[转换实现](https://github.com/markmap/markmap/blob/99fc93e6efd4a1df01260232d818fb57955d71df/packages/markmap-lib/src/transform.ts#L67-L85) [node 类型](https://github.com/markmap/markmap/blob/99fc93e6efd4a1df01260232d818fb57955d71df/packages/markmap-common/src/types/common.ts#L1-L29)

首版使用 `markmap-lib/no-plugins` 和 `new Transformer([])`：不接受 fenced block 内的 YAML frontmatter、JSON options、`extraJs`、`extraCss`、自定义 HTML parser、KaTeX 或代码高亮插件。官方默认插件包含 frontmatter、KaTeX、highlight.js、npm URL、checkbox 和 source lines；其中 frontmatter 明确接受 `extraJs`/`extraCss`，npm URL 插件会把 `npm:` 资源解析成外部地址。[no-plugins 入口](https://github.com/markmap/markmap/blob/99fc93e6efd4a1df01260232d818fb57955d71df/packages/markmap-lib/package.json#L23-L40) [默认插件](https://github.com/markmap/markmap/blob/99fc93e6efd4a1df01260232d818fb57955d71df/packages/markmap-lib/src/plugins/index.ts#L19-L26) [frontmatter 处理](https://github.com/markmap/markmap/blob/99fc93e6efd4a1df01260232d818fb57955d71df/packages/markmap-lib/src/plugins/frontmatter/index.ts#L41-L49) [npm URL 处理](https://github.com/markmap/markmap/blob/99fc93e6efd4a1df01260232d818fb57955d71df/packages/markmap-lib/src/plugins/npm-url/index.ts#L9-L27)

可保留官方 magic comment `<!-- markmap: fold -->` 与 `foldAll`；它们由 HTML tree parser 转换为 `payload.fold`，不依赖默认插件。[官方说明](https://markmap.js.org/docs/magic-comments) [解析实现](https://github.com/markmap/markmap/blob/99fc93e6efd4a1df01260232d818fb57955d71df/packages/markmap-html-parser/src/index.ts#L254-L274)

## Rendering lifecycle and interaction

SVG 必须先有明确宽高。不要以 `Markmap.create(svg, options, root)` 作为 readiness：该静态方法立即返回实例，在后台调用 `setData()`，随后再调用 `fit()`，调用方拿不到这条 Promise chain。[官方尺寸要求](https://markmap.js.org/docs/packages--markmap-view) [create 实现](https://github.com/markmap/markmap/blob/99fc93e6efd4a1df01260232d818fb57955d71df/packages/markmap-view/src/view.ts#L766-L777)

建议由 Fuxian 显式控制：

1. 懒加载 `markmap-view`，创建固定高度、宽度 `100%` 的 SVG。
2. 等待本地字体 ready，执行 `new Markmap(svg, safeOptions)`。
3. `await mm.setData(sanitizedRoot)`，再 `await mm.fit()`。
4. 等待布局在连续帧稳定后，才完成 render task 并保存 export snapshot。
5. revision 变化、重试或卸载时调用 `mm.destroy()`。

这也决定了模块边界：Markmap 不能像 Mermaid 一样只返回 SVG string 后丢弃 runtime。inline preview 必须由 finished-document controller 按 task id 持有活的 `Markmap` 实例，折叠、fit 和缩放都调用该实例；controller 销毁或 revision 替换时逐一销毁。源码抽屉可以继续复用，focused/full-screen view 则从同一份清理后 tree 创建独立实例。只有复制与 PDF 使用静态 SVG snapshot。

`setData()` 会等待一次 `requestAnimationFrame` 后测量 `foreignObject` 内容，但过渡本身没有统一的 rendered event；构造函数还安装了一个 100 ms debounce 的 `ResizeObserver`。因此 readiness 必须由 Fuxian 建立并通过 Electron fixture 验证，不能只看 SVG 是否存在。[测量与布局](https://github.com/markmap/markmap/blob/99fc93e6efd4a1df01260232d818fb57955d71df/packages/markmap-view/src/view.ts#L433-L470) [rAF 与 relayout](https://github.com/markmap/markmap/blob/99fc93e6efd4a1df01260232d818fb57955d71df/packages/markmap-view/src/view.ts#L502-L508) [ResizeObserver](https://github.com/markmap/markmap/blob/99fc93e6efd4a1df01260232d818fb57955d71df/packages/markmap-view/src/view.ts#L68-L107)

首版固定 `duration: 0`、本地字体、`autoFit: false`，不接受作者函数型 options。inline block 保持固定高度，节点折叠不能改变正文占位；宽度变化后重新 fit。官方 `fit()`、`rescale()`、`toggleNode()`、`destroy()` 都是可直接复用的实例 API。[API 文档](https://markmap.js.org/api/classes/markmap-view.Markmap.html) [fit 实现](https://github.com/markmap/markmap/blob/99fc93e6efd4a1df01260232d818fb57955d71df/packages/markmap-view/src/view.ts#L615-L640)

交互边界建议：

- inline：允许节点展开/折叠和工具栏的缩放、适应、全屏；鼠标滚轮继续滚动正文。
- focused/full-screen：启用 Markmap 原生 zoom/pan，退出后不改变正文 reading position。
- 不采用官方 toolbar，复用 Fuxian 现有 Lucide 控件和源码抽屉。
- 官方节点 circle 只有 click handler，没有键盘语义；Fuxian 需为可折叠节点补 `tabindex`、button name 和 Enter/Space 行为，并调用公开的 `toggleNode()`。[节点交互源码](https://github.com/markmap/markmap/blob/99fc93e6efd4a1df01260232d818fb57955d71df/packages/markmap-view/src/view.ts#L142-L166) [circle handler](https://github.com/markmap/markmap/blob/99fc93e6efd4a1df01260232d818fb57955d71df/packages/markmap-view/src/view.ts#L407-L431)

原生 wheel 行为会根据 `scrollForPan` 拦截滚轮做 pan 或 zoom，且 pan handler 调用 `preventDefault()`；不能在 inline 阅读区直接照搬默认配置。[zoom filter](https://github.com/markmap/markmap/blob/99fc93e6efd4a1df01260232d818fb57955d71df/packages/markmap-view/src/view.ts#L80-L88) [wheel pan](https://github.com/markmap/markmap/blob/99fc93e6efd4a1df01260232d818fb57955d71df/packages/markmap-view/src/view.ts#L127-L140)

## Security, resources, and sanitization

Markmap 输出不是纯 SVG text。每个节点是 `g > foreignObject > div > div > HTML`；官方渲染器把 `d.content` 直接传给 D3 `.html()`。同时，内部 Markdown-it 明确启用了 raw HTML。因此未经清理的 fence 可以在插入 DOM 时形成 XSS，等渲染完再清理已经太晚。[官方 SVG 结构 ADR](https://github.com/markmap/markmap/blob/99fc93e6efd4a1df01260232d818fb57955d71df/adr/structure-of-svg.md#L3-L43) [HTML 写入](https://github.com/markmap/markmap/blob/99fc93e6efd4a1df01260232d818fb57955d71df/packages/markmap-view/src/view.ts#L433-L458) [Markdown-it 设置](https://github.com/markmap/markmap/blob/99fc93e6efd4a1df01260232d818fb57955d71df/packages/markmap-lib/src/markdown-it.ts#L7-L13)

必须采用两阶段、Markmap 专用的结构化清理：

1. **DOM 写入前**：遍历 `IPureNode`，把每个 `content` 放入 inert template 清理。首版只保留纯文本、`br`、`p`、`strong`、`em`、`del/s`、`ins`、`mark`、`sub`、`sup`、`code/pre` 和受控 `a`；删除图片、SVG、style、class、id、事件和未知 HTML。链接只保留通过 finished-document URL policy 的 `href`，点击仍交给系统浏览器。
2. **渲染完成后**：检查 live DOM 只包含官方 Markmap SVG 结构和精确的 `foreignObject > div > div > allowed content`，原位移除 URL 属性、外部引用、危险 style 和多余 HTML，但不替换带有 D3 listeners/data 的交互节点；另对深拷贝 snapshot 做完整清理并序列化，供 copy/PDF 使用。

保留受控 `foreignObject` 是必要的，否则节点文字、换行和链接都会消失。wrapper/SVG 还需补稳定的中文 accessible name；交互 SVG 不应假装具有完整树语义。

不调用 `getAssets()`、`loadJS()` 或 `loadCSS()`，不加载图片和字体资源，CSP 继续阻断真实网络。官方资源 loader 会创建 script/link，并对 stylesheet 主动 `fetch()`；KaTeX 和 highlight 插件配置指向包/CDN 资源。[资源 loader](https://github.com/markmap/markmap/blob/99fc93e6efd4a1df01260232d818fb57955d71df/packages/markmap-common/src/loader.ts#L24-L103) [KaTeX 资源](https://github.com/markmap/markmap/blob/99fc93e6efd4a1df01260232d818fb57955d71df/packages/markmap-lib/src/plugins/katex/config.ts#L5-L56) [highlight 资源](https://github.com/markmap/markmap/blob/99fc93e6efd4a1df01260232d818fb57955d71df/packages/markmap-lib/src/plugins/hljs/config.ts#L5-L17)

## Cancellation, limits, and performance

`Transformer.transform()` 与 D3/flextree layout 都没有 `AbortSignal`。`destroy()` 会移除 zoom handlers、清空 SVG 并断开 observer，但不能中断已经占用主线程的同步转换或布局。[transform API](https://github.com/markmap/markmap/blob/99fc93e6efd4a1df01260232d818fb57955d71df/packages/markmap-lib/src/transform.ts#L67-L85) [destroy 实现](https://github.com/markmap/markmap/blob/99fc93e6efd4a1df01260232d818fb57955d71df/packages/markmap-view/src/view.ts#L758-L764)

建议把 `markmap-lib/no-plugins` 转换放入最多两个可终止 ES module Worker；主线程只负责受限 node tree 的 DOM 测量与交互。沿用 revision/task id、过期结果丢弃、超时终止 Worker、视图销毁。首版在实测前采用保守上限：source 512 KiB、2,000 nodes、深度 64、单节点清理后 HTML 20 KiB、最终 SVG 5 MiB/100,000 elements；超限显示明确错误。必须增加 500、1,000、2,000 节点以及深链 fixture，测量 transform、首次 fit、折叠、resize、内存回收和连续 external revision。

布局仍发生在 renderer DOM 线程，因此 Worker 不能代替 node/depth 限制。多个 block 要按可见性/队列调度，不能同时初始化所有大型 Markmap。

## Deterministic PDF

PDF 不得序列化用户偶然留下的折叠、缩放或平移状态。每个 block 在首次成功时，从同一份清理后 pure tree 生成一份独立 export snapshot：

1. 深拷贝 tree，清除所有 `payload.fold`，强制全部展开。
2. 使用同一固定版本、主题、本地字体和 `duration: 0` 渲染。
3. 等待字体和布局稳定；以自然布局 bounds 加固定 padding 生成 `viewBox`，移除交互 zoom transform。
4. 通过同一 Markmap sanitizer 后保存 SVG；PDF export window 只复用该 snapshot，不重新转换 Markdown，也不读取当前交互 DOM。

这样 screen 与 PDF 使用相同 Markdown 语义和清理策略，同时 PDF 结果对用户操作不敏感。`foreignObject` 的中文文本选择、链接、分页、A4/adaptive/custom width、超宽图缩放必须做 Electron PDF 测试；单个 SVG 无法自然跨页，首版应限制规模并提示作者拆分过大的 map，而不是静默栅格化。

## Bundle and license implications

npm 快照中，`markmap-lib@0.18.12` tarball/unpacked 为 181,381 / 741,061 bytes，`markmap-view@0.18.12` 为 22,865 / 86,454 bytes，`markmap-common@0.18.9` 为 7,219 / 33,693 bytes。`markmap-lib/no-plugins` 发布入口自身约 3.8 KiB，但包依赖仍声明 Markdown-it、KaTeX、highlight.js、Prism、YAML、HTML parser 与 `markmap-view`；实际安装包和 lazy chunk 增量必须以 Fuxian production build/asar 为准。[markmap-lib package](https://github.com/markmap/markmap/blob/99fc93e6efd4a1df01260232d818fb57955d71df/packages/markmap-lib/package.json#L18-L83) [markmap-view package](https://github.com/markmap/markmap/blob/99fc93e6efd4a1df01260232d818fb57955d71df/packages/markmap-view/package.json#L31-L53)

Markmap packages 为 MIT；`markmap-view` 依赖 D3，并把 `d3-flextree` 用于布局。发布时要更新并验证 `THIRD_PARTY_NOTICES.md`，特别检查被上游构建产物包含、但只列在其 devDependencies 的 `d3-flextree`。[Markmap MIT License](https://github.com/markmap/markmap/blob/99fc93e6efd4a1df01260232d818fb57955d71df/LICENSE) [layout import](https://github.com/markmap/markmap/blob/99fc93e6efd4a1df01260232d818fb57955d71df/packages/markmap-view/src/view.ts#L1-L23)

## First-release acceptance boundary

1. Canonical `markmap` fence，Markdown 标题/列表、基础 inline formatting、受控链接和 magic fold comments。
2. 无 frontmatter/options/plugins/assets/images/任意 HTML/网络请求；固定本地样式与字体。
3. 固定高度的 inline reader、键盘可用的节点折叠、工具栏缩放/fit、独立 full-screen zoom/pan。
4. 可取消的 transform Worker、受限 DOM layout、显式 readiness、重试和 external revision 处理。
5. 专用双阶段 sanitizer；文本可选择，链接由系统浏览器打开。
6. PDF 始终全部展开、自然 bounds fit、复用预生成的清理后 SVG，不继承交互状态。
7. production CSP、lazy chunks、asar、许可、中文/超宽/深层地图、screen/PDF 一致性全部通过后再关闭 Issue #22。
