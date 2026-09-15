# 主题、自定义设计与布局故障

官方模板由 structure、item、title 等设计元素组合。普通任务优先适合信息结构的模板；只有确有布局需要时再使用 `design`，并核对当前运行时注册的元素名。

## 自定义设计与局部主题（示例）

```infographic
infographic
design
  structure
    type list-row
    gap 24
  item
    type compact-card
  title
    type default
data
  title 验证关注点
  lists
    - label 内容
      desc 核对事实
    - label 版面
      desc 检查可读性
theme light
  colorPrimary #426B87
  title
    fill #29485D
  item
    label
      font-weight 700
```

标题字号改变后要检查实际行高与占位，不能只确认配置通过解析。这里没有模板名，因为完整 design 提供了结构与条目。它并非“不完整的模板声明”；Fuxian 当前支持该官方用法。

## 样式选择

palette 区分并列项目，主题的 title/item 控制文字层级；需要 pattern、rough 或渐变时查当前版本 stylize 结构。只设置有阅读目的的字段，不复制大段默认配置。

图标优先可用的本地 Lucide/MDI。`illus`、资源对象和可信在线资源可用，但需遵循 Fuxian 资源边界。中文字体按实际环境验证，不假定任意指定字体存在。

配置 design 的 structure/item/items 时提供明确 type；不要假定省略 type 的片段一定能继承模板元件。

## 常见问题

| 现象                           | 检查                                  | 修正                                                      |
| ------------------------------ | ------------------------------------- | --------------------------------------------------------- |
| 有标题但条目为空               | 模板所需字段、根节点结构              | 按模板定义使用 lists/sequences/compares/root/nodes 等字段 |
| Type is required               | 自定义元件缺少 type                   | 补齐 structure/item/items 的类型，按完整示例重渲染        |
| 模板不存在                     | 名称拼写、目标依赖版本                | 查 getTemplates 的精确名称，不拼造变体                    |
| 子项没显示                     | 缩进、children 层次、模板是否显示描述 | 用支持层级的模板，核对父项和子项归属                      |
| 中文单字掉到下一行             | 卡片宽度或描述过长                    | 缩短文案、换纵向/网格模板；不要只减小字号                 |
| 图标为空但文字正常             | 资源名称或访问不可用                  | 使用已知本地图标，保留完整文本语义                        |
| 原始 SVG 正常，Fuxian 显示异常 | 净化后的样式/资源与运行时边界         | 在目标应用检查，避免不受支持的资源引用                    |
| 屏幕正常而 PDF 丢失重点        | 重点依赖动画时序                      | 主信息静态可读，核对导出的实际帧                          |

## 动画与输出

带 animated 的模板不是一概不支持。用户需要时选择真实注册模板，检查动画静态帧是否仍含节点、关系与标签。交付 PDF 时不把运动方向作为唯一关系说明。

默认交付 `infographic` 围栏；Fuxian 负责渲染，无需创建 CDN HTML。通用校验见 [validation.md](../validation.md)。
