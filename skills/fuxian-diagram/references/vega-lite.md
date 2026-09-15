# Vega-Lite

For statistical charts, establish the observation unit, metrics, and measurement definitions before selecting marks, encodings, and transforms. All example data is illustrative.

## Diagram types with local guides

Before authoring any Vega-Lite chart, read the [color rules](vega-lite/layout-troubleshooting.md#default-colors). Use the table to identify a suitable diagram type, then read its guide and adapt a complete example. Read troubleshooting guidance when rendering or layout problems arise. Load only the relevant branches.

| Diagram type or task                                                  | Guide                                                            | Coverage                                                    |
| --------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------- |
| Bar/column; grouped bar                                               | [comparison.md](vega-lite/comparison.md)                         | Bars, grouped bars, sorting, and zero baselines             |
| Line; area; cumulative trend                                          | [trends.md](vega-lite/trends.md)                                 | Lines, areas, dates, and cumulative transforms              |
| Histogram; box plot                                                   | [distribution.md](vega-lite/distribution.md)                     | Histograms, box plots, samples, and statistical definitions |
| Scatterplot; heatmap                                                  | [correlation-heatmap.md](vega-lite/correlation-heatmap.md)       | Scatterplots, heatmaps, sequential and diverging colors     |
| Normalized stacked bar; donut                                         | [composition.md](vega-lite/composition.md)                       | Normalized stacks and donut charts                          |
| Layered charts; facets / small multiples                              | [transforms-facets.md](vega-lite/transforms-facets.md)           | aggregate/calculate/fold, layer, and facet                  |
| Blank charts, invalid ratios, misalignment, sizing or resource errors | [layout-troubleshooting.md](vega-lite/layout-troubleshooting.md) | Layered diagnosis and layout correction                     |

Coverage terms follow the [selection inventory](selection-guide.md#diagram-type-inventory).

## Further chart families and compositions

Vega-Lite composes charts from marks, encodings, transforms, and views; a chart name is not necessarily a dedicated `mark` value. These [official gallery](https://vega.github.io/vega-lite/examples/) candidates have no complete local example here. Check their specification and the target compiler, then apply Fuxian's inline-data and snapshot constraints.

| Type                       | Use and construction                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Density; dot/strip plot    | Distribution shape using density transforms or positioned point/tick marks                                  |
| Error bars; error bands    | Uncertainty intervals with defined statistical meaning, using composite marks or layers                     |
| Ranged bars / Gantt        | Start/end intervals using paired position channels; task dependency routing needs separate modeling         |
| Waterfall                  | Contributions to a running total using calculations, window transforms, and ranged bars                     |
| Streamgraph; stacked area  | Composition over time; choose the baseline to match the question                                            |
| Pie; radial plot           | Angular/radial encodings using arc or polar-positioned marks; prefer bars for precise comparison            |
| Geographic maps            | Inline geographic features/coordinates and projections; adapt gallery examples that fetch external datasets |
| Text table; colored matrix | Exact lookup with text marks, optionally layered on rectangles                                              |
| Repeat; concatenated views | Repeated metrics or coordinated panels; ensure important information is visible in the initial snapshot     |

Sankey, general network layouts, treemaps, and word clouds are not built-in Vega-Lite chart constructors. Full Vega examples requiring layout transforms are not directly portable. Prefer another suitable engine, or explicitly derive coordinates before authoring a custom Vega-Lite view and verify that it preserves the requested semantics.

## Shared constraints

- Emit valid JSON in a `vega-lite` fence. Fuxian does not accept full Vega fences; renaming a fence does not convert a Vega specification.
- Keep field case, types, units, and date conventions consistent. Do not treat missing values as zero automatically; make aggregation traceable.
- Inline data, optionally through named datasets. See [capabilities.md](capabilities.md) for Fuxian's schema/compiler and static-snapshot boundaries.
- Key report values must be readable in the initial snapshot; hover and interaction are supplementary.
- Examples use the current Vega-Lite v6 schema. Check capabilities first for older target versions.
