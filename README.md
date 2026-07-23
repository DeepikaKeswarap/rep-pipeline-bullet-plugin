# Rep Pipeline Bullet Chart — Sigma Plugin

A custom Sigma plugin that reproduces the "Rep Pipeline vs Target" bullet-style
chart: two stacked bars per category plus an independent point marker, e.g.

```
Rep name  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬  (thin bar:  Segment A + Segment B, stacked)
          ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ●  (thick bar: Segment A + Segment B, stacked, plus a point)
```

Sigma doesn't have this chart type natively, which is exactly the kind of gap
the **Plugin** framework is for: you build a small web app, Sigma hosts it in
an iframe on a workbook page, and it reads live data straight from a Sigma
data element.

## What it looks like in Sigma's editor panel

Once added to a workbook, the plugin element's editor panel lets a user pick:

- **Data source** – which data element (table) in the workbook to read
- **Category** – the row label column (e.g. rep name)
- **Bar 1 – Segment A / Segment B** – the two measures stacked in the thin bar
- **Bar 2 – Segment A / Segment B** – the two measures stacked in the thick bar
- **Point marker value** – the measure plotted as the independent dot
- **Chart title** – free text
- 5 color pickers, one per segment/marker, with reasonable defaults if left blank

## Run it locally

```sh
npm install
npm run dev
```

This starts a Vite dev server at `http://localhost:5173` (Sigma's default dev
playground port).

## Wire it up in Sigma

1. **Ask your Sigma admin for "Manage plugins" permission** if you don't have
   it, and confirm your org has a **Sigma Plugin Dev Playground** plugin
   registered (Admin Portal → Custom Plugins). If not, an admin can register
   one pointed at `http://localhost:5173`.
2. In any workbook (Edit mode), click **+ → UI Elements → Plugin**.
3. In the new element's editor panel, select **Sigma Plugin Dev Playground**.
4. With `npm run dev` running locally, the element should immediately show
   this chart's editor panel (Data source, Category, Bar 1/2 segments, etc).
5. Pick your source table and columns. The thin bar, thick bar, and point
   marker should render immediately — no refresh needed as you tweak code,
   the dev server hot-reloads the iframe.

### Going to production

1. Build it: `npm run build` (outputs to `dist/`).
2. Host `dist/` somewhere with a stable URL — Netlify and Heroku are
   Sigma's suggested options, but any static host works (S3+CloudFront,
   Vercel, an internal server, etc.) as long as it's reachable from your
   Sigma org's users.
3. Have a Sigma org Admin go to **Admin Portal → Account → Custom Plugins →
   Add**, and register the hosted URL as this plugin's **Production URL**.
4. Anyone in the org can now add it via **+ → UI Elements → Plugin** and pick
   it by name.

## Notes / things worth knowing

- Plugins can only read from a data element that lives in the **same
  workbook**, and are capped at the first 25,000 rows of that element — group/
  aggregate upstream in Sigma if a rep-level table gets bigger than that.
- The two "Segment B" measures are meant for things like "remaining to
  target" (bar 1) or an overage/overflow amount (bar 2) — but the plugin
  doesn't assume any particular business meaning; it just stacks whatever two
  measures you give it. If you want the red "overflow" look from the
  original screenshot, feed a calculated "amount over target" measure into
  Bar 2 – Segment B (it'll be 0, and invisible, for reps who aren't over).
- Colors are optional; if you don't set them, this chart falls back to
  green / gray for bar 1 and navy / red for bar 2, with an orange point —
  matching the reference screenshot.
- The chart re-flows on resize (it watches the container width), so it'll
  behave reasonably in a dashboard grid.

## Files

```
src/main.jsx        Bootstraps the Sigma plugin client + React root
src/App.jsx          Defines the editor panel config, pulls data via Sigma's
                     hooks, and maps it into rows for the chart
src/BulletChart.jsx  The actual SVG chart (stacked bars + point marker)
```
