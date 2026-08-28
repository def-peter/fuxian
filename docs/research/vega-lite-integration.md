# Vega-Lite 浏览器与 Electron 本地集成评估

> 调研日期：2026-08-28。资料仅采用 Vega/Vega-Lite 官方文档、官方仓库和官方包元数据。版本与体积数据是调研日快照，不是实施时的锁定版本。

## 结论

Issue #23 适合采用**本地、延迟加载、静态 SVG 快照**方案：

`lazy import -> schema 校验 -> Fuxian 策略校验 -> compile -> fail-closed loader -> headless View -> toSVG -> SVG 清理 -> 屏幕/PDF 复用 -> finalize`

直接使用 `vega-lite` 编译与 `vega` 运行时，比 `vega-embed` 更符合 Fuxian 的只读 finished-document reader 边界。官方推荐的编译入口是 `vegaLite.compile(spec).spec`；Vega `View.toSVG()` 返回矢量 SVG 字符串，并在 headless 渲染前等待数据流完成。[Vega-Lite compile](https://vega.github.io/vega-lite/usage/compile.html#javascript) [View `toSVG`](https://vega.github.io/vega/docs/api/view/#view_toSVG) [headless renderer source](https://github.com/vega/vega/blob/main/packages/vega-view/src/render-headless.js)

`vega-embed` 面向交互式网页，额外包含 Tooltip、Themes、源码/导出/在线 Editor actions，并允许 embed 配置参与渲染；这些都不是 Fuxian 图表任务所需能力。[Vega-Embed capabilities](https://github.com/vega/vega-embed/blob/main/README.md) [package metadata](https://github.com/vega/vega-embed/blob/main/package.json)

## 推荐 JavaScript 边界

首次发现 `vega-lite` fenced block 时，在独立 worker 中缓存动态导入的 `vega-lite`、`vega` 和 `vega-interpreter` Promise。主阅读器启动时不要解析这些包；动态加载只减少启动解析与执行成本，依赖仍会进入 Electron 安装包。

核心调用可按以下边界实现：

```ts
const vgSpec = compile(vlSpec).spec;
const runtime = parse(vgSpec, null, { ast: true });
const view = new View(runtime, {
  renderer: 'none',
  loader: denyExternalResources,
  expr: expressionInterpreter,
});

try {
  return await view.toSVG();
} finally {
  view.finalize();
}
```

Vega 默认通过 `Function` 构造器执行表达式，不符合禁止 `unsafe-eval` 的 CSP。官方替代方案是让 parser 输出 AST，并把 `vega-interpreter` 传给 View；官方测量称初始解析与数据流平均约慢 10%，但这是值得接受的安全成本。[CSP and interpreter](https://vega.github.io/vega/usage/interpreter/) `finalize()` 会注销 timer、外部事件监听器和 tooltip，但应用必须在 View 不再使用时显式调用。[View lifecycle](https://vega.github.io/vega/docs/api/view/#view_finalize)

## `data.values` 校验边界

Vega-Lite schema 校验与 Fuxian 资源策略是两层不同的检查。包本身导出 `vega-lite-schema.json`；编译器会产生 warnings，但不能代替 schema 校验。[Vega-Lite package exports](https://github.com/vega/vega-lite/blob/main/package.json) [official validation guidance](https://vega.github.io/vega-lite/usage/debugging.html#validate-the-schema)

1. 在解析前限制源码字节数，只接受 JSON；使用随安装版本打包的 schema，不根据用户的 `$schema` URL 发起请求。
2. 遍历所有组合 view 及 `lookup.from.data`。任何**存在的** Data 节点都必须自带 `values`；拒绝 `url`、named-only data、`datasets` 间接引用及 `sequence`、`sphere`、`graticule` generator。[Data variants](https://vega.github.io/vega-lite/docs/data.html) [common view properties](https://vega.github.io/vega-lite/docs/spec.html#common) [lookup secondary data](https://vega.github.io/vega-lite/docs/lookup.html#lookup-data)
3. 首版建议让 `values` 只接受有明确字节、行数、字段数和嵌套深度上限的 JSON 数组/对象，拒绝 schema 同样允许的 CSV/TSV 字符串，以便配额可预测。
4. 编译后再次检查 Vega spec 不含外部 data URL、image 或 href；最后再清理 SVG。不要对 `data.values` 内普通记录的同名字段做无上下文递归匹配。

## 安全边界

| 风险               | 官方行为                                                                                                                                                                                                                                                                                                                                                                                                                 | Fuxian 首版策略                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| 外部数据与文件     | View 构造时即可立即请求外部数据，因此 custom loader 必须作为构造参数传入。[View loader timing](https://vega.github.io/vega/docs/api/view/#view_loader)                                                                                                                                                                                                                                                                   | 传入 `load`、`sanitize` 均拒绝的 loader，并在 Vega 专用隔离环境中以 CSP `connect-src 'none'` 做第二层保护。 |
| 默认 URL sanitizer | 默认 loader 允许 `http(s)`、`file`、`data`、`mailto`、`tel` 等 URI；它检查的是 URI 合法性，不是产品白名单。[loader source](https://github.com/vega/vega/blob/main/packages/vega-loader/src/loader.js)                                                                                                                                                                                                                    | 不复用默认 sanitizer 作为授权判断。                                                                         |
| 图片               | `image` mark 的 URL 可以来自 inline data 的字段，所以禁用 `data.url` 仍可能联网。[Image mark](https://vega.github.io/vega-lite/docs/image.html)                                                                                                                                                                                                                                                                          | 拒绝 image mark、`encoding.url` 和 mark URL；SVG sanitizer 删除 `<image>` 及外部引用。                      |
| 链接               | `href` channel 会让 mark 在点击时加载 URL；SVG renderer 会输出 `<a>`。[href channel](https://vega.github.io/vega-lite/docs/encoding.html#href) [SVG renderer source](https://github.com/vega/vega/blob/main/packages/vega-scenegraph/src/SVGStringRenderer.js)                                                                                                                                                           | 首版拒绝 `encoding.href`/mark href，并从 SVG 删除 anchor 与事件属性。                                       |
| Tooltip            | 原生 renderer 可生成 title；Vega Tooltip plugin 还能生成 HTML，并支持图片 tooltip。[Tooltip](https://vega.github.io/vega-lite/docs/tooltip.html)                                                                                                                                                                                                                                                                         | 不引入 Tooltip plugin；保留经过转义/清理的纯文本语义，不创建 HTML 浮层。                                    |
| 表达式             | Vega expression 是受限的 JavaScript 子集，但仍提供 `random()`、`now()`、数组序列、数据与浏览器状态函数。[Expressions](https://vega.github.io/vega/docs/expressions/)                                                                                                                                                                                                                                                     | 使用 AST interpreter；限制表达式数量/长度，首版拒绝随机、当前时间和浏览器状态依赖。不要用正则解析表达式。   |
| Transform          | `flatten`、`fold` 会扩行，`pivot` 默认字段数不设限，`density` 可生成大量采样，`sample` 使用随机性。[Transform index](https://vega.github.io/vega-lite/docs/transform.html) [flatten](https://vega.github.io/vega-lite/docs/flatten.html) [fold](https://vega.github.io/vega-lite/docs/fold.html) [pivot](https://vega.github.io/vega-lite/docs/pivot.html) [density](https://vega.github.io/vega-lite/docs/density.html) | 先采用 transform allowlist；同时限制 transform 数量、输入行数、尺寸、运行时和最终 SVG 字节/节点数。         |

即使上游 renderer 会转义文本，也应让最终 SVG 继续经过 Fuxian 的结构化 allowlist sanitizer；Vega 的 URI 清理不能替代该边界。

## 取消、超时与任务替换

`runAsync()` 和 `toSVG()` 的官方签名均不接受 `AbortSignal`；`finalize()`只清理 timer/listener，并不终止当前 compile 或 CPU dataflow。[`runAsync`](https://vega.github.io/vega/docs/api/view/#view_runAsync) [`toSVG`](https://vega.github.io/vega/docs/api/view/#view_toSVG) [`finalize` source](https://github.com/vega/vega/blob/main/packages/vega-view/src/finalize.js)

因此 `Promise.race(timeout)` 只能让调用方停止等待，不能实现硬取消。建议把编译与渲染放进可销毁的 Web Worker；文档 revision、用户取消或超时后终止 worker，并以 task id 丢弃过期结果。官方没有承诺完整 Vega-Lite 在 Web Worker 中运行，这一架构需要先用拒绝 image/URL 的目标子集验证。若暂时同线程实现，只能依赖严格输入上限和过期结果隔离，不能声称具备硬超时。

## 确定性、PDF 与文本

- 每个 `(source hash, installed engine version, content width, document theme)` 只生成一份已清理 SVG；正文、全屏、复制 SVG 与 PDF 复用该字符串，PDF 不重新编译。
- 固定图表宽高、number/time locale 和字体；不在 PDF 路径使用依赖宿主容器的 responsive `container` sizing。[Responsive sizing](https://vega.github.io/vega-lite/docs/size.html#specifying-responsive-width-and-height) [Locale API](https://vega.github.io/vega/docs/api/locale/)
- 禁止 `now()`、`random()` 和随机 transform；若将来允许随机能力，Vega 提供 `setRandom(randomLCG(seed))`，但它是全局状态，应在隔离 worker 内设置。[Seeded random API](https://vega.github.io/vega/docs/api/statistics/#randomLCG)
- `toSVG()` 产生真正的 `<text>`/`<tspan>`，而不是把图表整体栅格化，因此正文中的图表文本可选择，PDF 保持矢量。[SVG string renderer](https://github.com/vega/vega/blob/main/packages/vega-scenegraph/src/SVGStringRenderer.js) 跨机器像素级一致仍依赖字体可用性；需要固定打包字体并等待字体与 render task 全部 ready 后再允许导出。

## 依赖体积与许可证

官方包元数据快照如下；minified/gzip 是从官方 npm tarball中的浏览器产物本地测得的数量级，只用于立项评估，最终以 Fuxian 的 Vite production stats 和 Electron 安装包 diff 为准。

| 包                                                                      |  版本 | npm unpacked size | 预构建 browser min / gzip（约） |
| ----------------------------------------------------------------------- | ----: | ----------------: | ------------------------------: |
| [`vega-lite`](https://registry.npmjs.org/vega-lite/6.4.3)               | 6.4.3 |           5.81 MB |                  251 KB / 80 KB |
| [`vega`](https://registry.npmjs.org/vega/6.4.0)                         | 6.4.0 |           3.73 MB |                 521 KB / 180 KB |
| [`vega-interpreter`](https://registry.npmjs.org/vega-interpreter/2.3.2) | 2.3.2 |           0.05 MB |              单独测量实施 chunk |
| [`vega-embed`](https://registry.npmjs.org/vega-embed/7.1.0)（不建议）   | 7.1.0 |           0.59 MB |     60 KB / 21 KB，另需 peer 包 |

Vega、Vega-Lite、Vega-Embed 与 interpreter 均声明 BSD-3-Clause。二进制分发必须在文档或随附材料重现版权、许可条件和免责声明，且不得借版权所有者或贡献者名称背书；不要求图表内显示 Vega logo。[Vega license](https://github.com/vega/vega/blob/main/LICENSE) [Vega-Lite license](https://github.com/vega/vega-lite/blob/main/LICENSE) Electron 发布流程应生成并随包提供完整 third-party notices，覆盖全部传递依赖。

## 实施门槛

在进入产品代码前，先用 production bundler 记录初始 chunk、lazy chunk、asar 和安装包增量；再做一个 worker spike，验证 CSP、硬超时、固定字体 SVG、屏幕/PDF 同源快照和连续 revision 替换。若 worker 方案不可行，必须缩小 transform/表达式能力，而不是把同线程 `Promise.race` 描述为取消。

## 实施结果

Issue #23 的 production build 将 Vega-Lite、Vega、AST interpreter、Ajv 和 bundled schema 合并为一个按需加载的 Worker 产物，未进入应用启动路径。2026-08-28 锁定版本构建出的未压缩 Worker 文件为约 `4,018 KB`；该数字应在依赖升级时重新测量。

Worker spike 与 Electron 测试确认：生产 CSP 可以加载同源 Worker；取消或超时会终止运行中的 Worker；同时最多运行两个 Worker；屏幕与 PDF 的已清理 SVG 快照逐字一致。macOS 与 Windows 目录包均通过发布包校验。
