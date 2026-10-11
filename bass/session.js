/* ================================================================
   session.js — practice-session timer, focus cues, and streak
   tracking for the Note-Set Randomizer. Depends on noteset.js being
   loaded first (reuses its hashSeed / mulberry32 / storage globals).
   All names are globals — pages must not redeclare them.
   ================================================================ */

/**
 * makeSessionTimer — a pausable elapsed-time timer with one-shot
 * threshold callbacks. Thresholds are passive: crossing one never
 * auto-pauses the timer and never plays a sound.
 *
 * @param {object} callbacks  { onTick(elapsedMs), onWorkPrompt(), onCapMessage(), onDoneEligible() }
 * @returns {object} { start(), pause(), reset(), getElapsedMs(), getState() }
 */
function makeSessionTimer(callbacks) {
  callbacks = callbacks || {};
  var WORK_MS = 12 * 60 * 1000;
  var CAP_MS  = 25 * 60 * 1000;
  var DONE_MS = 10 * 60 * 1000;

  var state           = 'idle';   /* 'idle' | 'running' | 'paused' */
  var startTimestamp  = null;     /* Date.now() at (re)start, adjusted on resume */
  var pausedElapsedMs = 0;        /* elapsed accumulated before the current run */
  var intervalId      = null;

  var firedWork = false, firedCap = false, firedDone = false;

  function elapsedMs() {
    if (state === 'running') return Date.now() - startTimestamp;
    return pausedElapsedMs;
  }

  function checkThresholds() {
    var ms = elapsedMs();
    if (!firedWork && ms >= WORK_MS) { firedWork = true; if (callbacks.onWorkPrompt) callbacks.onWorkPrompt(); }
    if (!firedCap && ms >= CAP_MS) { firedCap = true; if (callbacks.onCapMessage) callbacks.onCapMessage(); }
    if (!firedDone && ms >= DONE_MS) { firedDone = true; if (callbacks.onDoneEligible) callbacks.onDoneEligible(); }
  }

  function tick() {
    checkThresholds();
    if (callbacks.onTick) callbacks.onTick(elapsedMs());
  }

  function start() {
    if (state === 'running') return;
    startTimestamp = Date.now() - pausedElapsedMs;  /* no drift across pause/resume */
    state = 'running';
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(tick, 1000);
    tick();
  }

  function pause() {
    if (state !== 'running') return;
    pausedElapsedMs = Date.now() - startTimestamp;
    state = 'paused';
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
    tick();
  }

  function reset() {
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
    state = 'idle';
    startTimestamp = null;
    pausedElapsedMs = 0;
    firedWork = false; firedCap = false; firedDone = false;
    tick();
  }

  return {
    start: start,
    pause: pause,
    reset: reset,
    getElapsedMs: elapsedMs,
    getState: function() { return state; }
  };
}

/* ---- Focus cues ---- */
var FOCUS_CUES = [
  'Wrist out, thumb follows',
  'Elbow hangs free',
  'Fret with arm weight, not a squeeze',
  'Floating-thumb muting',
  'Mute idle strings with the fretting hand',
  'Shoulders down',
  'Feel fret markers instead of looking',
  'Alternate index/middle'
];

/**
 * focusCueForDate — a stable, date-seeded focus cue. Uses a different
 * seed suffix than generateSet's reroll seed, so it never changes
 * when the user rerolls the note set.
 */
function focusCueForDate(date) {
  var rng = mulberry32(hashSeed(date + '|focus'));
  return FOCUS_CUES[Math.floor(rng() * FOCUS_CUES.length)];
}

/* ---- Streak tracking ---- */
var STREAK_STORAGE_KEY = 'flotsam.noteRandomizer.streak';
var STREAK_LOG_DAYS = 28;

function addDaysISO(dateStr, n) {
  var d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * recordPracticeDay — marks dateStr as practiced, trims the log to the
 * most recent 28 calendar days, and recomputes the current streak
 * fresh (walking backward from today) so a gap self-heals correctly.
 *
 * @param {string} dateStr 'YYYY-MM-DD'
 * @returns {object} { log, currentStreak }
 */
function recordPracticeDay(dateStr) {
  var stored = storage.get(STREAK_STORAGE_KEY) || { log: {}, currentStreak: 0 };
  var log = stored.log || {};
  log[dateStr] = true;

  /* Trim to the most recent STREAK_LOG_DAYS calendar days (relative to dateStr). */
  var cutoff = addDaysISO(dateStr, -(STREAK_LOG_DAYS - 1));
  var trimmed = {};
  Object.keys(log).forEach(function(d) { if (d >= cutoff && d <= dateStr) trimmed[d] = true; });

  /* Recompute current streak by walking backward from dateStr. */
  var streak = 0;
  var cursor = dateStr;
  while (trimmed[cursor]) {
    streak++;
    cursor = addDaysISO(cursor, -1);
  }

  var result = { log: trimmed, currentStreak: streak };
  storage.set(STREAK_STORAGE_KEY, result);
  return result;
}

/** getStreak — reads the persisted streak state without recording a new day. */
function getStreak() {
  return storage.get(STREAK_STORAGE_KEY) || { log: {}, currentStreak: 0 };
}

/**
 * render4WeekCalendar — pure DOM builder: clears `container` and
 * appends 28 small cell divs (oldest to newest, 4 rows x 7 columns)
 * marking days present in `log` as practiced.
 *
 * @param {HTMLElement} container
 * @param {object} log  { 'YYYY-MM-DD': true, ... }
 * @param {string} [todayStr] anchor date for the 28-day window (default: today, local)
 */
function render4WeekCalendar(container, log, todayStr) {
  log = log || {};
  todayStr = todayStr || new Date().toISOString().slice(0, 10);
  container.innerHTML = '';

  var grid = document.createElement('div');
  grid.className = 'cal-grid';

  for (var i = STREAK_LOG_DAYS - 1; i >= 0; i--) {
    var d = addDaysISO(todayStr, -i);
    var cell = document.createElement('div');
    cell.className = 'cal-dot' + (log[d] ? ' practiced' : '');
    cell.title = d + (log[d] ? ' — practiced' : '');
    grid.appendChild(cell);
  }

  container.appendChild(grid);
}
