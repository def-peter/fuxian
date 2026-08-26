# Issue Tracker: GitHub

Issues and specs for this repository live in GitHub Issues. Use the `gh` CLI for all operations and infer the repository from `git remote`.

## Conventions

- Create: `gh issue create --title "..." --body "..."`
- Read: `gh issue view <number> --comments`
- List: `gh issue list --state open --json number,title,body,labels,comments`
- Comment: `gh issue comment <number> --body "..."`
- Label: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`
- Close: `gh issue close <number> --comment "..."`

## Pull Requests as a Triage Surface

**PRs as a request surface: no.**

## Skill Terminology

- "Publish to the issue tracker" means create a GitHub issue.
- "Fetch the relevant ticket" means run `gh issue view <number> --comments`.

## Wayfinding

Use one `wayfinder:map` issue with linked sub-issues. Label children as `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`. Represent blockers with native GitHub issue dependencies. Claim work by assigning it to `@me`; resolve it with a final comment and closure.
