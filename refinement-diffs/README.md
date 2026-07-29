# Terminal OS refinement diffs

Before/after screenshots for the UI density pass (`refinement/ui-density-pass`).

| File | Viewport | Notes |
|------|----------|-------|
| `before/terminalOS-1920x1080.png` | 1920×1080 | Captured before presentation changes (skeleton paint) |
| `before/terminalOS-3840x2160.png` | 3840×2160 | Early/skeleton capture (Chrome virtual-time) |
| `after/terminalOS-1920x1080.png` | 1920×1080 | Settled ribbons: traders **60px**, tokens **52px** |
| `after/terminalOS-3840x2160.png` | 3840×2160 | Same settled state at 4K |

Measured via CDP after data hydrate: `.tos-traders-ribbon` height 60, `.tos-tokens-ribbon` height 52.
