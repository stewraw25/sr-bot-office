/* SR Bot Office — TV scene. No build step.
   Add a bot by editing data/bots.json. Desks reflow on their own.
   status.json is polled for live state. ?demo=1 animates tasks locally. */
(function () {
  'use strict';

  var STAGE_W = 1920;
  var STAGE_H = 1080;
  var HEADER_H = 58;
  var TICKER_H = 48;
  var FARM_W = 520;
  var FARM_H = STAGE_H - HEADER_H - TICKER_H;
  var STALE_MS = 2 * 60 * 60 * 1000;
  var POLL_MS = 45000;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var params = new URLSearchParams(location.search);
  var DEMO = params.get('demo') === '1' || params.get('demo') === 'true';
  var DEBUG = params.has('debug') || params.has('fps');
  var SKY_LOCK = params.get('sky');
  if (['night', 'dawn', 'day', 'dusk'].indexOf(SKY_LOCK) === -1) SKY_LOCK = null;

  var GROK_SWEATERS = ['#1f8a7b', '#218a9a', '#2f6f86', '#3d8f6a', '#1d6e78', '#2a7d62'];
  var BUZZ_SWEATERS = ['#d4893a', '#e09a3a', '#c46b3a', '#e0b15a', '#b86a48', '#cc7a3a'];
  var RINGS = { grok: '#3dbea8', buzz: '#f0b45a' };
  var STATE_LABEL = {
    working: 'Working',
    idle: 'Idle',
    collaborating: 'Together',
    offline: 'Offline'
  };
  var DEMO_TASKS = [
    'Weekly SEO check',
    'Drafting X post',
    'Call wrap-up',
    'Inbox tidy',
    'Backtest review',
    'Macro notes',
    'Overnight digest',
    'Risk scan',
    'Keyword pass',
    'Site health check',
    'Diary skim',
    'Statement run',
    'Job notes sync',
    'Cert booking',
    'Market open scan',
    'Desk research'
  ];
  var CHICKEN_COLORS = [
    '#f7f1e3', '#e6d2a8', '#d08a45', '#fffaf2', '#8d5a34', '#f0e2c0',
    '#c46a3a', '#efe6c9', '#f4d7a8', '#a86b3c', '#fffdf8', '#e7c98a'
  ];

  var stage = document.getElementById('stage');
  var scene = document.getElementById('scene');
  var clockEl = document.getElementById('clock');
  var countsEl = document.getElementById('counts');
  var feedEl = document.getElementById('feed');
  var fullBtn = document.getElementById('fullbtn');
  var tickerTrack = document.getElementById('ticker-track');
  var fpsEl = document.getElementById('fps');

  var zonesEl, folk, links, crittersEl, sunEl, moonEl;
  var agents = [];
  var byId = new Map();
  var critters = [];
  var wizard = null;
  var linkPool = new Map();
  var zonesByTeam = new Map();
  var sharedTable = { x: 0, y: 0 };
  var room = { x: 0, y: 0, w: 0, h: 0 };
  var lastStatus = null;
  var botSig = '';
  var demoHistory = [];
  var lastMinute = -1;
  var frames = 0;
  var fpsStamp = 0;

  var BAND = {
    barn: { x: 24, y: 116, w: 496, h: 208 },
    stable: { x: 14, y: 332, w: 492, h: 116 },
    paddock: { x: 12, y: 456, w: 496, h: 146 },
    pond: { cx: 250, cy: 662, rx: 176, ry: 34 },
    chickens: { x: 10, y: 712, w: 280, h: 78 },
    yard: { x: 8, y: 792, w: 504, h: 78 }
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0;
    return h;
  }
  function sweater(team, id) {
    var palette = team === 'buzz' ? BUZZ_SWEATERS : GROK_SWEATERS;
    return palette[hash(id) % palette.length];
  }
  function teamLabel(team) {
    if (team === 'grok') return 'Grok Bots';
    if (team === 'buzz') return 'Buzz';
    return String(team).replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }
  function displayName(name) {
    return String(name);
  }

  function fit() {
    var s = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
    stage.style.transform = 'translate(-50%, -50%) scale(' + s + ')';
  }

  function londonParts(date) {
    var parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23'
    }).formatToParts(date);
    function get(type) {
      for (var i = 0; i < parts.length; i++) if (parts[i].type === type) return parts[i].value;
      return '';
    }
    var hour = Number(get('hour'));
    if (!isFinite(hour)) hour = 12;
    hour = ((hour % 24) + 24) % 24;
    return {
      hour: hour,
      minute: Number(get('minute')) || 0,
      label: (get('weekday') + ' ' + get('day') + ' ' + get('month')).replace(/,/g, '')
    };
  }

  function londonTime(date) {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).format(date);
  }

  function londonShort(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).format(d);
  }

  function skyPhase(hour) {
    if (hour >= 20 || hour < 5) return 'night';
    if (hour < 8) return 'dawn';
    if (hour >= 17) return 'dusk';
    return 'day';
  }

  function updateSky(parts) {
    var phase = SKY_LOCK || skyPhase(parts.hour);
    ['night', 'dawn', 'day', 'dusk'].forEach(function (p) {
      document.body.classList.toggle('phase-' + p, p === phase);
    });
    if (!sunEl) return;
    var t = parts.hour + parts.minute / 60;
    var u = 0.5;
    if (phase === 'dawn') u = ((t - 5) / 3) * 0.3;
    else if (phase === 'day') u = 0.18 + ((t - 8) / 9) * 0.64;
    else if (phase === 'dusk') u = 0.72 + ((t - 17) / 3) * 0.2;
    else u = ((t >= 20 ? t - 20 : t + 4) / 9);
    u = clamp(u, 0.05, 0.9);
    var x = 18 + u * (FARM_W - 80);
    var lift = Math.sin(u * Math.PI);
    var y = phase === 'day' ? 16 - lift * 8 : phase === 'night' ? 26 : 40 - lift * 6;
    sunEl.style.left = x + 'px';
    sunEl.style.top = y + 'px';
    moonEl.style.left = x + 'px';
    moonEl.style.top = (y + 6) + 'px';
  }

  function tickClock() {
    var now = new Date();
    var parts = londonParts(now);
    clockEl.textContent = parts.label + '  ·  ' + londonTime(now);
    if (parts.minute !== lastMinute) {
      lastMinute = parts.minute;
      updateSky(parts);
    }
  }

  function setFeed(mode) {
    feedEl.className = 'feed' + (mode && mode !== 'live' ? ' ' + mode : '');
    feedEl.textContent = mode === 'demo' ? 'Demo' : mode === 'error' ? 'No feed' : 'Live';
  }

  function updateCounts() {
    var c = { working: 0, idle: 0, collaborating: 0, offline: 0 };
    agents.forEach(function (a) {
      if (c[a.state] != null) c[a.state] += 1;
      else c.idle += 1;
    });
    countsEl.replaceChildren();
    [
      ['working', c.working, 'working'],
      ['idle', c.idle, 'idle'],
      ['collaborating', c.collaborating, 'together'],
      ['offline', c.offline, 'offline']
    ].forEach(function (row) {
      var el = document.createElement('span');
      el.className = 'count ' + row[0];
      var dot = document.createElement('i');
      el.append(dot, document.createTextNode(row[1] + ' ' + row[2]));
      countsEl.appendChild(el);
    });
  }

  function historyLabel(entry) {
    var bot = byId.get(entry.id);
    var name = bot ? bot.name : entry.id;
    var when = londonShort(entry.at);
    var how = entry.state || 'idle';
    if (entry.state === 'collaborating') {
      var names = (entry.with || []).map(function (id) {
        var other = byId.get(id);
        return other ? other.name : id;
      });
      how = names.length ? 'together with ' + names.join(', ') : 'together';
    }
    var task = entry.task ? '  ·  ' + entry.task : '';
    return (when ? when + '  ' : '') + name + '  ' + how + task;
  }

  function renderTicker(entries) {
    var items = (entries || []).slice(0, 5).map(historyLabel);
    if (!items.length) items = ['Quiet in the hut — waiting for a status change'];
    var twice = items.concat(items);
    tickerTrack.replaceChildren();
    twice.forEach(function (text) {
      var s = document.createElement('span');
      s.className = 'tick';
      s.textContent = text;
      tickerTrack.appendChild(s);
    });
  }

  function blackWheel(cx, cy, r) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#141414"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r - 3) + '" fill="#1c1c1c" stroke="#2a2a2a" stroke-width="1"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + Math.max(2, r * 0.28) + '" fill="#0e0e0e"/>';
  }

  function parkedVehicles() {
    return '<g class="parking">' +
      '<rect x="0" y="868" width="520" height="106" fill="#8d8478"/>' +
      '<rect x="0" y="868" width="520" height="8" fill="#6f675c"/>' +
      '<g class="work-van" transform="translate(4 878)">' +
        '<ellipse cx="118" cy="92" rx="108" ry="7" fill="rgba(0,0,0,0.28)"/>' +
        '<path d="M16 70 L16 34 Q16 18 34 16 L168 16 L196 34 L228 36 L236 48 L236 72 Q236 80 224 80 L28 80 Q16 80 16 70 Z" fill="#f7f8f6" stroke="#c9d0d6" stroke-width="1.4"/>' +
        '<path d="M30 24 L164 24 L186 38 L30 38 Z" fill="#b7d4e2"/>' +
        '<rect x="198" y="40" width="28" height="14" rx="2" fill="#b7d4e2" stroke="#7f9eae" stroke-width="0.8"/>' +
        '<rect x="20" y="58" width="206" height="7" fill="#1d4e89"/>' +
        '<text class="brand" x="22" y="53" fill="#1d4e89" font-size="11" font-weight="800" font-family="Arial, Helvetica, sans-serif">Stewart Rawson Electrical</text>' +
        '<path d="M92 40 L92 72" stroke="#d5dbe1" stroke-width="1.2"/>' +
        '<rect x="228" y="50" width="8" height="6" rx="1" fill="#f2e7a4"/>' +
        blackWheel(58, 80, 13) +
        blackWheel(196, 80, 13) +
      '</g>' +
      '<g class="security-van" transform="translate(250 894)">' +
        '<ellipse cx="62" cy="74" rx="58" ry="6" fill="rgba(0,0,0,0.28)"/>' +
        '<path d="M8 56 L8 28 Q8 16 22 15 L78 15 L96 28 L118 30 L124 40 L124 58 Q124 64 116 64 L16 64 Q8 64 8 56 Z" fill="#1b3f66" stroke="#10283f" stroke-width="1.2"/>' +
        '<path d="M18 22 L74 22 L88 32 L18 32 Z" fill="#9ec4d6"/>' +
        '<rect x="98" y="34" width="18" height="10" rx="1.5" fill="#9ec4d6"/>' +
        '<text class="brand" x="14" y="50" fill="#f4f7fb" font-size="11" font-weight="800" font-family="Arial, Helvetica, sans-serif">SR Security</text>' +
        blackWheel(36, 64, 10) +
        blackWheel(100, 64, 10) +
      '</g>' +
      '<g class="tesla" transform="translate(386 886)">' +
        '<ellipse cx="66" cy="82" rx="60" ry="6" fill="rgba(0,0,0,0.32)"/>' +
        '<path d="M10 52 C16 52 20 40 32 30 C46 16 66 12 92 12 C114 12 124 20 132 32 L136 34 C142 36 146 44 146 52 L146 62 C146 68 140 70 132 70 L18 70 C12 70 8 66 8 60 Z" fill="#121212" stroke="#2a2a2a" stroke-width="1"/>' +
        '<path d="M34 32 C48 20 66 16 94 16 C112 16 122 22 128 32 L36 34 Z" fill="#1c2833"/>' +
        '<path d="M132 44 L146 46 L146 52 L130 50 Z" fill="#e7eef3"/>' +
        '<path d="M12 48 L22 46 L22 52 L12 54 Z" fill="#c23b3b"/>' +
        blackWheel(42, 70, 13) +
        blackWheel(114, 70, 13) +
      '</g>' +
      '</g>';
  }

  function caravan(x, y, scale, body, roof, far) {
    return '<g class="caravan ' + (far ? 'far' : 'near') + '" transform="translate(' + x + ' ' + y + ') scale(' + scale + ')" opacity="' + (far ? '0.9' : '1') + '">' +
      '<rect x="-8" y="24" width="12" height="4" rx="1" fill="#666"/>' +
      '<rect x="0" y="10" width="76" height="32" rx="8" fill="' + body + '"/>' +
      '<rect x="8" y="0" width="60" height="16" rx="6" fill="' + roof + '"/>' +
      '<rect class="glow-win" x="14" y="18" width="18" height="12" rx="2" stroke="#5c4636" stroke-width="1.2"/>' +
      '<rect x="46" y="20" width="14" height="20" rx="1" fill="#6b442c"/>' +
      '<circle cx="20" cy="44" r="6.5" fill="#222"/><circle cx="20" cy="44" r="2.2" fill="#aaa"/>' +
      '<circle cx="56" cy="44" r="6.5" fill="#222"/><circle cx="56" cy="44" r="2.2" fill="#aaa"/>' +
      '</g>';
  }

  function fence(x, y, w, h) {
    var posts = '';
    for (var px = x; px <= x + w; px += 26) {
      posts += '<rect x="' + px + '" y="' + y + '" width="5" height="' + h + '" rx="1" fill="#6b4a30"/>';
    }
    return posts +
      '<rect x="' + x + '" y="' + (y + 10) + '" width="' + w + '" height="5" rx="1" fill="#d7bc8a"/>' +
      '<rect x="' + x + '" y="' + (y + h - 16) + '" width="' + w + '" height="5" rx="1" fill="#d7bc8a"/>';
  }

  function farmMarkup() {
    var b = BAND.barn;
    var s = BAND.stable;
    var p = BAND.paddock;
    var pond = BAND.pond;
    var yard = BAND.yard;
    var boards = '';
    for (var x = b.x + 16; x < b.x + b.w - 8; x += 16) {
      boards += '<line x1="' + x + '" y1="' + (b.y + 78) + '" x2="' + x + '" y2="' + (b.y + b.h) + '" stroke="rgba(0,0,0,0.18)" stroke-width="2"/>';
    }
    var tufts = '';
    for (var i = 0; i < 18; i++) {
      var tx = 12 + (i * 47) % (FARM_W - 24);
      var ty = 300 + ((i * 83) % (FARM_H - 320));
      tufts += '<path d="M' + tx + ' ' + ty + ' q4 -10 8 0 q4 -12 8 0" stroke="#2f6a32" stroke-width="2" fill="none"/>';
    }
    return '' +
      '<div class="sky-extras">' +
        '<div class="sun"></div><div class="moon"></div><div class="stars"></div>' +
        '<div class="cloud c1"></div><div class="cloud c2"></div>' +
      '</div>' +
      '<svg id="land" viewBox="0 0 ' + FARM_W + ' ' + FARM_H + '" width="' + FARM_W + '" height="' + FARM_H + '">' +
        '<path d="M0 168 C 70 120, 150 108, 230 132 C 320 98, 400 140, 520 118 L 520 190 L 0 190 Z" fill="#6f9a5c"/>' +
        '<path d="M0 186 C 90 160, 200 170, 300 156 C 400 146, 460 168, 520 160 L 520 210 L 0 210 Z" fill="#5c8a48"/>' +
        tufts +
        caravan(36, 58, 0.55, '#efe6d4', '#d5c4a4', true) +
        caravan(188, 46, 0.48, '#e4eee4', '#b7c9b0', true) +
        '<path d="M' + b.x + ' ' + (b.y + b.h) + ' L' + b.x + ' ' + (b.y + 86) + ' L' + (b.x + 150) + ' ' + b.y + ' L' + (b.x + b.w) + ' ' + (b.y + 58) + ' L' + (b.x + b.w) + ' ' + (b.y + b.h) + ' Z" fill="#8d4038"/>' +
        '<path d="M' + b.x + ' ' + (b.y + 86) + ' L' + (b.x + 150) + ' ' + b.y + ' L' + (b.x + b.w) + ' ' + (b.y + 58) + ' L' + (b.x + b.w - 8) + ' ' + (b.y + 70) + ' L' + (b.x + 150) + ' ' + (b.y + 22) + ' L' + (b.x + 10) + ' ' + (b.y + 96) + ' Z" fill="#6e322c"/>' +
        boards +
        '<rect class="glow-win" x="' + (b.x + 36) + '" y="' + (b.y + 108) + '" width="54" height="62" rx="3" stroke="#f3ead8" stroke-width="4"/>' +
        '<rect class="glow-win" x="' + (b.x + 110) + '" y="' + (b.y + 100) + '" width="78" height="74" rx="3" stroke="#f3ead8" stroke-width="4"/>' +
        '<rect class="glow-win" x="' + (b.x + 214) + '" y="' + (b.y + 112) + '" width="64" height="56" rx="3" stroke="#f3ead8" stroke-width="4"/>' +
        '<rect class="glow-win" x="' + (b.x + 300) + '" y="' + (b.y + 78) + '" width="40" height="28" rx="3" stroke="#f3ead8" stroke-width="3"/>' +
        '<rect x="' + (b.x + 390) + '" y="' + (b.y + 130) + '" width="46" height="78" rx="2" fill="#3e2a24"/>' +
        '<rect class="glow-win" x="' + (b.x + 398) + '" y="' + (b.y + 140) + '" width="30" height="36" rx="1"/>' +
        '<rect x="' + (b.x + 430) + '" y="' + (b.y + 18) + '" width="16" height="36" fill="#5c4638"/>' +
        '<rect x="' + s.x + '" y="' + (s.y + 28) + '" width="' + s.w + '" height="' + (s.h - 28) + '" rx="3" fill="#7a5340"/>' +
        '<path d="M' + (s.x - 6) + ' ' + (s.y + 36) + ' L' + (s.x + 40) + ' ' + s.y + ' L' + (s.x + s.w) + ' ' + s.y + ' L' + (s.x + s.w) + ' ' + (s.y + 36) + ' Z" fill="#6a4534"/>' +
        stableDoors(s) +
        '<path d="M' + (s.x + 250) + ' ' + (s.y + 8) + ' q14 16 0 28 q-14 -12 0 -28" fill="none" stroke="#e6c56a" stroke-width="3"/>' +
        fence(p.x + 8, p.y + 18, p.w - 20, p.h - 28) +
        '<rect x="' + (p.x + 70) + '" y="' + (p.y + p.h - 36) + '" width="36" height="14" rx="3" fill="#8d6a3a"/>' +
        '<rect x="' + (p.x + 74) + '" y="' + (p.y + p.h - 32) + '" width="28" height="6" rx="2" fill="#6eb0c8"/>' +
        '<ellipse cx="' + pond.cx + '" cy="' + pond.cy + '" rx="' + pond.rx + '" ry="' + pond.ry + '" fill="#2f7ea8"/>' +
        '<ellipse cx="' + (pond.cx - 20) + '" cy="' + (pond.cy - 6) + '" rx="' + (pond.rx * 0.62) + '" ry="' + (pond.ry * 0.45) + '" fill="#4aa0c8" opacity="0.85"/>' +
        '<ellipse cx="' + (pond.cx + 50) + '" cy="' + (pond.cy + 6) + '" rx="16" ry="7" fill="#3e8f4a"/>' +
        '<path d="M' + (pond.cx - pond.rx + 10) + ' ' + pond.cy + ' q-6 -28 8 -8 q6 -24 10 0" fill="#2f6a32"/>' +
        '<path d="M' + (pond.cx + pond.rx - 24) + ' ' + (pond.cy + 4) + ' q8 -26 6 -4 q10 -22 8 6" fill="#2f6a32"/>' +
        '<ellipse cx="150" cy="' + (BAND.chickens.y + 70) + '" rx="120" ry="28" fill="#6a4a2e" opacity="0.35"/>' +
        caravan(16, yard.y + 6, 0.78, '#f4efe4', '#e7d7c0', false) +
        caravan(92, yard.y + 18, 0.78, '#e3efe4', '#c5d5c4', false) +
        caravan(164, yard.y + 8, 0.74, '#f3e0cc', '#e2c2a4', false) +
        '<ellipse cx="400" cy="' + (yard.y + 62) + '" rx="70" ry="12" fill="#6b4a2c"/>' +
        '<ellipse cx="368" cy="' + (yard.y + 58) + '" rx="24" ry="8" fill="#5a3c24"/>' +
        parkedVehicles() +
        '<g transform="translate(488 ' + (yard.y + 28) + ')">' +
          '<rect x="0" y="0" width="9" height="20" rx="3" fill="#2f5580"/>' +
          '<rect x="12" y="0" width="9" height="20" rx="3" fill="#2f5580"/>' +
        '</g>' +
      '</svg>';
  }

  function stableDoors(s) {
    var html = '';
    for (var i = 0; i < 3; i++) {
      var x = s.x + 36 + i * 150;
      var y = s.y + 48;
      html += '<rect x="' + x + '" y="' + y + '" width="78" height="64" rx="2" fill="#3a2418"/>' +
        '<rect x="' + (x + 4) + '" y="' + (y + 30) + '" width="70" height="34" fill="#8a6244"/>' +
        '<path d="M' + (x + 8) + ' ' + (y + 34) + ' L' + (x + 70) + ' ' + (y + 60) + ' M' + (x + 70) + ' ' + (y + 34) + ' L' + (x + 8) + ' ' + (y + 60) + '" stroke="#6a452e" stroke-width="3"/>' +
        '<rect class="glow-win" x="' + (x + 18) + '" y="' + (y + 6) + '" width="42" height="18" rx="2" opacity="0.35"/>';
    }
    return html;
  }

  function roofMarkup() {
    var ribs = '';
    for (var i = 1; i < 11; i++) {
      var x = Math.round(1440 * i / 11);
      ribs += '<line x1="' + x + '" y1="20" x2="' + x + '" y2="100" stroke="rgba(255,255,255,0.06)" stroke-width="3"/>';
    }
    return '<svg class="roof" viewBox="0 0 1440 108" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="M0,108 L0,72 Q720,2 1440,72 L1440,108 Z" fill="#3a424c"/>' +
      '<path d="M0,72 Q720,4 1440,72" fill="none" stroke="#7d8794" stroke-width="7"/>' +
      '<path d="M0,86 Q720,22 1440,86" fill="none" stroke="#2a3138" stroke-width="4" opacity="0.55"/>' +
      ribs +
      '<path d="M0,100 Q720,36 1440,100" fill="none" stroke="#c4895a" stroke-width="6"/>' +
      '</svg>';
  }

  function hutMarkup() {
    var bulbs = '';
    for (var i = 0; i < 16; i++) {
      bulbs += '<i style="left:' + (28 + i * 80) + 'px;animation-delay:' + ((i % 6) * 0.25) + 's"></i>';
    }
    return roofMarkup() +
      '<div class="chimney"><i></i><i></i></div>' +
      '<div class="backwall"></div>' +
      '<div class="clerestory"></div>' +
      '<div class="floor"></div>' +
      '<div class="wall-right"></div>' +
      '<div class="porthole"></div>' +
      '<div class="daylight"></div>' +
      '<div class="lights">' + bulbs + '</div>' +
      '<div class="wheel w1"></div><div class="wheel w2"></div>';
  }

  function fillStars() {
    var stars = document.querySelector('.stars');
    if (!stars) return;
    var bits = [];
    for (var i = 0; i < 40; i++) {
      var x = Math.random() * (FARM_W - 8);
      var y = Math.random() * 108;
      var r = Math.random() > 0.82 ? 1.5 : 1;
      bits.push(x.toFixed(0) + 'px ' + y.toFixed(0) + 'px 0 ' + r + 'px #fff');
    }
    stars.style.boxShadow = bits.join(', ');
  }

  function spriteHorse() {
    return '<svg class="sprite" viewBox="0 0 112 76" width="102" height="70">' +
      '<path class="tail" d="M18 32 C6 34 4 54 16 58" stroke="#111" stroke-width="4" fill="none"/>' +
      '<g class="leg b"><rect x="30" y="42" width="7" height="26" rx="2" fill="#141414"/></g>' +
      '<g class="leg a"><rect x="42" y="42" width="7" height="26" rx="2" fill="#1a1a1a"/></g>' +
      '<ellipse cx="54" cy="36" rx="28" ry="15" fill="#141414" stroke="#6e655c" stroke-width="1.4"/>' +
      '<path d="M72 34 C84 26 92 16 100 12 C90 20 88 32 80 40 Z" fill="#101010" stroke="#6e655c" stroke-width="1.2"/>' +
      '<ellipse cx="100" cy="15" rx="12" ry="7" fill="#101010" stroke="#6e655c" stroke-width="1.2"/>' +
      '<path d="M92 11 L96 1 L104 11 Z" fill="#101010"/>' +
      '<path d="M76 30 C84 16 94 8 104 5" stroke="#0a0a0a" stroke-width="3.5" fill="none"/>' +
      '<circle cx="105" cy="14" r="1.4" fill="#f7f7f7"/>' +
      '<g class="leg a"><rect x="64" y="44" width="7" height="26" rx="2" fill="#141414"/></g>' +
      '<g class="leg b"><rect x="76" y="44" width="7" height="26" rx="2" fill="#1a1a1a"/></g>' +
      '</svg>';
  }

  function spritePoodle() {
    return '<svg class="sprite" viewBox="0 0 76 50" width="68" height="46">' +
      '<g fill="#d6453d">' +
        '<circle cx="10" cy="26" r="6.5"/>' +
        '<circle cx="20" cy="39" r="4.5"/>' +
        '<ellipse cx="32" cy="28" rx="15" ry="10"/>' +
        '<circle cx="44" cy="39" r="4.5"/>' +
        '<circle cx="50" cy="18" r="9"/>' +
        '<circle cx="43" cy="15" r="4.2"/>' +
        '<circle cx="58" cy="14" r="3.6"/>' +
      '</g>' +
      '<ellipse cx="57" cy="21" rx="4.6" ry="3.2" fill="#f3c4b6"/>' +
      '<circle cx="60" cy="21" r="1.3" fill="#2b1c1c"/>' +
      '<circle cx="52" cy="16" r="1.15" fill="#2b1c1c"/>' +
      '<path d="M44 23 Q51 28 56 22" stroke="#f2d36a" stroke-width="1.7" fill="none"/>' +
      '</svg>';
  }

  function spriteDuck() {
    return '<svg class="sprite" viewBox="0 0 52 36" width="46" height="32">' +
      '<ellipse cx="20" cy="20" rx="13" ry="8" fill="#fffaf3"/>' +
      '<ellipse cx="15" cy="20" rx="7" ry="4.2" fill="#efe4d2"/>' +
      '<circle cx="31" cy="15" r="6.5" fill="#fffaf3"/>' +
      '<polygon points="36,14 49,17 36,19" fill="#f0a020"/>' +
      '<circle cx="33" cy="14" r="1.15" fill="#222"/>' +
      '<path d="M14 27 l-5 6 M22 27 l4 6" stroke="#e09020" stroke-width="1.7" fill="none" stroke-linecap="round"/>' +
      '</svg>';
  }

  function spriteChicken(color) {
    return '<svg class="sprite" viewBox="0 0 44 38" width="36" height="32">' +
      '<ellipse cx="16" cy="22" rx="11" ry="8" fill="' + color + '"/>' +
      '<g class="head-peck">' +
        '<circle cx="27" cy="16" r="6.2" fill="' + color + '"/>' +
        '<path d="M23 9 l2.2 5.2 l3.2 -5 l2.4 5" fill="#d32020"/>' +
        '<polygon points="31,15 40,17.2 31,19" fill="#f0a020"/>' +
        '<circle cx="29" cy="15" r="1" fill="#222"/>' +
        '<path d="M26 20 q2 3.2 0 4.2" fill="#d32020"/>' +
      '</g>' +
      '<path d="M12 29 l-3 6 M18 29 l3 6" stroke="#e09020" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
      '</svg>';
  }

  function spriteWizard() {
    return '<svg class="sprite" viewBox="0 0 156 112" width="156" height="112">' +
      '<g class="digger">' +
        '<rect x="6" y="78" width="78" height="18" rx="8" fill="#242424"/>' +
        '<circle class="cogs" cx="22" cy="88" r="7" fill="#3a3a3a" stroke="#111" stroke-width="2"/>' +
        '<circle class="cogs" cx="42" cy="88" r="7" fill="#3a3a3a" stroke="#111" stroke-width="2"/>' +
        '<circle class="cogs" cx="62" cy="88" r="7" fill="#3a3a3a" stroke="#111" stroke-width="2"/>' +
        '<rect x="16" y="60" width="62" height="20" rx="3" fill="#e2b325"/>' +
        '<path d="M40 60 L42 40 L78 40 L80 60 Z" fill="#f0d056"/>' +
        '<rect class="glow-win" x="50" y="44" width="20" height="12" rx="1"/>' +
        '<g class="boom">' +
          '<rect x="0" y="58" width="34" height="7" rx="2" fill="#c49612"/>' +
          '<g class="bucket"><path d="M0 52 h12 l4 16 h-16 z" fill="#667077"/></g>' +
        '</g>' +
      '</g>' +
      '<g class="person">' +
        '<path d="M96 100 L86 62 L112 52 L126 100 Z" fill="#2c3f90"/>' +
        '<path d="M100 58 Q104 82 96 98 Q112 86 118 60 Q110 66 100 58" fill="#d5d8dc"/>' +
        '<circle cx="112" cy="50" r="9" fill="#f0c9a0"/>' +
        '<circle cx="116" cy="49" r="1.2" fill="#222"/>' +
        '<path d="M96 50 L114 8 L132 50 Z" fill="#3c2a78"/>' +
        '<rect x="90" y="46" width="42" height="6" rx="2" fill="#3c2a78"/>' +
        '<circle cx="110" cy="28" r="1.5" fill="#ffe38a"/>' +
        '<circle cx="118" cy="20" r="1.1" fill="#ffe38a"/>' +
        '<circle cx="106" cy="34" r="1" fill="#ffe38a"/>' +
      '</g>' +
      '<g class="spade">' +
        '<rect x="124" y="58" width="4" height="36" rx="1" fill="#6b4428"/>' +
        '<path d="M118 92 h16 l-4 12 h-12 z" fill="#8d949a"/>' +
      '</g>' +
      '<g class="clods">' +
        '<circle class="clod" cx="132" cy="104" r="3.2" fill="#6b4a2a"/>' +
        '<circle class="clod c2" cx="142" cy="106" r="2.4" fill="#7a5530"/>' +
        '<circle class="clod c3" cx="124" cy="106" r="2.2" fill="#5c3e24"/>' +
      '</g>' +
      '</svg>';
  }

  function critterEl(cls, svg) {
    var el = document.createElement('div');
    el.className = 'critter ' + cls;
    el.innerHTML = '<div class="face">' + svg + '</div><div class="shadow"></div>';
    crittersEl.appendChild(el);
    return el;
  }

  function placeCritter(c) {
    c.el.style.transform = 'translate3d(' + c.x.toFixed(2) + 'px,' + c.y.toFixed(2) + 'px,0) translate(-50%,-100%)';
    c.el.classList.toggle('moving', !!c.moving);
    var flip = c.facing < 0 ? 'scaleX(-1)' : 'scaleX(1)';
    if (c._flip !== flip && c.face) {
      c._flip = flip;
      c.face.style.transform = flip;
    }
  }

  function createAnimals() {
    var p = BAND.paddock;
    var ground = p.y + p.h - 18;
    var bounds = { minX: p.x + 48, maxX: p.x + p.w - 120, ground: ground };
    for (var i = 0; i < 2; i++) {
      var el = critterEl('horse', spriteHorse());
      var x = bounds.minX + 24 + i * 150;
      critters.push({
        kind: 'horse', el: el, face: el.querySelector('.face'),
        x: x, y: ground, tx: i === 0 ? x + 100 : x, wait: i === 0 ? 0.4 : 5,
        speed: 24 + i * 4, facing: 1, bounds: bounds, moving: i === 0
      });
    }

    var loop = [
      { x: 36, y: BAND.chickens.y + 28 },
      { x: 150, y: BAND.chickens.y + 12 },
      { x: 250, y: BAND.chickens.y + 48 },
      { x: 190, y: BAND.chickens.y + 62 },
      { x: 80, y: BAND.chickens.y + 40 },
      { x: 300, y: BAND.chickens.y + 22 }
    ];
    for (var d = 0; d < 2; d++) {
      var pel = critterEl('poodle', spritePoodle());
      var start = loop[d * 3];
      critters.push({
        kind: 'poodle', el: pel, face: pel.querySelector('.face'),
        x: start.x, y: start.y, points: loop, i: d * 3,
        speed: 70 + d * 10, facing: 1, moving: true
      });
    }

    for (var k = 0; k < 6; k++) {
      var duckEl = critterEl('duck', spriteDuck());
      critters.push({
        kind: 'duck', el: duckEl, face: duckEl.querySelector('.face'),
        angle: (Math.PI * 2 * k) / 6,
        speed: 0.34 + (k % 3) * 0.06,
        x: 0, y: 0, facing: 1, moving: true
      });
    }

    var yard = BAND.chickens;
    for (var c = 0; c < 12; c++) {
      var cel = critterEl('chicken', spriteChicken(CHICKEN_COLORS[c % CHICKEN_COLORS.length]));
      var head = cel.querySelector('.head-peck');
      if (head) head.style.animationDelay = (c * 0.17) + 's';
      var cx = yard.x + 16 + (c % 6) * 46;
      var cy = yard.y + yard.h - 8 - (c % 3) * 10;
      critters.push({
        kind: 'chicken', el: cel, face: cel.querySelector('.face'),
        x: cx, y: cy, tx: cx, ty: cy,
        bounds: yard, wait: (c % 4) * 0.4, speed: 18, facing: c % 2 ? 1 : -1,
        moving: c % 3 === 0
      });
    }

    var wel = critterEl('wizard dig', spriteWizard());
    wizard = {
      kind: 'wizard', el: wel, face: wel.querySelector('.face'),
      x: 400, y: BAND.yard.y + BAND.yard.h - 4,
      digX: 392, driveMin: 330, driveMax: 430,
      feetY: BAND.yard.y + BAND.yard.h - 4,
      t: 1, mode: 'dig', facing: 1, moving: false
    };
    critters.push(wizard);
  }

  function stepCritters(dt) {
    for (var i = 0; i < critters.length; i++) {
      var c = critters[i];
      if (c.kind === 'horse') stepHorse(c, dt);
      else if (c.kind === 'poodle') stepPoodle(c, dt);
      else if (c.kind === 'duck') stepDuck(c, dt);
      else if (c.kind === 'chicken') stepChicken(c, dt);
      else if (c.kind === 'wizard') stepWizard(c, dt);
      placeCritter(c);
    }
  }

  function stepHorse(h, dt) {
    if (Math.abs(h.tx - h.x) < 2) {
      h.moving = false;
      h.wait -= dt;
      if (h.wait <= 0) {
        h.tx = h.bounds.minX + Math.random() * (h.bounds.maxX - h.bounds.minX);
        h.wait = 5 + Math.random() * 8;
      }
    } else {
      var dir = Math.sign(h.tx - h.x);
      h.x += dir * h.speed * dt;
      h.facing = dir || h.facing;
      h.moving = true;
    }
    h.y = h.bounds.ground;
  }

  function stepPoodle(p, dt) {
    var target = p.points[p.i];
    var dx = target.x - p.x;
    var dy = target.y - p.y;
    var dist = Math.hypot(dx, dy);
    if (dist < 4) p.i = (p.i + 1) % p.points.length;
    else {
      p.x += (dx / dist) * p.speed * dt;
      p.y += (dy / dist) * p.speed * dt;
      if (Math.abs(dx) > 1) p.facing = dx > 0 ? 1 : -1;
    }
    p.moving = true;
  }

  function stepDuck(d, dt) {
    d.angle += d.speed * dt;
    var pond = BAND.pond;
    d.x = pond.cx + Math.cos(d.angle) * pond.rx * 0.78;
    d.y = pond.cy + Math.sin(d.angle) * pond.ry + 14;
    d.facing = -Math.sin(d.angle) >= 0 ? 1 : -1;
    d.moving = true;
  }

  function stepChicken(c, dt) {
    if (c.moving) {
      var dx = c.tx - c.x;
      var dy = c.ty - c.y;
      var dist = Math.hypot(dx, dy);
      if (dist < 2) {
        c.moving = false;
        c.wait = 0.7 + Math.random() * 2.4;
      } else {
        var step = Math.min(dist, c.speed * dt);
        c.x += (dx / dist) * step;
        c.y += (dy / dist) * step;
        if (Math.abs(dx) > 0.4) c.facing = dx > 0 ? 1 : -1;
      }
    } else {
      c.wait -= dt;
      if (c.wait <= 0) {
        var b = c.bounds;
        c.tx = b.x + 8 + Math.random() * (b.w - 24);
        c.ty = b.y + b.h - 6 - Math.random() * 28;
        c.moving = true;
      }
    }
  }

  function stepWizard(w, dt) {
    w.t += dt;
    var u = w.t % 18;
    var prev = w.x;
    if (u < 7) {
      w.mode = 'dig';
      w.x += (w.digX - w.x) * Math.min(1, dt * 2.5);
      w.facing = 1;
      w.moving = Math.abs(w.digX - prev) > 0.4;
    } else {
      w.mode = 'drive';
      var k = (u - 7) / 11;
      var ping = k < 0.5 ? k * 2 : (1 - k) * 2;
      var target = w.driveMin + ping * (w.driveMax - w.driveMin);
      w.facing = target >= prev ? 1 : -1;
      w.x = target;
      w.moving = true;
    }
    w.y = w.feetY;
    w.el.classList.toggle('dig', w.mode === 'dig');
    w.el.classList.toggle('drive', w.mode === 'drive');
  }

  function buildScenery() {
    room.x = FARM_W + 16;
    room.y = HEADER_H + 156;
    room.w = STAGE_W - FARM_W - 16 - 36;
    room.h = FARM_H - 156 - 14;
    scene.innerHTML =
      '<div id="farm">' + farmMarkup() + '</div>' +
      '<div id="hut">' + hutMarkup() + '</div>' +
      '<div id="zones"></div>' +
      '<svg id="links" viewBox="0 0 1920 1080"></svg>' +
      '<div id="folk"></div>';
    var farm = document.getElementById('farm');
    crittersEl = document.createElement('div');
    crittersEl.id = 'critters';
    farm.appendChild(crittersEl);
    zonesEl = document.getElementById('zones');
    folk = document.getElementById('folk');
    links = document.getElementById('links');
    sunEl = farm.querySelector('.sun');
    moonEl = farm.querySelector('.moon');
    fillStars();
    createAnimals();
  }

  function chooseGrid(n, w, h) {
    var best = null;
    for (var cols = 1; cols <= n; cols++) {
      var rows = Math.ceil(n / cols);
      var cellW = w / cols;
      var cellH = h / rows;
      var usable = cellW >= 140 && cellH >= 88;
      var wide = cellW >= 176;
      var tall = cellH >= 96;
      var score = (usable ? 500 : 0) + (wide ? 400 : 0) + (tall ? 500 : 0) + Math.min(cellW, 230) + cellH * 1.2;
      if (!best || score > best.score) best = { cols: cols, rows: rows, cellW: cellW, cellH: cellH, score: score };
    }
    return best;
  }

  function groupBots(list) {
    var map = new Map();
    var order = [];
    list.forEach(function (bot) {
      if (!map.has(bot.team)) {
        map.set(bot.team, []);
        order.push(bot.team);
      }
      map.get(bot.team).push(bot);
    });
    var pref = { grok: 0, buzz: 1 };
    order.sort(function (a, b) {
      var ia = pref[a] == null ? 10 : pref[a];
      var ib = pref[b] == null ? 10 : pref[b];
      return ia - ib;
    });
    return order.map(function (team) { return { team: team, bots: map.get(team) }; });
  }

  function allocateZones(teams) {
    var gap = 10;
    var n = teams.length || 1;
    var usable = room.h - gap * Math.max(0, teams.length - 1);
    var total = 0;
    teams.forEach(function (t) { total += t.bots.length; });
    total = total || 1;
    function minFor(count) {
      if (count > 16) return 470;
      if (count > 8) return 300;
      return 210;
    }
    var zones = teams.map(function (t) {
      return { team: t.team, bots: t.bots, h: usable * (t.bots.length / total) };
    });
    for (var pass = 0; pass < 5; pass++) {
      var deficit = 0;
      var donors = [];
      zones.forEach(function (z) {
        var m = Math.min(minFor(z.bots.length), usable / n);
        if (z.h < m) {
          deficit += m - z.h;
          z.h = m;
        } else donors.push(z);
      });
      if (deficit < 0.5 || !donors.length) break;
      var sum = donors.reduce(function (s, z) { return s + z.h; }, 0) || 1;
      donors.forEach(function (z) {
        var m = Math.min(minFor(z.bots.length), usable / n);
        var give = Math.min(deficit * (z.h / sum), Math.max(0, z.h - m));
        z.h -= give;
      });
    }
    var sumH = zones.reduce(function (s, z) { return s + z.h; }, 0) || 1;
    var scale = usable / sumH;
    var y = room.y;
    zones.forEach(function (z, i) {
      z.h = i === zones.length - 1 ? (room.y + room.h - y) : Math.round(z.h * scale);
      z.x = room.x;
      z.y = y;
      z.w = room.w;
      y += z.h + gap;
    });
    return zones;
  }

  function addProp(cls, x, y, html) {
    var el = document.createElement('div');
    el.className = 'prop ' + cls;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.transform = 'translate(-50%, -100%)';
    el.innerHTML = html;
    zonesEl.appendChild(el);
    return el;
  }

  function layoutZone(zone) {
    var titleH = 36;
    var breakH = zone.h > 430 ? 78 : 66;
    var bubblePad = zone.h > 430 ? 16 : 8;
    var gridX = zone.x + 10;
    var gridY = zone.y + titleH + bubblePad;
    var gridW = zone.w - 20;
    var gridH = Math.max(80, zone.h - titleH - bubblePad - breakH);
    var grid = chooseGrid(zone.bots.length, gridW, gridH);
    zone.grid = grid;
    zone.breakH = breakH;
    zone.laneY = zone.y + zone.h - breakH * 0.62;
    var breakY = zone.y + zone.h - breakH * 0.42;
    zone.kettle = { x: zone.x + 92, y: breakY };
    zone.sofa = { x: zone.x + Math.min(380, zone.w * 0.3), y: breakY + 2 };
    zone.table = { x: zone.x + zone.w * 0.52, y: breakY };
    zone.windowSpot = { x: zone.x + zone.w - 78, y: zone.y + 148 };
    zone.bots.forEach(function (bot, i) {
      var col = i % grid.cols;
      var row = Math.floor(i / grid.cols);
      bot.deskX = gridX + col * grid.cellW + grid.cellW / 2;
      bot.deskY = gridY + row * grid.cellH + grid.cellH * 0.82;
      bot.cellW = grid.cellW;
    });
    zone.spots = [
      { id: 'kettle', x: zone.kettle.x + 8, y: zone.kettle.y, kind: 'kettle' },
      { id: 'kettle2', x: zone.kettle.x + 58, y: zone.kettle.y + 4, kind: 'kettle' },
      { id: 'sofa', x: zone.sofa.x - 36, y: zone.sofa.y, kind: 'sofa' },
      { id: 'sofa2', x: zone.sofa.x + 40, y: zone.sofa.y + 2, kind: 'sofa' },
      { id: 'window', x: zone.windowSpot.x, y: zone.windowSpot.y, kind: 'window' }
    ];
    var laneXs = [0.22, 0.4, 0.58, 0.74, 0.9];
    laneXs.forEach(function (t, i) {
      zone.spots.push({ id: 'lane-' + i, x: zone.x + zone.w * t, y: zone.laneY });
    });
    zone.bots.forEach(function (bot, i) {
      zone.spots.push({
        id: 'pass-' + bot.id,
        x: bot.deskX + (i % 3 === 0 ? -34 : i % 3 === 1 ? 34 : 0),
        y: Math.min(zone.y + zone.h - 20, bot.deskY + 42)
      });
    });

    var rug = document.createElement('section');
    rug.className = 'zone team-' + zone.team;
    rug.dataset.team = zone.team;
    rug.style.left = zone.x + 'px';
    rug.style.top = zone.y + 'px';
    rug.style.width = zone.w + 'px';
    rug.style.height = zone.h + 'px';
    var h2 = document.createElement('h2');
    h2.textContent = teamLabel(zone.team);
    rug.appendChild(h2);
    zonesEl.appendChild(rug);

    addProp('kettle', zone.kettle.x, zone.kettle.y - 16,
      '<div class="steam"><i></i><i></i><i></i></div><div class="pot"></div><div class="handle"></div><div class="spout"></div><div class="cafetiere"></div>');
    addProp('sofa', zone.sofa.x, zone.sofa.y - 8,
      '<div class="back"></div><div class="seat"></div><div class="arm l"></div><div class="arm r"></div>');
    addProp('table', zone.table.x, zone.table.y - 6, '<div class="top"></div>');
    addProp('plant', zone.x + zone.w - 36, zone.y + 78, '<div class="leaf"></div><div class="pot"></div>');
    if (zone.team === 'grok') {
      addProp('stove', zone.kettle.x - 54, zone.kettle.y - 4, '<div class="body"></div><div class="door"></div>');
    }
  }

  function makeAgent(bot, zone) {
    var el = document.createElement('div');
    el.className = 'actor';
    el.dataset.id = bot.id;
    el.title = bot.role ? bot.name + ' — ' + bot.role : bot.name;
    el.style.setProperty('--plate', Math.max(78, Math.floor(bot.cellW - 16)) + 'px');
    el.style.setProperty('--ring', RINGS[bot.team] || '#e6d3b4');
    el.style.setProperty('--sweater', sweater(bot.team, bot.id));

    var bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.hidden = true;
    var plate = document.createElement('div');
    plate.className = 'plate';
    var name = document.createElement('div');
    name.className = 'name';
    name.textContent = displayName(bot.name);
    name.dataset.full = bot.name;
    var st = document.createElement('div');
    st.className = 'st idle';
    st.textContent = 'Idle';
    plate.append(name, st);
    var fig = document.createElement('div');
    fig.className = 'fig';
    var head = document.createElement('div');
    head.className = 'head';
    head.textContent = bot.emoji || '🤖';
    var flip = document.createElement('div');
    flip.className = 'flip';
    flip.innerHTML = '<div class="torso"></div><i class="arm a"></i><i class="arm b"></i><i class="leg a"></i><i class="leg b"></i>';
    fig.append(head, flip);
    var shadow = document.createElement('div');
    shadow.className = 'shadow';
    el.append(bubble, plate, fig, shadow);

    var desk = document.createElement('div');
    desk.className = 'desk';
    desk.innerHTML = '<div class="mon"></div><div class="top"></div>';
    desk.style.transform = 'translate3d(' + bot.deskX + 'px,' + (bot.deskY + 12) + 'px,0) translate(-50%,-100%)';
    desk.style.zIndex = String(1700 + Math.round(bot.deskY));
    folk.appendChild(desk);
    folk.appendChild(el);
    fitName(name);

    return {
      id: bot.id,
      name: bot.name,
      team: bot.team,
      el: el,
      bubble: bubble,
      st: st,
      flip: flip,
      deskEl: desk,
      zone: zone,
      deskX: bot.deskX,
      deskY: bot.deskY,
      x: bot.deskX + ((hash(bot.id) % 2) ? 36 : -36),
      y: bot.deskY - 8,
      facing: 1,
      path: [],
      state: 'idle',
      task: '',
      with: [],
      mode: '',
      destKey: '',
      settled: false,
      walking: false,
      dwell: 0,
      speed: 72 + (hash(bot.id) % 28),
      sig: '',
      spot: null
    };
  }

  function mount(list) {
    zonesEl.replaceChildren();
    folk.replaceChildren();
    linkPool.forEach(function (path) { path.remove(); });
    linkPool.clear();
    agents = [];
    byId = new Map();
    zonesByTeam = new Map();
    var grouped = groupBots(list);
    var zones = allocateZones(grouped);
    zones.forEach(layoutZone);
    zones.forEach(function (z) { zonesByTeam.set(z.team, z); });
    if (zones.length >= 2) {
      sharedTable = {
        x: room.x + room.w - 130,
        y: zones[0].y + zones[0].h - 8
      };
    } else if (zones.length === 1) {
      sharedTable = { x: zones[0].table.x, y: zones[0].table.y };
    }
    addProp('table shared', sharedTable.x, sharedTable.y - 4, '<div class="top"></div>');
    list.forEach(function (bot) {
      var zone = zonesByTeam.get(bot.team) || zones[0];
      var agent = makeAgent(bot, zone);
      agents.push(agent);
      byId.set(bot.id, agent);
    });
    if (DEBUG) {
      console.log('SR Bot Office zones', zones.map(function (z) {
        return z.team + ' ' + Math.round(z.w) + 'x' + Math.round(z.h) + ' grid ' + z.grid.cols + 'x' + z.grid.rows;
      }));
    }
  }

  function route(agent, dest) {
    var path = [];
    var dx = dest.x - agent.x;
    var dy = dest.y - agent.y;
    var dist = Math.hypot(dx, dy);
    if (dist > 140) {
      var nx = -dy / dist;
      var ny = dx / dist;
      var bend = ((hash(agent.id + ':' + Math.round(dest.x) + ':' + Math.round(dest.y)) % 7) - 3) * 22;
      path.push({
        x: clamp((agent.x + dest.x) / 2 + nx * bend, agent.zone.x + 24, agent.zone.x + agent.zone.w - 24),
        y: clamp((agent.y + dest.y) / 2 + ny * bend, agent.zone.y + 56, agent.zone.y + agent.zone.h - 16)
      });
    }
    path.push({ x: dest.x, y: dest.y });
    return path;
  }

  function fitName(nameEl) {
    nameEl.style.transform = '';
    var plate = nameEl.parentNode;
    if (!plate) return;
    var avail = plate.clientWidth - 8;
    var need = nameEl.scrollWidth;
    if (avail > 20 && need > avail) {
      nameEl.style.transform = 'scaleX(' + Math.max(0.78, avail / need).toFixed(3) + ')';
    }
  }

  function spotCrowded(agent, spot) {
    for (var i = 0; i < agents.length; i++) {
      var other = agents[i];
      if (other === agent || other.zone !== agent.zone) continue;
      if (other.spot === spot) return true;
      if (Math.hypot(other.x - spot.x, other.y - spot.y) < 96) return true;
    }
    return false;
  }

  function countIdleWalking() {
    var n = 0;
    for (var i = 0; i < agents.length; i++) {
      if (agents[i].state === 'idle' && agents[i].walking) n++;
    }
    return n;
  }

  function pickWander(agent, preferNear) {
    var spots = agent.zone.spots;
    var social = spots.filter(function (s) { return s.kind === 'kettle' || s.kind === 'sofa' || s.kind === 'window'; });
    var floorSpots = spots.filter(function (s) { return !s.kind; });
    if (!floorSpots.length) floorSpots = spots;
    var spot = null;
    if (preferNear) {
      var nearby = spots.filter(function (candidate) {
        var d = Math.hypot(candidate.x - agent.x, candidate.y - agent.y);
        return d > 24 && d < 170 && !spotCrowded(agent, candidate);
      });
      if (nearby.length) spot = nearby[(Math.random() * nearby.length) | 0];
    }
    if (!spot && social.length && Math.random() < 0.42) {
      for (var s = 0; s < 6; s++) {
        var socialSpot = social[(Math.random() * social.length) | 0];
        if (Math.hypot(socialSpot.x - agent.x, socialSpot.y - agent.y) < 70) continue;
        if (!spotCrowded(agent, socialSpot)) { spot = socialSpot; break; }
      }
    }
    if (!spot) {
      var far = floorSpots.filter(function (candidate) {
        return candidate !== agent.spot && Math.hypot(candidate.x - agent.x, candidate.y - agent.y) > 120;
      });
      var pool = far.length ? far : floorSpots;
      spot = pool[(Math.random() * pool.length) | 0];
      for (var t = 0; t < 10; t++) {
        var candidate = pool[(Math.random() * pool.length) | 0];
        spot = candidate;
        if (!spotCrowded(agent, candidate)) break;
      }
    }
    agent.spot = spot;
    agent.path = route(agent, spot);
    agent.settled = false;
    agent.dwell = spot.kind === 'kettle' ? 6 + Math.random() * 6 : 3.2 + Math.random() * 4.2;
    agent.destKey = 'wander:' + spot.id;
  }

  function assignMeetings() {
    var collab = agents.filter(function (a) { return a.state === 'collaborating'; });
    var parent = new Map();
    collab.forEach(function (a) { parent.set(a.id, a.id); });
    function find(id) {
      var p = parent.get(id);
      if (p == null) return id;
      while (parent.get(p) !== p) {
        parent.set(p, parent.get(parent.get(p)));
        p = parent.get(p);
      }
      return p;
    }
    function union(a, b) {
      if (!parent.has(a) || !parent.has(b)) return;
      var pa = find(a);
      var pb = find(b);
      if (pa !== pb) parent.set(pa, pb);
    }
    collab.forEach(function (a) {
      (a.with || []).forEach(function (id) { union(a.id, id); });
    });
    var groups = new Map();
    collab.forEach(function (a) {
      var p = find(a.id);
      if (!groups.has(p)) groups.set(p, []);
      groups.get(p).push(a);
    });
    groups.forEach(function (group) {
      var teams = {};
      group.forEach(function (a) { teams[a.team] = true; });
      var cross = Object.keys(teams).length > 1;
      var table = cross ? sharedTable : group[0].zone.table;
      if (group.length === 2) {
        group[0].meet = { x: table.x - 46, y: table.y + 10 };
        group[1].meet = { x: table.x + 46, y: table.y + 10 };
      } else {
        group.forEach(function (a, i) {
          var ang = -Math.PI / 2 + (i / group.length) * Math.PI * 2;
          var rad = 34 + group.length * 8;
          a.meet = { x: table.x + Math.cos(ang) * rad, y: table.y + Math.sin(ang) * rad * 0.62 };
        });
      }
      group.forEach(function (a) {
        a.meet.x = clamp(a.meet.x, room.x + 28, room.x + room.w - 28);
        a.meet.y = clamp(a.meet.y, room.y + 36, room.y + room.h - 18);
      });
    });
  }

  function retarget(agent) {
    var dest;
    if (agent.state === 'working' || agent.state === 'offline') dest = { x: agent.deskX, y: agent.deskY };
    else if (agent.state === 'collaborating') dest = agent.meet || { x: agent.zone.table.x, y: agent.zone.table.y + 8 };
    else return;
    var key = dest.x.toFixed(1) + ',' + dest.y.toFixed(1);
    if (agent.destKey === key) return;
    agent.destKey = key;
    agent.path = route(agent, dest);
    agent.settled = false;
  }

  function follow(agent, dt) {
    var speed = agent.state === 'idle' ? agent.speed * 0.92 : agent.speed;
    if (!agent.path || !agent.path.length) {
      agent.walking = false;
      agent.settled = true;
      return;
    }
    var p = agent.path[0];
    var dx = p.x - agent.x;
    var dy = p.y - agent.y;
    var dist = Math.hypot(dx, dy);
    if (dist < 3) {
      agent.x = p.x;
      agent.y = p.y;
      agent.path.shift();
      agent.walking = agent.path.length > 0;
      agent.settled = agent.path.length === 0;
      return;
    }
    var step = Math.min(dist, speed * dt);
    agent.x += (dx / dist) * step;
    agent.y += (dy / dist) * step;
    if (dx < -0.6) agent.facing = -1;
    else if (dx > 0.6) agent.facing = 1;
    agent.walking = true;
    agent.settled = false;
  }

  function separate(list) {
    var min = 36;
    for (var i = 0; i < list.length; i++) {
      for (var j = i + 1; j < list.length; j++) {
        var a = list[i];
        var b = list[j];
        if (a.settled && b.settled) continue;
        var dx = b.x - a.x;
        var dy = b.y - a.y;
        var d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 < 0.01) continue;
        var d = Math.sqrt(d2);
        var push = (min - d) * 0.5;
        dx /= d;
        dy /= d;
        if (!a.settled) { a.x -= dx * push; a.y -= dy * push; }
        if (!b.settled) { b.x += dx * push; b.y += dy * push; }
      }
    }
  }

  function clampAgent(a) {
    var dest = a.path && a.path.length ? a.path[a.path.length - 1] : { x: a.x, y: a.y };
    var minX = Math.min(a.zone.x, dest.x) + 8;
    var maxX = Math.max(a.zone.x + a.zone.w, dest.x) - 8;
    var minY = Math.min(a.zone.y + 124, dest.y);
    var maxY = Math.max(a.zone.y + a.zone.h - 8, dest.y);
    a.x = clamp(a.x, minX, maxX);
    a.y = clamp(a.y, minY, maxY);
  }

  function drawAgent(agent) {
    var sitting = agent.settled && !agent.walking && (agent.state === 'working' || agent.state === 'offline');
    var drawY = agent.y + (sitting ? 16 : 0);
    agent.el.style.transform = 'translate3d(' + agent.x.toFixed(2) + 'px,' + drawY.toFixed(2) + 'px,0) translate(-50%,-100%)';
    agent.el.style.zIndex = String(1500 + Math.round(agent.y));
    var flip = agent.facing < 0 ? 'scaleX(-1)' : 'scaleX(1)';
    if (agent._flip !== flip) {
      agent._flip = flip;
      agent.flip.style.transform = flip;
    }
    var typing = agent.settled && !agent.walking && agent.state === 'working';
    agent.el.classList.toggle('walking', agent.walking);
    agent.el.classList.toggle('sitting', sitting);
    agent.el.classList.toggle('typing', typing);
    agent.el.classList.toggle('offline', agent.state === 'offline');
    if (agent._state !== agent.state) {
      agent._state = agent.state;
      agent.st.textContent = STATE_LABEL[agent.state] || 'Idle';
      agent.st.className = 'st ' + agent.state;
    }
    var text = '';
    if (agent.state === 'working' || agent.state === 'collaborating') {
      text = agent.task || (agent.state === 'collaborating' ? 'Working together' : '');
    }
    if (agent._bubble !== text) {
      agent._bubble = text;
      agent.bubble.hidden = !text;
      agent.bubble.textContent = text;
    }
    if (agent.deskEl && agent._deskOn !== typing) {
      agent._deskOn = typing;
      agent.deskEl.classList.toggle('active', typing);
    }
  }

  function stepAgents(dt) {
    for (var i = 0; i < agents.length; i++) {
      var agent = agents[i];
      if (agent.state === 'idle') {
        if (agent.mode !== 'idle') {
          agent.mode = 'idle';
          agent.destKey = '';
          pickWander(agent, true);
        } else if (agent.settled) {
          agent.dwell -= dt;
          if (agent.dwell <= 0) {
            if (countIdleWalking() < 8) pickWander(agent, false);
            else agent.dwell = 0.35 + Math.random() * 0.7;
          }
        }
      } else {
        if (agent.mode !== agent.state) {
          agent.mode = agent.state;
          agent.destKey = '';
        }
        retarget(agent);
      }
      follow(agent, dt);
    }
    separate(agents);
    for (var j = 0; j < agents.length; j++) {
      clampAgent(agents[j]);
      drawAgent(agents[j]);
    }
    renderLinks();
  }

  function renderLinks() {
    var want = new Set();
    agents.forEach(function (a) {
      if (a.state !== 'collaborating') return;
      (a.with || []).forEach(function (id) {
        var b = byId.get(id);
        if (!b || b.state !== 'collaborating') return;
        var key = a.id < id ? a.id + '|' + id : id + '|' + a.id;
        if (want.has(key)) return;
        want.add(key);
        var path = linkPool.get(key);
        if (!path) {
          path = document.createElementNS(SVG_NS, 'path');
          path.setAttribute('class', 'link');
          links.appendChild(path);
          linkPool.set(key, path);
        }
        var x1 = a.x;
        var y1 = a.y - 70;
        var x2 = b.x;
        var y2 = b.y - 70;
        var mx = (x1 + x2) / 2;
        var my = Math.min(y1, y2) - 26;
        path.setAttribute('d', 'M ' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' Q ' + mx.toFixed(1) + ' ' + my.toFixed(1) + ' ' + x2.toFixed(1) + ' ' + y2.toFixed(1));
      });
    });
    linkPool.forEach(function (path, key) {
      if (!want.has(key)) {
        path.remove();
        linkPool.delete(key);
      }
    });
  }

  function asIds(value) {
    if (Array.isArray(value)) return value.map(function (v) { return String(v).trim(); }).filter(Boolean);
    if (typeof value === 'string' && value.trim()) {
      return value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    }
    return [];
  }

  function effective(entry) {
    if (!entry) return { state: 'idle', task: '', with: [] };
    var state = String(entry.state || 'idle');
    if (['working', 'idle', 'collaborating', 'offline'].indexOf(state) === -1) state = 'idle';
    var updated = Date.parse(entry.updated_at || entry.at || '');
    var stale = !isFinite(updated) || (Date.now() - updated > STALE_MS);
    if (stale && state !== 'offline') return { state: 'idle', task: '', with: [] };
    var task = String(entry.task || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return { state: state, task: task, with: asIds(entry.with) };
  }

  function pulse(agent) {
    agent.el.classList.remove('flash');
    void agent.el.offsetWidth;
    agent.el.classList.add('flash');
  }

  function applyStatus(data, opts) {
    opts = opts || {};
    var list = Array.isArray(data) ? data : ((data && data.bots) || []);
    var entries = new Map();
    list.forEach(function (entry) {
      if (entry && entry.id) entries.set(entry.id, entry);
    });
    agents.forEach(function (agent) {
      var eff = effective(entries.get(agent.id));
      var withIds = eff.with.filter(function (id) { return byId.has(id) && id !== agent.id; });
      var sig = eff.state + '|' + eff.task + '|' + withIds.join(',');
      var changed = agent.sig && agent.sig !== sig;
      agent.state = eff.state;
      agent.task = eff.task;
      agent.with = withIds;
      agent.sig = sig;
      if (opts.force || changed) agent.mode = '';
      if (opts.flash && changed) pulse(agent);
    });
    assignMeetings();
    updateCounts();
    var history = Array.isArray(data) ? [] : ((data && data.history) || []);
    renderTicker(history.slice(-5).reverse());
  }

  function seedDemo() {
    agents.forEach(function (a) {
      a.state = 'idle';
      a.task = '';
      a.with = [];
      a.mode = '';
      a.sig = '';
      a.destKey = '';
    });
    function set(id, state, task, withIds) {
      var a = byId.get(id);
      if (!a) return;
      a.state = state;
      a.task = task || '';
      a.with = withIds || [];
    }
    set('kelvin', 'working', 'Weekly SEO check');
    set('eden', 'collaborating', 'Morning standup', ['grace']);
    set('grace', 'collaborating', 'Morning standup', ['eden']);
    set('merlin', 'working', 'Market open scan');
    set('amber', 'working', 'Inbox sweep');
    set('scout', 'working', 'Overnight digest');
    set('phoenix', 'working', 'Front desk cover');
    set('sr-planner-agent', 'offline', 'Parked');
    var now = Date.now();
    demoHistory = [
      { id: 'amber', state: 'working', task: 'Inbox sweep', with: [], at: new Date(now - 8 * 60000).toISOString() },
      { id: 'scout', state: 'working', task: 'Overnight digest', with: [], at: new Date(now - 6 * 60000).toISOString() },
      { id: 'merlin', state: 'working', task: 'Market open scan', with: [], at: new Date(now - 4 * 60000).toISOString() },
      { id: 'eden', state: 'collaborating', task: 'Morning standup', with: ['grace'], at: new Date(now - 2 * 60000).toISOString() },
      { id: 'kelvin', state: 'working', task: 'Weekly SEO check', with: [], at: new Date(now).toISOString() }
    ];
    assignMeetings();
    updateCounts();
    renderTicker(demoHistory.slice(-5).reverse());
  }

  function demoTick() {
    var pool = agents.filter(function (a) { return a.id !== 'sr-planner-agent'; });
    var picks = pool.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 3);
    var now = new Date().toISOString();
    picks.forEach(function (a) {
      var roll = Math.random();
      if (roll < 0.5) {
        a.state = 'working';
        a.task = pick(DEMO_TASKS);
        a.with = [];
      } else if (roll < 0.78) {
        var mates = pool.filter(function (b) { return b !== a && b.team === a.team; });
        var m = mates.length ? mates[(Math.random() * mates.length) | 0] : null;
        var task = pick(['Morning standup', 'Desk huddle', 'Handover', 'Review notes']);
        a.state = 'collaborating';
        a.task = task;
        a.with = m ? [m.id] : [];
        if (m) {
          m.state = 'collaborating';
          m.task = task;
          m.with = [a.id];
          m.mode = '';
          demoHistory.push({ id: m.id, state: 'collaborating', task: task, with: m.with.slice(), at: now });
        }
      } else if (roll < 0.92) {
        a.state = 'idle';
        a.task = '';
        a.with = [];
      } else {
        a.state = 'offline';
        a.task = '';
        a.with = [];
      }
      a.mode = '';
      demoHistory.push({ id: a.id, state: a.state, task: a.task, with: (a.with || []).slice(), at: now });
      pulse(a);
    });
    var planner = byId.get('sr-planner-agent');
    if (planner && planner.state !== 'offline') {
      planner.state = 'offline';
      planner.task = 'Parked';
      planner.with = [];
      planner.mode = '';
    }
    if (demoHistory.length > 20) demoHistory.splice(0, demoHistory.length - 20);
    assignMeetings();
    updateCounts();
    renderTicker(demoHistory.slice(-5).reverse());
  }

  function normalizeBots(raw) {
    var seen = new Set();
    var list = [];
    (raw || []).forEach(function (bot) {
      if (!bot || !bot.id || seen.has(bot.id)) return;
      seen.add(String(bot.id));
      list.push({
        id: String(bot.id),
        name: String(bot.name || bot.id),
        emoji: String(bot.emoji || '🤖'),
        team: String(bot.team || 'grok').trim().toLowerCase(),
        role: String(bot.role || '')
      });
    });
    return list;
  }

  function showFatal(msg) {
    var d = document.createElement('div');
    d.className = 'fatal';
    d.textContent = msg;
    stage.appendChild(d);
  }

  async function fetchJson(url) {
    var res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(url + ' ' + res.status);
    return res.json();
  }

  async function load() {
    var bots;
    try {
      bots = normalizeBots(await fetchJson('data/bots.json?ts=' + Date.now()));
    } catch (err) {
      showFatal('Could not load the bot list.');
      return;
    }
    if (!bots.length) {
      showFatal('The bot list is empty.');
      return;
    }
    botSig = JSON.stringify(bots);
    if (!DEMO) {
      try {
        lastStatus = await fetchJson('status.json?ts=' + Date.now());
        setFeed('live');
      } catch (err) {
        lastStatus = null;
        setFeed('error');
      }
    }
    mount(bots);
    if (DEMO) {
      document.getElementById('demo-flag').hidden = false;
      setFeed('demo');
      seedDemo();
      setInterval(demoTick, 10000);
    } else if (lastStatus) {
      applyStatus(lastStatus, { force: true, flash: false });
    } else {
      updateCounts();
      renderTicker([]);
    }
    setInterval(refresh, POLL_MS);
  }

  async function refresh() {
    try {
      var bots = normalizeBots(await fetchJson('data/bots.json?ts=' + Date.now()));
      var sig = JSON.stringify(bots);
      if (sig !== botSig && bots.length) {
        botSig = sig;
        mount(bots);
        if (DEMO) seedDemo();
        else if (lastStatus) applyStatus(lastStatus, { force: true, flash: false });
      }
    } catch (err) { /* keep the roster on screen */ }
    if (DEMO) return;
    try {
      lastStatus = await fetchJson('status.json?ts=' + Date.now());
      applyStatus(lastStatus, { flash: true });
      setFeed('live');
    } catch (err) {
      setFeed('error');
    }
  }

  function isFull() {
    return document.fullscreenElement || document.webkitFullscreenElement;
  }

  function toggleFull() {
    if (isFull()) {
      var exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document);
    } else {
      var el = document.documentElement;
      var req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) req.call(el);
    }
  }

  function syncFullButton() {
    fullBtn.textContent = isFull() ? 'Exit' : 'Fullscreen';
  }

  function bindUi() {
    fullBtn.addEventListener('click', toggleFull);
    document.addEventListener('fullscreenchange', syncFullButton);
    document.addEventListener('webkitfullscreenchange', syncFullButton);
    stage.addEventListener('dblclick', function (event) {
      if (event.target === fullBtn) return;
      toggleFull();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'f' || event.key === 'F') toggleFull();
    });
    var cursorTimer;
    function poke() {
      document.body.classList.remove('hide-cursor');
      clearTimeout(cursorTimer);
      cursorTimer = setTimeout(function () { document.body.classList.add('hide-cursor'); }, 4000);
    }
    document.addEventListener('mousemove', poke, { passive: true });
    document.addEventListener('mousedown', poke, { passive: true });
    document.addEventListener('touchstart', poke, { passive: true });
    poke();
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && !DEMO) refresh();
    });
  }

  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (DEBUG) {
      frames += 1;
      if (now - fpsStamp > 1000) {
        fpsEl.hidden = false;
        fpsEl.textContent = frames + ' fps';
        frames = 0;
        fpsStamp = now;
      }
    }
    stepCritters(dt);
    if (agents.length) stepAgents(dt);
    requestAnimationFrame(frame);
  }

  fit();
  window.addEventListener('resize', fit);
  buildScenery();
  var bootParts = londonParts(new Date());
  lastMinute = bootParts.minute;
  updateSky(bootParts);
  tickClock();
  setInterval(tickClock, 1000);
  bindUi();
  requestAnimationFrame(frame);
  load();

  if (DEBUG) {
    window.__office = {
      agents: function () { return agents; },
      counts: function () {
        return {
          actors: document.querySelectorAll('.actor').length,
          ducks: document.querySelectorAll('.duck').length,
          horses: document.querySelectorAll('.horse').length,
          poodles: document.querySelectorAll('.poodle').length,
          chickens: document.querySelectorAll('.chicken').length,
          wizards: document.querySelectorAll('.wizard').length,
          nearVans: document.querySelectorAll('.caravan.near').length,
          farVans: document.querySelectorAll('.caravan.far').length,
          zones: document.querySelectorAll('.zone').length
        };
      }
    };
  }
})();
