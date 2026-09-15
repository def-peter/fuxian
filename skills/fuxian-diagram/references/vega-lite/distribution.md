# 分布：直方图与箱线图

用于理解样本集中位置、离散程度与异常值。至少确认样本单位、样本量、采样范围；小样本示例只说明语法，不支持统计推断。

## 直方图

`bin` 将连续值分组，y 轴统计每组样本数。它与按类别计数的普通柱形图不同。

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "title": "任务耗时分布（示例）",
  "width": "container",
  "height": 220,
  "data": {
    "values": [
      {
        "seconds": 12
      },
      {
        "seconds": 14
      },
      {
        "seconds": 15
      },
      {
        "seconds": 18
      },
      {
        "seconds": 19
      },
      {
        "seconds": 21
      },
      {
        "seconds": 22
      },
      {
        "seconds": 24
      },
      {
        "seconds": 26
      },
      {
        "seconds": 27
      },
      {
        "seconds": 31
      },
      {
        "seconds": 38
      }
    ]
  },
  "mark": {
    "type": "bar",
    "color": "#426B87"
  },
  "encoding": {
    "x": {
      "field": "seconds",
      "type": "quantitative",
      "bin": {
        "step": 10
      },
      "title": "耗时（秒）"
    },
    "y": {
      "aggregate": "count",
      "type": "quantitative",
      "title": "任务数",
      "axis": {
        "tickMinStep": 1
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

## 箱线图

箱体显示四分位数和中位数，须线规则由 `extent` 控制。这里使用 1.5 倍 IQR，超出者显示为离群观测，不自动等于异常数据。

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "title": "不同队列的耗时（示例）",
  "width": "container",
  "height": 240,
  "data": {
    "values": [
      {
        "queue": "快速队列",
        "seconds": 8
      },
      {
        "queue": "快速队列",
        "seconds": 9
      },
      {
        "queue": "快速队列",
        "seconds": 11
      },
      {
        "queue": "快速队列",
        "seconds": 12
      },
      {
        "queue": "快速队列",
        "seconds": 13
      },
      {
        "queue": "快速队列",
        "seconds": 16
      },
      {
        "queue": "快速队列",
        "seconds": 20
      },
      {
        "queue": "普通队列",
        "seconds": 14
      },
      {
        "queue": "普通队列",
        "seconds": 18
      },
      {
        "queue": "普通队列",
        "seconds": 20
      },
      {
        "queue": "普通队列",
        "seconds": 23
      },
      {
        "queue": "普通队列",
        "seconds": 27
      },
      {
        "queue": "普通队列",
        "seconds": 29
      },
      {
        "queue": "普通队列",
        "seconds": 50
      }
    ]
  },
  "mark": {
    "type": "boxplot",
    "extent": 1.5
  },
  "encoding": {
    "x": {
      "field": "queue",
      "type": "nominal",
      "title": "队列",
      "axis": {
        "labelAngle": 0
      }
    },
    "y": {
      "field": "seconds",
      "type": "quantitative",
      "title": "耗时（秒）",
      "scale": {
        "zero": true
      }
    },
    "color": {
      "field": "queue",
      "type": "nominal",
      "legend": null
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

## 选择与校验

直方图用于看分布形状，箱线图用于比较多组分布摘要。箱线图隐藏了多峰形状，必要时附样本点或直方图。不同组样本量要说明，不能仅凭箱体宽度猜数量。

分箱边界影响视觉结论，业务有固定阈值时优先明确步长；自动分箱适合探索，但交付时记录口径。`aggregate: count` 是行数，数据已聚合时应按频数字段求和。

官方参考：[Bin](https://vega.github.io/vega-lite/docs/bin.html)、[Boxplot](https://vega.github.io/vega-lite/docs/boxplot.html)。
