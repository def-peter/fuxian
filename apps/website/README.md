# Fuxian website

The official website lives in the same repository as the desktop app, with independent Vite development and static output.

```sh
corepack pnpm --filter @fuxian/website dev
corepack pnpm --filter @fuxian/website build
corepack pnpm --filter @fuxian/website preview
```

## Pages and language

- `/zh/` and `/en/`: homepage, feature demonstrations, FAQ, download.
- `/zh/features/` and `/en/features/`: capabilities, screenshots, diagram example, and usage limitations.
- `/`: readable Chinese fallback HTML. In a JavaScript-enabled browser, the entry point redirects to Chinese for a Chinese browser language and English otherwise. Explicit locale URLs always keep their language; language links retain the current page type.

The build script renders all five pages into HTML, including FAQ answers and feature content. React hydrates the localized pages to enable menus and carousels. Ordinary links connect the pages; a server-side router or SPA fallback is unnecessary.

## Content and metadata

- `src/App.tsx`: homepage and shared header, download, footer.
- `src/Features.tsx`: bilingual feature guide. Keep claims consistent with current application behavior.
- `src/site.ts`: routes, FAQ, introduction, titles, descriptions.
- `src/entry-server.tsx`: prerendering, canonical URLs, language alternates, social metadata, SoftwareApplication JSON-LD, sitemap.
- `public/examples/`: downloadable Markdown examples.

Canonical URLs use `https://def-peter.github.io/fuxian/`. Update this origin and production base together when moving to a custom domain. No ratings or unverified performance claims are included in structured data. The site does not depend on FAQ rich results.

## GitHub Pages

Website publication is manual and independent of desktop releases. Pushing code, including website changes, does not deploy the site. When ready to publish:

1. Push the website changes to `main`.
2. Open **Actions → Deploy website → Run workflow**, select `main`, and run it.
3. Wait for both `build` and `deploy` to succeed, then check the live site.

The equivalent CLI command is `gh workflow run deploy-website.yml --ref main`.

The workflow builds and uploads `dist`. In GitHub Actions, Vite uses `/fuxian/` for all internal routes and assets. To verify that path locally:

```sh
WEBSITE_BASE=/fuxian/ corepack pnpm --filter @fuxian/website build
WEBSITE_BASE=/fuxian/ corepack pnpm --filter @fuxian/website preview
```

## Analytics

Production analytics uses Umami and remains disabled unless `VITE_UMAMI_WEBSITE_ID` is present at build time. Set the public Website ID as the `UMAMI_WEBSITE_ID` GitHub Actions repository variable. `UMAMI_SCRIPT_URL` is optional and defaults to Umami Cloud; set it only when moving to a self-hosted instance.

The site records pageviews plus download, GitHub, feature-guide, skill-command-copy, and one-time homepage section-view events. It does not record clicks to the diagram-language websites. Search parameters and URL hashes are excluded, browser Do Not Track is respected, and local development never loads the analytics script.

`dist/sitemap.xml` contains the four localized page URLs. Submit the deployed sitemap through the relevant search console if desired. A robots.txt inside a GitHub project subpath cannot control the origin's crawler policy, so this site does not generate one.
