# SR Bot Office

Live full-screen view of Stewart Rawson's AI bots, drawn as a shepherd's hut on a smallholding. Built for an office TV. The main page is a static Three.js scene (procedural primitives, no build step). A flat fallback of the same office is at `/2d/`. No paid services and no downloaded models.

**Live:** https://stewraw25.github.io/sr-bot-office/

Three.js is MIT licensed and loaded from jsDelivr (`three@0.170.0`). Pixel ratio is capped so a 4K TV does not render a full 4K framebuffer, and shadows use one 1024 map.

## What you see

The hut is the office, with the barrel roof cut away so the room stays visible. Grok Bots sit toward the back, Buzz toward the front. Desks are laid out from `data/bots.json`, so adding a bot just adds a desk. Name and status labels sit above each bot and move aside when they would overlap.

- **Working** bots walk to their desk, sit, and type. A bubble shows a short task label.
- **Idle** bots wander between desks, the sofa, and the kettle.
- **Collaborating** bots walk to a shared table. A line joins them and both bubbles show the task.
- **Offline** bots stay at their desk, greyed out. This does not expire.

Outside the hut: a barn conversion, stables, two black horses, two red miniature poodles, six ducks, a dozen chickens, nearby and distant caravans, and a wizard doing groundworks. Parked by the hut are a white Stewart Rawson Electrical van, a smaller SR Security van, and a black Tesla Model Y. The sky tint follows UK time (night, dawn, day, dusk). Add `?sky=night` (or `dawn`, `day`, `dusk`) to lock it.

`?demo=1` ignores `status.json` and animates example tasks in the browser only. Nothing is written.

The mouse cursor hides after a few seconds. Fullscreen is the button, a double-click, or the `f` key. The header link **2D** opens the flat version.

## Bots

Edit `data/bots.json`. Each entry is `id`, `name`, `emoji`, `team` (`grok` or `buzz`), and `role`. Keep ids lowercase with hyphens. Mori is not a bot and is not in the list. SR-Planner-Agent is parked: leave it `offline`.

## Status

`status.json` at the repo root:

```json
{
  "updated_at": "2026-10-29T09:43:28Z",
  "bots": [
    { "id": "kelvin", "state": "working", "task": "Weekly SEO check", "with": [], "updated_at": "2026-10-29T09:43:28Z" }
  ],
  "history": [
    { "id": "kelvin", "state": "working", "task": "Weekly SEO check", "with": [], "at": "2026-10-29T09:43:28Z" }
  ]
}
```

`state` is `working`, `idle`, `collaborating`, or `offline`. `task` is a short label, 40 characters max. `with` is bot ids, used when collaborating. The page polls about every 45 seconds.

**No customer data.** Task labels stay generic. The updater rejects emails, long numbers, and money amounts.

A `working`, `idle`, or `collaborating` entry older than about two hours is shown as idle. An explicit `offline` stays offline, so a parked bot does not start wandering just because the timestamp is old. A bot with no status entry is idle.

## One-line status update

Needs `bash`, `curl`, `python3`, and a GitHub token that can read and write contents (`GH_TOKEN`).

```bash
curl -fsSL https://raw.githubusercontent.com/stewraw25/sr-bot-office/main/scripts/set-status.sh | GH_TOKEN="$GH_TOKEN" bash -s -- kelvin working "Weekly SEO check"
```

From a checkout:

```bash
GH_TOKEN="$GH_TOKEN" ./scripts/set-status.sh kelvin working "Weekly SEO check"
GH_TOKEN="$GH_TOKEN" ./scripts/set-status.sh eden collaborating "Morning standup" grace
GH_TOKEN="$GH_TOKEN" ./scripts/set-status.sh kelvin idle
GH_TOKEN="$GH_TOKEN" ./scripts/set-status.sh sr-planner-agent offline "Parked"
```

The same inputs work from Actions: workflow **set-status** (`workflow_dispatch`), or a `repository_dispatch` of type `set-status` with `client_payload` fields `id` (or `bot_id`), `state`, `task`, and `with`.

```bash
curl -fsSL -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/stewraw25/sr-bot-office/dispatches \
  -d '{"event_type":"set-status","client_payload":{"id":"kelvin","state":"working","task":"Weekly SEO check"}}'
```

The script re-reads `status.json`, retries if someone else wrote it first, and keeps the last 20 history rows.
