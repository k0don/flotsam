/* ================================================================
   nav.js — builds the sticky site nav and marks the current page.
   Each page lives in its own folder at bass/pages/<slug>/index.html
   (with its page-specific style.css alongside) and loads this file
   from ../../shared/nav.js; the overview at bass/index.html loads it
   from shared/nav.js. Links are resolved against this script's own
   URL, so they work from either location.

   To add a page: create bass/pages/<slug>/index.html, append one
   { slug, label } entry to NAV_PAGES, and add a card for it to the
   overview list in bass/index.html.
   ================================================================ */

var NAV_PAGES = [
  { slug: 'interval-map',    label: 'Interval Map'    },
  { slug: 'intervals',       label: 'Intervals'       },
  { slug: 'triads',          label: 'Triads'          },
  { slug: 'note-randomizer', label: 'Note Randomizer' }
];

/* This script's absolute URL (…/bass/shared/nav.js). currentScript is
   only set while the script is first executing, so capture it here at
   the top level rather than inside the DOMContentLoaded handler. */
var NAV_SCRIPT_SRC = document.currentScript.src;

/* Hrefs are resolved relative to bass/shared/, so '../pages/<slug>/'
   and '../index.html' land in the right place whichever page loaded
   us. Links name index.html explicitly so they work from file:// as
   well as on a web server (e.g. GitHub Pages). */
function pageHref(slug) {
  return new URL('../pages/' + slug + '/index.html', NAV_SCRIPT_SRC).href;
}

function overviewHref() {
  return new URL('../index.html', NAV_SCRIPT_SRC).href;
}

/* The current page's slug is its folder name: the last non-empty path
   segment, ignoring a trailing index.html. Handles /bass/pages/triads/,
   /bass/pages/triads/index.html and
   file:///.../bass/pages/triads/index.html. On the overview this
   yields 'bass', which matches no page, so no nav link is marked. */
function currentSlug(pathname) {
  var parts = pathname.split('/').filter(function(s) { return s !== ''; });
  if (parts.length && parts[parts.length - 1] === 'index.html') parts.pop();
  return parts.length ? parts[parts.length - 1] : '';
}

function buildNav() {
  var current = currentSlug(window.location.pathname);

  var nav = document.createElement('nav');
  nav.className = 'site-nav';

  var brand = document.createElement('a');
  brand.className = 'nav-brand';
  brand.href = overviewHref();
  brand.textContent = 'Bass';
  nav.appendChild(brand);

  NAV_PAGES.forEach(function(page) {
    var a = document.createElement('a');
    a.className = 'nav-link' + (current === page.slug ? ' active' : '');
    a.href = pageHref(page.slug);
    a.textContent = page.label;
    nav.appendChild(a);
  });

  document.body.insertBefore(nav, document.body.firstChild);
}

document.addEventListener('DOMContentLoaded', buildNav);
