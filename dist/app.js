const $=s=>document.querySelector(s);const config=window.SPA_ASSETS;
function startIntro(){if(!document.documentElement.classList.contains('intro-pending'))return;document.documentElement.classList.remove('intro-pending');document.documentElement.classList.add('intro-ready')}setTimeout(startIntro,2500);
document.querySelectorAll('[data-asset]').forEach(box=>{const a=config[box.dataset.asset];if(!a)return;if(a.src){const img=document.createElement('img');img.src=a.src;img.alt=a.alt||'';if(a.mobile){const pic=document.createElement('picture'),source=document.createElement('source');source.media='(max-width: 700px)';source.srcset=a.mobile;pic.append(source,img);box.prepend(pic)}else box.prepend(img);img.onerror=()=>img.remove()}if(a.video&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const v=document.createElement('video');v.src=a.video;v.muted=true;v.autoplay=true;v.playsInline=true;v.preload='metadata';v.setAttribute('aria-hidden','true');v.addEventListener('playing',()=>{v.classList.add('is-playing');if(box.dataset.asset==='hero')startIntro()});v.addEventListener('error',()=>v.remove());if(box.dataset.asset==='hero')enableReverseCycle(v);else v.loop=true;box.append(v)}});
// Play forward, then seek backward in small steps before playing forward again.
function enableReverseCycle(video){let reversing=false,lastFrame=0,frame=0;function reverse(now){if(!reversing)return;if(document.hidden){lastFrame=now;frame=requestAnimationFrame(reverse);return}if(!lastFrame)lastFrame=now;if(now-lastFrame>=42&&!video.seeking){const elapsed=Math.min((now-lastFrame)/1000,.15);lastFrame=now;const next=Math.max(0,video.currentTime-elapsed);video.currentTime=next;if(next===0){reversing=false;video.addEventListener('seeked',()=>video.play().catch(()=>{}),{once:true});return}}frame=requestAnimationFrame(reverse)}video.addEventListener('ended',()=>{reversing=true;lastFrame=0;frame=requestAnimationFrame(reverse)});video.addEventListener('error',()=>{reversing=false;cancelAnimationFrame(frame)})}
let timer=null,phase=0;$('#breath-toggle').addEventListener('click',()=>{if(timer){clearInterval(timer);timer=null;$('.breath').classList.remove('active');$('#breath-toggle').textContent='Begin breathing';$('#breath-word').textContent='';return}phase=0;$('.breath').classList.add('active');$('#breath-toggle').textContent='End breathing';$('#breath-word').textContent='Breathe in';timer=setInterval(()=>{phase=1-phase;$('#breath-word').textContent=phase?'Breathe out':'Breathe in'},4000)});if('IntersectionObserver'in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target)}}),{threshold:.08});document.querySelectorAll('.reveal').forEach(e=>observer.observe(e))}else document.querySelectorAll('.reveal').forEach(e=>e.classList.add('visible'));

// Keep the navigation visible and highlight the section currently in view.
const header=$('.header'),navLinks=[...document.querySelectorAll('.header nav a')];function updateNavigation(){header.classList.toggle('scrolled',window.scrollY>80);const logo=header.querySelector('.brand-logo'),point=header.getBoundingClientRect().height/2,section=[...document.querySelectorAll('main > section, footer')].find(el=>{const r=el.getBoundingClientRect();return r.top<=point&&r.bottom>point});const light=section&&['intro','planner','visit'].some(name=>section.classList.contains(name));const logoSrc='generated-images/logo-'+(light?'dark':'light')+'-color.png';if(logo.getAttribute('src')!==logoSrc)logo.setAttribute('src',logoSrc);let active='';for(const id of ['experiences','about','visit']){const section=document.getElementById(id),r=section.getBoundingClientRect();if(r.top<=180&&r.bottom>180)active=id}navLinks.forEach(link=>{const current=link.getAttribute('href')==='#'+active;link.classList.toggle('active',current);if(current)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current')})}window.addEventListener('scroll',updateNavigation,{passive:true});updateNavigation();

// Reveal the floating header on scroll and fade it after two seconds of inactivity.
let headerIdleTimer;function scheduleHeaderFade(){clearTimeout(headerIdleTimer);header.classList.remove('header-idle');if(window.scrollY<=80||header.classList.contains('menu-open'))return;headerIdleTimer=setTimeout(()=>{if(!header.classList.contains('menu-open')&&!header.contains(document.activeElement)&&!header.matches(':hover'))header.classList.add('header-idle')},2000)}header.addEventListener('animationend',e=>{if(e.target===header&&e.animationName==='navDrop')header.classList.add('intro-complete')});window.addEventListener('scroll',scheduleHeaderFade,{passive:true});header.addEventListener('focusin',()=>{clearTimeout(headerIdleTimer);header.classList.remove('header-idle')});header.addEventListener('focusout',scheduleHeaderFade);header.addEventListener('mouseenter',()=>clearTimeout(headerIdleTimer));header.addEventListener('mouseleave',scheduleHeaderFade);

// Mobile navigation stays available until it is closed or a section is selected.
const menuToggle=$('.menu-toggle'),menu=$('#main-navigation');function setMenu(open,restoreFocus=false){header.classList.toggle('menu-open',open);menuToggle.setAttribute('aria-expanded',String(open));menuToggle.setAttribute('aria-label',open?'Close navigation menu':'Open navigation menu');if(open){clearTimeout(headerIdleTimer);header.classList.remove('header-idle')}else{if(restoreFocus)menuToggle.focus();scheduleHeaderFade()}}menuToggle.addEventListener('click',()=>setMenu(!header.classList.contains('menu-open')));menu.addEventListener('click',e=>{if(e.target.closest('a')&&header.classList.contains('menu-open'))setMenu(false,true)});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&header.classList.contains('menu-open')){e.preventDefault();setMenu(false,true)}});document.addEventListener('click',e=>{if(header.classList.contains('menu-open')&&!header.contains(e.target))setMenu(false)});window.addEventListener('resize',()=>{if(window.innerWidth>800&&header.classList.contains('menu-open'))setMenu(false)});

// Shoji panels are added only when motion and viewport observation are available.
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
if('IntersectionObserver' in window && !motionPreference.matches){
  const images=[...document.querySelectorAll('.card-media')];
  const revealObserver=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      const image=entry.target;
      if(entry.isIntersecting){
        image.style.setProperty('--reveal-delay',`${images.indexOf(image) * 500}ms`);
        image.classList.remove('shoji-reset');
        requestAnimationFrame(()=>{if(image.dataset.inView==='true')image.classList.add('shoji-revealed')});
        image.dataset.inView='true';
      }else{
        image.dataset.inView='false';
        image.classList.add('shoji-reset');
        image.classList.remove('shoji-revealed');
      }
    });
  },{threshold:0});
  images.forEach(image=>{
    const screen=document.createElement('div');
    screen.className='shoji-screen';
    screen.setAttribute('aria-hidden','true');
    for(let i=0;i<2;i++){const panel=document.createElement('span');screen.append(panel)}
    image.append(screen);
    revealObserver.observe(image);
  });
}
// The gallery scrolls in a loop and can be dragged like a normal image strip.
const gallery=document.querySelector('.details-gallery');
const galleryTrack=gallery.querySelector('.gallery-track');
const galleryGroup=gallery.querySelector('.gallery-group');
gallery.querySelectorAll('img').forEach(image=>image.draggable=false);
let galleryDragging=false, galleryStartX=0, galleryStartScroll=0, galleryVisible=false, resumeAfterDrag=false, galleryPointerItem=null, galleryPointerMoved=false;
gallery.addEventListener('pointerdown',event=>{
  if(event.pointerType!=='mouse'||event.button!==0)return;
  event.preventDefault();
  galleryPointerItem=event.target.closest('.gallery-media');galleryPointerMoved=false;
  galleryDragging=true;resumeAfterDrag=false;galleryStartX=event.clientX;galleryStartScroll=gallery.scrollLeft;
  gallery.classList.add('dragging');gallery.setPointerCapture(event.pointerId);
});
gallery.addEventListener('pointermove',event=>{if(galleryDragging){if(Math.abs(event.clientX-galleryStartX)>6)galleryPointerMoved=true;gallery.scrollLeft=galleryStartScroll-(event.clientX-galleryStartX)}});
function endGalleryDrag(){if(galleryDragging)resumeAfterDrag=true;galleryDragging=false;gallery.classList.remove('dragging')}
gallery.addEventListener('pointerleave',()=>{resumeAfterDrag=false});
gallery.addEventListener('touchstart',()=>{resumeAfterDrag=false},{passive:true});
gallery.addEventListener('touchend',()=>{resumeAfterDrag=true},{passive:true});
gallery.addEventListener('pointerup',event=>{if(galleryDragging&&!galleryPointerMoved&&galleryPointerItem)openGalleryImage(galleryPointerItem);galleryPointerItem=null;endGalleryDrag()});
gallery.addEventListener('pointercancel',endGalleryDrag);
gallery.addEventListener('lostpointercapture',endGalleryDrag);
if(!motionPreference.matches){
  for(let i=0;i<2;i++){
    const clone=galleryGroup.cloneNode(true);clone.setAttribute('aria-hidden','true');
    clone.querySelectorAll('img').forEach(image=>{image.alt='';image.draggable=false});
    galleryTrack.append(clone);
  }
  let position=0,lastTime=0;
  const width=()=>galleryGroup.getBoundingClientRect().width;
  function normalize(){const w=width();if(!w)return;while(gallery.scrollLeft<w/2)gallery.scrollLeft+=w;while(gallery.scrollLeft>=w*1.5)gallery.scrollLeft-=w;position=gallery.scrollLeft}
  requestAnimationFrame(()=>{gallery.scrollLeft=width();position=gallery.scrollLeft});
  gallery.addEventListener('scroll',normalize,{passive:true});
  if('IntersectionObserver' in window){new IntersectionObserver(entries=>{galleryVisible=entries[0].isIntersecting},{threshold:0}).observe(gallery)}else galleryVisible=true;
  function drift(time){
    if(lastTime&&galleryVisible&&!galleryDragging&&(!gallery.matches(':hover')||resumeAfterDrag)&&!gallery.matches(':focus-within')&&!document.hidden){
      position-=Math.min(time-lastTime,50)*.025;gallery.scrollLeft=position;
      if(position<width()/2){position+=width();gallery.scrollLeft=position}
    }else position=gallery.scrollLeft;
    lastTime=time;requestAnimationFrame(drift);
  }
  requestAnimationFrame(drift);
}

// Expand an experience without removing the information in the cards.
const experienceDialog=document.querySelector('.experience-dialog');
const dialogImage=experienceDialog.querySelector('img');
const dialogDescription=experienceDialog.querySelector('.experience-dialog-description');
const dialogPlan=experienceDialog.querySelector('.experience-dialog-plan');
let descriptionTimer=null;
function showExperience(card){
  const image=card.querySelector('.card-media img');
  const description=card.querySelector(':scope > p:not(.extra)').textContent.trim();
  const title=card.querySelector('h3').textContent.trim();
  const extra=card.querySelector('.extra');
  experienceDialog.querySelector('#experience-dialog-title').textContent=title;
  experienceDialog.querySelector('#experience-dialog-category').textContent=card.querySelector('.card-top span').textContent.trim();
  experienceDialog.querySelector('.experience-dialog-price').textContent=card.querySelector('.card-bottom div').textContent.trim();
  experienceDialog.querySelector('.experience-dialog-extra').textContent=extra?extra.textContent.trim():'';
  dialogPlan.dataset.experience=card.querySelector('[data-select]').dataset.select;
  dialogImage.hidden=!image;
  if(image){dialogImage.src=image.src;dialogImage.alt=image.alt}
  dialogDescription.setAttribute('aria-label',description);
  clearInterval(descriptionTimer);
  if(motionPreference.matches){dialogDescription.textContent=description}else{
    dialogDescription.textContent='';let next=0;
    const written=document.createElement('span');written.setAttribute('aria-hidden','true');
    const quill=document.createElement('span');quill.className='writing-quill';quill.setAttribute('aria-hidden','true');
    quill.innerHTML='<svg viewBox="0 0 24 28" fill="none"><path d="M3 25C7 17 13 9 21 3M6 20C5 13 11 5 21 3c1 8-4 15-12 17M10 15l-1-4m4 1 4-1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    dialogDescription.append(written,quill);
    descriptionTimer=setInterval(()=>{next=Math.min(description.length,next+1);written.textContent=description.slice(0,next);if(next===description.length){clearInterval(descriptionTimer);quill.classList.add('finished')}},48);
  }
  experienceDialog.showModal();
}
document.querySelectorAll('.card').forEach(card=>{
  const button=document.createElement('button');
  button.type='button';button.className='experience-image-button';
  button.setAttribute('aria-label','View '+card.querySelector('h3').textContent.trim()+' details');
  card.querySelector('.card-media').append(button);
  button.addEventListener('click',()=>showExperience(card));
});
experienceDialog.querySelector('.experience-dialog-close').addEventListener('click',()=>experienceDialog.close());
experienceDialog.addEventListener('close',()=>clearInterval(descriptionTimer));
dialogPlan.addEventListener('click',()=>{
  const service=document.querySelector('#service');service.value=dialogPlan.dataset.experience;service.dispatchEvent(new Event('change',{bubbles:true}));
  experienceDialog.close();
});

// Gallery images open on click, while pointer dragging continues to scroll the strip.
const galleryDialog=document.querySelector('.gallery-dialog');
const galleryDialogImage=galleryDialog.querySelector('img');
const galleryCaption=galleryDialog.querySelector('.gallery-dialog-caption');
const galleryNames={garden:'Woodland garden',spaSession:'Spa session',treatment:'Treatment details',customer:'Guest at a spa',tea:'Herbal tea'};
function openGalleryImage(item){
  const image=item.querySelector('img');if(!image)return;
  galleryDialogImage.src=image.src;
  const original=galleryGroup.querySelector(`[data-asset="${item.dataset.asset}"] img`);
  galleryDialogImage.alt=original?original.alt:'';
  galleryCaption.textContent='Bella Vista Spa';
  galleryDialog.showModal();
}
gallery.querySelectorAll('.gallery-media').forEach(item=>{
  const button=document.createElement('button');button.type='button';button.className='gallery-image-button';
  button.setAttribute('aria-label','View '+(galleryNames[item.dataset.asset]||'gallery image'));
  if(item.closest('[aria-hidden="true"]'))button.tabIndex=-1;
  item.append(button);
  button.addEventListener('click',event=>{if(event.detail===0||event.pointerType!=='mouse')openGalleryImage(item)});
});
galleryDialog.querySelector('.gallery-dialog-close').addEventListener('click',()=>galleryDialog.close());

