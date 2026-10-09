# SaintsAI — client and administrator visual remaster

Inspired by the rounded dark surfaces, purple light and pill controls at gptmaker.ai, retaining SaintsAI branding and the existing product workflows.

- Shared theme for 28 client/admin HTML entry points, including login.
- Client home: new welcome composition, four live summary cards, agenda and connection cards, compact quick actions and existing finance/history tabs.
- Admin home: new hero, visible SaaS revenue/access metrics, preserved business profit metrics, prospecting, client management and receipts.
- Shared rounded forms/cards, brighter purple actions, responsive navigation and hover/press feedback. Reduced-motion preferences respected. Existing light theme supported.
- Presentation code moves existing DOM nodes without cloning IDs, replacing business listeners, issuing new API requests or changing persistence.
- Build appends patches/saintsai-neon-v6.js after the existing remaster. Both version manifests advance to 2026.10.10.1.

## Validation

`PLAYWRIGHT_MODULE=/path/to/playwright node tests/neon-ui-browser.cjs`

Mocked API browser verification covers eight core screens at 320, 390, 768 and 1440px; unique IDs, live metric rendering, finance/history tabs, client menu, admin client navigation, overflow and uncaught JavaScript errors. Screenshots of mobile/desktop dark/light themes are reviewed locally. No production writes are made by this test.

The 32 existing focused checks for client update, branding, gallery and critical client behavior pass on the generated application. This change does not alter backend routes, database or integrations.
