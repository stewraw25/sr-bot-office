#!/usr/bin/env bash
# Update status.json for SR Bot Office via the GitHub contents API.
# Retries when the file changed underneath us (HTTP 409/422).
#
# Usage:
#   GH_TOKEN=... ./scripts/set-status.sh <bot-id> <state> [task] [with]
#
# One line, no checkout required (needs bash, curl, python3):
#   curl -fsSL https://raw.githubusercontent.com/stewraw25/sr-bot-office/main/scripts/set-status.sh | GH_TOKEN="$GH_TOKEN" bash -s -- kelvin working "Weekly SEO check"
#
# States: working | idle | collaborating | offline
# Task: optional, 40 characters max, no personal data (no names, phones, addresses, amounts).
# With: optional comma-separated bot ids when collaborating.
#
# Local check without GitHub (does not need GH_TOKEN):
#   STATUS_FILE=status.json BOTS_FILE=data/bots.json ./scripts/set-status.sh kelvin working "Weekly SEO check"
set -euo pipefail

usage() {
  cat <<'EOF' >&2
Usage: GH_TOKEN=... set-status.sh <bot-id> <state> [task] [with]

  state   working, idle, collaborating, or offline
  task    short label, 40 characters max, no personal data
  with    comma-separated bot ids (for collaborating)

Examples:
  GH_TOKEN="$GH_TOKEN" ./scripts/set-status.sh kelvin working "Weekly SEO check"
  GH_TOKEN="$GH_TOKEN" ./scripts/set-status.sh eden collaborating "Morning standup" grace
  GH_TOKEN="$GH_TOKEN" ./scripts/set-status.sh kelvin idle
  GH_TOKEN="$GH_TOKEN" ./scripts/set-status.sh sr-planner-agent offline "Parked"
EOF
  exit 1
}

if [[ $# -lt 2 || $# -gt 4 ]]; then
  usage
fi

BOT_ID="$1"
BOT_STATE="$2"
BOT_TASK="${3-}"
BOT_WITH="${4-}"
export BOT_ID BOT_STATE BOT_TASK BOT_WITH

REPO="${REPO:-${GITHUB_REPOSITORY:-stewraw25/sr-bot-office}}"
BRANCH="${BRANCH:-main}"
export REPO BRANCH

apply_status() {
  local bots_path="$1"
  local status_path="$2"
  local out_path="$3"
  python3 - "$bots_path" "$status_path" "$out_path" <<'PY'
import json, os, re, sys
from datetime import datetime, timezone

bots_path, status_path, out_path = sys.argv[1:4]
bot_id = os.environ["BOT_ID"].strip()
state = os.environ["BOT_STATE"].strip()
task = re.sub(r"\s+", " ", os.environ.get("BOT_TASK", "")).strip()
raw_with = os.environ.get("BOT_WITH", "").strip()

if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,48}", bot_id):
    sys.exit("Bot id must be lowercase letters, numbers, and hyphens.")
if state not in ("working", "idle", "collaborating", "offline"):
    sys.exit("State must be working, idle, collaborating, or offline.")
if len(task) > 40:
    sys.exit("Task must be 40 characters or fewer. Use a short label, no personal data.")
if "@" in task or re.search(r"[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}", task, re.I):
    sys.exit("Task looks like an email address. No personal data in status labels.")
if re.search(r"\d{5,}", task):
    sys.exit("Task contains a long number. Do not include phones or account numbers.")
if re.search(r"[£$€]\s*\d|\d+\s*(gbp|usd|eur)\b", task, re.I):
    sys.exit("Task looks like an amount. Do not include money figures.")

def parse_with(raw):
    if not raw:
        return []
    if raw.startswith("["):
        data = json.loads(raw)
        if not isinstance(data, list):
            sys.exit("with must be a list of bot ids.")
        return [str(item).strip() for item in data if str(item).strip()]
    return [part.strip() for part in raw.split(",") if part.strip()]

try:
    with_ids = parse_with(raw_with)
except json.JSONDecodeError:
    sys.exit("Could not read the with list. Use comma-separated ids, e.g. grace,merlin.")

with open(bots_path, encoding="utf-8") as handle:
    bots = json.load(handle)
if not isinstance(bots, list):
    sys.exit("data/bots.json must be a list.")
known = []
for bot in bots:
    if isinstance(bot, dict) and bot.get("id"):
        known.append(str(bot["id"]))
known_set = set(known)
if bot_id not in known_set:
    sys.exit("Unknown bot id '%s'. Add it to data/bots.json first.\nKnown: %s" % (bot_id, ", ".join(known)))

clean_with = []
for other in with_ids:
    if other == bot_id or other in clean_with:
        continue
    if other not in known_set:
        sys.exit("Unknown collaborator '%s'." % other)
    clean_with.append(other)

text = open(status_path, encoding="utf-8").read().strip()
data = json.loads(text) if text else {"updated_at": "", "bots": [], "history": []}
if not isinstance(data, dict):
    sys.exit("status.json must be a JSON object.")
bots_status = data.get("bots")
history = data.get("history")
if not isinstance(bots_status, list):
    bots_status = []
if not isinstance(history, list):
    history = []

now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
updated = {
    "id": bot_id,
    "state": state,
    "task": task,
    "with": clean_with,
    "updated_at": now,
}
found = False
new_bots = []
for entry in bots_status:
    if isinstance(entry, dict) and entry.get("id") == bot_id:
        merged = dict(entry)
        merged.update(updated)
        new_bots.append(merged)
        found = True
    else:
        new_bots.append(entry)
if not found:
    new_bots.append(updated)

history.append({
    "id": bot_id,
    "state": state,
    "task": task,
    "with": clean_with,
    "at": now,
})
history = history[-20:]

data["updated_at"] = now
data["bots"] = new_bots
data["history"] = history

with open(out_path, "w", encoding="utf-8") as handle:
    json.dump(data, handle, indent=2, ensure_ascii=False)
    handle.write("\n")

message = "status: %s → %s" % (bot_id, state)
if task:
    message += " (%s)" % task
if clean_with and state == "collaborating":
    message += " with " + ", ".join(clean_with)
print(message[:180])
PY
}

if [[ -n "${STATUS_FILE:-}" ]]; then
  BOTS_FILE="${BOTS_FILE:-data/bots.json}"
  if [[ ! -f "$STATUS_FILE" || ! -f "$BOTS_FILE" ]]; then
    echo "STATUS_FILE and BOTS_FILE must both exist." >&2
    exit 1
  fi
  apply_status "$BOTS_FILE" "$STATUS_FILE" "$STATUS_FILE"
  exit 0
fi

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "Set GH_TOKEN to a token that can read and write contents on ${REPO}." >&2
  exit 1
fi

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

branch_q=$(python3 -c 'import os, urllib.parse; print(urllib.parse.quote(os.environ["BRANCH"], safe=""))')
api="https://api.github.com/repos/${REPO}/contents"

http_code() {
  # Prints the HTTP status. Network failures become 000.
  local method="$1" url="$2" outfile="$3" accept="$4" body="${5:-}"
  local args=(-sS -o "$outfile" -w "%{http_code}" -X "$method"
    -H "Authorization: Bearer ${GH_TOKEN}"
    -H "Accept: ${accept}"
    -H "X-GitHub-Api-Version: 2022-11-28")
  if [[ -n "$body" ]]; then
    args+=(-H "Content-Type: application/json" --data-binary @"$body")
  fi
  curl "${args[@]}" "$url" || printf '000'
}

explain_error() {
  local file="$1"
  python3 - "$file" <<'PY' >&2 || true
import json, sys
try:
    data = json.load(open(sys.argv[1], encoding="utf-8"))
except Exception:
    sys.exit(0)
msg = data.get("message") if isinstance(data, dict) else None
if msg:
    print(msg)
PY
}

for attempt in 1 2 3 4 5 6; do
  status_code=$(http_code GET "${api}/status.json?ref=${branch_q}" "$tmpdir/meta.json" "application/vnd.github+json")
  bots_code=$(http_code GET "${api}/data%2Fbots.json?ref=${branch_q}" "$tmpdir/bots.json" "application/vnd.github.raw")
  if [[ "$status_code" != "200" || "$bots_code" != "200" ]]; then
    echo "GitHub read failed (status.json ${status_code}, bots.json ${bots_code})." >&2
    explain_error "$tmpdir/meta.json"
    if [[ "$status_code" == "401" || "$bots_code" == "401" || "$status_code" == "403" || "$bots_code" == "403" ]]; then
      echo "GH_TOKEN was rejected. It needs contents read/write on ${REPO}." >&2
      exit 2
    fi
    if [[ "$attempt" -eq 6 ]]; then
      exit 2
    fi
    sleep $((attempt * 2))
    continue
  fi

  python3 - "$tmpdir/meta.json" "$tmpdir/status.json" <<'PY'
import base64, json, sys
meta = json.load(open(sys.argv[1], encoding="utf-8"))
raw = base64.b64decode(meta["content"])
open(sys.argv[2], "wb").write(raw)
open(sys.argv[1] + ".sha", "w", encoding="utf-8").write(meta["sha"])
PY
  sha=$(cat "$tmpdir/meta.json.sha")
  export sha

  if ! msg=$(apply_status "$tmpdir/bots.json" "$tmpdir/status.json" "$tmpdir/new-status.json"); then
    exit 1
  fi

  COMMIT_MSG="$msg" BLOB_SHA="$sha" python3 - "$tmpdir/new-status.json" "$tmpdir/body.json" <<'PY'
import base64, json, os, sys
content = open(sys.argv[1], "rb").read()
body = {
    "message": os.environ["COMMIT_MSG"],
    "content": base64.b64encode(content).decode("ascii"),
    "sha": os.environ["BLOB_SHA"],
    "branch": os.environ["BRANCH"],
}
json.dump(body, open(sys.argv[2], "w", encoding="utf-8"))
PY

  put_code=$(http_code PUT "${api}/status.json" "$tmpdir/put.json" "application/vnd.github+json" "$tmpdir/body.json")
  if [[ "$put_code" == "200" || "$put_code" == "201" ]]; then
    echo "$msg"
    exit 0
  fi
  echo "GitHub write returned ${put_code} (attempt ${attempt})." >&2
  explain_error "$tmpdir/put.json"
  if [[ "$put_code" == "409" || "$put_code" == "422" || "$put_code" == "500" || "$put_code" == "502" || "$put_code" == "503" || "$put_code" == "504" || "$put_code" == "000" ]]; then
    sleep $((attempt * 2))
    continue
  fi
  if [[ "$put_code" == "401" || "$put_code" == "403" ]]; then
    echo "GH_TOKEN cannot write status.json on ${REPO}." >&2
  fi
  exit 2
done

echo "Could not update status.json after several attempts. Try again." >&2
exit 2
