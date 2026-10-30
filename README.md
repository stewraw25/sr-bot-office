# SR Bot Office

Live view of Stewart Rawson's AI bots, drawn as a warm low-poly shepherd's hut on a smallholding. Built for an office TV. The main page is a static Three.js scene (no build step). A flat fallback of the same roster is at `/2d/` and is unchanged. No paid services and no downloaded models.

**Live:** https://stewraw25.github.io/sr-bot-office/

Three.js is MIT licensed and loaded from jsDelivr (`three@0.170.0`). The renderer stays sharp: device pixel ratio is capped at 2, tone mapping is off, and there is no bloom. If a machine stays under 30 fps, shadows drop before resolution does. Bots, desks, and repeated yard pieces are instanced.

## What you see

The hut is a cutaway office so the floor stays readable. Department names are lettered into the carpets: Websites / SEO / Social, Office & Phones, Jobs, Money, Research, Study, and Housekeeping. Kelvin, the lead, has a glass-walled corner office. The middle of the floor is a lounge. There is a break counter, a research wall with animated screens, a blinking server rack, and plants. Bots are small blocky people in flat matte colours, each with a job accessory. Name tags stay small and low contrast. Idle bots show a name only on hover or tap. Nothing is drawn over the carpet lettering.

- **Working** bots walk to their own desk and sit. A short task label is on the roster, not a usage board.
- **Idle** bots sit in the lounge and do not bob. Idle does not expire.
- **Collaborating** bots carry a folder to Kelvin's office. Kelvin stays at his desk.
- **Offline** bots stay at their desk, greyed out. This does not expire.

Desks come from `data/bots.json`, so adding a bot adds a desk.

Outside, and still in frame: the hut on its wheels, a barn conversion beside it, a fenced paddock with two black horses and stables, two red miniature poodles, six ducks on a pond, chickens, caravans nearby and a couple further off, and a wizard in a pointy hat doing groundworks with a digger. Parked on the gravel are a white Transporter-style van marked Stewart Rawson Electrical, a smaller van marked SR Security, and a black Tesla Model Y on black wheels. Animals move gently. The sky tint follows UK time (night, dawn, day, dusk). The Now / Day / Evening / Night buttons lock it. `?sky=night` (or `dawn`, `day`, `dusk`, `evening`) still works.

**Simulate Work**, at the bottom, animates example tasks in the browser only. It never writes `status.json`. A small Simulation label shows while it runs. `?simulate=1` starts it (`?demo=1` does the same).

The cursor hides after a few seconds. Fullscreen is the button, a double-click, or the `f` key. The header link **2D** opens the flat version.

## Bots

Edit `data/bots.json`. Each entry is `id`, `name`, `emoji`, `team` (`grok` or `buzz`), and `role`. Keep ids lowercase with hyphens. Mori is not a bot and is not in the list. Kelvin is the lead. SR-Planner-Agent is parked: leave it `offline`.

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

`state` is `working`, `idle`, `collaborating`, or `offline`. `task` is a short label, 40 characters max. `with` is bot ids, used when collaborating. The page polls about every 45 seconds. It never invents a status. If the feed is missing, everyone is shown idle.

**No customer data.** Task labels stay generic. The updater rejects emails, long numbers, and money amounts.

A `working` or `collaborating` entry older than 10 minutes is shown as idle, so a stale "working" flag does not leave someone typing. An explicit `idle` does not expire. An explicit `offline` stays offline. A bot with no status entry is idle. The `/2d/` page is untouched and still uses its own, longer stale rule.

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

## Third-party

The scene borrows from three MIT projects. Their licence notices are kept in `third_party/`, and the page footer links the repos.

- [agent-office-3d](https://github.com/jefferysha0627/agent-office-3d) — Jeffery Sha, 2026. Desk, chair, and toy-rig proportions, and the walk pose. See `third_party/agent-office-3d-LICENSE`.
- [Hermes3D](https://github.com/iamlukethedev/Hermes3D) — Luke The Dev, 2026. The idea of walking a handoff into the lead's office. See `third_party/Hermes3D-LICENSE`.
- [hermes-virtual-office](https://github.com/JuniorXcoder/hermes-virtual-office) — Hermes Virtual Office Contributors, 2026. Blocky avatar parts and the wood-floor approach. See `third_party/hermes-virtual-office-LICENSE`.
