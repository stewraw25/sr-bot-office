/* Optional live channel for SR Bot Office.
   The topic is read from the page hash and is never written down here.
   The page then follows https://ntfy.sh/<topic> (12h JSON backfill, then SSE).
   The message shapes match the feed Stewart's bots already post:
   status lines, plus roster / looks / groups / usage notes.
   Those notes are accepted so a mixed channel does not look broken.
   Desks, colours, and teams stay the ones in data/bots.json. */
const TOPIC = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_LINE = 4096;

export function topicFromLocation(loc = location) {
  let text = String(loc.hash || '').replace(/^#/, '');
  try { text = decodeURIComponent(text); } catch { /* keep the raw hash */ }
  text = text.trim();
  if (!TOPIC.test(text)) return null;
  return text;
}

/** Follow one ntfy.sh topic. `onRecord(record, isoTime)` for each status line.
 *  `onFeed(ok)` when the channel can or cannot be read. Never logs the topic. */
export function startLive(topic, { onRecord, onFeed }) {
  const base = 'https://ntfy.sh/' + encodeURIComponent(topic);
  const seen = new Set();
  let lastId = null;
  let es = null;
  let closed = false;
  let opened = false;

  function take(message) {
    if (!message || message.event !== 'message' || typeof message.id !== 'string') return false;
    if (seen.has(message.id)) return false;
    seen.add(message.id);
    lastId = message.id;
    if (typeof message.message !== 'string' || message.message.length > MAX_LINE) return false;
    let record;
    try { record = JSON.parse(message.message); } catch { return false; }
    if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
    const when = typeof message.time === 'number'
      ? new Date(message.time * 1000).toISOString()
      : new Date().toISOString();
    onRecord(record, when);
    return true;
  }

  async function backfill(since) {
    const res = await fetch(base + '/json?poll=1&since=' + encodeURIComponent(since), { cache: 'no-store' });
    if (!res.ok) throw new Error('channel ' + res.status);
    const text = await res.text();
    const rows = [];
    text.split('\n').forEach((row) => {
      if (!row) return;
      try { rows.push(JSON.parse(row)); } catch { /* skip a bad line */ }
    });
    rows.sort((a, b) => (Number(a.time) || 0) - (Number(b.time) || 0));
    rows.forEach(take);
    opened = true;
    onFeed(true);
  }

  function follow() {
    if (closed) return;
    es = new EventSource(base + '/sse');
    es.onopen = () => {
      opened = true;
      onFeed(true);
      if (lastId) backfill(lastId).catch(() => {});
    };
    es.onmessage = (ev) => {
      try { take(JSON.parse(ev.data)); } catch { /* keepalive or junk */ }
    };
    es.onerror = () => {
      if (!opened) onFeed(false);
    };
  }

  backfill('12h').then(follow).catch(() => {
    onFeed(false);
    follow();
  });

  return {
    close() {
      closed = true;
      if (es) es.close();
    }
  };
}
