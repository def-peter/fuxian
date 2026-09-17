# Vega-Lite layout and diagnosis

## Default colors

Explicit themes, colors, and existing color mappings take priority. For unspecified new charts, prefer an **Ant Design palette**. Avoid brown and earth tones by default; use them when the subject requires them, such as soil categories, or the user explicitly requests them. Do not color categories merely to decorate a single metric; color should support comparison, grouping, or status.

The following Fuxian defaults are selected from Ant Design's base palette. They are not a built-in Vega scheme named `antd`. Use the hexadecimal values directly; no Ant Design installation or extra theme package is needed.

| Purpose                               | Default colors and usage                                                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Single-series bars, lines, points     | Blue `#1677FF`, explicitly in mark.color; area opacity may be reduced while outlines remain distinguishable                                                  |
| Unordered categories                  | Blue `#1677FF`, cyan `#13C2C2`, purple `#722ED1`, green `#52C41A`, magenta `#EB2F96` as needed; keep domain → range mapping consistent across the document   |
| Continuous magnitude                  | Light-to-dark blue: `#E6F4FF`, `#91CAFF`, `#4096FF`, `#1677FF`, `#0958D9`; retain a continuous legend and add boundaries or values to distinguish pale cells |
| Deviations around a meaningful center | Blue `#1677FF` → neutral gray `#F5F5F5` → purple `#722ED1`; map the established neutral value to the center and explain sign and units                       |
| Explicit status                       | Success green `#52C41A`, failure red `#F5222D`, warning orange `#FA8C16`; also express status through text/symbols; warm colors are not random decoration    |
| Text and grid                         | Text `#262626`, secondary text `#595959`, grid `#F0F0F0`; pale low-contrast colors must not carry primary labels                                             |

Fix category mappings with `encoding.color.scale.domain/range`. If categories exceed distinguishable colors, use semantic facets/groups or additional shapes and line styles. Merge the following configuration fragment at the top level. Existing field scales or mark colors override defaults; inspect them when editing.

```json
{
  "config": {
    "mark": { "color": "#1677FF" },
    "text": { "color": "#262626" },
    "range": {
      "category": ["#1677FF", "#13C2C2", "#722ED1", "#52C41A", "#EB2F96"]
    }
  }
}
```

Put continuous colors in the numeric field's `scale.range`; category settings do not change continuous scales. `interpolate: "rgb"` makes the gradient follow the specified colors directly. For an established deviation range of −10 to 10 centered on zero, a scale fragment is:

```json
{
  "scale": {
    "domain": [-10, 0, 10],
    "range": ["#1677FF", "#F5F5F5", "#722ED1"],
    "interpolate": "rgb"
  }
}
```

This range is illustrative; derive real ranges from data and analytical definitions. For an explicitly requested dark theme, preserve the background and choose compatible scales, text, and grid colors. Application-shell dark mode does not automatically restyle authored charts. Inspect the actual SVG's legends, marks, gradients, and text contrast rather than only checking JSON for the desired colors.

Sources: [Ant Design color system](https://ant.design/docs/spec/colors/), [official base values](https://github.com/ant-design/ant-design-colors/blob/main/generate-presets.ts), [Vega-Lite Scale](https://vega.github.io/vega-lite/docs/scale.html).

## From input to finished output

For new charts or structural changes: JSON parsing → Official schema → Compilation → Dataflow execution → SVG. Inspect the finished Fuxian document when host integration is requested or implicated in the failure. For localized edits, use the [validation scope](../validation.md#choose-validation-by-impact). Fix errors at the failing layer; compilation does not prove fields contain values, labels are readable, or external resources are allowed.

| Symptom                                 | Diagnosis                                                                   | Correction                                                                              |
| --------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Blank chart                             | Field names/case, sample count after filter, numeric types                  | Check actual data and each transform result                                             |
| Invalid ratio                           | Zero denominator, averaged group ratios, percentage multiplied by 100 twice | Define numerator/denominator; aggregate before dividing                                 |
| Incorrect date order                    | Alphabetical string sorting or unparseable dates                            | Use temporal fields or explicit ordinal order                                           |
| One category splits into several points | Aggregation grain or grouping introduced by color/detail/tooltip            | Inspect grouping effects of each encoding                                               |
| Chart too wide or labels clipped        | Long categories, total facet width, legend layout                           | Horizontal bars, facets in rows, legends above/below                                    |
| Layer labels misaligned                 | Inconsistent fields/scales/units across layers                              | Share coordinate semantics or split the chart                                           |
| Responsive sizing has no effect         | Container used in an unsupported nested specification                       | Check official single-view/layer and facet sizing rules                                 |
| Schema error                            | Valid JSON but invalid mark/encoding/transform                              | Use the target version's schema; adding `$schema` does not fix an invalid specification |
| Fuxian rejects resources                | data.url, image marks, or external mark links                               | Inline data and use supported static representations                                    |

If a multi-chart document has correct mark colors but a gradient legend resembling another chart, render the chart alone, then check for duplicate gradient IDs across same-page SVGs. If only the combined page fails, retain a minimal reproduction and report a rendering-layer problem. Do not alter data or color semantics to hide it; separate exported chart files can support immediate delivery.

## Chart semantics

Bars normally start at zero. Log scales cannot include nonpositive values and must be identified. Correlation is not causation; missing is not zero. Preserve units and time windows after aggregation. Use distinguishable categorical colors for categories and sequential colors for continuous values; diverging scales require a meaningful center.

## Layout adjustments

For a title or label wording change, preserve the existing specification and inspect only the affected chart if text length or placement could cause a problem. Diagnose truncation before changing padding: `axis.labelLimit` can shorten axis text, while SVG bounds or host overflow can clip otherwise complete labels. Change the property responsible for the observed defect; do not add padding or rebuild the layout speculatively.

Start with engine-managed bounds and default padding. Explicit padding adds outer space beyond the space already allocated for axes and labels; do not reserve a second full label-width margin. If rendered text still clips, add only the small allowance needed in that rendering environment. If excessive blank space is observed, reduce redundant padding while retaining complete labels. Check both clipping and excessive margins in the same affected-chart preview, with no additional viewport passes or pixel-by-pixel tuning. A working padding value for one chart is not a default to copy into other charts.

Remove unnecessary series or repeated labels first while retaining important dimensions. Legend position, axis-label angle, title, and labelLimit can help, but must not hide text needed to identify entities. Provide a text layer or nearby table for exact values; tooltips are supplementary.

Choose width for the data, marks, and readable labels. Single views/layers can use container width when responsive sizing is appropriate. If a requested size or an observed clipping problem requires resizing, rerender and inspect font sizes, marks at minimum/maximum values, and axis titles.

References: [Size](https://vega.github.io/vega-lite/docs/size.html), [Axis](https://vega.github.io/vega-lite/docs/axis.html), [Legend](https://vega.github.io/vega-lite/docs/legend.html).
