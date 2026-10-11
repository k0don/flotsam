/* ================================================================
   noteset.js — pure note-set generation logic for the Note-Set
   Randomizer. No DOM access (localStorage aside). Loaded after
   fretboard.js (reuses its NOTES / NOTE_ALT / BASS_OPEN globals)
   and before session.js (which reuses hashSeed / mulberry32).
   All names are globals — pages must not redeclare them.
   ================================================================ */

/* ---- Note-set pools ---- */
var POOLS = {
  minPent:    { id:'minPent',    label:'minor pentatonic',     offsets:[0,3,5,7,10],       flavor:'minor', defaultEnabled:true  },
  majPent:    { id:'majPent',    label:'major pentatonic',     offsets:[0,2,4,7,9],        flavor:'major', defaultEnabled:true  },
  minTriadB7: { id:'minTriadB7', label:'minor triad + b7',     offsets:[0,3,7,10],         flavor:'minor', defaultEnabled:true  },
  majTriad6:  { id:'majTriad6',  label:'major triad + 6',      offsets:[0,4,7,9],          flavor:'major', defaultEnabled:true  },
  dominant:   { id:'dominant',   label:'dominant chord tones', offsets:[0,4,7,10],         flavor:'major', defaultEnabled:true  },
  dorian:     { id:'dorian',     label:'dorian',                offsets:[0,2,3,5,7,9,10],   flavor:'minor', defaultEnabled:false },
  mixolydian: { id:'mixolydian', label:'mixolydian',            offsets:[0,2,4,5,7,9,10],   flavor:'major', defaultEnabled:false },
  bluesHex:   { id:'bluesHex',   label:'blues hexatonic',       offsets:[0,3,5,6,7,10],     flavor:'minor', defaultEnabled:false }
};

/* Stable iteration order for UI building (Object.keys order isn't
   guaranteed stable across engines in theory, though in practice all
   modern engines preserve insertion order for string keys). */
var POOL_ORDER = ['minPent','majPent','minTriadB7','majTriad6','dominant','dorian','mixolydian','bluesHex'];
var CORE_POOL_IDS  = ['minPent','majPent','minTriadB7','majTriad6','dominant'];
var MODAL_POOL_IDS = ['dorian','mixolydian','bluesHex'];

/* E, A, D, G, C, F — pitch classes (matches fretboard.js's NOTES indexing, C=0) */
var EASY_ROOTS = [4,9,2,7,0,5];

/* Bass-notation interval labels — distinct from fretboard.js's classical INTERVAL_DATA.sym */
var INTERVAL_LABELS = {
  0:'R', 1:'b2', 2:'2', 3:'b3', 4:'3', 5:'4',
  6:'b5', 7:'5', 8:'b6', 9:'6', 10:'b7', 11:'7'
};

var CHORD_SUFFIX = {
  minPent:'m', majPent:'', minTriadB7:'m7', majTriad6:'6',
  dominant:'7', dorian:'m7', mixolydian:'7', bluesHex:'m'
};

/* ---- Note spelling: flat vs sharp keyed on key center + pool flavor ---- */
var FLAT_MAJOR_ROOTS = {5:1, 10:1, 3:1, 8:1, 1:1};  /* F, Bb, Eb, Ab, Db */
var FLAT_MINOR_ROOTS = {2:1, 7:1, 0:1, 5:1, 10:1};  /* Dm, Gm, Cm, Fm, Bbm */

function spell(pc, root, pool) {
  var isFlatKey = pool.flavor === 'minor' ? !!FLAT_MINOR_ROOTS[root.pc] : !!FLAT_MAJOR_ROOTS[root.pc];
  var sharpName = NOTES[pc];  /* reuse fretboard.js's global NOTES array */
  if (isFlatKey && NOTE_ALT[sharpName]) return NOTE_ALT[sharpName];  /* reuse fretboard.js's global NOTE_ALT */
  return sharpName;
}

/* ---- Seeded PRNG (plain globals, reused by session.js) ---- */

/* djb2 string hash -> uint32 */
function hashSeed(str) {
  var hash = 5381;
  for (var i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);  /* hash*33 + c */
    hash = hash | 0;  /* force 32-bit */
  }
  return hash >>> 0;  /* uint32 */
}

/* Standard mulberry32 PRNG -> function yielding floats in [0,1) */
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- Core generation ---- */

/**
 * generateSet — deterministically build today's (or a reroll's) note set.
 *
 * @param {string} date         'YYYY-MM-DD'
 * @param {number} rerollCount  0 for the day's first set, 1/2/... for rerolls
 * @param {object} settings     { enabledRoots: number[], enabledPools: string[],
 *                                 easyRootsOnly: bool, surpriseMode: bool }
 * @param {Array}  history      [{ date:'YYYY-MM-DD', rootPc, poolId }, ...]
 * @returns {object} { date, root:{pc,name}, pool:{id,label}, notes:[{pc,name,interval}], drone:{chord,suggestion} }
 */
function generateSet(date, rerollCount, settings, history) {
  settings = settings || {};
  history  = history  || [];

  var seed = hashSeed(date + '|' + rerollCount);
  var rng  = mulberry32(seed);

  var easyRootsOnly = !!settings.easyRootsOnly;
  var surpriseMode  = !!settings.surpriseMode;

  var rootsIn = (settings.enabledRoots && settings.enabledRoots.length) ? settings.enabledRoots : EASY_ROOTS.slice();
  var poolsIn = (settings.enabledPools && settings.enabledPools.length) ? settings.enabledPools : POOL_ORDER.slice();

  var roots = easyRootsOnly ? rootsIn.filter(function(pc) { return EASY_ROOTS.indexOf(pc) !== -1; }) : rootsIn.slice();
  if (roots.length === 0) roots = EASY_ROOTS.slice();  /* graceful fallback if filter empties it */

  /* Step 2: build full combo list */
  var combos = [];
  roots.forEach(function(rootPc) {
    poolsIn.forEach(function(poolId) {
      if (POOLS[poolId]) combos.push({ rootPc: rootPc, poolId: poolId });
    });
  });
  if (combos.length === 0) {
    /* Defensive fallback: settings somehow excluded everything */
    EASY_ROOTS.forEach(function(rootPc) {
      POOL_ORDER.forEach(function(poolId) { combos.push({ rootPc: rootPc, poolId: poolId }); });
    });
  }

  /* Step 3: exclude combos used on any STRICTLY earlier date */
  var excluded = {};
  history.forEach(function(h) {
    if (h.date < date) excluded[h.rootPc + '|' + h.poolId] = true;
  });
  var filtered = combos.filter(function(c) { return !excluded[c.rootPc + '|' + c.poolId]; });
  if (filtered.length === 0) filtered = combos;  /* graceful degradation */

  /* Step 4: pick a combo */
  var combo = filtered[Math.floor(rng() * filtered.length)];
  var pool  = POOLS[combo.poolId];
  var root  = { pc: combo.rootPc, name: spell(combo.rootPc, { pc: combo.rootPc }, pool) };

  /* Step 5: pick set size, clamped to the pool's own size */
  var sizeChoices = [3,4,5].filter(function(n) { return n <= pool.offsets.length; });
  var N = sizeChoices[Math.floor(rng() * sizeChoices.length)];

  /* Steps 6-7: build selection, retry on bad spacing for 7-note (modal) pools */
  function buildSelection() {
    var sel  = [0];
    var rest = pool.offsets.filter(function(o) { return o !== 0; });
    if (pool.offsets.indexOf(7) !== -1 && N >= 3 && !surpriseMode) {
      sel.push(7);
      rest = rest.filter(function(o) { return o !== 7; });
    }
    while (sel.length < N && rest.length > 0) {
      var ri = Math.floor(rng() * rest.length);
      sel.push(rest[ri]);
      rest.splice(ri, 1);
    }
    return sel;
  }

  function circularDist(a, b) {
    var d = Math.abs(a - b);
    return Math.min(d, 12 - d);
  }

  function hasBadSpacing(sel) {
    var tritonePairs = 0;
    for (var i = 0; i < sel.length; i++) {
      for (var j = i + 1; j < sel.length; j++) {
        var cd = circularDist(sel[i], sel[j]);
        if (cd === 1) return true;
        if (cd === 6) tritonePairs++;
      }
    }
    return tritonePairs > 1;
  }

  var selected = buildSelection();
  if (pool.offsets.length === 7) {
    var attempts = 1;
    while (hasBadSpacing(selected) && attempts < 50) {
      selected = buildSelection();
      attempts++;
    }
    /* After 50 attempts, accept the last candidate as-is. */
  }

  /* Step 8: sort + map to note objects */
  selected.sort(function(a, b) { return a - b; });
  var notes = selected.map(function(offset) {
    var pc = (root.pc + offset) % 12;
    return { pc: pc, name: spell(pc, root, pool), interval: INTERVAL_LABELS[offset] };
  });

  /* Step 9: drone suggestion */
  var chordName = root.name + CHORD_SUFFIX[pool.id];
  var drone = { chord: chordName, suggestion: chordName + ' vamp, 60–80 BPM' };

  /* Step 10 */
  return {
    date: date,
    root: root,
    pool: { id: pool.id, label: root.name + ' ' + pool.label },
    notes: notes,
    drone: drone
  };
}

/**
 * positionsFor — every fretboard position (string, fret) whose sounded
 * pitch class is in `pcs`.
 *
 * @param {number[]} pcs       pitch classes to highlight
 * @param {number[]} [tuning]  defaults to global BASS_OPEN
 * @param {number}   [maxFret] inclusive max fret (default 12)
 * @returns {Array} [{string, fret, pc}, ...] — `string` index matches
 *                  fretboard.js's layout.strY(string) / BASS_OPEN order, no remapping.
 */
function positionsFor(pcs, tuning, maxFret) {
  tuning  = tuning  || BASS_OPEN;
  maxFret = (maxFret !== undefined) ? maxFret : 12;
  var result = [];
  for (var s = 0; s < tuning.length; s++) {
    for (var f = 0; f <= maxFret; f++) {
      var pc = (tuning[s] + f) % 12;
      if (pcs.indexOf(pc) !== -1) result.push({ string: s, fret: f, pc: pc });
    }
  }
  return result;
}

/* ================================================================
   localStorage — every access wrapped; fails silently (quota errors,
   Safari private browsing, blocked storage, etc. all degrade to
   fresh-defaults behavior rather than breaking the page).
   ================================================================ */
var storage = {
  get: function(key) { try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch(e) { return null; } },
  set: function(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {} }
};

var STORAGE_KEYS = {
  reroll:   'flotsam.noteRandomizer.reroll',
  history:  'flotsam.noteRandomizer.history',
  settings: 'flotsam.noteRandomizer.settings'
};

var HISTORY_MAX_ENTRIES = 14;

/** getRerollCount — today's reroll count, resetting to 0 on a new day. */
function getRerollCount(dateStr) {
  var stored = storage.get(STORAGE_KEYS.reroll);
  if (!stored || stored.date !== dateStr) return 0;
  return stored.count || 0;
}

/** bumpRerollCount — increments + persists today's reroll count, returns the new value. */
function bumpRerollCount(dateStr) {
  var next = getRerollCount(dateStr) + 1;
  storage.set(STORAGE_KEYS.reroll, { date: dateStr, count: next });
  return next;
}

/** getHistory — the persisted (rootPc, poolId)-by-date history, newest-friendly, capped. */
function getHistory() {
  return storage.get(STORAGE_KEYS.history) || [];
}

/** recordHistoryEntry — upsert today's combo (never duplicates a same-day entry), capped to HISTORY_MAX_ENTRIES. */
function recordHistoryEntry(dateStr, rootPc, poolId) {
  var hist = getHistory().filter(function(h) { return h.date !== dateStr; });
  hist.push({ date: dateStr, rootPc: rootPc, poolId: poolId });
  hist.sort(function(a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });
  if (hist.length > HISTORY_MAX_ENTRIES) hist = hist.slice(hist.length - HISTORY_MAX_ENTRIES);
  storage.set(STORAGE_KEYS.history, hist);
  return hist;
}

/** getSettings — persisted settings panel state, merged over the given defaults. */
function getSettings(defaults) {
  var stored = storage.get(STORAGE_KEYS.settings);
  if (!stored) return defaults;
  var merged = {};
  for (var k in defaults) merged[k] = (stored[k] !== undefined) ? stored[k] : defaults[k];
  return merged;
}

/** saveSettings — persists the settings panel state. */
function saveSettings(settings) {
  storage.set(STORAGE_KEYS.settings, settings);
}
