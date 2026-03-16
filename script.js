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


// ----edit---
function initBlurText() {
  document.querySelectorAll('[data-blur-text]').forEach(el => {
    const text      = el.textContent.trim();
    const by        = el.dataset.blurBy || 'words';       // 'words' or 'chars'
    const direction = el.dataset.blurDir || 'top';        // 'top' or 'bottom'
    const delay     = parseInt(el.dataset.blurDelay) || 120; // ms between each word/char

    const segments = by === 'words' ? text.split(' ') : text.split('');
    el.textContent = '';
    el.classList.add('blur-text-wrapper');

    segments.forEach((seg, i) => {
      const span = document.createElement('span');
      span.classList.add('blur-text-word');
      span.textContent = seg === ' ' ? '\u00A0' : seg;
      if (by === 'words' && i < segments.length - 1) span.textContent += '\u00A0';
      el.appendChild(span);
    });

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      el.querySelectorAll('.blur-text-word').forEach((span, i) => {
        span.style.animationDelay = `${(i * delay) / 800}s`;
        span.classList.add(direction === 'top' ? 'animate-top' : 'animate-bottom');
      });
      observer.unobserve(el);
    }, { threshold: 0.1 });

    observer.observe(el);
  });
}

initBlurText();
