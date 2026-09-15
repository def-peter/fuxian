# Fuxian Diagram 官方文档核查

> 历史阶段：2026-09-15 优化前核查。下文的“当前”“现有”“修复方案”均指当时状态，不代表全部建议已落实或仍是当前待办。后续改动、验证范围与待跟进项见 [验证与发布摘要](fuxian-diagram-validation.md)。

核查日期：2026-09-15。对象：当前工作区 `skills/fuxian-diagram`，包括主文件、四类引擎索引和相关细分指南。

结论：选型与按需加载结构可以保留。后续优先修复图文语义不一致、把原则补成可执行的失败处理，再增加少量针对性参考内容。文件数量不作为质量指标。

本报告是官网与本地实现的事实核查，不是 Darwin 基线评分。核查后的基线阶段包含 6 次独立生成、20 条渲染记录，综合粗排分数 86.1 / 100；该分数仅代表当时基线，不是发布版本的质量评分。原始评分、输出和截图保存在仓库外开发归档中。

## 版本依据

| 引擎             | 当前本地依据                        | 核查注意点                                                          |
| ---------------- | ----------------------------------- | ------------------------------------------------------------------- |
| PlantUML         | 配置的服务，未固定服务版本          | 主题、字体、include 和新样式须按实际服务确认                        |
| Mermaid          | 安装版本 11.17.2；依赖声明 ^11.17.2 | 官网当前显示 12.0.0，不能直接套用最新默认值                         |
| Vega-Lite / Vega | 6.4.3 / 6.4.0                       | 使用本地编译器和数据流验证官方规则                                  |
| AntV Infographic | 0.2.20                              | 对照本地 parser、注册表和 Fuxian 策略；官网示例并不保证所有环境一致 |

依赖见 [desktop/package.json](../../apps/desktop/package.json)，Mermaid 加载和初始化见 [document-render-adapter.ts](../../apps/desktop/src/renderer/src/document-render-adapter.ts)。

## 优先处理

### 1. Mermaid 异步示例的图文含义不一致

位置：[mermaid/sequence.md](../../skills/fuxian-diagram/references/mermaid/sequence.md)，示例与其后说明。

示例先画 Worker 生成文件并向 API 记录成功/失败，再画用户查询结果；正文却说该图“不暗示任务总在第一次查询前完成”。时序图本身表达消息的先后，该说明无法消除图中的排列关系。[官方时序说明](https://mermaid.js.org/syntax/sequenceDiagram.html)

修复方案：最小改动是明确写成“示例仅展示任务已结束后的一次查询”。如果目标是解释处理期间的查询，则按真实需求增加处理与查询的并发片段，以及进行中/已结束的结果分支；不能凭空添加业务轮询策略。

验收：图和正文对查询发生时机的描述一致；需要并发时实际检查消息与分支，再渲染窄栏版面。

### 2. Vega-Lite 缺测规则缺少执行细节

位置：[vega-lite/trends.md](../../skills/fuxian-diagram/references/vega-lite/trends.md) 的“误读防护与排版”。现有“不将缺测当零、避免连线掩盖缺口”方向正确，但没有区分“整行不存在”“值为 null”“过滤掉 null”。

官网规定 `mark.invalid: "filter"` 会让路径连接剩余有效点，断线模式则在无效值处打断路径。[Invalid Data](https://vega.github.io/vega-lite/docs/invalid-data.html)

本地 Vega-Lite 6.4.3 / Vega 6.4.0 实际编译并生成 SVG 的结果：

| 数据与配置                                          | SVG 路径结果             |
| --------------------------------------------------- | ------------------------ |
| x=1 和 x=3 有值，x=2 整行缺失                       | 两个有效点被直接连接     |
| 显式保留 x=2、y=null，使用 break-paths-show-domains | 两段分离，没有跨缺测连接 |
| 同样的 null 行，改成 invalid=filter                 | 又连接两个有效点         |

修复方案：当业务明确按固定周期采集且中间缺测时，保留完整周期与 null，使用目标版本支持的断线模式，必要时显示 point 与“未采集”注释。只有来源明确表示零时填零。对于事件发生时间本来就不规则的数据，不能擅自补出固定采集周期。补齐缺失键可依据 [Impute](https://vega.github.io/vega-lite/docs/impute.html)，但不默认用均值插补。

验收：加入含缺测的针对性示例，核对数据、连线和缺测标签；孤立点必须可见。当前核查只验证了数据流与 SVG 路径，没有做该新示例的 Fuxian 视觉验收。

### 3. Infographic 关系图需要显式检查 ID 唯一性

位置：[infographic/hierarchy-relations.md](../../skills/fuxian-diagram/references/infographic/hierarchy-relations.md)。已要求 ID 与标签分开、关系引用已定义 ID，但没有明确 ID 唯一约束。

官网说明节点没有 ID 时使用 label，重复 ID 按最后一个节点处理。这使同名部门、同名步骤可能混成一个节点。[官方关系数据语法](https://infographic.antv.vision/learn/infographic-syntax)

本地 `parseSyntax` 微型核查：两个节点都写 `id team`、分别标成“研发”和“测试”，并引用未定义的 `delivery`，返回 `errors: []`、`warnings: []`。这证明语法检查不会替代关系完整性检查；本次没有据此声称最终渲染已经丢节点。

修复方案：生成关系图时先检查所有 ID 唯一，再检查边端点；同名标签使用不同稳定 ID。渲染后比较预期节点数量、可见标签与关系，不只检查解析器状态。

验收：用同名但不同角色的节点验证不会合并；本地指南明确该检查不能依赖 parser 自动报错。

## 有价值的补强

### 4. 把版本提示变成具体的官网查阅规则

位置：[capabilities.md](../../skills/fuxian-diagram/references/capabilities.md)、[sources.md](../../skills/fuxian-diagram/references/sources.md)、[mermaid/layout-troubleshooting.md](../../skills/fuxian-diagram/references/mermaid/layout-troubleshooting.md)。

现有文档已说明以目标运行时为准，但缺少一张集中维护的已核查版本表与具体差异例子。Mermaid 官网当前说明 v12 默认内置 ELK，而本地是 11.17.2，应用没有注册额外的布局加载器。不能依据最新官网直接给当前 Fuxian 推荐 v12 的默认布局行为。[官方 Layouts](https://mermaid.js.org/config/layouts.html)

Infographic 官网语法页要求容器尺寸放构造选项；本地 0.2.20 的 `parseSyntax` 实际接受顶层 `width 640` 并返回 `options.width: 640`。这只是解析能力核查，尺寸最终如何呈现仍需目标应用验证。不能照抄官网一句话就删除现有 Fuxian sizing 能力。[官方语法规范](https://infographic.antv.vision/learn/infographic-syntax)

修复方案：在 capabilities 集中记录版本与核查日期；普通作图先读本地指南，遇到指南未覆盖能力再查官网，并检查是否适用本地版本。升级时更新差异与实际渲染证据，避免四处复制版本号。

### 5. 补齐主题与可访问描述的最小操作说明

PlantUML 的 mars 默认设置正确，应保留。在 [plantuml/layout-troubleshooting.md](../../skills/fuxian-diagram/references/plantuml/layout-troubleshooting.md) 补一个 mars 加局部 `<style>` 的完整示例，覆盖长标签和字体；按图类型选择 selector。官方正在逐步淘汰 skinparam，但仍保留兼容支持，不能把既有 skinparam 文档判为全部无效。[Styles](https://plantuml.com/style)、[Skinparam 状态](https://plantuml.com/skinparam)

主题不可用时，官网提供 `help themes` 查询方法；较新服务可用 `%get_all_theme()`。把现有“核实主题支持”补成具体动作，失败后保留用户的明确要求并说明限制。[Themes](https://plantuml.com/theme)

Mermaid 已有局部 frontmatter 示例，但可增加统一配置入口说明：新配置用图内 YAML frontmatter，旧 directives 已被其替代；安全配置由宿主控制。[Configuration](https://mermaid.js.org/config/configuration.html)

可访问性方面，在适用图类型增加 `accTitle` / `accDescr` 示例，并在通用校验中要求正文保留关键结论。官网说明这两个字段生成 SVG 标题、描述和 ARIA 关联；最终是否被 Fuxian 保留仍需检查净化后的 SVG，不能据官方支持就宣称成品无障碍通过。[Accessibility](https://mermaid.js.org/config/accessibility.html)

### 6. 给失败修复增加明确的终止与交付分支

位置：[validation.md](../../skills/fuxian-diagram/references/validation.md) 及四类排错指南。

当前已有错误定位、修复、重渲染，以及无工具时说明未验证的规则。可以进一步改成“触发条件 → 首次修复 → 仍失败如何交付”的三列决策表。建议按以下方式执行：

- 语法/布局问题：先按错误证据修复；同因失败且没有新证据时，停止重复相同尝试，缩成最小复现并保留完整源码。
- 网络/服务不可用：检查既有配置与可用本地路径；不把网络故障当语法错误反复改图。
- 自动选择的模板不显示关键字段：在同一引擎选已核实且能保留全部事实的模板，说明变更；用户明确指定的格式不静默替换。
- 仍无法完成成品验证：交付可编辑源码和确切未验证项；复杂图能拆分且不改变含义时继续完成可独立交付部分。

这是结合 Darwin 失败模式维度提出的工作流改进，不是官网规定。验收重点是失败后能完成合理交付，而非给普通选型添加确认流程。

## 保留的设计与本次边界

- 内容锚定 → 自动选型 → 按需读指南 → 实际渲染与版面检查的主流程符合原始需求。
- 用户指定优先、重叠场景 PlantUML + mars 优先、定量问题用 Vega-Lite、叙事概览用 Infographic 的分工保留。
- 模板字段必须实际显示、源码解析不等于渲染成功、渲染成功不等于版面通过的区分保留。
- 不为迎合 Darwin 分数而给日常作图添加 STOP 或强制让用户选引擎；现有自主选型是用户的明确要求。
- 本次未重新运行之前 49 个示例的整套视觉 QA，也未做新增 PDF 验证。此次微型核查为 Infographic parser 与 Vega-Lite 数据流/SVG 路径检查。
- Darwin runtime 措辞扫描对主 SKILL.md 与仓库 README 未发现其指定模式的命中；不把这次扫描扩展声称为所有运行环境均已验证。

建议先处理第 1–3 项，再补版本依据、样式/描述与失败交付。后续 Darwin 对照测试应使用用户确认的 [test-prompts.json](../../skills/fuxian-diagram/test-prompts.json)，所有评分须附实际输出证据。
