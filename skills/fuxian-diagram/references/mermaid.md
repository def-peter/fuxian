# Mermaid

用户指定 Mermaid、维护已有 Mermaid，或目标环境要求它时使用。下面按实际图类型加载；不要把一种声明的语法套到另一种图中。

## 按需读取

选定图类型后，读取对应指南并据其完整示例改写；遇到渲染或版面问题再读排错指南。无需一次加载全部分支。

| 当前任务                               | 指南                                                             | 内容                                |
| -------------------------------------- | ---------------------------------------------------------------- | ----------------------------------- |
| 流程、判断、回退、轻量分组             | [flowchart.md](mermaid/flowchart.md)                             | 流程图；条件回路与分组示例          |
| 消息先后、请求返回、异步和并发         | [sequence.md](mermaid/sequence.md)                               | 时序图；消息类型与片段语法          |
| 生命周期、类关系、数据库实体           | [state-class-er.md](mermaid/state-class-er.md)                   | 状态、类与 ER；三个完整示例         |
| 架构总览、服务依赖、代码或部署配置转图 | [architecture-deployment.md](mermaid/architecture-deployment.md) | 分层与代码取证；常规 flowchart 表达 |
| 概念树、任务日期、里程碑               | [mindmap-gantt.md](mermaid/mindmap-gantt.md)                     | 思维导图与 Gantt；层级与依赖的区别  |
| 声明报错、标签异常、分组方向、样式失效 | [layout-troubleshooting.md](mermaid/layout-troubleshooting.md)   | 常见语法问题与成品布局检查          |

## 共通约束

- ID 与标签分开，含特殊字符的流程图标签用双引号，如 `node["支付服务（含重试）"]`。
- 声明、箭头、分组和配色语法按图类型与目标版本核实；不把 flowchart 的样式视为所有图的通用 API。
- Fuxian 采用 strict 安全模式，成品的核心含义不能依赖回调或任意 HTML。
- 原始源码可解析和最终版面可读要分别验证。
