const START_DATE = new Date(2024, 10, 17);
const photoSources = Array.isArray(window.PHOTO_SOURCES) ? window.PHOTO_SOURCES : [];

const photoGrid = document.getElementById('photoGrid');
photoSources.forEach((src, index) => {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = `photo-card reveal${index === 0 ? ' photo-tall' : ''}${index === 3 ? ' photo-wide' : ''}`;
  card.dataset.index = String(index);
  card.setAttribute('aria-label', `查看照片 ${index + 1}`);
  const image = document.createElement('img');
  image.src = src;
  image.alt = `我们的照片 ${index + 1}`;
  image.loading = 'lazy';
  card.appendChild(image);
  photoGrid.appendChild(card);
});

const palettes = {
  night:   { top:'#101a38', mid:'#303f6c', bottom:'#6d6178', sun:'#d7dcff', ink:'#f7f8ff', muted:'rgba(247,248,255,.72)', glass:'rgba(25,34,67,.36)', edge:'rgba(255,255,255,.25)', shadow:'rgba(2,7,21,.32)', label:'夜色正好' },
  dawn:    { top:'#748db1', mid:'#c99d9f', bottom:'#f2c6a2', sun:'#ffe3b5', ink:'#17243a', muted:'rgba(23,36,58,.66)', glass:'rgba(255,255,255,.26)', edge:'rgba(255,255,255,.5)', shadow:'rgba(46,42,64,.18)', label:'晨光初醒' },
  morning: { top:'#76b2dd', mid:'#bad8e5', bottom:'#e7dcc3', sun:'#fff1b2', ink:'#102b43', muted:'rgba(16,43,67,.66)', glass:'rgba(255,255,255,.31)', edge:'rgba(255,255,255,.62)', shadow:'rgba(48,91,117,.15)', label:'早安，今天也在一起' },
  noon:    { top:'#4ca1dc', mid:'#9ccce9', bottom:'#e4eff1', sun:'#fffbd9', ink:'#0d3048', muted:'rgba(13,48,72,.65)', glass:'rgba(255,255,255,.30)', edge:'rgba(255,255,255,.66)', shadow:'rgba(24,82,116,.16)', label:'日光明亮' },
  afternoon:{ top:'#68a7d4', mid:'#b6cfdb', bottom:'#eed3ad', sun:'#ffe29b', ink:'#183047', muted:'rgba(24,48,71,.66)', glass:'rgba(255,255,255,.3)', edge:'rgba(255,255,255,.6)', shadow:'rgba(46,73,89,.17)', label:'午后微光' },
  sunset:  { top:'#657da6', mid:'#d69285', bottom:'#f2bd87', sun:'#ffca76', ink:'#2b2631', muted:'rgba(43,38,49,.67)', glass:'rgba(255,246,238,.29)', edge:'rgba(255,255,255,.5)', shadow:'rgba(70,39,52,.19)', label:'晚霞时分' },
  evening: { top:'#27345b', mid:'#726380', bottom:'#b87e78', sun:'#f4c99d', ink:'#fff9f2', muted:'rgba(255,249,242,.72)', glass:'rgba(34,40,75,.32)', edge:'rgba(255,255,255,.27)', shadow:'rgba(8,13,34,.3)', label:'暮色温柔' }
};

function getPeriod(hour) {
  if (hour < 5) return 'night';
  if (hour < 7) return 'dawn';
  if (hour < 11) return 'morning';
  if (hour < 14) return 'noon';
  if (hour < 17) return 'afternoon';
  if (hour < 19) return 'sunset';
  if (hour < 21) return 'evening';
  return 'night';
}

function applyTimePalette(minutes) {
  const hour = minutes / 60;
  const key = getPeriod(hour);
  const p = palettes[key];
  const root = document.documentElement;
  root.style.setProperty('--sky-top', p.top);
  root.style.setProperty('--sky-mid', p.mid);
  root.style.setProperty('--sky-bottom', p.bottom);
  root.style.setProperty('--sun-color', p.sun);
  root.style.setProperty('--ink', p.ink);
  root.style.setProperty('--muted', p.muted);
  root.style.setProperty('--glass', p.glass);
  root.style.setProperty('--glass-edge', p.edge);
  root.style.setProperty('--glass-shadow', p.shadow);
  document.getElementById('periodLabel').textContent = p.label;
  document.querySelector('meta[name="theme-color"]').setAttribute('content', p.top);

  const daylightProgress = Math.max(0, Math.min(1, (hour - 5) / 15));
  root.style.setProperty('--sun-x', `${10 + daylightProgress * 80}%`);
  root.style.setProperty('--sun-y', `${70 - Math.sin(daylightProgress * Math.PI) * 55}%`);
  document.querySelector('.sun').style.opacity = hour >= 5 && hour <= 20 ? '.78' : '.13';
}

const colorTime = document.getElementById('colorTime');
const colorTimeLabel = document.getElementById('colorTimeLabel');
const resetColorTime = document.getElementById('resetColorTime');
const colorControl = document.querySelector('.color-control');
const colorControlToggle = document.getElementById('colorControlToggle');
let colorOverrideMinutes = null;

function getBeijingParts(now) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(now);
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
}

function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60).toString().padStart(2, '0');
  const mins = Math.floor(minutes % 60).toString().padStart(2, '0');
  return `${hours}:${mins}`;
}

function updateColorControl(realMinutes) {
  const activeMinutes = colorOverrideMinutes ?? realMinutes;
  colorTime.value = activeMinutes;
  colorTimeLabel.textContent = formatMinutes(activeMinutes);
  applyTimePalette(activeMinutes);
}

function updateClock() {
  const now = new Date();
  const beijing = getBeijingParts(now);
  const elapsed = Math.floor((Date.UTC(beijing.year, beijing.month - 1, beijing.day) - Date.UTC(2024, 10, 17)) / 86400000) + 1;
  document.getElementById('dayCount').textContent = Math.max(1, elapsed).toLocaleString('zh-CN');
  document.getElementById('todayDate').textContent = new Intl.DateTimeFormat('zh-CN', { timeZone:'Asia/Shanghai', year:'numeric', month:'long', day:'numeric', weekday:'short' }).format(now);
  document.getElementById('localTime').textContent = new Intl.DateTimeFormat('zh-CN', { timeZone:'Asia/Shanghai', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' }).format(now);
  updateColorControl(beijing.hour * 60 + beijing.minute);
}

colorTime.addEventListener('input', () => {
  colorOverrideMinutes = Number(colorTime.value);
  updateColorControl(colorOverrideMinutes);
});

resetColorTime.addEventListener('click', () => {
  colorOverrideMinutes = null;
  updateClock();
});

colorControlToggle.addEventListener('click', () => {
  const minimized = colorControl.classList.toggle('is-minimized');
  colorControlToggle.setAttribute('aria-expanded', String(!minimized));
  colorControlToggle.setAttribute('aria-label', minimized ? '展开日光调节' : '最小化日光调节');
  colorControlToggle.title = minimized ? '展开日光调节' : '最小化日光调节';
});

const scrollToMemories = document.getElementById('scrollToMemories');
scrollToMemories.addEventListener('click', () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  scrollToMemories.classList.add('is-activating');
  window.setTimeout(() => {
    document.querySelector('.memories').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    scrollToMemories.classList.remove('is-activating');
  }, reduceMotion ? 0 : 180);
});

const heroCard = document.querySelector('.hero-card');
let rafId = 0;
window.addEventListener('pointermove', (event) => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || event.pointerType === 'touch') return;
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    const x = event.clientX / innerWidth - .5;
    const y = event.clientY / innerHeight - .5;
    heroCard.style.setProperty('--tilt-x', `${-y * 2.2}deg`);
    heroCard.style.setProperty('--tilt-y', `${x * 2.8}deg`);
    heroCard.style.setProperty('--move-x', `${x * 5}px`);
    heroCard.style.setProperty('--move-y', `${y * 4}px`);
    heroCard.style.setProperty('--pointer-x', `${event.clientX / innerWidth * 100}%`);
    heroCard.style.setProperty('--pointer-y', `${event.clientY / innerHeight * 100}%`);
  });
});

const observer = new IntersectionObserver(entries => {
  entries.forEach((entry, index) => {
    if (entry.isIntersecting) {
      entry.target.style.transitionDelay = `${Math.min(index * 60, 240)}ms`;
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: .12 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightboxImage');
const imagePosition = document.getElementById('imagePosition');
let currentPhoto = 0;

function showPhoto(index) {
  currentPhoto = (index + photoSources.length) % photoSources.length;
  lightboxImage.src = photoSources[currentPhoto];
  imagePosition.textContent = `${currentPhoto + 1} / ${photoSources.length}`;
}

document.querySelectorAll('.photo-card').forEach(card => card.addEventListener('click', () => {
  showPhoto(Number(card.dataset.index));
  lightbox.showModal();
}));
document.querySelector('.close-button').addEventListener('click', () => lightbox.close());
document.querySelector('.prev').addEventListener('click', () => showPhoto(currentPhoto - 1));
document.querySelector('.next').addEventListener('click', () => showPhoto(currentPhoto + 1));
lightbox.addEventListener('click', event => { if (event.target === lightbox) lightbox.close(); });
lightbox.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') showPhoto(currentPhoto - 1);
  if (event.key === 'ArrowRight') showPhoto(currentPhoto + 1);
});

updateClock();
setInterval(updateClock, 1000);
