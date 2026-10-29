# 浮现 Fuxian Logo

正式标志由三层展开的蓝色书页与繁体「見」融合而成，表达 Markdown 内容从源文件中展开，并以完成态文档被看见。项目使用圆角应用图标、透明图形和 Markdown 文档图标三种标准物料。

## 设计规范

- 标志内部固定使用繁体「見」，不可替换为简体「见」。
- 不改变书页与字形的相对比例、间距和连接关系。
- 保留浅天蓝、明亮蓝、钴蓝和深石墨色的冷色层次；书页应轻盈通透，不得压暗或降低饱和度。
- 「見」使用横向一致的石墨黑，仅保留克制、连续的纵向明暗变化，不得出现偏青竖笔或分区色块。
- 保留书页与承载面上的均匀面性渐变；不要添加边缘高光、玻璃效果或重投影。
- 最小常规界面尺寸为 `24px`；`16px` 仅用于 favicon 等受限场景。
- 常规白底圆角物料四周保留约 `4%` 的透明净空，macOS 已确认资源及其边距保持原样；Windows 专用导出仅按下述整体透明裁切规则减少外围净空。
- 白色承载面与内部彩色图案的比例已确认，不得调整。Windows 若需优化整体显示大小，只能减少整枚图标外围的透明净空，并将白底与前景一起等比缩放；不得挤占白底内部空间，也不得裁掉圆角、阴影或半透明抗锯齿边缘。
- macOS 菜单栏的小尺寸单色版只裁掉透明净空、等比缩放，不加粗、不描边、不重绘；缩小时按面积累计原始 Alpha，避免细横线被采样遗漏。此规则不改变 macOS Dock 或 Windows 图标。
- 软件界面使用透明图形与实时产品标题组合；中文显示“浮现”，未来英文界面显示“Fuxian”。标题属于可本地化 UI 文本，不固化进 Logo 图片。

## 标准物料

1. **白底圆角应用图标**：用于操作系统应用图标、安装包、favicon 和项目首页。
2. **透明底图形 Logo**：用于不需要品牌名称的界面、文档和视觉物料。
3. **Markdown 文档图标**：竖向文件轮廓以 `M↓` 为中心，左下为正文横线，右下以蓝色书页贴角；分别提供 Windows 和 macOS 文件关联资源，不得替代应用图标。
4. **菜单栏单色图标**：从透明图形母版生成，裁掉多余留白。macOS 菜单栏使用 `18/36px` 单色模板，对应相同的 `18pt` 逻辑尺寸。Windows 托盘和应用图标仍使用原有白底圆角物料，不通过放大内部主体处理整体尺寸问题。

## 文件

| 文件                                                     | 用途                                |
| -------------------------------------------------------- | ----------------------------------- |
| `fuxian-app-icon-generation-source.png`                  | `1254px` 白底应用图标展示母版       |
| `fuxian-app-icon-source.png`                             | 提取后的 `1024px` RGBA 应用图标母版 |
| `app-icon/fuxian-app-icon-{size}.png`                    | `16` 至 `1024px` 的应用 Logo 导出   |
| `mark/fuxian-mark-generation-source.png`                 | `1254px` 白底透明图形展示母版       |
| `mark/fuxian-mark-source.png`                            | `1024px` 透明底图形母版             |
| `mark/fuxian-mark-{size}.png`                            | `16` 至 `1024px` 的透明图形导出     |
| `small-icon/monochrome/fuxian-small-icon-{18,36}.png`    | macOS 菜单栏标准与 Retina 单色图标  |
| `file-icon/windows/fuxian-markdown-file-icon-source.png` | Windows Markdown 文档图标母版       |
| `file-icon/windows/fuxian-markdown-file-icon-{size}.png` | Windows 图标按 `16` 至 `256px` 导出 |
| `file-icon/macos/fuxian-markdown-file-icon-source.png`   | macOS `1024px` Markdown 图标母版    |
| `file-icon/macos/fuxian-markdown-file-icon-{size}.png`   | macOS 图标按 `16` 至 `1024px` 导出  |
| `../alternatives/faceted-origami-v1/`                    | 备选的彩色折面书页方案              |
| `../archive/monochrome-book-jian-v1/`                    | 上一版灰阶矢量 Logo，可用于历史回溯 |

Electron 在 Windows 使用 `apps/desktop/resources/icon-windows.png`，其他平台保留 `apps/desktop/resources/icon.png`；应用打包图标位于 `build/icon.png`、`build/icon.icns` 和 `build/icon.ico`。Windows 文件关联图标位于 `build/markdown-file.ico`，包含 `16`、`20`、`24`、`32`、`48`、`64`、`128` 和 `256px` 八个画面；macOS 文件关联图标位于 `build/markdown-file.icns`，包含标准与 Retina 完整 iconset。

运行 `node scripts/generate-windows-icons.mjs` 只更新 Windows 运行时 PNG、应用 ICO 和托盘 ICO，不读写 macOS 资源。Windows PNG 从原 `1024px` 白底应用图中整体裁取 `(21, 20)` 起的 `983×983px`，只移除全透明条带，并在完整非透明内容外保留一圈源像素。整枚图标约放大 `4.2%`，白底与前景比例不变。应用 ICO 保留 `16/32/48/64/128/256px`；其中 `16px` 仍用原物料。托盘保留 `16/20/24/32/40/48/64px`；其中 `16/20/24px` 没有完整外围余量，保持原样，其余帧从整体裁切版缩放。见 ADR 0038。

运行 `node scripts/generate-tray-icons.mjs` 可重新生成已确认的 macOS 菜单栏模板、单色 PNG 导出及上述 Windows 资源。单色图形宽度为 `16pt`，整体向上对齐 `0.25pt`；标准与 Retina 版本共享同一几何布局。测试分别检查横线可见度、横线之间的空隙和 Alpha 总覆盖面积，不能只与同一缩放算法逐像素比对。macOS 的应用 PNG/ICNS、原始 Logo 和文件关联图标均不修改。
