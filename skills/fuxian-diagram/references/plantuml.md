# PlantUML

流程、结构与交互建模默认优先使用 PlantUML；新图默认 `!theme mars`，用户指定样式或已有源码风格优先。

## 按需读取

选定图类型后，读取对应指南并据其完整示例改写；遇到渲染或版面问题再读排错指南。无需一次加载全部分支。

| 当前任务                               | 指南                                                              | 内容                               |
| -------------------------------------- | ----------------------------------------------------------------- | ---------------------------------- |
| 条件流程、循环、并行、跨角色责任交接   | [activity-swimlanes.md](plantuml/activity-swimlanes.md)           | 活动图与泳道；两个完整流程示例     |
| 调用返回、异步消息、超时、重试或补偿   | [sequence.md](plantuml/sequence.md)                               | 时序图；同步分支与幂等消费示例     |
| 对象生命周期、复合状态                 | [state.md](plantuml/state.md)                                     | 状态图；嵌套状态与事件条件         |
| 类职责、接口关系、数据库实体和基数     | [class-er.md](plantuml/class-er.md)                               | 类图与 ER；继承、组合、主外键      |
| 系统组件、接口依赖、运行环境与网络边界 | [architecture-deployment.md](plantuml/architecture-deployment.md) | 组件与部署；区分逻辑视图和物理视图 |
| 角色目标、运行时实例快照、模块分层     | [use-case-object-package.md](plantuml/use-case-object-package.md) | 用例、对象、包图；三种独立示例     |
| 概念层级、交付成果分解                 | [mindmap-wbs.md](plantuml/mindmap-wbs.md)                         | 思维导图与 WBS；专用起止语法       |
| 渲染报错、宽高失衡、字体与主题问题     | [layout-troubleshooting.md](plantuml/layout-troubleshooting.md)   | 布局参数、常见失败和修复顺序       |

## 共通约束

- 普通 UML 使用成对 `@startuml` / `@enduml`；思维导图等专用类型保持其专用标记，围栏仍用 `plantuml`。
- 使用标准 PlantUML 语法和稳定别名；`mxgraph.*` 是上游特定产品的扩展，不作为 Fuxian 标准语法。
- 源码会送往配置的服务；字体与 include 库需在服务端可用，不能用本机环境推断。
- 先选择正确关系语义和抽象层次，再调整 mars 基础上的局部样式。
