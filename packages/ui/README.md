# @triage/ui

CSP-safe DOM construction helpers for the injected Triage UI.

github.com's CSP (`script-src github.githubassets.com`, no `unsafe-inline`)
forbids inline `style="…"` attributes and `on*` handlers carried via
`innerHTML`. Everything here builds UI the only allowed way:

- `createElement` (never `innerHTML`)
- CSSOM — `element.style` (never a `style=` attribute string)
- `addEventListener` (never `on*` attributes)

`el(tag, options)` is the single entry point. The dependency only ever flows
**UI → engine**; the engine must not import from this package.
