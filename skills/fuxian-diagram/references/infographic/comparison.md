# 二元比较、SWOT 与象限

用于方案优劣、观点分类和决策概览。先定义一致的比较维度；已有定量指标需要精确比较时优先 Vega-Lite 或附近表格。

## 二元对比（示例）

```infographic
infographic compare-hierarchy-left-right-circle-node-plain-text
data
  title 两种交付方式
  compares
    - label 在线文档
      children
        - label 更新及时
        - label 依赖访问环境
    - label PDF 文件
      children
        - label 更新需重发
        - label 可离线阅读
```

此模板展示两个根项的方案名称。某些 `compare-binary-*` 模板只画子项，并使用固定 PROS/CONS 或 VS 装饰；不能假定根项名称会显示。两个根项对应两个方案，子项分别表达相同维度：本例先比较更新，再比较访问/分发限制。不要一边列优点、一边列无关描述造成倾向性比较。

## SWOT（示例）

```infographic
infographic compare-quadrant-quarter-simple-card
data
  title 新服务 SWOT（示例）
  compares
    - label 优势
      desc 响应迅速
    - label 劣势
      desc 团队较小
    - label 机会
      desc 新增需求
    - label 威胁
      desc 竞争加剧
```

示例选择四格版面，直接显示 SWOT 四个维度与要点。`compare-swot` 的默认四列较宽，窄文档中可能将子项缩得过小；按目标版面选择，而非仅根据模板名字。优势/劣势属于内部，机会/威胁属于外部。分类依据来自用户材料，不能为凑齐四格虚构市场事实。

## 四象限（示例）

```infographic
infographic compare-quadrant-quarter-simple-card
data
  title 按收益与投入分类（示例）
  compares
    - label 高收益 低投入
      desc 优先执行
    - label 高收益 高投入
      desc 安排专项
    - label 低收益 低投入
      desc 顺手处理
    - label 低收益 高投入
      desc 谨慎投入
```

这里是四类概览，不是带真实坐标的数据散点。用户需要给任务打分定位时，先确认评分数据与坐标语义，再用适合准确坐标的图形。

## 排版与校验

二元模板必须有两个根项；多方案改适合多列的模板或拆图。SWOT 与四象限核对四个维度是否完整，实际布局位置是否与标签一致。描述不应挤满卡片；正文承接证据、例外和判断依据。
