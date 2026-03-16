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

// ── TARGET CURSOR (GSAP — FERRIS WHEEL SPIN + PROXIMITY SNAP) ──
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
  const SPIN_DURATION  = 2;    // seconds per full rotation
  const ORBIT          = 12;   // px — distance from dot centre to each corner
  const BORDER         = 3;    // px padding around snapped element
  const CORNER_SIZE    = 8;    // px
  const SNAP_THRESHOLD = 12;   // px — snap when corners first reach the element (= ORBIT)
  const RELEASE_BUFFER = 8;    // px — release once dot moves this far outside

  // ── state ──
  let mouseX        = window.innerWidth  / 2;
  let mouseY        = window.innerHeight / 2;
  let spinTl        = null;
  let isSnapped     = false;
  let activeTarget  = null;
  let resumeTimeout = null;

  // ── SETUP ──
  const W = (ORBIT + CORNER_SIZE) * 2;
  const C = W / 2;

  cursor.style.width  = W + 'px';
  cursor.style.height = W + 'px';

  gsap.set(dot, { top: C, left: C, xPercent: -50, yPercent: -50 });
  gsap.set(corners[0], { top: C - ORBIT - CORNER_SIZE, left: C - ORBIT - CORNER_SIZE }); // tl
  gsap.set(corners[1], { top: C - ORBIT - CORNER_SIZE, left: C + ORBIT              }); // tr
  gsap.set(corners[2], { top: C + ORBIT,               left: C + ORBIT              }); // br
  gsap.set(corners[3], { top: C + ORBIT,               left: C - ORBIT - CORNER_SIZE }); // bl

  gsap.set(cursor, { xPercent: -50, yPercent: -50, x: mouseX, y: mouseY });

  // ── spin ──
  const createSpin = () => {
    if (spinTl) spinTl.kill();
    spinTl = gsap.timeline({ repeat: -1 })
      .to(cursor, { rotation: '+=360', duration: SPIN_DURATION, ease: 'none' });
  };
  createSpin();

  // ── helpers ──
  function distToRect(px, py, rect) {
    const dx = Math.max(rect.left - px, 0, px - rect.right);
    const dy = Math.max(rect.top  - py, 0, py - rect.bottom);
    return Math.sqrt(dx * dx + dy * dy);
  }

  // x/y offsets for each corner to reach element edges
  // Uses mouseX/mouseY directly (not lagged gsap cursor position) to avoid jitter
  function getSnapOffsets(rect, mx, my) {
    const B = BORDER, CS = CORNER_SIZE, O = ORBIT;
    return [
      { x: rect.left  - B      - mx - (-O - CS), y: rect.top    - B      - my - (-O - CS) }, // tl
      { x: rect.right + B - CS - mx - ( O     ), y: rect.top    - B      - my - (-O - CS) }, // tr
      { x: rect.right + B - CS - mx - ( O     ), y: rect.bottom + B - CS - my - ( O     ) }, // br
      { x: rect.left  - B      - mx - (-O - CS), y: rect.bottom + B - CS - my - ( O     ) }, // bl
    ];
  }

  // ── snap ──
  function snapTo(el) {
    if (activeTarget === el) return;
    releaseSnap(false);

    // Cancel any pending spin-resume so it can't fire while we're snapped
    if (resumeTimeout) { clearTimeout(resumeTimeout); resumeTimeout = null; }

    activeTarget = el;
    isSnapped    = true;

    gsap.killTweensOf(cursor, 'rotation');
    spinTl?.pause();
    gsap.to(cursor, { rotation: 0, duration: 0.2, ease: 'power2.out' });

    const rect    = el.getBoundingClientRect();
    const offsets = getSnapOffsets(rect, mouseX, mouseY);

    corners.forEach((c, i) => {
      gsap.to(c, { x: offsets[i].x, y: offsets[i].y, duration: 0.22, ease: 'power3.out', overwrite: true });
    });
  }

  // update snapped corners on mousemove (no ticker — avoids jitter)
  function updateSnap() {
    if (!isSnapped || !activeTarget) return;
    const rect    = activeTarget.getBoundingClientRect();
    const offsets = getSnapOffsets(rect, mouseX, mouseY);
    corners.forEach((c, i) => {
      gsap.to(c, { x: offsets[i].x, y: offsets[i].y, duration: 0.12, ease: 'power1.out', overwrite: 'auto' });
    });
  }

  // ── release ──
  function releaseSnap(doResume = true) {
    activeTarget = null;
    isSnapped    = false;

    corners.forEach(c => {
      gsap.to(c, { x: 0, y: 0, duration: 0.35, ease: 'power3.out', overwrite: true });
    });

    if (!doResume) return;

    if (resumeTimeout) clearTimeout(resumeTimeout);
    resumeTimeout = setTimeout(() => {
      // wait for corners to finish returning before spinning again
      const rot = ((gsap.getProperty(cursor, 'rotation') % 360) + 360) % 360;
      spinTl?.kill();
      const remaining = SPIN_DURATION * (1 - rot / 360);
      gsap.to(cursor, {
        rotation: rot + 360,
        duration: remaining > 0.05 ? remaining : SPIN_DURATION,
        ease: 'none',
        onComplete: () => createSpin()
      });
      resumeTimeout = null;
    }, 380); // wait for corner return animation (0.35s) to finish
  }

  // ── mousemove ──
  window.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    gsap.to(cursor, { x: mouseX, y: mouseY, duration: 0.1, ease: 'power3.out' });

    // find nearest cursor-target that the dot is actually on (or very close to)
    const allTargets = document.querySelectorAll('.cursor-target');
    let closest = null, closestDist = Infinity;
    allTargets.forEach(el => {
      const dist = distToRect(mouseX, mouseY, el.getBoundingClientRect());
      if (dist < closestDist) { closestDist = dist; closest = el; }
    });

    if (closest && closestDist <= SNAP_THRESHOLD) {
      // dot is on the element — snap
      snapTo(closest);
      updateSnap(); // update corner positions on every move while snapped
    } else if (isSnapped && closestDist > SNAP_THRESHOLD + RELEASE_BUFFER) {
      // dot has left the element — release
      releaseSnap(true);
    } else if (isSnapped) {
      // still snapped, update corner positions
      updateSnap();
    }
  });

  // ── click ──
  window.addEventListener('mousedown', () => {
    gsap.to(dot,    { scale: 0.6, duration: 0.15 });
    gsap.to(cursor, { scale: 0.88, duration: 0.15 });
  });
  window.addEventListener('mouseup', () => {
    gsap.to(dot,    { scale: 1,  duration: 0.3  });
    gsap.to(cursor, { scale: 1,  duration: 0.2  });
  });

  // ── scroll ──
  window.addEventListener('scroll', () => {
    if (!isSnapped || !activeTarget) return;
    const dist = distToRect(mouseX, mouseY, activeTarget.getBoundingClientRect());
    if (dist > PROXIMITY + RELEASE_BUFFER) releaseSnap(true);
  }, { passive: true });

})();
