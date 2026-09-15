# 散点与热力图

散点解释两个变量的共同变化，热力图解释二维分类中的强度分布。以下样本仅演示结构，不能据此断言因果。

## 散点

每个点应是同一种观测单位，x/y 字段来自同一条记录；不要误把分别汇总的数据按行拼接。

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "title": "文档长度与处理耗时（示例）",
  "width": "container",
  "height": 240,
  "data": {
    "values": [
      {
        "pages": 3,
        "seconds": 2,
        "kind": "纯文本"
      },
      {
        "pages": 8,
        "seconds": 4,
        "kind": "纯文本"
      },
      {
        "pages": 12,
        "seconds": 6,
        "kind": "纯文本"
      },
      {
        "pages": 5,
        "seconds": 7,
        "kind": "含图表"
      },
      {
        "pages": 9,
        "seconds": 11,
        "kind": "含图表"
      },
      {
        "pages": 14,
        "seconds": 15,
        "kind": "含图表"
      }
    ]
  },
  "mark": {
    "type": "point",
    "filled": true,
    "size": 100,
    "opacity": 0.8
  },
  "encoding": {
    "x": {
      "field": "pages",
      "type": "quantitative",
      "title": "页数"
    },
    "y": {
      "field": "seconds",
      "type": "quantitative",
      "title": "处理耗时（秒）"
    },
    "color": {
      "field": "kind",
      "type": "nominal",
      "title": "文档类型",
      "legend": {
        "orient": "top"
      }
    }
  },
  "config": {
    "axis": {
      "labelFontSize": 12,
      "titleFontSize": 13,
      "tickCount": 6
    },
    "legend": {
      "labelFontSize": 12,
      "titleFontSize": 13
    },
    "title": {
      "fontSize": 16
    },
    "header": {
      "labelFontSize": 12,
      "titleFontSize": 13
    }
  }
}
```

## 二维热力图

颜色编码数值，提供清晰色标；有序类别给出显式顺序。

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "title": "时段任务量（示例）",
  "width": "container",
  "height": 180,
  "data": {
    "values": [
      {
        "day": "周一",
        "period": "上午",
        "tasks": 12
      },
      {
        "day": "周一",
        "period": "下午",
        "tasks": 20
      },
      {
        "day": "周二",
        "period": "上午",
        "tasks": 18
      },
      {
        "day": "周二",
        "period": "下午",
        "tasks": 9
      },
      {
        "day": "周三",
        "period": "上午",
        "tasks": 7
      },
      {
        "day": "周三",
        "period": "下午",
        "tasks": 15
      }
    ]
  },
  "mark": "rect",
  "encoding": {
    "x": {
      "field": "day",
      "type": "ordinal",
      "sort": [
        "周一",
        "周二",
        "周三"
      ],
      "title": null,
      "axis": {
        "labelAngle": 0
      }
    },
    "y": {
      "field": "period",
      "type": "ordinal",
      "sort": [
        "上午",
        "下午"
      ],
      "title": null
    },
    "color": {
      "field": "tasks",
      "type": "quantitative",
      "title": "任务数",
      "scale": {
        "scheme": "blues",
        "zero": true
      }
    }
  },
  "config": {
    "axis": {
      "labelFontSize": 12,
      "titleFontSize": 13,
      "tickCount": 6
    },
    "legend": {
      "labelFontSize": 12,
      "titleFontSize": 13
    },
    "title": {
      "fontSize": 16
    },
    "header": {
      "labelFontSize": 12,
      "titleFontSize": 13
    }
  }
}
```

## 细化与校验

点重叠先调整透明度或改分箱汇总；未经说明不添加随机抖动。离群点核对数据来源，不因影响美观删除。添加回归线时注明模型与样本范围，它不会证明因果。

热力图正负偏差使用以有意义中心值（通常零）为中心的发散色；绝对量用连续色。缺失单元格不应显示为已知零值。同一图中不要把多个单位映射到同一色标。

官方参考：[Point](https://vega.github.io/vega-lite/docs/point.html)、[Rect](https://vega.github.io/vega-lite/docs/rect.html)、[Scale](https://vega.github.io/vega-lite/docs/scale.html)。
