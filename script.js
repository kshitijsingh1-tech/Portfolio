// ── THEME ──
const html = document.documentElement;
const saved = localStorage.getItem('ks-theme') || 'light';
html.setAttribute('data-theme', saved);

const toggle = document.querySelector('.theme-toggle');
if (toggle) {
  updateIcon(saved);
  toggle.addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('ks-theme', next);
    updateIcon(next);
  });
}

function updateIcon(theme) {
  if (toggle) toggle.textContent = theme === 'dark' ? '○' : '●';
}

// ── ACTIVE NAV ──
const current = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-links a').forEach(a => {
  if (a.getAttribute('href') === current) a.classList.add('active');
});

// ── SCROLL REVEAL ──
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// Stagger children with class .stagger
document.querySelectorAll('.stagger-parent').forEach(parent => {
  Array.from(parent.children).forEach((child, i) => {
    child.classList.add('reveal');
    child.style.transitionDelay = `${i * 0.1}s`;
    observer.observe(child);
  });
});

// ── SKILL BARS ──
const barObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.querySelectorAll('.skill-bar-fill').forEach(bar => {
        setTimeout(() => { bar.style.width = bar.dataset.width; }, 200);
      });
      barObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.2 });

document.querySelectorAll('.skill-category').forEach(el => barObserver.observe(el));

// ── RESUME PLACEHOLDER ──
document.querySelectorAll('.resume-btn, .resume-link').forEach(btn => {
  btn.addEventListener('click', e => {
    e.preventDefault();
    alert('Resume coming soon — check back later!');
  });
});

// ── TARGET CURSOR (GSAP + PROXIMITY SNAP + ORBITAL SPIN) ──
(function initCursor() {
  const isMobile =
    (('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.innerWidth <= 768) ||
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent);
  if (isMobile) return;

  if (typeof gsap === 'undefined') {
    window.addEventListener('load', initCursor);
    return;
  }

  // ── inject HTML ──
  const cursor = document.createElement('div');
  cursor.className = 'target-cursor-wrapper';
  cursor.innerHTML = `
    <div class="target-cursor-dot"></div>
    <div class="target-cursor-corner corner-tl"></div>
    <div class="target-cursor-corner corner-tr"></div>
    <div class="target-cursor-corner corner-br"></div>
    <div class="target-cursor-corner corner-bl"></div>
  `;
  document.body.appendChild(cursor);
  document.body.style.cursor = 'none';

  const dot     = cursor.querySelector('.target-cursor-dot');
  const corners = Array.from(cursor.querySelectorAll('.target-cursor-corner'));

  // ── config ──
  const ORBIT_RADIUS   = 22;    // px — orbit circle radius when idle
  const SPIN_SPEED     = 1.2;   // rotations per second
  const BORDER         = 4;     // px padding around snapped element
  const CORNER_SIZE    = 12;    // px corner bracket size
  const PROXIMITY      = 80;    // px distance to trigger snap
  const RELEASE_BUFFER = 20;    // extra px hysteresis before releasing

  // ── state ──
  let mouseX = window.innerWidth  / 2;
  let mouseY = window.innerHeight / 2;
  let angle       = 0;          // current orbital angle in radians
  let lastTime    = performance.now();
  let isSnapped   = false;
  let activeTarget = null;
  let snapTickerFn = null;
  let resumeTimeout = null;

  // each corner starts 90° apart on the circle
  // corner order: tl=0°, tr=90°, br=180°, bl=270°
  const OFFSETS = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];

  gsap.set(cursor, { xPercent: -50, yPercent: -50, x: mouseX, y: mouseY });

  // ── helpers ──
  function distToRect(px, py, rect) {
    const dx = Math.max(rect.left - px, 0, px - rect.right);
    const dy = Math.max(rect.top  - py, 0, py - rect.bottom);
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getElementCorners(rect) {
    return [
      { x: rect.left  - BORDER,               y: rect.top    - BORDER },
      { x: rect.right + BORDER - CORNER_SIZE,  y: rect.top    - BORDER },
      { x: rect.right + BORDER - CORNER_SIZE,  y: rect.bottom + BORDER - CORNER_SIZE },
      { x: rect.left  - BORDER,               y: rect.bottom + BORDER - CORNER_SIZE },
    ];
  }

  // ── main orbital ticker ──
  // runs every frame — drives the spin when idle, does nothing when snapped
  gsap.ticker.add((time, deltaTime) => {
    if (isSnapped) return;

    const dt = deltaTime / 1000; // ms → seconds
    angle += SPIN_SPEED * 2 * Math.PI * dt;

    corners.forEach((c, i) => {
      const a = angle + OFFSETS[i];
      const tx = Math.cos(a) * ORBIT_RADIUS - CORNER_SIZE / 2;
      const ty = Math.sin(a) * ORBIT_RADIUS - CORNER_SIZE / 2;
      // direct style for performance — no gsap tween overhead in the loop
      gsap.set(c, { x: tx, y: ty });
    });
  });

  // ── snap to element ──
  function snapTo(el) {
    if (activeTarget === el) return;
    releaseSnap(false);

    activeTarget = el;
    isSnapped    = true;

    const rect    = el.getBoundingClientRect();
    const targets = getElementCorners(rect);
    const curX    = gsap.getProperty(cursor, 'x');
    const curY    = gsap.getProperty(cursor, 'y');

    // animate each corner from its current orbital position to element corner
    corners.forEach((c, i) => {
      gsap.to(c, {
        x: targets[i].x - curX + CORNER_SIZE,
        y: targets[i].y - curY + CORNER_SIZE,
        duration: 0.25,
        ease: 'power3.out',
        overwrite: true
      });
    });

    // keep corners locked to element as cursor drifts inside it
    if (snapTickerFn) gsap.ticker.remove(snapTickerFn);
    snapTickerFn = () => {
      const r  = el.getBoundingClientRect();
      const t  = getElementCorners(r);
      const cx = gsap.getProperty(cursor, 'x');
      const cy = gsap.getProperty(cursor, 'y');
      corners.forEach((c, i) => {
        gsap.to(c, {
          x: t[i].x - cx + CORNER_SIZE,
          y: t[i].y - cy + CORNER_SIZE,
          duration: 0.15,
          ease: 'power1.out',
          overwrite: 'auto'
        });
      });
    };
    gsap.ticker.add(snapTickerFn);
  }

  // ── release snap — return to orbit ──
  function releaseSnap(doReturn = true) {
    if (snapTickerFn) { gsap.ticker.remove(snapTickerFn); snapTickerFn = null; }
    activeTarget = null;

    if (!doReturn) { isSnapped = false; return; }

    // smoothly return each corner to its current orbital position
    // we resume the orbital ticker immediately — corners will catch up via gsap.to
    isSnapped = false;

    corners.forEach((c, i) => {
      const a  = angle + OFFSETS[i];
      const tx = Math.cos(a) * ORBIT_RADIUS - CORNER_SIZE / 2;
      const ty = Math.sin(a) * ORBIT_RADIUS - CORNER_SIZE / 2;
      gsap.to(c, { x: tx, y: ty, duration: 0.4, ease: 'power3.out', overwrite: true });
    });
  }

  // ── mousemove — move cursor + proximity check ──
  window.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    gsap.to(cursor, { x: mouseX, y: mouseY, duration: 0.1, ease: 'power3.out' });

    const targets = document.querySelectorAll('.cursor-target');
    let closest     = null;
    let closestDist = Infinity;

    targets.forEach(el => {
      const rect = el.getBoundingClientRect();
      const dist = distToRect(mouseX, mouseY, rect);
      if (dist < closestDist) { closestDist = dist; closest = el; }
    });

    if (closest && closestDist <= PROXIMITY) {
      snapTo(closest);
    } else if (isSnapped && closestDist > PROXIMITY + RELEASE_BUFFER) {
      releaseSnap(true);
    }
  });

  // ── click effect ──
  window.addEventListener('mousedown', () => {
    gsap.to(dot,    { scale: 0.6, duration: 0.15 });
    gsap.to(cursor, { scale: 0.88, duration: 0.15 });
  });
  window.addEventListener('mouseup', () => {
    gsap.to(dot,    { scale: 1, duration: 0.3 });
    gsap.to(cursor, { scale: 1, duration: 0.2 });
  });

  // ── scroll: recheck proximity ──
  window.addEventListener('scroll', () => {
    if (!isSnapped || !activeTarget) return;
    const rect = activeTarget.getBoundingClientRect();
    const dist = distToRect(mouseX, mouseY, rect);
    if (dist > PROXIMITY + RELEASE_BUFFER) releaseSnap(true);
  }, { passive: true });

})();
