# Fuxian Diagram

English · [简体中文](README.zh-CN.md)

Turn complex content into readable diagrams without having to choose a diagram engine yourself. This companion skill for [Fuxian](https://github.com/def-peter/fuxian) identifies what needs explaining, chooses an appropriate visual, and produces Markdown diagram source with layout checks.

**[Explore Fuxian](https://github.com/def-peter/fuxian) · [Download the reader](https://github.com/def-peter/fuxian/releases/latest) · [Report an issue](https://github.com/def-peter/fuxian/issues)**

## Install

With Node.js and npm available, run:

```bash
npx skills add def-peter/fuxian --skill fuxian-diagram
```

Choose your agent and installation scope when prompted. The [skills CLI](https://github.com/vercel-labs/skills) supports agents including Claude Code, Codex, and Cursor; rendering capabilities depend on the environment you use.

List available skills before installing:

```bash
npx skills add def-peter/fuxian --list
```

Update installed skills:

```bash
npx skills update
```

The skill supplies instructions and references. Install Fuxian separately to read the generated Markdown and export it as PDF. Other readers may support only some of the four diagram formats.

## What it does

| Your content                                                | Typical choice                                   |
| ----------------------------------------------------------- | ------------------------------------------------ |
| Processes, interactions, state changes, architecture        | PlantUML, with the `mars` theme by default       |
| A Mermaid request or a target environment requiring Mermaid | Mermaid                                          |
| Comparisons, trends, distributions, correlations            | Vega-Lite, with an Ant Design palette by default |
| Key points, stages, milestones, visual summaries            | AntV Infographic                                 |

Your explicit diagram type, engine, theme, or colors take priority. PlantUML is preferred where it overlaps with Mermaid. Default Vega-Lite colors favor blue, cyan, purple, green, and magenta; brown tones are reserved for a meaningful use or an explicit request.

For a whole document, the skill selects the important or difficult passages first. It preserves source facts, supplies editable diagram source, and checks syntax and layout when rendering tools are available. If rendering cannot be verified, it reports that limit.

## Languages

Use the skill with Chinese or English requests. Explicit output-language instructions take priority; document edits follow the target document's language, and other tasks follow your request's language. Diagram titles, labels, legends, and explanations follow that choice. Syntax keywords, identifiers, and data fields keep their original spelling.

The agent instructions, detailed references, and example copy are written in English; generated output follows the requested language. Ask explicitly for bilingual labels or separate language versions when needed.

## Try it

- “Add diagrams to this design document. Choose the parts that are hardest to understand and place the diagrams beside the relevant text.”
- “Explain this approval process, including rejection and resubmission paths. Choose a suitable diagram.”
- “Use this monthly revenue CSV to show the trend and compare regions, using Ant Design colors.”

You can also explicitly ask your agent to use `fuxian-diagram`.

## Read the result in Fuxian

Fuxian is a Markdown desktop reader for Windows and macOS. It renders all four diagram formats within the document and supports PDF export. These screenshots show examples of the reader's rendering capabilities; they are not a guarantee of identical skill output.

![PlantUML source and rendered diagram in Fuxian](https://raw.githubusercontent.com/def-peter/fuxian/main/docs/assets/readme/en/05-plantuml.png)

![Vega-Lite dashboard in Fuxian](https://raw.githubusercontent.com/def-peter/fuxian/main/docs/assets/readme/en/06-vega-lite.png)

## Documentation

- [Skill instructions](SKILL.md)
- [Diagram selection guide](references/selection-guide.md)
- [Fuxian capabilities and rendering limits](references/capabilities.md)
- Engine references: [PlantUML](references/plantuml.md), [Mermaid](references/mermaid.md), [Vega-Lite](references/vega-lite.md), [Infographic](references/infographic.md)
- [Official sources and maintenance](references/sources.md)

Project links provide attribution and a reader download path. The skill does not ask agents to insert promotional links into generated diagrams or answers.

## License

Created by Peter Li. Released under the [MIT License](LICENSE).
