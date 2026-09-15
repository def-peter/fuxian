# Fuxian Visual Capabilities

This contract follows the current repository runtime, not every historical Fuxian release. For an older installation, verify its version and supported features before using advanced syntax.

| Engine           | Accepted info string | Execution                                       | Status                                                         |
| ---------------- | -------------------- | ----------------------------------------------- | -------------------------------------------------------------- |
| Mermaid          | `mermaid`            | Local application runtime                       | Supported                                                      |
| PlantUML         | `plantuml`, `puml`   | Configured PlantUML server                      | Supported                                                      |
| Vega-Lite        | `vega-lite`          | Local isolated worker                           | Supported                                                      |
| AntV Infographic | `infographic`        | Local isolated worker with controlled resources | Supported                                                      |
| Vega             | none                 | -                                               | Unsupported as a document fence; author Vega-Lite instead      |
| D2               | none                 | -                                               | Unsupported; do not emit a `d2` block                          |
| Markmap          | none                 | -                                               | Unsupported as document content; do not emit a `markmap` block |

Prefer canonical `plantuml` in new content. No aliases are accepted for `vega-lite` or `infographic`. Fuxian's article structure map is generated from Markdown headings; it does not recognize a `markmap` fence.

## Rendering boundaries

- Mermaid runs locally with strict security. Author colors and layout are preserved.
- PlantUML source is sent unchanged to the configured service, which defaults to the public PlantUML server. A local/private service is needed when content must stay local/private. Use source-level themes; application appearance does not restyle diagrams.
- Vega-Lite follows the bundled official schema/compiler. Inline `data.values`, inline named `datasets`, transforms, expressions, parameters and responsive container sizing are supported. Actual external data loading, image marks and mark hyperlinks are unsupported. Parameters and selections render their initial state, not a live dashboard. Time/random expressions are evaluated into the snapshot; prefer fixed data for reproducible reporting.
- Infographic follows the pinned official runtime: exact built-in templates, custom `design`, full themes, sizing, resource objects and animated templates are supported within bounded execution and sanitization. Resource fetching is controlled; available local `lucide/...` or `mdi/...` icons are useful for portable output. Optional unavailable resources may degrade without failing the whole visual.
- Finished content, focused viewing, copying and PDF reuse sanitized SVG snapshots. Animation can remain live on screen; PDF captures a static frame. Make the main meaning visible without animation or interaction.

## Maintenance evidence

When working in the Fuxian repository, check the parser in `packages/markdown-renderer/src/index.ts`, dependency versions in `apps/desktop/package.json`, and the `vega-lite-policy.ts`, `vega-lite-runtime.ts`, `infographic-policy.ts`, `infographic-renderer.worker.ts` and resource policy files under `apps/desktop/src/renderer/src/`.

ADRs 0001, 0009, 0024 and 0027 in `docs/adr/` explain service transport, author styling and official syntax support. Renderer limits and tests take precedence over copied upstream examples. Do not infer support from a dependency alone: Vega is an internal runtime, not an accepted source fence.
