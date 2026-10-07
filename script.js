(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const root = document.documentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const sources = Array.isArray(window.PHOTO_SOURCES) ? window.PHOTO_SOURCES : [];
  const dimensions = window.PHOTO_DIMENSIONS || {};
  const home = $('#home');
  const gallery = $('#memories');
  const grid = $('#photoGrid');
  const colorControl = $('.color-control');
  let previewMinutes = null;
  let galleryScroll = 0;
  let navigating = false;
  let activeView = 'home';
  let currentPhoto = 0;
  let lastCard = null;
  let layoutFrame = 0;

  // Continuous color interpolation keeps the sky smooth across period boundaries.
  const stops = [
    { h:0, top:'#101b32', mid:'#283958', bottom:'#686b86', sun:'#c9ddff', label:'夜色正好' },
    { h:5, top:'#25354f', mid:'#746779', bottom:'#bb9492', sun:'#e5c9bc', label:'晨光初醒' },
    { h:7, top:'#91b4d2', mid:'#c1ced8', bottom:'#efdbc5', sun:'#ffe3b6', label:'早安，今天也在一起' },
    { h:12, top:'#85b8dc', mid:'#bad8eb', bottom:'#e5eced', sun:'#fff3d1', label:'日光明亮' },
    { h:16, top:'#90accb', mid:'#c3cbd5', bottom:'#e7d1bd', sun:'#ffe0b0', label:'午后微光' },
    { h:18, top:'#757d9d', mid:'#b38d9b', bottom:'#e0ac94', sun:'#ffc59b', label:'晚霞时分' },
    { h:20, top:'#263650', mid:'#5f617e', bottom:'#9e818f', sun:'#e9c5b5', label:'暮色温柔' },
    { h:24, top:'#101b32', mid:'#283958', bottom:'#686b86', sun:'#c9ddff', label:'夜色正好' }
  ];
  function mix(a,b,t) {
    const av = a.match(/[a-f\d]{2}/gi).map(v => parseInt(v,16));
    const bv = b.match(/[a-f\d]{2}/gi).map(v => parseInt(v,16));
    return '#' + av.map((v,i) => Math.round(v+(bv[i]-v)*t).toString(16).padStart(2,'0')).join('');
  }
  function updatePalette(minutes) {
    const h = minutes/60;
    const i = stops.findIndex((s,index) => index < stops.length-1 && h >= s.h && h < stops[index+1].h);
    const a = stops[Math.max(0,i)], b = stops[Math.max(0,i)+1];
    const t = (h-a.h)/(b.h-a.h);
    const palette = {};
    for (const key of ['top','mid','bottom','sun']) palette[key] = mix(a[key],b[key],t);
    root.style.setProperty('--sky-top',palette.top);
    root.style.setProperty('--sky-mid',palette.mid);
    root.style.setProperty('--sky-bottom',palette.bottom);
    root.style.setProperty('--sun-color',palette.sun);
    const daylight = Math.max(0,Math.sin((h-5)/15*Math.PI));
    const isLight = h >= 6.5 && h < 18.3;
    root.style.setProperty('--ink',isLight ? '#20344b' : '#f6f8fc');
    root.style.setProperty('--muted',isLight ? 'rgba(32,52,75,.75)' : 'rgba(246,248,252,.74)');
    root.style.setProperty('--stars-opacity',String((1-daylight)*.6));
    root.style.setProperty('--sun-x',`${15 + Math.min(1,Math.max(0,(h-5)/15))*70}%`);
    $('#periodLabel').textContent = t < .5 ? a.label : b.label;
    $('meta[name="theme-color"]').content = palette.top;
    window.earthLighting = { minutes, daylight, color:palette.sun };
    window.dispatchEvent(new CustomEvent('earthlight',{detail:window.earthLighting}));
  }
  function beijingParts(date) {
    return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type,Number(p.value)]));
  }
  function updateClock() {
    const now = new Date(), p = beijingParts(now);
    const days = Math.floor((Date.UTC(p.year,p.month-1,p.day)-Date.UTC(2024,10,17))/86400000)+1;
    const next = String(Math.max(1,days));
    if ($('#dayCount').textContent !== next) { $('#dayCount').textContent = next; positionEarth(); }
    $('#localTime').textContent = [p.hour,p.minute,p.second].map(v => String(v).padStart(2,'0')).join(':');
    $('#todayDate').textContent = `${p.year}.${String(p.month).padStart(2,'0')}.${String(p.day).padStart(2,'0')}`;
    const minutes = previewMinutes ?? (p.hour*60+p.minute);
    syncLightDial(minutes);
    if (minutes !== window.earthLighting?.minutes) updatePalette(minutes);
  }
  function minimizeColor(minimized) {
    colorControl.classList.toggle('is-minimized',minimized);
    $('#colorControlToggle').setAttribute('aria-expanded',String(!minimized));
    $('#colorControlToggle').setAttribute('aria-label',minimized ? '展开光照设置' : '最小化光照设置');
    $('.color-control-body').inert = minimized;
  }
  $('#colorControlToggle').addEventListener('click',() => minimizeColor(!colorControl.classList.contains('is-minimized')));
  const lightDial = $('#colorTime');
  let dialAngle = null;
  let dialPointer = null;
  let dialMinutes = 0;
  function lightPeriod(minutes) {
    if(minutes < 300) return '凌晨';
    if(minutes < 660) return '早晨';
    if(minutes < 840) return '中午';
    if(minutes < 1020) return '下午';
    if(minutes < 1200) return '傍晚';
    return '夜晚';
  }
  function syncLightDial(minutes) {
    dialMinutes = minutes;
    const angle = minutes / 1440 * 360;
    // Unwrap the angle so crossing midnight and aligning to now take the shortest route.
    dialAngle = dialAngle === null ? angle : dialAngle + ((angle-dialAngle+540)%360+360)%360-180;
    lightDial.style.setProperty('--dial-angle',`${dialAngle}deg`);
    lightDial.setAttribute('aria-valuenow',String(minutes));
    const period = lightPeriod(minutes);
    lightDial.setAttribute('aria-valuetext',period);
    const label = $('#colorTimeLabel');
    if(label.textContent !== period) {
      label.textContent = period;
      if(!reducedMotion.matches) {
        label.getAnimations().forEach(animation => animation.cancel());
        label.animate([{opacity:.3,transform:'translateY(3px)'},{opacity:1,transform:'translateY(0)'}],{duration:280,easing:'ease-out'});
      }
    }
  }
  function chooseLight(minutes) {
    previewMinutes = ((Math.round(minutes)%1440)+1440)%1440;
    updateClock();
  }
  function choosePointer(event) {
    const rect=lightDial.getBoundingClientRect();
    const x=event.clientX-rect.left-rect.width/2;
    const y=event.clientY-rect.top-rect.height/2;
    if(Math.hypot(x,y)<rect.width*.23) return;
    const angle=(Math.atan2(x,-y)+Math.PI*2)%(Math.PI*2);
    chooseLight(angle/(Math.PI*2)*1440);
  }
  lightDial.addEventListener('pointerdown',event => {
    if(event.button!==0) return;
    const rect=lightDial.getBoundingClientRect();
    if(Math.hypot(event.clientX-rect.left-rect.width/2,event.clientY-rect.top-rect.height/2)<rect.width*.23) return;
    dialPointer=event.pointerId;
    lightDial.classList.add('is-dragging');
    lightDial.setPointerCapture(dialPointer);
    lightDial.focus({preventScroll:true});
    choosePointer(event);
  });
  lightDial.addEventListener('pointermove',event => {if(event.pointerId===dialPointer) choosePointer(event);});
  function endLightDrag(event) {
    if(event.pointerId!==dialPointer) return;
    dialPointer=null;lightDial.classList.remove('is-dragging');
    if(lightDial.hasPointerCapture(event.pointerId)) lightDial.releasePointerCapture(event.pointerId);
  }
  lightDial.addEventListener('pointerup',endLightDrag);
  lightDial.addEventListener('pointercancel',endLightDrag);
  lightDial.addEventListener('lostpointercapture',() => {dialPointer=null;lightDial.classList.remove('is-dragging');});
  lightDial.addEventListener('keydown',event => {
    const steps={ArrowRight:15,ArrowUp:15,ArrowLeft:-15,ArrowDown:-15,PageUp:60,PageDown:-60};
    if(event.key in steps) {event.preventDefault();chooseLight(dialMinutes+steps[event.key]*(event.shiftKey?4:1));}
    else if(event.key==='Home') {event.preventDefault();chooseLight(0);}
    else if(event.key==='End') {event.preventDefault();chooseLight(1439);}
  });
  for(let i=0;i<24;i++) {
    const tick=document.createElementNS('http://www.w3.org/2000/svg','line');
    const angle=i*Math.PI/12,major=i%6===0;
    tick.setAttribute('x1',String(108+Math.sin(angle)*100));
    tick.setAttribute('y1',String(108-Math.cos(angle)*100));
    tick.setAttribute('x2',String(108+Math.sin(angle)*(major?106:103)));
    tick.setAttribute('y2',String(108-Math.cos(angle)*(major?106:103)));
    tick.setAttribute('class',major?'major-tick':'');
    $('#dialTicks').append(tick);
  }
  $('#resetColorTime').addEventListener('click',() => { previewMinutes = null; updateClock(); });

  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
  }),{threshold:.04,rootMargin:'100px'});
  observer.observe($('.gallery-ending'));
  const cards = sources.map((src,index) => {
    const card = document.createElement('button');
    card.type = 'button'; card.className = 'photo-card'; card.setAttribute('aria-label',`查看我们的照片 ${index+1}`);
    const img = new Image();
    const [width,height] = dimensions[src] || [4,3];
    img.width = width; img.height = height; img.alt = `我们的照片 ${index+1}`;
    img.loading = index < 4 ? 'eager' : 'lazy'; img.decoding = 'async';
    img.addEventListener('load',queueLayout);
    img.addEventListener('error',() => { card.classList.add('is-error'); card.setAttribute('aria-label',`照片 ${index+1} 暂时无法加载`); });
    img.src = src; card.append(img); grid.append(card); observer.observe(card);
    card.addEventListener('click',() => { if(card.classList.contains('is-error')) return; lastCard = card; showPhoto(index); $('#lightbox').showModal(); window.dispatchEvent(new CustomEvent('skypause',{detail:true})); });
    return card;
  });
  $('#photoCount').textContent = `${sources.length} 张回忆`;
  $('#galleryEmpty').hidden = sources.length > 0;
  function layoutPhotos() {
    if(gallery.hidden) return;
    const style = getComputedStyle(grid), cols = Number(style.getPropertyValue('--columns')) || 3;
    const gap = Number.parseFloat(style.getPropertyValue('--gap')) || 24;
    const width = (grid.clientWidth-gap*(cols-1))/cols;
    const heights = Array(cols).fill(0);
    cards.forEach(card => {
      const img = card.firstElementChild;
      const col = heights.indexOf(Math.min(...heights));
      const ratio = (img.naturalHeight || img.height)/(img.naturalWidth || img.width);
      const height = width*ratio;
      card.style.width = `${width}px`; card.style.height = `${height}px`;
      card.style.setProperty('--card-x',`${col*(width+gap)}px`);
      card.style.setProperty('--card-y',`${heights[col]}px`);
      heights[col] += height+gap;
    });
    grid.style.height = `${Math.max(0,...heights)- (cards.length ? gap : 0)}px`;
  }
  function queueLayout() { cancelAnimationFrame(layoutFrame); layoutFrame = requestAnimationFrame(layoutPhotos); }
  new ResizeObserver(queueLayout).observe(grid);
  function positionEarth() {
    if(home.hidden) return;
    const count = $('#dayCount');
    const stage = $('.earth-stage');
    // Derive the centered layout without measuring animated transforms.
    const top = home.clientHeight / 2 - count.offsetHeight / 2;
    stage.style.top = `${top+count.offsetHeight-stage.clientWidth*.16-count.offsetHeight*.08}px`;
    home.style.setProperty('--count-width',`${count.offsetWidth}px`);
    $('.hero-date').style.top = `${top+count.offsetHeight+36}px`;
  }
  new ResizeObserver(positionEarth).observe(home);
  document.fonts.ready.then(positionEarth);
  function scatterScene(reverse=false) {
    const distance=Math.min(innerWidth,1100)*.17;
    const targets=[
      ['.names',-distance,-100,1],['.clock',distance,-100,1],
      ['.hero-copy .eyebrow',-distance*.7,-90,1],['#hero-title',0,-145,1.1],['.hero-unit',distance*.35,100,1],
      ['.hero-date .date-line',-distance*.75,105,1],['#periodLabel',distance*.75,110,1],
      ['.earth-stage',0,innerHeight*.3,.9],['.earth-tools',-distance*.6,130,1],
      ['#enterGallery',0,125,1],['.hero-bottom .quiet-note:first-child',-distance,90,1],
      ['.hero-bottom .quiet-note:last-child',distance,90,1],['.color-control',90,70,1],
      ['.stars',0,-80,1.15],['.nebula',distance,0,1.25],['.day-clouds',-distance,0,1.2],
      ['.orbit-track',distance,-90,1],['.distant-planet',distance,-90,1],['.meteor',distance,-60,1],['.sky-light',-distance,-70,1.2],['.sky-haze',distance,90,1.15]
    ];
    return targets.flatMap(([selector,x,y,scale])=>{
      const el=$(selector);if(!el || el.hidden || getComputedStyle(el).display==='none')return [];
      const base=getComputedStyle(el).transform==='none'?'':getComputedStyle(el).transform;
      const opacity=getComputedStyle(el).opacity;
      const keyframes=[{transform:base || 'none',opacity},{transform:`${base} translate3d(${x}px,${y}px,0) scale(${scale})`,opacity:0}];
      if(reverse)keyframes.reverse();
      return [el.animate(keyframes,{duration:1000,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'})];
    });
  }
  async function changeView(view,animate=true) {
    if(navigating || view===activeView) return;
    navigating = true;
    minimizeColor(true);
    const motion=animate && !reducedMotion.matches;
    const animations=[];
    home.inert=true;colorControl.inert=true;gallery.inert=true;
    if(view==='memories') {
      gallery.hidden=false;gallery.classList.add('is-transition-layer');
      layoutPhotos();gallery.scrollTop=galleryScroll;
      if(motion){
        animations.push(...scatterScene());
        animations.push(gallery.animate([{opacity:0,filter:'blur(10px)',transform:'scale(.985)'},{opacity:1,filter:'blur(0px)',transform:'scale(1)'}],{duration:850,delay:180,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'}));
        await Promise.all(animations.map(a=>a.finished.catch(()=>{})));
      }
      home.hidden=true;gallery.classList.remove('is-transition-layer');activeView='memories';
      $('.sky').classList.add('is-gallery');
      window.dispatchEvent(new CustomEvent('earthvisibility',{detail:false}));
      layoutPhotos(); window.scrollTo({top:galleryScroll,behavior:'instant'});
      $('#memories-title').focus({preventScroll:true});
    } else {
      galleryScroll = window.scrollY;
      home.hidden=false;gallery.classList.add('is-transition-layer');gallery.scrollTop=galleryScroll;
      window.scrollTo({top:0,behavior:'instant'});
      positionEarth();
      window.dispatchEvent(new CustomEvent('earthvisibility',{detail:true}));
      $('.sky').classList.remove('is-gallery');
      if(motion){
        animations.push(...scatterScene(true));
        animations.push(gallery.animate([{opacity:1},{opacity:0}],{duration:650,easing:'ease',fill:'both'}));
        await Promise.all(animations.map(a=>a.finished.catch(()=>{})));
      }
      gallery.hidden=true;gallery.classList.remove('is-transition-layer');activeView='home';
      $('#enterGallery').focus({preventScroll:true});
    }
    animations.forEach(a=>a.cancel());
    home.inert=false;gallery.inert=false;colorControl.inert=false;
    if(view==='memories')$('#memories-title').focus({preventScroll:true});
    else $('#enterGallery').focus({preventScroll:true});
    navigating = false;
    const desired = view === 'memories' ? '#memories' : '#home';
    if(location.hash !== desired) history.pushState(null,'',desired);
  }
  $('#enterGallery').addEventListener('click',e => {e.preventDefault();changeView('memories');});
  $('#backHome').addEventListener('click',e => {e.preventDefault();changeView('home');});
  window.addEventListener('popstate',() => changeView(location.hash==='#memories' ? 'memories' : 'home',false));
  if(location.hash==='#memories') changeView('memories',false);
  let pointerFrame = 0;
  home.addEventListener('pointermove',e => {
    if(reducedMotion.matches || e.pointerType==='touch' || navigating || $('.earth-stage').classList.contains('is-dragging')) return;
    cancelAnimationFrame(pointerFrame);
    pointerFrame = requestAnimationFrame(() => {
      const x = e.clientX/innerWidth-.5, y = e.clientY/innerHeight-.5;
      root.style.setProperty('--text-x',`${x*6}px`); root.style.setProperty('--text-y',`${y*4}px`);
      root.style.setProperty('--earth-x',`${x*13}px`); root.style.setProperty('--earth-y',`${y*8}px`);
      root.style.setProperty('--stars-x',`${x*2}px`);root.style.setProperty('--stars-y',`${y*2}px`);
      root.style.setProperty('--pointer-x',`${e.clientX/innerWidth*100}%`); root.style.setProperty('--pointer-y',`${e.clientY/innerHeight*100}%`);
      window.earthPointer = {x,y};
    });
  });
  home.addEventListener('pointerleave',() => { for(const name of ['text-x','text-y','earth-x','earth-y']) root.style.setProperty(`--${name}`,'0px'); window.earthPointer = {x:0,y:0}; });
  function showPhoto(index) {
    if(!sources.length) return;
    currentPhoto = (index+sources.length)%sources.length;
    $('#lightboxImage').src = sources[currentPhoto];
    $('#lightboxImage').alt = `我们的照片 ${currentPhoto+1}`;
    $('#imagePosition').textContent = `${currentPhoto+1} / ${sources.length}`;
  }
  $('.close-button').addEventListener('click',() => $('#lightbox').close());
  $('.prev').addEventListener('click',() => showPhoto(currentPhoto-1));
  $('.next').addEventListener('click',() => showPhoto(currentPhoto+1));
  $('#lightbox').addEventListener('close',() => {lastCard?.focus({preventScroll:true});window.dispatchEvent(new CustomEvent('skypause',{detail:false}));});
  $('#lightbox').addEventListener('click',e => {if(e.target === $('#lightbox')) $('#lightbox').close();});
  $('#lightbox').addEventListener('keydown',e => {if(e.key==='ArrowLeft'){e.preventDefault();showPhoto(currentPhoto-1);}if(e.key==='ArrowRight'){e.preventDefault();showPhoto(currentPhoto+1);}});
  let touchX = 0, touchY = 0;
  $('#lightboxImage').addEventListener('touchstart',e => {touchX=e.changedTouches[0].clientX;touchY=e.changedTouches[0].clientY;},{passive:true});
  $('#lightboxImage').addEventListener('touchend',e => {const dx=e.changedTouches[0].clientX-touchX,dy=e.changedTouches[0].clientY-touchY;if(Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)*1.5) showPhoto(currentPhoto+(dx<0?1:-1));},{passive:true});
  updateClock(); positionEarth(); setInterval(updateClock,1000);
})();
