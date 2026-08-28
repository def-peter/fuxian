# 浮现 Fuxian Logo

正式标志由三层展开的彩色书页与繁体「見」融合而成，表达 Markdown 内容从源文件中展开，并以完成态文档被看见。项目使用圆角应用图标、透明图形和带“浮现”字标的横版组合三种标准物料。

## 设计规范

- 标志内部固定使用繁体「見」，不可替换为简体「见」。
- 不改变书页与字形的相对比例、间距和连接关系。
- 保留明亮暖象牙、鲜明珊瑚橙、饱和青绿色和深石墨色的色系关系，不将主 Logo 改为低饱和或暗色版本。
- 保留书页与承载面上的均匀面性渐变；不要添加边缘高光、玻璃效果或重投影。
- 最小常规界面尺寸为 `24px`；`16px` 仅用于 favicon 等受限场景。
- 圆角承载面四周保留约 `4%` 的透明净空。
- 中文横版中的“浮现”使用鼎猎宋刻体，字标视觉高度约为图形的 `82%`，呈现更明确的古籍刊刻气质；英文横版中的“Fuxian”使用 Source Serif 4 Semibold，保持编辑出版感。
- 中文字标按 alpha 重心与图形做光学居中，`28px` 高度下保留约 `5.75px` 有效间距，并采用轻量笔画增重；不要用纯黑描边重新加粗。
- 两套字标均已固化在 PNG 中，界面不可改用系统字体重新排版。字体文件不随项目提交；中文字体由品牌方提供并留存授权凭证，Source Serif 4 遵循 SIL Open Font License 1.1。

## 标准物料

1. **白底圆角应用图标**：用于操作系统应用图标、安装包、favicon 和项目首页。
2. **透明底图形 Logo**：用于不需要品牌名称的界面、文档和视觉物料。
3. **透明底图形 Logo + 本地化字标**：中文使用“浮现”，英文使用“Fuxian”；用于软件窗口左上角等品牌身份区域，字形不依赖运行系统。

## 文件

| 文件                                             | 用途                                   |
| ------------------------------------------------ | -------------------------------------- |
| `fuxian-app-icon-generation-source.png`          | `1254px` 白底应用图标展示母版           |
| `fuxian-app-icon-source.png`                     | 提取后的 `1024px` RGBA 应用图标母版    |
| `app-icon/fuxian-app-icon-{size}.png`            | `16` 至 `1024px` 的应用 Logo 导出      |
| `mark/fuxian-mark-generation-source.png`         | `1254px` 白底透明图形展示母版           |
| `mark/fuxian-mark-source.png`                    | `1024px` 透明底图形母版                |
| `mark/fuxian-mark-{size}.png`                    | `16` 至 `1024px` 的透明图形导出        |
| `lockup/zh-CN/fuxian-lockup-zh-CN-source.png`    | 中文透明横版组合母版                   |
| `lockup/zh-CN/fuxian-lockup-zh-CN-{height}h.png` | 中文横版按高度 `24` 至 `512px` 导出    |
| `lockup/en-US/fuxian-lockup-en-US-source.png`    | 英文透明横版组合母版                   |
| `lockup/en-US/fuxian-lockup-en-US-{height}h.png` | 英文横版按高度 `24` 至 `512px` 导出    |
| `../alternatives/faceted-origami-v1/`            | 备选的彩色折面书页方案                 |
| `../archive/modern-sans-lockup-v1/`              | 上一版现代无衬线中文横版               |
| `../archive/zcool-xiaowei-lockup-v2/`            | 上一版 ZCOOL XiaoWei 中文横版          |
| `../archive/dinglie-regular-lockup-v3/`          | 上一版紧间距、未增重的鼎猎宋刻体横版   |
| `../archive/monochrome-book-jian-v1/`            | 上一版灰阶矢量 Logo，可用于历史回溯    |

Electron 运行时图标位于 `apps/desktop/resources/icon.png`；打包图标位于 `build/icon.png`、`build/icon.icns` 和 `build/icon.ico`，均由 RGBA 母版导出。
