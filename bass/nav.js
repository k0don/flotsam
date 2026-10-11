/* ================================================================
   nav.js — builds the sticky site nav and marks the current page.
   Add a new page by appending one entry to NAV_PAGES.
   ================================================================ */

var NAV_PAGES = [
  { href: 'bass_intervals.html', label: 'Interval Map' },
  { href: 'intervals2.html',     label: 'Intervals'    },
  { href: 'triads.html',         label: 'Triads'       },
  { href: 'note-randomizer.html', label: 'Note Randomizer' }
];

function buildNav() {
  var current = window.location.pathname.split('/').pop() || '';

  var nav = document.createElement('nav');
  nav.className = 'site-nav';

  var brand = document.createElement('a');
  brand.className = 'nav-brand';
  brand.href = 'bass_intervals.html';
  brand.textContent = 'Bass';
  nav.appendChild(brand);

  NAV_PAGES.forEach(function(page) {
    var a = document.createElement('a');
    a.className = 'nav-link' + (current === page.href ? ' active' : '');
    a.href = page.href;
    a.textContent = page.label;
    nav.appendChild(a);
  });

  document.body.insertBefore(nav, document.body.firstChild);
}

document.addEventListener('DOMContentLoaded', buildNav);
