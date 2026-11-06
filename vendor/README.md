# Vendored packages

Local copies of dependencies that have a known vulnerability and no fixed
release upstream. Each one is wired in through `overrides` in `package.json`.
Remove it once upstream publishes a fix.

| Package | Base version | Advisory | Patch |
| --- | --- | --- | --- |
| `deepmerge` | 4.3.1 (MIT) | [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) | Merged keys are written with `Object.defineProperty`, so a `__proto__` key can no longer replace the prototype of the result. |

`deepmerge` is used only at build time (vite-plugin-pwa → workbox-build →
@rollup/plugin-node-resolve) and is not shipped to the browser.
