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
  '#d3b96d',  /* 0  root         */
  '#b22121',  /* 1  minor 2nd    */
  '#95510e',  /* 2  major 2nd    */
  '#224ca0',  /* 3  minor 3rd    */
  '#8fa40d',  /* 4  major 3rd    */
  '#247e3b',  /* 5  perfect 4th  */
  '#790da4',  /* 6  tritone      */
  '#0e9451',  /* 7  perfect 5th  */
  '#24677e',  /* 8  minor 6th    */
  '#7e6724',  /* 9  major 6th    */
  '#247e7e',  /* 10 minor 7th    */
  '#7e2467'   /* 11 major 7th    */
];

var IV_BORDER = [
  '#eed688','#d72727','#c2711e','#386fd0','#bfda14',
  '#35ad50','#aa1ed8','#1ec878','#3599ad','#ac8c3c',
  '#29adad','#ab3297'
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

var FB_DOT_FONT    = '-apple-system,"Helvetica Neue",Arial,sans-serif';

function fbShade(hex, amt) {
  if (!amt) return hex;
  var n = parseInt(hex.slice(1), 16);
  var k = 1 - amt;
  var r = Math.round(((n >> 16) & 255) * k);
  var g = Math.round(((n >> 8) & 255) * k);
  var b = Math.round((n & 255) * k);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
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
    ctx.fillStyle = fi === 0 ? '#615535' : (fi % 2 === 0 ? '#4f432a' : '#352e26');
    ctx.fillRect(cx, fbT, layout.stripeW, fbB - fbT);
  }

  /* Fret lines */
  for (var f = 0; f <= layout.numFrets; f++) {
    var x    = M.L + f * layout.stripeW;
    var isNut = (f === 0);
    ctx.beginPath();
    ctx.moveTo(x, fbT); ctx.lineTo(x, fbB);
    ctx.strokeStyle = isNut ? '#d0c8a0' : '#a2a8b4';
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
        ctx.fillStyle = '#998346'; ctx.fill();
      });
    } else {
      ctx.beginPath();
      ctx.arc(fx, belowY, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#998346'; ctx.fill();
    }
    ctx.font = '600 13px -apple-system,"Helvetica Neue",Arial,sans-serif';
    ctx.fillStyle = '#bfaf81';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(fm, fx, fbT - 2);
  });

  /* "OPEN" column label — above the grid, matching fret number placement */
  if (showOpenLabel) {
    ctx.font = '600 11px -apple-system,"Helvetica Neue",Arial,sans-serif';
    ctx.fillStyle = '#bfaf81';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('OPEN', M.L + layout.stripeW / 2, fbT - 2);
  }

  /* String lines + labels */
  var strThick     = [1.2, 1.9, 2.7, 3.6];
  var strColor     = ['#d4ba7e','#c3a561','#bd933d','#a77b29'];
  var strColorOpen = ['#ebd197','#d5ba7f','#c0a466','#ba8944'];  /* bolder open-column segment */
  for (var s = 0; s < 4; s++) {
    var sy = layout.strY(s);
    ctx.beginPath();
    ctx.moveTo(fbL, sy); ctx.lineTo(fbR, sy);
    ctx.strokeStyle = strColor[s]; ctx.lineWidth = strThick[s]; ctx.stroke();
    /* Brighter, thicker segment for the open column */
    ctx.beginPath();
    ctx.moveTo(fbL, sy); ctx.lineTo(fbL + layout.stripeW, sy);
    ctx.strokeStyle = strColorOpen[s]; ctx.lineWidth = strThick[s] + 1.0; ctx.stroke();
    ctx.font = 'bold 14px -apple-system,"Helvetica Neue",Arial,sans-serif';
    ctx.fillStyle = '#c8ba88';
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
 *   shade  {number}  0–1 darkens fill and border toward black while staying opaque (default 0)
 *   sublabelScale {number}  sublabel font size as a fraction of r (default 0.62)
 *   labelPx       {number}  absolute main-label font size px; overrides the r-based size
 *   sublabelPx    {number}  absolute sublabel font size px; overrides sublabelScale
 *   labelDy       {number}  vertical shift px applied to both label lines (default 0)
 */
function drawNoteDot(ctx, x, y, r, ivIndex, label, sublabel, opts) {
  opts      = opts   || {};
  var alpha = (opts.alpha !== undefined) ? opts.alpha : 1.0;
  var shade = opts.shade || 0;
  var bg    = fbShade(IV_COLORS[ivIndex], shade);
  var bd    = fbShade(IV_BORDER[ivIndex], shade);
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

  /* Labels scale with the dot radius; a dark outline keeps light text legible on brighter fills */
  var sm      = label && label.length > 1;
  var lblPx   = (opts.labelPx !== undefined) ? opts.labelPx
              : Math.round(r * (sublabel ? 0.72 : (sm ? 0.75 : 0.95)));
  var dy      = opts.labelDy || 0;
  var outline = !isRoot;
  ctx.textAlign   = 'center';
  ctx.fillStyle   = tx;
  ctx.lineJoin    = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth   = Math.max(2, r * 0.14);

  ctx.font         = '800 ' + lblPx + 'px ' + FB_DOT_FONT;
  ctx.textBaseline = sublabel ? 'alphabetic' : 'middle';
  var ly = (sublabel ? y : y + 0.5) + dy;
  if (outline) ctx.strokeText(label || '', x, ly);
  ctx.fillText(label || '', x, ly);

  if (sublabel) {
    var subScale     = (opts.sublabelScale !== undefined) ? opts.sublabelScale : 0.62;
    var subPx        = (opts.sublabelPx !== undefined) ? opts.sublabelPx : Math.round(r * subScale);
    ctx.font         = '700 ' + subPx + 'px ' + FB_DOT_FONT;
    ctx.textBaseline = 'top';
    ctx.globalAlpha  = (alpha < 1 ? alpha : 1) * 0.9;
    if (outline) ctx.strokeText(sublabel, x, y + 2 + dy);
    ctx.fillText(sublabel, x, y + 2 + dy);
  }

  ctx.restore();
}

/**
 * drawZoneHighlight — soft rounded-rect highlight spanning a fret range
 * across all 4 strings. Call AFTER drawNeck() and BEFORE drawNoteDot()
 * calls, so note dots render on top of the shaded zone.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} layout   from makeNeckLayout()
 * @param {object} zone     { fretStart, fretEnd } inclusive fret-column indices,
 *                          same 0..layout.numFrets-1 space as layout.fretX()
 * @param {object} [opts]
 *   color        {string}  base hex color (default '#d3b96d')
 *   fillAlpha    {number}  0-1 fill opacity (default 0.12)
 *   strokeAlpha  {number}  0-1 border opacity (default 0.5)
 *   lineWidth    {number}  border width px (default 1.5)
 *   cornerRadius {number}  px (default 10)
 *   pad          {number}  vertical padding beyond string rows 0 and 3
 *                          (default: the neck's 20px overhang, or dotRadius + 2 if larger)
 *   label        {string}  optional caption, drawn in a row above the fret numbers —
 *                          needs layout.M.T >= ~52 to fit on the canvas
 *   labelColor   {string}  caption fill color (default '#bfaf81')
 *   labelFont    {string}  caption CSS font (default '600 13px' system sans)
 */
function drawZoneHighlight(ctx, layout, zone, opts) {
  opts   = opts || {};
  var color   = opts.color        || '#d3b96d';
  var fAlpha  = (opts.fillAlpha   !== undefined) ? opts.fillAlpha   : 0.12;
  var sAlpha  = (opts.strokeAlpha !== undefined) ? opts.strokeAlpha : 0.5;
  var lw      = (opts.lineWidth   !== undefined) ? opts.lineWidth   : 1.5;
  var cr      = (opts.cornerRadius !== undefined) ? opts.cornerRadius : 10;
  var pad     = (opts.pad !== undefined) ? opts.pad : Math.max(20, layout.dotRadius + 2);

  var x1 = layout.M.L + zone.fretStart * layout.stripeW;
  var x2 = layout.M.L + (zone.fretEnd + 1) * layout.stripeW;
  var y1 = layout.strY(0) - pad;
  var y2 = layout.strY(3) + pad;
  var w  = x2 - x1;
  var h  = y2 - y1;

  var fillHex   = fAlpha   >= 1 ? 'ff' : Math.round(fAlpha   * 255).toString(16).padStart(2, '0');
  var strokeHex = sAlpha   >= 1 ? 'ff' : Math.round(sAlpha   * 255).toString(16).padStart(2, '0');

  ctx.save();
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x1, y1, w, h, cr);
  } else {
    ctx.rect(x1, y1, w, h);
  }
  ctx.fillStyle   = color + fillHex;
  ctx.fill();
  ctx.strokeStyle = color + strokeHex;
  ctx.lineWidth   = lw;
  ctx.stroke();

  if (opts.label) {
    ctx.font = opts.labelFont || '600 13px -apple-system,"Helvetica Neue",Arial,sans-serif';
    ctx.fillStyle = opts.labelColor || '#bfaf81';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    /* drawNeck puts fret numbers with their baseline at M.T - 22; sit one text row above them */
    ctx.fillText(opts.label, (x1 + x2) / 2, layout.M.T - 38);
  }
  ctx.restore();
}
