# Preserve official Vega-Lite syntax within the snapshot boundary

The MVP policy in ADR 0006 confused similarly named fields and rejected valid container sizing, mark expressions, inline datasets, parameters, and transforms. The bundled official schema and compiler now own syntax validation. Fuxian budgets source bytes, JSON complexity, inline rows, render dimensions, SVG size, worker concurrency, and execution time; it checks actual compiled data sources and marks for external resources, with a denying loader as the final boundary. Image marks and external mark links remain unsupported by this offline snapshot renderer.

Vega's interpreter evaluates official expressions without dynamic JavaScript evaluation. Parameters and selections contribute their initial state to the snapshot; browser input widgets and live brushing are not part of finished content. Random or time-dependent expressions are evaluated when a chart renders, then frozen in the shared SVG rather than rejected by a function-name blacklist.

The document supplies its measured chart content width and independently sized reading viewport height through Vega's `containerSize` expression API. Only charts declaring responsive dimensions rerender after a debounced container change; fixed and step-based charts retain official sizing. Missing measurements retain Vega-Lite's official fallback. Focused viewing, paper preview, and PDF reuse the resulting SVG without rerunning the dataflow or changing author source.

References: [Vega-Lite sizing](https://vega.github.io/vega-lite/docs/size.html), [expression extensibility](https://vega.github.io/vega/docs/api/extensibility/), [headless View](https://vega.github.io/vega/docs/api/view/).
