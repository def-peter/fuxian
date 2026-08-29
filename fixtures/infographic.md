# Infographic 渲染验证

正文应当立即可读，信息图在后台完成渲染。

```infographic
infographic list-row-horizontal-icon-arrow
data
  title 浮现发布流程
  desc 从需求确认到稳定交付
  lists
    - label 需求确认
      desc 明确范围与阅读目标
      icon lucide/clipboard-check
    - label 安全渲染
      desc 保留官方排版与中文换行
      icon lucide/shield-check
    - label 稳定导出
      desc 预览与 PDF 使用相同快照
      icon mdi/file-check-outline
```

```infographic
infographic list-row-simple-horizontal-arrow
theme dark
  colorPrimary #61DDAA
  colorBg #1F1F1F
data
  title 深色主题
  desc 官方内置主题与作者颜色保持不变
  lists
    - label 本地渲染
      desc 不依赖远程渲染服务
    - label 可选择文字
      desc 保留 foreignObject 文本结构
```

```infographic
infographic compare-quadrant-quarter-simple-card
data
  compares
    - label 未授权图标
      icon ref:remote:https://example.test/icon.svg
```

## 官方扩展模板

```infographic
infographic chart-wordcloud
data
  items
    - label 完整保留官方词云布局
      value 100
    - label 中文排版
      value 72
    - label 可复制文字
      value 58
    - label 同一份 SVG
      value 44
    - label 屏幕 全屏 复制 PDF
      value 30
```

```infographic
infographic sequence-interaction-default-badge-card
data
  title 发布时序
  relations
    author[文档作者] -->|写入一段需要验证自动换行与宽度计算的较长中文内容| fuxian[浮现]
    fuxian -->|呈现经过安全清理且仍可选择的官方信息图| reader[阅读者]
```

```infographic
infographic list-row-simple-illus
data
  title 可信插图资源
  desc 插图在进入文档前完成净化并嵌入 SVG
  lists
    - label 本地插图
      desc 明确指定 Lucide 资源时不访问网络
      illus lucide/coffee
    - label 同源输出
      desc 正文 全屏 复制与 PDF 使用同一快照
      illus mdi/shield-check
```

```infographic
infographic relation-dagre-flow-tb-animated-badge-card
data
  relations
    source[Markdown 源文档] -> snapshot[安全 SVG 快照] -> output[屏幕与 PDF]
```
