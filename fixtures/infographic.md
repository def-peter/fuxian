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
