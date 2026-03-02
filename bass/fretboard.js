/* ================================================================
   fretboard.js — shared data constants and canvas drawing utilities
   Loaded as a plain script (no module bundler) before page scripts.
   All names are globals — pages must not redeclare them.
   ================================================================ */

/* ---- Note data ---- */
var NOTES    = ['C','C\u266f','D','D\u266f','E','F','F\u266f','G','G\u266f','A','A\u266f','B'];
var NOTE_ALT = { 'C\u266f':'Db','D\u266f':'Eb','F\u266f':'Gb','G\u266f':'Ab','A\u266f':'Bb' };

/* Standard 4-string bass (E standard). Index 0 = highest string (G). */
var BASS_OPEN = [7, 2, 9, 4];   /* G=7  D=2  A=9  E=4 */
var STR_NAMES = ['G','D','A','E'];

/* ---- Interval colors (12-semitone master palette) ---- */
var IV_COLORS = [
  '#c8a84a',  /* 0  root         */
  '#8b1a1a',  /* 1  minor 2nd    */
  '#6b3a0a',  /* 2  major 2nd    */
  '#1a3a7a',  /* 3  minor 3rd    */
  '#6a7a0a',  /* 4  major 3rd    */
  '#1a5a2a',  /* 5  perfect 4th  */
  '#5a0a7a',  /* 6  tritone      */
  '#0a6a3a',  /* 7  perfect 5th  */
  '#1a4a5a',  /* 8  minor 6th    */
  '#5a4a1a',  /* 9  major 6th    */
  '#1a5a5a',  /* 10 minor 7th    */
  '#5a1a4a'   /* 11 major 7th    */
];

var IV_BORDER = [
  '#e8c860','#b02020','#9a5a18','#2a5ab0','#9ab010',
  '#2a8a40','#8a18b0','#18a060','#2a7a8a','#8a7030',
  '#208888','#882878'
];

var IV_TEXT = [
  '#000',    '#ffaaaa','#ffc878','#a0c8ff','#e8f080',
  '#80f0a0','#e080ff','#60ffc0','#80d8f0','#f0d080',
  '#80f0f0','#f080d8'
];

/* Quality and triad type color lookups (JS mirrors of CSS --q-* / --t-* vars) */
var Q_COLORS = {
  perfect: IV_COLORS[7],
  major:   IV_COLORS[4],
  minor:   IV_COLORS[3],
  tritone: IV_COLORS[6]
};

var TYPE_COLORS = {
  major: IV_COLORS[4],
  minor: IV_COLORS[3],
  dim:   IV_COLORS[1],
  aug:   IV_COLORS[9]
};

/* ---- Interval metadata (12 chromatic intervals) ---- */
var INTERVAL_DATA = [
  { hs:0,  sym:'R',   name:'Root',        quality:'perfect', char:'Home base' },
  { hs:1,  sym:'m2',  name:'Minor 2nd',   quality:'minor',   char:'Very tense, dissonant (Jaws)' },
  { hs:2,  sym:'M2',  name:'Major 2nd',   quality:'major',   char:'Common melodic movement' },
  { hs:3,  sym:'m3',  name:'Minor 3rd',   quality:'minor',   char:'\u201cSad\u201d \u2014 foundation of minor chords' },
  { hs:4,  sym:'M3',  name:'Major 3rd',   quality:'major',   char:'\u201cHappy\u201d \u2014 foundation of major chords' },
  { hs:5,  sym:'P4',  name:'Perfect 4th', quality:'perfect', char:'Stable, open sounding' },
  { hs:6,  sym:'TT',  name:'Tritone',     quality:'tritone', char:'Most unstable \u2014 the devil\'s interval' },
  { hs:7,  sym:'P5',  name:'Perfect 5th', quality:'perfect', char:'Very stable (power chord root\u21925th)' },
  { hs:8,  sym:'m6',  name:'Minor 6th',   quality:'minor',   char:'Bittersweet, melancholic' },
  { hs:9,  sym:'M6',  name:'Major 6th',   quality:'major',   char:'Warm, open' },
  { hs:10, sym:'m7',  name:'Minor 7th',   quality:'minor',   char:'\u201cBluesy\u201d 7th \u2014 critical in bass & jazz' },
  { hs:11, sym:'M7',  name:'Major 7th',   quality:'major',   char:'Dreamy, sophisticated tension' }
];

/* ================================================================
   Canvas drawing utilities
   ================================================================ */

var FB_FRET_MARKS  = [3, 5, 7, 9, 12];
var FB_DOUBLE_MARK = 12;

/**
 * makeNeckLayout — compute canvas geometry for a 4-string bass neck.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} [opts]
 *   numFrets   {number}  fret columns including open (default 13 = frets 0–12)
 *   margins    {object}  { L, R, T, B } px  (default L:56 R:18 T:36 B:32)
 *   dotRadius  {number}  note dot radius px  (default 13)
 * @returns {object} layout with fretX(f), strY(s), and geometry values
 */
function makeNeckLayout(canvas, opts) {
  opts       = opts || {};
  var nf     = opts.numFrets  || 13;
  var dr     = opts.dotRadius || 13;
  var M      = opts.margins   || { L:56, R:18, T:36, B:32 };
  var W      = canvas.width;
  var H      = canvas.height;
  var sw     = (W - M.L - M.R) / nf;   /* stripe width per fret */
  var sh     = (H - M.T - M.B) / 3;    /* 4 strings = 3 gaps    */
  return {
    canvas: canvas, W: W, H: H, M: M,
    numFrets: nf, stripeW: sw, strH: sh, dotRadius: dr,
    fretX: function(f) { return M.L + (f + 0.5) * sw; },
    strY:  function(s) { return M.T + s * sh; }
  };
}

/**
 * drawNeck — renders the static neck (background, frets, strings, markers).
 * Does NOT draw note dots — call drawNoteDot() separately for each note.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} layout  from makeNeckLayout()
 * @param {object} [opts]
 *   showOpenLabel  {boolean}  label first column "OPEN"  (default false)
 *   firstFretNum   {number}   fret number offset for markers (default 0)
 *   extraFretMarks {number[]} additional fret numbers to mark beyond FB_FRET_MARKS
 */
function drawNeck(ctx, layout, opts) {
  opts               = opts || {};
  var showOpenLabel  = opts.showOpenLabel  || false;
  var firstFretNum   = opts.firstFretNum   || 0;
  var extraMarks     = opts.extraFretMarks || [];
  var M              = layout.M;
  var W = layout.W,  H = layout.H;

  ctx.clearRect(0, 0, W, H);

  /* Neck background — alternating fret columns; open column warm-tinted */
  var fbL = M.L, fbR = W - M.R;
  var fbT = M.T - 20, fbB = H - M.B + 20;
  for (var fi = 0; fi < layout.numFrets; fi++) {
    var cx = M.L + fi * layout.stripeW;
    ctx.fillStyle = fi === 0 ? '#4a4128' : (fi % 2 === 0 ? '#382f1e' : '#201c17');
    ctx.fillRect(cx, fbT, layout.stripeW, fbB - fbT);
  }

  /* Fret lines */
  for (var f = 0; f <= layout.numFrets; f++) {
    var x    = M.L + f * layout.stripeW;
    var isNut = (f === 0);
    ctx.beginPath();
    ctx.moveTo(x, fbT); ctx.lineTo(x, fbB);
    ctx.strokeStyle = isNut ? '#d0c8a0' : '#8890a0';
    ctx.lineWidth   = isNut ? 4         : 1.5;
    ctx.stroke();
  }

  /* Position dot markers */
  var allMarks = FB_FRET_MARKS.concat(extraMarks);
  allMarks.forEach(function(fm) {
    var rel = fm - firstFretNum;
    if (rel < 0 || rel >= layout.numFrets) return;
    var fx     = layout.fretX(rel);
    var belowY = fbB + 8;   /* below the neck rectangle */
    if (fm === FB_DOUBLE_MARK) {
      [-9, 9].forEach(function(dx) {
        ctx.beginPath();
        ctx.arc(fx + dx, belowY, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#7a6838'; ctx.fill();
      });
    } else {
      ctx.beginPath();
      ctx.arc(fx, belowY, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#7a6838'; ctx.fill();
    }
    ctx.font = '600 12px -apple-system,"Helvetica Neue",Arial,sans-serif';
    ctx.fillStyle = '#b09c62';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(fm, fx, fbT - 2);
  });

  /* "OPEN" column label — above the grid, matching fret number placement */
  if (showOpenLabel) {
    ctx.font = '600 10px -apple-system,"Helvetica Neue",Arial,sans-serif';
    ctx.fillStyle = '#b09c62';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('OPEN', M.L + layout.stripeW / 2, fbT - 2);
  }

  /* String lines + labels */
  var strThick     = [1.2, 1.9, 2.7, 3.6];
  var strColor     = ['#c8a85c','#b29044','#9a7832','#826020'];
  var strColorOpen = ['#e4c070','#caa85c','#b09048','#987038'];  /* bolder open-column segment */
  for (var s = 0; s < 4; s++) {
    var sy = layout.strY(s);
    ctx.beginPath();
    ctx.moveTo(fbL, sy); ctx.lineTo(fbR, sy);
    ctx.strokeStyle = strColor[s]; ctx.lineWidth = strThick[s]; ctx.stroke();
    /* Brighter, thicker segment for the open column */
    ctx.beginPath();
    ctx.moveTo(fbL, sy); ctx.lineTo(fbL + layout.stripeW, sy);
    ctx.strokeStyle = strColorOpen[s]; ctx.lineWidth = strThick[s] + 1.0; ctx.stroke();
    ctx.font = 'bold 13px -apple-system,"Helvetica Neue",Arial,sans-serif';
    ctx.fillStyle = '#baa868';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(STR_NAMES[s], fbL - 8, sy);
  }
}

/**
 * drawNoteDot — renders a single filled interval dot.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x          center x
 * @param {number} y          center y
 * @param {number} r          radius
 * @param {number} ivIndex    interval semitone index 0–11 (drives color)
 * @param {string} label      primary label (e.g. "R", "m3")
 * @param {string} [sublabel] smaller secondary text below label (e.g. note name)
 * @param {object} [opts]
 *   alpha  {number}  global opacity 0–1 (default 1); use <1 for secondary triad notes
 */
function drawNoteDot(ctx, x, y, r, ivIndex, label, sublabel, opts) {
  opts      = opts   || {};
  var alpha = (opts.alpha !== undefined) ? opts.alpha : 1.0;
  var bg    = IV_COLORS[ivIndex];
  var bd    = IV_BORDER[ivIndex];
  var tx    = IV_TEXT[ivIndex];
  var isRoot = (ivIndex === 0);

  ctx.save();
  if (alpha < 1) ctx.globalAlpha = alpha;

  /* Glow for root and tonally prominent intervals */
  if (isRoot || ivIndex === 6 || ivIndex === 7) {
    var grd = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
    grd.addColorStop(0, bg + '50'); grd.addColorStop(1, 'transparent');
    ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
    ctx.fillStyle = grd; ctx.fill();
  }

  /* Filled circle */
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle   = bg;
  ctx.strokeStyle = bd;
  ctx.lineWidth   = 1.5;
  ctx.fill(); ctx.stroke();

  /* Primary label */
  var sm = label && label.length > 1;
  ctx.font = (isRoot ? '700' : '600') + ' ' + (sm ? '9' : '11') + 'px \'Courier New\',monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = sublabel ? 'alphabetic' : 'middle';
  ctx.fillStyle    = tx;
  ctx.fillText(label || '', x, sublabel ? y - 1 : y + 0.5);

  /* Sublabel */
  if (sublabel) {
    ctx.font         = '600 8px \'Courier New\',monospace';
    ctx.textBaseline = 'top';
    ctx.globalAlpha  = (alpha < 1 ? alpha : 1) * 0.75;
    ctx.fillText(sublabel, x, y + 2);
  }

  ctx.restore();
}
