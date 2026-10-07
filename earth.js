import * as THREE from './assets/vendor/three.module.js';
import { GLTFLoader } from './assets/vendor/GLTFLoader.js';

const canvas = document.getElementById('earthCanvas');
const stage = document.querySelector('.earth-stage');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const resetButton = document.getElementById('resetEarth');
const hint = document.getElementById('earthHint');
const INITIAL_YAW = -.21 + Math.PI;
const INITIAL_PITCH = -.12;

async function createEarth() {
  stage.setAttribute('aria-busy','true');
  hint.textContent = '正在唤醒我们的小星球…';
  const renderer = new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1.48,1.48,1.48,-1.48,.1,20);
  camera.position.z = 6;
  const gltf = await new GLTFLoader().loadAsync('./assets/planet/earth-cartoon.glb');
  const earth = new THREE.Group();
  const model = gltf.scene;
  model.scale.setScalar(.96);
  earth.add(model);
  const group = new THREE.Group();
  group.add(earth);scene.add(group);
  const materials = new Set();
  model.traverse(object => {
    if(!object.isMesh) return;
    // The CC BY model is adapted for this site; credit is retained in the gallery.
    if(/^ox-logo/.test(object.name)) object.visible = false;
    object.frustumCulled = !object.isSkinnedMesh;
    for (const material of [].concat(object.material)) {
      if(materials.has(material)) continue;
      materials.add(material);
      material.roughness = .88;
      material.metalness = 0;
      if(material.name.startsWith('nube')) {
        material.color.set('#fff9ee');material.opacity=.84;
        material.depthWrite=false;
      }
      if(material.map) material.map.anisotropy = Math.min(4,renderer.capabilities.getMaxAnisotropy());
    }
  });
  const mixer = new THREE.AnimationMixer(model);
  for(const clip of gltf.animations) mixer.clipAction(clip).play();
  mixer.update(0);
  const ambient = new THREE.HemisphereLight('#ddecff','#829d76',2.15);
  const sun = new THREE.DirectionalLight('#fff2d5',2.6);sun.position.set(-3,4,5);
  const fill = new THREE.DirectionalLight('#b6dfff',.7);fill.position.set(3,1,-2);
  scene.add(ambient,sun,fill);
  function setLighting(data) {
    if(!data) return;
    const progress = Math.max(0,Math.min(1,(data.minutes/60-5)/15));
    sun.position.set((progress-.5)*6,3,4);
    sun.color.set(data.color);
    sun.intensity = 1.3+data.daylight*1.3;
    ambient.color.set('#b9cdf6').lerp(new THREE.Color('#e6f4ff'),data.daylight);
    ambient.intensity = 1.6+data.daylight*.55;
    fill.intensity = .45+data.daylight*.25;
    renderer.toneMappingExposure = 1.12+data.daylight*.13;
    render();
  }
  function resize() {
    const size = stage.clientWidth;
    renderer.setSize(size,size,false);render();
  }
  let yaw=INITIAL_YAW,pitch=INITIAL_PITCH,velocityX=0,velocityY=0;
  let interacted=false,dragging=false,resetting=false;
  let pointerId=null,previousX=0,previousY=0,previousTime=0,touchOrigin=null,motionTime=0;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  function render(){
    earth.rotation.y=yaw+(!interacted && !reducedMotion.matches?Math.sin(motionTime/32)*.055:0);

    const p=window.earthPointer || {x:0,y:0};
    group.rotation.x=pitch+(reducedMotion.matches || dragging?0:p.y*.012);
    group.rotation.z=-.06+(reducedMotion.matches || dragging?0:p.x*.012);
    canvas.dataset.yaw=yaw.toFixed(4);canvas.dataset.pitch=pitch.toFixed(4);
    renderer.render(scene,camera);
  }
  function markInteracted(){interacted=true;resetting=false;resetButton.hidden=false;hint.classList.add('is-dismissed');}
  function hitSphere(event){
    const rect=canvas.getBoundingClientRect();
    const x=(event.clientX-rect.left)/rect.width*2-1,y=(event.clientY-rect.top)/rect.height*2-1;
    return x*x+y*y<.84;
  }
  canvas.addEventListener('pointerdown',event=>{
    if(!hitSphere(event) || event.button!==0)return;
    pointerId=event.pointerId;previousX=event.clientX;previousY=event.clientY;previousTime=performance.now();velocityX=0;velocityY=0;
    if(event.pointerType==='touch'){touchOrigin={x:event.clientX,y:event.clientY};return;}
    dragging=true;canvas.setPointerCapture(pointerId);stage.classList.add('is-dragging');markInteracted();
  });
  canvas.addEventListener('pointermove',event=>{
    if(event.pointerId!==pointerId)return;
    if(touchOrigin && !dragging){
      const dx=event.clientX-touchOrigin.x,dy=event.clientY-touchOrigin.y;
      if(Math.abs(dy)>Math.abs(dx) && Math.abs(dy)>8){pointerId=null;touchOrigin=null;return;}
      if(Math.abs(dx)<6)return;
      dragging=true;canvas.setPointerCapture(pointerId);stage.classList.add('is-dragging');markInteracted();
    }
    if(!dragging)return;
    const now=performance.now(),dt=Math.max(.016,(now-previousTime)/1000),scale=Math.PI*1.3/stage.clientWidth;
    const dx=(event.clientX-previousX)*scale,dy=event.pointerType==='touch'?0:(event.clientY-previousY)*scale*.65;
    yaw+=dx;pitch=clamp(pitch+dy,-.48,.7);velocityX=clamp(dx/dt,-1.8,1.8);velocityY=clamp(dy/dt,-.8,.8);
    previousX=event.clientX;previousY=event.clientY;previousTime=now;render();
  });
  function endDrag(event){
    if(event.pointerId!==pointerId)return;
    if(performance.now()-previousTime>100 || reducedMotion.matches || event.type==='pointercancel'){velocityX=0;velocityY=0;}
    if(canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);
    dragging=false;pointerId=null;touchOrigin=null;stage.classList.remove('is-dragging');
  }
  canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);
  canvas.addEventListener('lostpointercapture',()=>{dragging=false;stage.classList.remove('is-dragging');});
  function reset(){
    velocityX=0;velocityY=0;yaw=INITIAL_YAW+Math.atan2(Math.sin(yaw-INITIAL_YAW),Math.cos(yaw-INITIAL_YAW));resetting=true;motionTime=0;
    if(reducedMotion.matches){yaw=INITIAL_YAW;pitch=INITIAL_PITCH;resetting=false;interacted=false;resetButton.hidden=true;render();}
  }
  resetButton.addEventListener('click',reset);
  canvas.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key))return;
    event.preventDefault();markInteracted();velocityX=0;velocityY=0;
    if(event.key==='Home'){reset();return;}
    if(event.key==='ArrowLeft')yaw-=.12;if(event.key==='ArrowRight')yaw+=.12;
    if(event.key==='ArrowUp')pitch=clamp(pitch-.08,-.48,.7);if(event.key==='ArrowDown')pitch=clamp(pitch+.08,-.48,.7);render();
  });
  let visible = !document.getElementById('home').hidden;
  let frame = 0, last = 0;
  function animate(time) {
    if(!visible || document.hidden || reducedMotion.matches){frame=0;return;}
    const dt = last ? Math.min((time-last)/1000,.05) : 0; last=time;
    motionTime+=dt;mixer.update(dt*.55);
    if(resetting){
      const factor=1-Math.exp(-dt*5);yaw+=(INITIAL_YAW-yaw)*factor;pitch+=(INITIAL_PITCH-pitch)*factor;
      if(Math.abs(yaw-INITIAL_YAW)+Math.abs(pitch-INITIAL_PITCH)<.001){yaw=INITIAL_YAW;pitch=INITIAL_PITCH;resetting=false;interacted=false;resetButton.hidden=true;}
    }else if(!dragging){
      yaw+=velocityX*dt;pitch=clamp(pitch+velocityY*dt,-.48,.7);
      const decay=Math.exp(-dt*3.3);velocityX*=decay;velocityY*=decay;
      if(Math.abs(velocityX)<.002)velocityX=0;if(Math.abs(velocityY)<.002)velocityY=0;
    }
    render();frame=requestAnimationFrame(animate);
  }
  function start(){if(frame || !visible || document.hidden || reducedMotion.matches)return;last=0;frame=requestAnimationFrame(animate);}
  window.addEventListener('earthlight',e => setLighting(e.detail));
  window.addEventListener('earthvisibility',e => {visible=e.detail;if(!visible){cancelAnimationFrame(frame);frame=0;}else{resize();start();}});
  document.addEventListener('visibilitychange',() => {if(document.hidden){cancelAnimationFrame(frame);frame=0;}else start();});
  reducedMotion.addEventListener('change',() => {if(reducedMotion.matches){cancelAnimationFrame(frame);frame=0;render();}else start();});
  new ResizeObserver(resize).observe(stage);
  resize();setLighting(window.earthLighting);stage.setAttribute('aria-busy','false');stage.classList.add('is-ready');canvas.dataset.ready='true';canvas.dataset.model='onirix-earth-cartoon';canvas.dataset.animations=String(gltf.animations.length);hint.textContent='拖动，探索我们的小星球';start();
}
createEarth().catch(error => {
  stage.setAttribute('aria-busy','false');
  stage.classList.add('has-error');
  canvas.tabIndex=-1;canvas.setAttribute('aria-label','卡通星球暂时无法加载');
  hint.textContent='小星球暂时无法加载，请刷新页面重试';
  console.warn('卡通星球加载失败：',error.message);
});
