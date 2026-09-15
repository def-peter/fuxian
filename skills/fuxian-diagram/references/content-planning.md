# From vague requests to content anchors

Users asking to “add some diagrams to this report” need not know diagram types. Understand the audience, central questions, and evidence first, then choose content whose visualization substantially reduces the effort of understanding it.

## Candidate content

| Content pattern                                       | Question to explain                                     | Possible representation                   |
| ----------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------- |
| Handoffs across roles, ordering, and exceptions       | Who owns each step, and what happens on failure?        | Activity/swimlane or sequence             |
| Layered components and dependencies across boundaries | What are the parts, and how do they collaborate?        | Component/deployment or hierarchy         |
| Several states of one object                          | When does it enter or leave a state?                    | State diagram                             |
| Many comparable values                                | What is the largest difference, trend, or distribution? | Appropriate Vega-Lite statistical chart   |
| Several viewpoints, stages, or tradeoffs              | Which points should readers remember?                   | Infographic list, timeline, or comparison |
| A simple single-sentence fact                         | Would a diagram really be clearer?                      | Usually keep prose                        |

## Example: illustrating a launch guide

Suppose the material already includes launch goals, manual approval and rollback rules, stage durations, and a deliverables checklist.

Possible anchors:

1. Approval passage → “Which step receives a rejected request?” → Approvers, conditions, rollback, and termination → After the launch steps → PlantUML swimlanes.
2. Duration table → “Which stage takes longest?” → Stage durations in the same units and measurement window → Beside the performance conclusion → Vega-Lite bars.
3. Deliverables checklist → “Which outputs must be prepared?” → Parallel deliverables → Retain the list if it is already short and clear.

Let content determine the number and combination of diagrams. A document need not use all four engines or have a diagram in every section.

## Missing information

Read existing material before asking which part to illustrate. Ask for the topic or source when both are absent. If only a data field is missing, continue independently useful relationship diagrams and identify what the statistical chart still needs.

Mark relationships as unconfirmed when evidence is insufficient. Do not invent queues, caches, retries, or approval steps from common architectures. For a purely illustrative request, state the illustrative assumptions.

## Document integration

Use a caption that states the diagram's purpose and place the diagram where the reader first encounters the difficulty. Explain definitions, limits, and exceptions in nearby prose; keep labels concise. Overview and detail views share terminology rather than renaming the same entity.

Check whether the caption, diagram, and adjacent explanation answer the original question, then follow [validation.md](validation.md) for rendering and layout verification.
