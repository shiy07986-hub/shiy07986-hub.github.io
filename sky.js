(() => {
  const root=document.documentElement;
  const sky=document.querySelector('.sky');
  const field=document.getElementById('starField');
  const orbitStar=document.getElementById('distantPlanet');
  const meteor=document.getElementById('meteor');
  const orbitPath=document.getElementById('orbitPath');
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let seed=17112024;
  function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
  for(let i=0;i<180;i++){
    const star=document.createElement('i');
    let x=random()*100,y=random()*95;
    if(x>34 && x<66 && y>22 && y<61)x=x<50?x-22:x+22;
    const size=.6+random()*1.6;
    star.className=`star${i%5===0?' twinkle':''}${i>68?' deep-star':''}`;
    star.style.cssText=`left:${x}%;top:${y}%;width:${size}px;height:${size}px;--star-opacity:${.3+random()*.6};animation-delay:${-random()*14}s;animation-duration:${6+random()*8}s`;
    field.append(star);
  }
  let night=0,home=!location.hash.includes('memories'),paused=false,meteorTimer=0;
  let orbitFrame=0,lastTime=0,angle=-Math.PI*.32,orbitClock=0;
  const clamp=v=>Math.max(0,Math.min(1,v));
  function orbitPosition(theta) {
    // The star and its visible trail use exactly the same fixed ellipse.
    return {x:innerWidth*(.5+.58*Math.cos(theta)),y:innerHeight*(.4+.34*Math.sin(theta)+.08*Math.cos(theta))};
  }
  function drawOrbit() {
    const points=Array.from({length:129},(_,i)=>orbitPosition(i*Math.PI*2/128));
    orbitPath.setAttribute('d',points.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')+' Z');
  }
  function paintOrbit(){
    const {x,y}=orbitPosition(angle);
    orbitStar.style.transform=`translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
    orbitStar.dataset.angle=angle.toFixed(4);
  }
  function orbit(time){
    orbitFrame=0;
    if(!home || paused || document.hidden || motion.matches)return;
    if(lastTime){
      const dt=Math.min((time-lastTime)/1000,.1);
      angle+=dt*Math.PI*2/180;
    }
    lastTime=time;
    if(time-orbitClock>32){paintOrbit();orbitClock=time;}
    orbitFrame=requestAnimationFrame(orbit);
  }
  function startOrbit(){
    paintOrbit();
    if(!orbitFrame && home && !paused && !document.hidden && !motion.matches){lastTime=0;orbitFrame=requestAnimationFrame(orbit);}
  }
  function stopOrbit(){cancelAnimationFrame(orbitFrame);orbitFrame=0;}
  function canMeteor(){return !paused&&!document.hidden&&!motion.matches&&night>.12;}
  function stopMeteor(){clearTimeout(meteorTimer);meteorTimer=0;meteor.classList.remove('is-visible');}
  function scheduleMeteor(delay=18000+random()*15000){
    if(meteorTimer||!canMeteor())return;
    meteorTimer=setTimeout(()=>{
      meteorTimer=0;if(!canMeteor())return;
      meteor.style.left=`${12+random()*70}%`;meteor.style.top=`${8+random()*22}%`;
      meteor.classList.remove('is-visible');void meteor.offsetWidth;meteor.classList.add('is-visible');
      scheduleMeteor(60000+random()*60000);
    },delay);
  }
  window.addEventListener('earthlight',event=>{
    const h=event.detail.minutes/60;
    night=h<6?clamp((6-h)/1.5):clamp((h-18)/3);
    const deep=h<7?clamp((6-h)/1.5):clamp((h-21)/2);
    root.style.setProperty('--night-strength',night.toFixed(3));
    root.style.setProperty('--deep-night',deep.toFixed(3));
    root.style.setProperty('--cloud-strength',(1-night).toFixed(3));
    root.style.setProperty('--orbit-core',`rgb(${Math.round(255-26*night)} ${Math.round(242-4*night)} ${Math.round(215+40*night)})`);
    root.dataset.skyPeriod=night>.8?'night':night>.1?'twilight':'day';
    if(!canMeteor())stopMeteor();else scheduleMeteor();
  });
  window.addEventListener('earthvisibility',event=>{
    home=event.detail;
    if(home)startOrbit();else stopOrbit();
    if(canMeteor())scheduleMeteor();
  });
  window.addEventListener('skypause',event=>{
    paused=event.detail;sky.classList.toggle('is-paused',paused);
    if(paused){stopOrbit();stopMeteor();}else{startOrbit();scheduleMeteor();}
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){stopOrbit();stopMeteor();}else{startOrbit();scheduleMeteor();}
  });
  motion.addEventListener('change',()=>{
    if(motion.matches){stopOrbit();stopMeteor();}else{startOrbit();scheduleMeteor();}
  });
  window.addEventListener('resize',()=>{drawOrbit();paintOrbit();});
  drawOrbit();startOrbit();
})();
