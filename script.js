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
  const SPIN_DURATION  = 2.4;  // slightly slower spin feels more premium
  const ORBIT          = 12;
  const BORDER         = 3;
  const CORNER_SIZE    = 8;
  const SNAP_THRESHOLD = 12;
  const RELEASE_BUFFER = 8;

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
  gsap.set(corners[0], { top: C - ORBIT - CORNER_SIZE, left: C - ORBIT - CORNER_SIZE });
  gsap.set(corners[1], { top: C - ORBIT - CORNER_SIZE, left: C + ORBIT              });
  gsap.set(corners[2], { top: C + ORBIT,               left: C + ORBIT              });
  gsap.set(corners[3], { top: C + ORBIT,               left: C - ORBIT - CORNER_SIZE });

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

  function getSnapOffsets(rect, mx, my) {
    const B = BORDER, CS = CORNER_SIZE, O = ORBIT;
    return [
      { x: rect.left  - B      - mx - (-O - CS), y: rect.top    - B      - my - (-O - CS) },
      { x: rect.right + B - CS - mx - ( O     ), y: rect.top    - B      - my - (-O - CS) },
      { x: rect.right + B - CS - mx - ( O     ), y: rect.bottom + B - CS - my - ( O     ) },
      { x: rect.left  - B      - mx - (-O - CS), y: rect.bottom + B - CS - my - ( O     ) },
    ];
  }

  // ── snap ──
  function snapTo(el) {
    if (activeTarget === el) return;
    releaseSnap(false);

    if (resumeTimeout) { clearTimeout(resumeTimeout); resumeTimeout = null; }

    activeTarget = el;
    isSnapped    = true;

    gsap.killTweensOf(cursor, 'rotation');
    spinTl?.pause();

    // smooth rotation settle to 0
    gsap.to(cursor, { rotation: 0, duration: 0.38, ease: 'expo.out' });

    // subtle scale pulse on snap entry — feels snappy but not jarring
    gsap.to(cursor, { scale: 1.08, duration: 0.18, ease: 'power2.out',
      onComplete: () => gsap.to(cursor, { scale: 1, duration: 0.28, ease: 'elastic.out(1, 0.5)' })
    });

    const rect    = el.getBoundingClientRect();
    const offsets = getSnapOffsets(rect, mouseX, mouseY);

    // staggered corner arrival — each corner lands slightly after the previous
    corners.forEach((c, i) => {
      gsap.to(c, {
        x: offsets[i].x, y: offsets[i].y,
        duration: 0.32,
        delay: i * 0.025,          // 25ms stagger between corners
        ease: 'expo.out',
        overwrite: true
      });
    });
  }

  // update snapped corners on mousemove
  function updateSnap() {
    if (!isSnapped || !activeTarget) return;
    const rect    = activeTarget.getBoundingClientRect();
    const offsets = getSnapOffsets(rect, mouseX, mouseY);
    corners.forEach((c, i) => {
      gsap.to(c, {
        x: offsets[i].x, y: offsets[i].y,
        duration: 0.18,            // slightly slower tracking feels silkier
        ease: 'power2.out',
        overwrite: 'auto'
      });
    });
  }

  // ── release ──
  function releaseSnap(doResume = true) {
    activeTarget = null;
    isSnapped    = false;

    // staggered spring return — corners spring back one after another
    corners.forEach((c, i) => {
      gsap.to(c, {
        x: 0, y: 0,
        duration: 0.5,
        delay: i * 0.03,
        ease: 'elastic.out(1, 0.6)',
        overwrite: true
      });
    });

    if (!doResume) return;

    if (resumeTimeout) clearTimeout(resumeTimeout);
    resumeTimeout = setTimeout(() => {
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
    }, 520); // slightly longer wait so spring fully settles before spin resumes
  }

  // ── mousemove ──
  window.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    // smoother follow — slightly more lag feels premium
    gsap.to(cursor, { x: mouseX, y: mouseY, duration: 0.14, ease: 'power3.out' });

    const allTargets = document.querySelectorAll('.cursor-target');
    let closest = null, closestDist = Infinity, closestArea = Infinity;
    allTargets.forEach(el => {
      const rect = el.getBoundingClientRect();
      const dist = distToRect(mouseX, mouseY, rect);
      const area = rect.width * rect.height;
      if (dist < closestDist || (dist === closestDist && area < closestArea)) {
        closestDist = dist; closestArea = area; closest = el;
      }
    });

    if (closest && closestDist <= SNAP_THRESHOLD) {
      snapTo(closest);
      updateSnap();
    } else if (isSnapped && closestDist > SNAP_THRESHOLD + RELEASE_BUFFER) {
      releaseSnap(true);
    } else if (isSnapped) {
      updateSnap();
    }
  });

  // ── click — deeper press feel ──
  window.addEventListener('mousedown', () => {
    gsap.to(dot,    { scale: 0.5,  duration: 0.12, ease: 'power2.in' });
    gsap.to(cursor, { scale: 0.82, duration: 0.12, ease: 'power2.in' });
  });
  window.addEventListener('mouseup', () => {
    gsap.to(dot,    { scale: 1, duration: 0.45, ease: 'elastic.out(1, 0.5)' });
    gsap.to(cursor, { scale: 1, duration: 0.4,  ease: 'elastic.out(1, 0.5)' });
  });

  // ── scroll ──
  window.addEventListener('scroll', () => {
    if (!isSnapped || !activeTarget) return;
    const dist = distToRect(mouseX, mouseY, activeTarget.getBoundingClientRect());
    if (dist > SNAP_THRESHOLD + RELEASE_BUFFER) releaseSnap(true);
  }, { passive: true });

})();

// ── SOCIAL FLASHCARD DECK ──
(function initFlashDeck() {
  const deck     = document.getElementById('flashDeck');
  const scroller = document.getElementById('flashScroller');
  if (!deck || !scroller) return;

  // ── show / hide logic — driven by scroll position ──
  let isVisible = false;
  let ready     = false; // blocks trigger until page has settled

  function showDeck() {
    if (isVisible || !ready) return;
    isVisible = true;
    deck.classList.add('visible');
  }

  function hideDeck() {
    if (!isVisible) return;
    isVisible = false;
    deck.classList.remove('visible');
    setTimeout(() => { scroller.scrollTop = 0; }, 750);
  }

  // Wait 600ms after load before enabling — lets browser restore scroll,
  // page animate in, and reveal observer settle without triggering cards
  window.addEventListener('load', () => {
    // force scroll to top so restored position doesn't trigger immediately
    window.scrollTo(0, 0);
    setTimeout(() => { ready = true; }, 600);
  });

  window.addEventListener('scroll', () => {
    if      (window.scrollY > 80) showDeck();
    else if (window.scrollY < 30) hideDeck();
  }, { passive: true });

  if (false) {
    closeBtn.addEventListener('click', hideDeck);
  }

  // ── capture wheel over deck → scroll cards, not page ──
  deck.addEventListener('wheel', e => {
    const atTop    = scroller.scrollTop <= 0;
    const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;

    // at top scrolling up → let page scroll (hides the deck)
    // at bottom scrolling down → let page scroll
    // otherwise → scroll cards only
    if ((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0)) return;

    e.preventDefault();
    scroller.scrollTop += e.deltaY;
  }, { passive: false });

  // touch support
  let touchStartY = 0;
  deck.addEventListener('touchstart', e => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  deck.addEventListener('touchmove', e => {
    const delta    = touchStartY - e.touches[0].clientY;
    touchStartY    = e.touches[0].clientY;
    const atTop    = scroller.scrollTop <= 0;
    const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;

    if ((atTop && delta < 0) || (atBottom && delta > 0)) return;

    scroller.scrollTop += delta;
    e.preventDefault();
  }, { passive: false });
  let cursorHideTimer = null;
  scroller.addEventListener('scroll', () => {
    scroller.style.cursor = 'none';
    clearTimeout(cursorHideTimer);
    cursorHideTimer = setTimeout(() => {
      scroller.style.cursor = '';
    }, 400);
  }, { passive: true });

  // ── ScrollStack — port of React component (internal scroll mode) ──
  const cards = Array.from(scroller.querySelectorAll('.scroll-stack-card'));
  const endEl = scroller.querySelector('.scroll-stack-end');
  const dots  = Array.from(document.querySelectorAll('.flashdeck-dot'));
  if (!cards.length) return;

  const ITEM_DISTANCE   = 12;
  const ITEM_SCALE      = 0.03;
  const ITEM_STACK_DIST = 30;
  const STACK_POS       = 0.20;
  const SCALE_END_POS   = 0.10;
  const BASE_SCALE      = 0.85;

  cards.forEach((card, i) => {
    if (i < cards.length - 1) card.style.marginBottom = ITEM_DISTANCE + 'px';
    card.style.transformOrigin    = 'top center';
    card.style.backfaceVisibility = 'hidden';
    card.style.perspective        = '1000px';
    card.style.willChange         = 'transform, filter';
  });

  const lastTransforms = new Map();

  function calcProgress(scrollTop, start, end) {
    if (scrollTop <= start) return 0;
    if (scrollTop >= end)   return 1;
    return (scrollTop - start) / (end - start);
  }

  function updateDots(scrollTop, containerH) {
    const stackPosPx = STACK_POS * containerH;
    let topIdx = 0;
    cards.forEach((card, i) => {
      if (scrollTop >= card.offsetTop - stackPosPx - ITEM_STACK_DIST * i) topIdx = i;
    });
    dots.forEach((d, i) => d.classList.toggle('active', i === topIdx));
    // only the top card should be a cursor snap target
    cards.forEach((card, i) => card.classList.toggle('cursor-target', i === topIdx));
  }

  function update() {
    const scrollTop  = scroller.scrollTop;
    const contH      = scroller.clientHeight;
    const stackPosPx = STACK_POS    * contH;
    const scaleEndPx = SCALE_END_POS * contH;
    const endTop     = endEl ? endEl.offsetTop : 0;

    cards.forEach((card, i) => {
      const cardTop      = card.offsetTop;
      const triggerStart = cardTop - stackPosPx - ITEM_STACK_DIST * i;
      const triggerEnd   = cardTop - scaleEndPx;
      const pinEnd       = endTop - contH / 2;

      const scaleProgress = calcProgress(scrollTop, triggerStart, triggerEnd);
      const targetScale   = BASE_SCALE + i * ITEM_SCALE;
      const scale         = 1 - scaleProgress * (1 - targetScale);

      let ty = 0;
      if (scrollTop >= triggerStart && scrollTop <= pinEnd) {
        ty = scrollTop - cardTop + stackPosPx + ITEM_STACK_DIST * i;
      } else if (scrollTop > pinEnd) {
        ty = pinEnd - cardTop + stackPosPx + ITEM_STACK_DIST * i;
      }

      const newTY = Math.round(ty    * 100)  / 100;
      const newSC = Math.round(scale * 1000) / 1000;
      const last  = lastTransforms.get(i);
      if (!last || Math.abs(last.ty - newTY) > 0.1 || Math.abs(last.sc - newSC) > 0.001) {
        card.style.transform = `translate3d(0,${newTY}px,0) scale(${newSC})`;
        lastTransforms.set(i, { ty: newTY, sc: newSC });
      }
    });

    updateDots(scrollTop, contH);
  }

  scroller.addEventListener('scroll', update, { passive: true });
  update();
})();
