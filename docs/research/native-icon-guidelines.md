# Windows 与 macOS 原生图标规范调研

> 调研日期：2026-10-29。适用现状：Fuxian 0.1.32、Electron 44.0.0、Windows NSIS 与 macOS PNG/ICNS 图标流程。状态：研究结论，不是新的设计决策。本次只新增报告，没有改动资源或代码，也没有进行 Windows 原生显示验证。

后续已批准并实施的 Windows 专用透明净空调整见 [ADR 0038](../adr/0038-trim-only-transparent-windows-icon-padding.md)：整枚白底图标仅裁全透明外围，小尺寸无余量帧及全部 macOS 资源保留。以下资源入口、测量和未实施说明反映调研时点，不代表后续实现状态；Windows 原生显示仍待验收。

## 结论

**同一个品牌，可以分别出 Windows 和 macOS 的图标。建议分平台、分用途导出，不必重做两套 Logo。** 就像同一张照片配不同相框，品牌主体一致，画布、外形和小尺寸处理可以不同。Apple 也建议跨平台保持视觉一致，而不是要求文件完全相同。[Apple HIG][apple-app-icons]

- **Windows 可以减少多余的外部透明留白，但不是一律越少越好。** 官方强调轮廓、视觉平衡、小尺寸辨识和多分辨率，没有给所有 Win32 图标规定统一的透明留白百分比。[Windows 设计指南][ms-design] [Win32 图标][ms-icons]
- **白底圆角承载面可以保留。** Microsoft 偏好透明背景，但明确允许品牌图标带底板。不能据此说 Windows 必须去掉白底，或必须把图案撑满画布。[图标制作指南][ms-construction]
- **应用图标和托盘／菜单栏图标应该分开看。** macOS 菜单栏适合黑色加透明度的模板图；Windows 托盘适合小尺寸、多分辨率资源，可以使用彩色品牌图标。Electron 在 Windows 推荐 ICO，在 macOS 推荐模板图。[Apple 菜单栏][apple-menu-bar] [Electron Tray][electron-tray]
- **Fuxian 的 Windows 问题尚未定位。** 不能把“Windows 少留白”当作已经证实的修复；也不能用放大内部书页与「見」，替代放大包含白底的整个图标。
- **已批准的 macOS 菜单栏方案保持不变。** 本报告不重新评审它，也不建议重绘、加粗或换采样方法。现有决定见 [ADR 0037](../adr/0037-preserve-macos-menu-bar-stroke-coverage.md)。

## 先说清楚：到底是哪一层显得小

| 层次             | Fuxian 中对应的内容                                |
| ---------------- | -------------------------------------------------- |
| 文件画布         | PNG／ICO 某一帧的完整矩形，包括全透明像素          |
| 应用图标整体轮廓 | 白色圆角承载面连同里面的图案；阴影另行计量         |
| 内部品牌图案     | 蓝色书页与「見」，不包括白色承载面                 |
| 系统显示区域     | 任务栏按钮或托盘图标所在的区域，不等于图片可见范围 |

“整个图标小”应先量第二层相对第一层的大小。第三层变大，只会让图案在白底中更满，不会让白底整体变大。菜单栏单色图没有白色承载面，不能套用应用图标的测量方式。

还要区分透明边距和图标内部的白底空间。后者属于画面，不是透明留白。测量透明度边界时，也应分开记录低透明度阴影和主体；单个接近透明的像素就可能扩大边界。这是测量方法建议，不是平台规定。

## Microsoft：经典桌面应用与通知区域

### 应用、窗口和任务栏不是一个资源入口

Win32 图标资源可以包含多个尺寸和色深。系统根据所需尺寸选择图像；窗口还分别有大图标和小图标。`WM_SETICON` 能设置窗口图标，任务栏按钮通常呈现应用图标。不能仅凭 EXE 中有正确 ICO，就推定所有运行中的窗口都用了它。[About Icons][ms-icons] [WM_SETICON][ms-seticon] [The Taskbar][ms-taskbar]

Electron 同样区分运行时窗口图标和可执行文件图标。`BrowserWindow` 的 `icon` 是窗口图标；Windows 推荐 ICO，也允许不设置，让它使用 EXE 图标。PNG 并非不合法，但不能把一个 PNG 路径当成已经提供了 ICO 的所有尺寸。[Electron 窗口选项][electron-window] [nativeImage][electron-image]

### 16／32px 不是不随 DPI 改变的上限

Microsoft 当前指南给出的 Windows 11 示例：

| 显示位置                       | 100%／125%／150%／200% 缩放时的像素尺寸 |
| ------------------------------ | --------------------------------------- |
| 标题栏、通知区域等             | 16／20／24／32px                        |
| 任务栏、搜索结果、所有应用列表 | 24／30／36／48px                        |

这是该指南的场景表，不是所有 Windows 版本、设置和加载 API 的固定保证。Win32 系统大小也受 DPI 影响；例如大图标的系统度量与现代任务栏的实际显示尺寸不能直接画等号。[Icon scaling][ms-construction] [Win32 系统度量][ms-icons]

资源建议：

- Microsoft 建议应用至少提供 16、24、32、48、256px。更多匹配尺寸可以减少缩放。[制作指南][ms-construction]
- Electron 44 另外明确列出 20、40、64px 等 DPI 对应尺寸。Fuxian 后续可按实际显示场景补齐，不必无差别生成所有整数尺寸。[Electron 44 nativeImage][electron-image]
- Win32 通知区域文档建议提供 16、32px，并用适合 DPI 的加载方法。这里不是说托盘永远只显示两种像素大小。[通知区域 API 指南][ms-notification]

### 外形、背景和小尺寸细节

Windows 设计指南强调独特、平衡的轮廓，以及小尺寸的清晰度。透明背景更容易适应主题；带底板的品牌图标也可以使用。因此，平台专用导出可以调整整体占画布比例，但无需强迫所有品牌采用同一种轮廓。[Windows 设计][ms-design] [透明背景说明][ms-construction]

较早的 Win32 通知区域指南还建议：优先选择易认的独特轮廓，保持简单，并为高 DPI 提供多个尺寸。但页面明确注明它为 Windows 7 编写，不能把其中 Aero 风格、尺寸表或其他历史建议，全部当成 Windows 11 的硬要求。[历史通知区域指南][ms-notification-design]

同样，旧版图标指南提醒“小尺寸不能只把大图机械缩小”。这支持分别检查小图，不等于授权随意修改 Fuxian 已确认的品牌几何。[历史 Win32 图标指南][ms-legacy-icons]

### 哪些是建议，哪些不要误套

- “视觉平衡”“透明背景更好”“推荐 ICO”和上述尺寸集合，属于设计或质量建议，不是统一的留白验收标准。[Microsoft][ms-construction] [Electron][electron-tray]
- Win32 API 对参数、句柄和调用方式有具体约束；这些与 Logo 应占画布多少是两回事。[Win32 图标][ms-icons] [通知区域][ms-notification]
- 同一篇 Windows 制作指南还包含 MSIX／AppX 的 `targetsize`、`altform-unplated` 和磁贴资源要求。它们有各自适用范围，**不是 Fuxian 当前 NSIS／Win32 ICO 的缺失文件清单**。不要用磁贴留白或未提供 unplated 资源的缩小机制，直接解释当前托盘问题。[manifest 与资源说明][ms-construction] [本项目打包配置](../../electron-builder.yml)

## Apple：当前新流程与现有 ICNS 要分开

### 当前 HIG：Icon Composer／Liquid Glass

Apple 的 App icons 页面在 **2026-10-28** 更新了格式说明。当前明确允许非分层位图，例如 PNG，也允许分层的 Icon Composer 文件；后者能更精确地控制材质和不同外观。不能说“现在必须改用 Icon Composer”。[HIG：Icon formats][apple-app-icons]

新流程的主要建议是：使用平台模板和网格，提供未预先裁圆角的图层，让系统完成遮罩与视觉效果。导入的背景图层应铺满且不透明。这里的“背景铺满”，不等于内部品牌图案必须铺满。[HIG：Layer design、Icon shape、Design][apple-app-icons]

Icon Composer 的 `.icon` 文件通过构建流程集成；Apple 的 Xcode 文档还说明了旧系统图标的生成和替换行为。它不是把现有圆角 PNG 改个后缀就完成迁移。[Icon Composer 集成][apple-composer]

### Fuxian 现状：静态 PNG → ICNS

Fuxian 当前设置的是 `build/icon.icns`，不是上述分层 `.icon` 文件。[本项目配置](../../electron-builder.yml)

Apple 归档的高分辨率指南适用于理解传统 iconset／ICNS：同一逻辑尺寸有标准与 Retina 图像；可用 `iconutil` 打包；完整尺寸集合是理想做法，但页面明确说并非必须全部提供。同像素数的 16pt@2x 与 32pt@1x，也可能需要不同的视觉处理。[传统高分辨率指南][apple-legacy]

该归档页面的“不要使用 Icon Composer”指当年的旧工具，**不能用来否定 2025 年推出的新 Icon Composer**。这里仅采用它对传统 ICNS、多分辨率和逻辑尺寸的说明。[归档页面，2012-09-19][apple-legacy] [新工具说明][apple-composer]

也不能反过来说旧 ICNS 在新 macOS 上绝不会被系统处理。Apple 在 WWDC25 明确说明，已有 Mac 图标可能被遮罩、扩展或缩放，以适应新外形。Fuxian 在具体系统版本中的结果仍需实机确认。[WWDC25，约 3:46 起][apple-wwdc]

因此：**不要为了遵守新图层规则，直接裁掉当前 ICNS 的全部透明边缘。** 传统静态成图、新分层输入、系统最终呈现是三个阶段。若未来迁移，应单独验证构建支持、旧系统回退和新外观，不混入此次 Windows 尺寸排查。

### macOS 菜单栏／状态图标

Apple HIG 建议菜单栏额外项采用图标或 SF Symbols。形状由黑色与透明部分定义，系统负责适配浅色、深色和选中状态。AppKit 的模板图还允许用 Alpha 调整黑色内容的透明度。[菜单栏 HIG][apple-menu-bar] [NSImage.isTemplate][apple-template]

Electron 对 macOS Tray 也推荐模板图，并要求保留 `Template` 与 `@2x` 的文件命名，以便自动识别。文档说 16／32px 对多数图标“效果很好”，**不是唯一合法尺寸**。[Electron 44 Tray][electron-tray] [nativeImage 模板与多分辨率][electron-image]

Fuxian 当前采用 18pt 逻辑画布，对应 18／36px 表示。这个数值是本项目方案，不是 Apple 的强制值；菜单栏高度也不能直接当成图案必须填满的高度。已批准的面积平均 Alpha 采样及对齐规则保持不变。[ADR 0037](../adr/0037-preserve-macos-menu-bar-stroke-coverage.md) [当前资源说明](../../design/logo/final/README.md)

## 成熟 Electron 项目的实际做法

以下是官方仓库在调研日的固定版本，不是对所有 Electron 应用的统计，也不代表所查开发分支已经发布。

### VS Code：平台资源分别维护

检查版本：仓库 `1.145.0`，提交 `d7658021df8289f549bf2af8c8dec131f2580d69`，2026-10-29。

- [`build/lib/electron.ts` 第 149、240 行][vscode-config]：macOS 指定 `resources/darwin/code.icns`，Windows 指定 `resources/win32/code.ico`。
- 实际资源分别位于 [`resources/darwin/code.icns`][vscode-mac] 和 [`resources/win32/code.ico`][vscode-win]。

这证明成熟项目会把平台导出作为独立资源维护。**它不证明 Windows 必须使用更小的留白比例**，也不证明改文件格式就会改变画面占比。这里检查的是公开仓库构建配置，不把它等同于所有 Microsoft 品牌发行物的完整资源。

### Signal Desktop：应用图标与托盘资源分开

检查版本：`8.36.0-alpha.1`，提交 `5dad34ad5ea1a5b6229412e5c8ac0a696ff7532d`，2026-10-28。

- [`package.json` 第 374、466 行][signal-package]：macOS 应用图标使用 `build/icons/mac/AppIcon.icon`；Windows 使用 `build/icons/win/icon.ico`。
- [`build/icons/mac/AppIcon.icon/icon.json`][signal-composer]：包含图层、外观和材质设置。这是实际采用新流程的例子，不意味着 Fuxian 应立即迁移。
- [`app/SystemTrayService.main.ts`][signal-tray] 的 `Variant`、`getTrayIconImagePath()` 和 `getIcon()`：托盘使用独立的 `images/tray-icons/`，有普通和未读状态图，并通过 `addRepresentation()` 加入多种分辨率。
- 例如 [`images/tray-icons/base/signal-tray-icon-16x16-base.png`][signal-tray-image]，与应用打包图标不是同一个文件。

也要看到差异：这个版本的 Signal 在 Windows／macOS 共用多表示的 PNG 托盘加载分支，所查函数没有设置模板标记。不能把它宣传成“所有应用都在 macOS 使用 Template、Windows 使用 ICO”的证据。[Signal 托盘源码][signal-tray]

两例共同支持的做法是：**品牌保持关联，平台资源独立，应用图标与托盘按用途分工，并处理多分辨率。** 具体格式和是否采用单色模板，仍由平台 API、产品需求和实测决定。

## 对 Fuxian 的限定建议

已确认的设计边界：白色承载面与内部彩色图案的比例保持不变。本轮唯一检查项是整枚图标外侧的透明净空；不调整白底内部空间，不单独放大前景，也不重画承载面。若存在可裁透明区域，白底与前景须整体等比变化；没有余量的尺寸不强行放大。以下通用资源建议不等于本轮已获准改动尺寸集合或加载路径。

### 当前资源入口

| 用途                   | 当前入口                                                              |
| ---------------------- | --------------------------------------------------------------------- |
| macOS 应用打包图标     | `build/icon.icns`，现有白底圆角画面                                   |
| Windows 应用打包图标   | `build/icon.ico`，同一白底圆角画面                                    |
| BrowserWindow 窗口图标 | 共用 `apps/desktop/resources/icon.png`                                |
| Windows 通知区域       | `Tray` 直接接收 `apps/desktop/resources/tray.ico`                     |
| macOS 菜单栏           | `trayTemplate.png` 与 `trayTemplate@2x.png`，18pt 的标准／Retina 表示 |

入口依据：[打包配置](../../electron-builder.yml)、[主进程窗口配置](../../apps/desktop/src/main/index.ts)、[Tray 工厂](../../apps/desktop/src/main/desktop-tray.ts)、[资源说明](../../design/logo/final/README.md)。上述入口应分别验收；只替换打包 ICO，不能保证覆盖已经显式指定 PNG 的窗口，更不会自动替换托盘 ICO。

资源说明中的“约 4% 透明净空”是现有品牌物料约定，不是 Windows 或 macOS 的通用强制比例。本报告没有据此推出新的平台比例，也没有修改该约定。

### 建议采用的顺序

1. **保留一个品牌母版，允许平台专用导出参数。** 不必为“分平台”新造两个 Logo。是否需要不同占画布比例，交给原生显示对照决定。
2. **先明确是哪处小。** 区分托盘、运行中任务栏、固定快捷方式和资源管理器。每一处先确认实际资源，避免改错文件。
3. **若证据指向外部透明边距，再做整体候选。** 裁的是白底圆角外面的多余透明区；白底、书页与字形一起等比变化。不单独放大内部图案，不改变相对几何。候选先对照，再决定是否采用。
4. **Windows 资源优先检查实际尺寸匹配。** ICO 的各帧应分别看清晰度、主体范围与主题对比。窗口是否改用 Windows 专用 ICO，或使用 EXE 默认图标，是后续独立实现选项，不是本报告已执行的修改。[Electron 窗口建议][electron-window]
5. **macOS 已批准方案不动。** 不改菜单栏模板，也不顺带改 Dock、文件关联图标或引入 Liquid Glass。

### 本地资源实测

2026-10-29 直接解码当前 ICO、ICNS 和 PNG，按 Alpha ≥ 128 测量包含白底的外轮廓；这个阈值用于排除很淡的边缘，不是系统显示标准。ICO 中的 32 位 DIB 按 BGRA 解码，ICNS 的 PNG 表示按原尺寸解码，没有先缩放。

| 资源                                       | 图像画布  | 外轮廓边界 |
| ------------------------------------------ | --------- | ---------- |
| Windows 应用 `build/icon.ico` 的 32px 帧   | 32×32     | 30×30      |
| macOS 应用 `build/icon.icns` 的 32px 表示  | 32×32     | 30×30      |
| Windows 托盘 `tray.ico` 的 16px 帧         | 16×16     | 16×16      |
| Windows 托盘 `tray.ico` 的 32px 帧         | 32×32     | 30×30      |
| 共用窗口 `apps/desktop/resources/icon.png` | 1024×1024 | 965×974    |

另外比较了应用 ICO 和 ICNS 的 32、64、128、256px 表示：每个对应尺寸的 Alpha 通道逐像素一致。这证明当前两套应用导出确实共用了相同的透明轮廓，而不仅是大致相似的边距。

Windows 应用 ICO 当前包含 16、32、48、64、128、256px；托盘 ICO 包含 16、20、24、32、40、48、64px。应用 ICO 尚未提供 Microsoft 最低建议集合中的 24px，也未覆盖 Electron 列举的所有常见中间 DPI 尺寸。这是值得补齐的资源质量项，**不是已证实的整体偏小根因**；显式指定窗口 PNG 的入口还需要另行核对。

实测不支持“明显存在大片外部透明边距”的判断，但也不能单独证明系统显示正常：主体透明度、像素采样、实际选帧和对照图标都会影响观感。32px 帧两侧高不透明度边界各约 1px；16px 托盘帧已几乎没有可继续裁掉的外围空间。

进一步按 Alpha > 0 检查完全透明的外围条带，不能把上述 Alpha ≥ 128 的边界外侧全部当作可裁空间：

- 共用 1024px 窗口 PNG 的非透明边界为 `(26, 21)` 起的 `974×981px`，因此左／右／上／下的全透明条带分别为 `26／24／21／22px`。若将这枚图标完整包进最小正方形，保持所有非透明内容，理论上可从 1024px 画布收紧到 981px；重新等比填入原画布的线性放大上限约为 `4.4%`。这是不留额外抗锯齿保护的几何上限，不是已验证的原生显示增幅。
- Windows 应用 ICO 的 16、32、64px 帧均有非零 Alpha 到达画布四边；不能直接把这几帧每边裁掉 1px 而声称仅删除了全透明像素。
- Windows 托盘 ICO 的 16、20px 帧没有完整的全透明外围条带；24px 帧仅左右各 1px，顶部和底部无余量；32、40、48、64px 帧则四边各有 1px 全透明条带。若调整，仍须保留边缘质量并逐尺寸验收，不能统一裁同一个百分比。

因此，源 PNG 有少量可收紧的外围净空，但当前低分辨率成图并非都能直接裁边。此结果不改变白底与内部图案比例，也没有修改任何 Windows 图标资源。

此前仅放大内部图案的 Windows 试稿已撤回。用户所指的是包含白底的整个轮廓。不能把该试稿当成有效修复，也不能据此认定留白就是根因。[当前决定边界](../adr/0037-preserve-macos-menu-bar-stroke-coverage.md)

### 暂不采用的替代方案

- **所有平台完全共用同一导出：** 可以工作，但不应因此跳过各平台、小尺寸和 DPI 验收。暂时共用画面并不等于设计错误。
- **Windows 一律去白底或贴满边：** 官方没有这种通用要求，也偏离此次“整个轮廓大小”的问题。
- **统一换成 Icon Composer：** 它只解决 Apple 平台的另一套图标流程，不能解释 Windows 托盘现象。需要另立迁移任务。

## 仍需哪些运行时证据

本次未确定根因，也未确定新的留白参数。后续最小验证范围：

1. 在 Windows 记录版本、缩放率和显示器配置。至少比较 100%、125%、150%、200%；支持其他缩放率时补测。不要只检查 16／32px 文件预览。[DPI 与尺寸依据][ms-construction]
2. 使用已打包、已安装的 Fuxian。分别截图通知区域、溢出区、运行中任务栏、固定任务栏和 Explorer。记录是否为旧快捷方式；必要时在独立测试快捷方式中排除旧资源影响，不先清理用户系统缓存。
3. 确认各入口实际使用的资源、请求大小和所选图像。先核对窗口 PNG、托盘 ICO、EXE 资源，再评估加载或缩放问题；目前没有证据证明其中某一项出错。
4. 对每帧分别量画布、包含白底的主体边界、内部图案边界和透明度覆盖。把当前图与一个“整体轮廓更大”的候选放在同一系统环境比较，不只看放大的图片。
5. 检查深浅色、较复杂背景和混合 DPI 显示器切换。视觉验收需区分“整个图标更大”“内部图案更满”和“细节更清楚”。三者不是同一个目标。
6. 若未来评估 macOS 应用图标迁移，另测目标旧系统与新系统、Dock／Finder 和各种外观。该项不重新打开已经批准的菜单栏采样设计。[Apple 旧图适配说明][apple-wwdc]

隐藏 E2E 和生成脚本测试能验证资源存在、表示尺寸及调用关系，不能替代系统界面中的视觉验收。本项目也已明确保留原生视觉验收这一环节。[ADR 0036](../adr/0036-add-native-desktop-tray-shortcuts.md)

## 资料版本说明

Apple 动态文档正文通过官方 DocC JSON 核对；文中优先链接到供人阅读的页面。平台建议按调研日版本解释，后续更新需重新确认。

- [App icons 官方 DocC 数据](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/app-icons.json)：包含 2026-10-28 的格式说明更新。
- [The menu bar 官方 DocC 数据](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/the-menu-bar.json)。

[ms-icons]: https://learn.microsoft.com/en-us/windows/win32/menurc/about-icons
[ms-seticon]: https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-seticon
[ms-taskbar]: https://learn.microsoft.com/en-us/windows/win32/shell/taskbar
[ms-notification]: https://learn.microsoft.com/en-us/windows/win32/shell/notification-area
[ms-notification-design]: https://learn.microsoft.com/en-us/windows/win32/uxguide/winenv-notification
[ms-design]: https://learn.microsoft.com/en-us/windows/apps/design/iconography/app-icon-design
[ms-construction]: https://learn.microsoft.com/en-us/windows/apps/design/iconography/app-icon-construction
[ms-legacy-icons]: https://learn.microsoft.com/en-us/windows/win32/uxguide/vis-icons
[apple-app-icons]: https://developer.apple.com/design/human-interface-guidelines/app-icons
[apple-menu-bar]: https://developer.apple.com/design/human-interface-guidelines/the-menu-bar#Menu-bar-extras
[apple-template]: https://developer.apple.com/documentation/appkit/nsimage/istemplate
[apple-composer]: https://developer.apple.com/documentation/xcode/creating-your-app-icon-using-icon-composer
[apple-legacy]: https://developer.apple.com/library/archive/documentation/GraphicsAnimation/Conceptual/HighResolutionOSX/Optimizing/Optimizing.html
[apple-wwdc]: https://developer.apple.com/videos/play/wwdc2025/220/?time=226
[electron-image]: https://github.com/electron/electron/blob/v44.0.0/docs/api/native-image.md
[electron-tray]: https://github.com/electron/electron/blob/v44.0.0/docs/api/tray.md
[electron-window]: https://github.com/electron/electron/blob/v44.0.0/docs/api/structures/base-window-options.md#basewindowconstructoroptions-object
[vscode-config]: https://github.com/microsoft/vscode/blob/d7658021df8289f549bf2af8c8dec131f2580d69/build/lib/electron.ts#L145-L240
[vscode-mac]: https://github.com/microsoft/vscode/blob/d7658021df8289f549bf2af8c8dec131f2580d69/resources/darwin/code.icns
[vscode-win]: https://github.com/microsoft/vscode/blob/d7658021df8289f549bf2af8c8dec131f2580d69/resources/win32/code.ico
[signal-package]: https://github.com/signalapp/Signal-Desktop/blob/5dad34ad5ea1a5b6229412e5c8ac0a696ff7532d/package.json#L364-L466
[signal-composer]: https://github.com/signalapp/Signal-Desktop/blob/5dad34ad5ea1a5b6229412e5c8ac0a696ff7532d/build/icons/mac/AppIcon.icon/icon.json
[signal-tray]: https://github.com/signalapp/Signal-Desktop/blob/5dad34ad5ea1a5b6229412e5c8ac0a696ff7532d/app/SystemTrayService.main.ts
[signal-tray-image]: https://github.com/signalapp/Signal-Desktop/blob/5dad34ad5ea1a5b6229412e5c8ac0a696ff7532d/images/tray-icons/base/signal-tray-icon-16x16-base.png
