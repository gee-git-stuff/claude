# Your scene overrides

Drop a `day.json`, `dawn.json`, `dusk.json`, or `night.json` file in this
folder to re-theme that time-of-day scene — without ever touching the
shipped defaults in `public/scenes/default/`.

You only need to include the fields you want to change. Anything you
leave out falls back to the default scene. For example, to just recolor
the daytime sky and turn off the tree hotspot for younger kids, your
`public/scenes/user/day.json` could be as small as:

```json
{
  "palette": {
    "skyTop": "#ff6b6b"
  },
  "hotspots": []
}
```

Notes on merging:
- `palette` merges field-by-field — override just `skyTop` and the rest
  of the default palette (`skyMid`, `skyBottom`, `ground`, `accent`) stays.
- `hotspots`, if present, **replaces the whole list** (it's not merged
  hotspot-by-hotspot) — copy the ones you want to keep from the default
  file in `public/scenes/default/` alongside your new/edited ones.
- Any other top-level field (`label`, `feel`, `accent`, `starChart`)
  replaces the default's value outright when present.

See `public/scenes/default/day.json` for the full shape of a scene,
including the `lesson` structure used by each hotspot.
