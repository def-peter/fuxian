# 层级树与关系网络

层级树是一棵有根树，关系图可以有跨层连接、多个父节点和环。存在多重归属时不要强行把关系塞进单根层级。

## 单根层级（示例）

```infographic
infographic hierarchy-tree-lr-curved-line-rounded-rect-node
design
  structure
    type hierarchy-tree
    orientation left-right
    edgeType curved
    edgeColorMode gradient
    edgeMarker none
  title
    type default
  item
    type rounded-rect-node
    width 160
data
  title 报告内容结构
  root
    label 报告
    children
      - label 结论
        children
          - label 主要发现
          - label 建议行动
      - label 依据
        children
          - label 数据
          - label 方法
```

示例显式补上 title 设计，并设置较窄节点与向右展开的方向，避免默认宽节点将字体整体缩小。只有一个 `root`，下级通过 `children` 递归。层级跳跃或同级混用分类轴时先调整内容。`hierarchy-structure` 等特殊结构不套用通用 root 规则，查对应模板定义。

## 带边标签的关系（示例）

```infographic
infographic relation-dagre-flow-tb-badge-card
data
  title 文档信息流
  nodes
    - id source
      label 源文档
    - id render
      label 渲染
    - id delivery
      label 成品
  relations
    source -->|输入| render
    render -->|输出| delivery
```

使用 badge-card 让节点名称清晰可读；simple-circle-node 等小节点模板需要特别检查标签是否落在可见范围内。节点 ID 与显示文本分开，关系引用已定义 ID。边标签描述作用；仅仅相邻或箭头相连，不能自动说明包含、依赖或先后。

## 复杂情况

树太宽时选择已验证的左右方向模板或分开重点分支；每次变体名称都要核对真实注册名。关系图跨边过多时先明确主关系，再把次要关系放入局部图。

需要严格 UML 的时序、基数、状态语义时优先 PlantUML；用户明确要信息图时，保留其选择并说明采用的简化表达。动态边可用于屏幕演示，静态图仍应能够读懂，见 [theme-layout.md](theme-layout.md)。
