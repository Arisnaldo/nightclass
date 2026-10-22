(function(){
'use strict';

/* ---------- helpers ---------- */
var RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
function $(s,el){return (el||document).querySelector(s)}
function $$(s,el){return Array.prototype.slice.call((el||document).querySelectorAll(s))}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t}return a}
function norm(s){return String(s).toLowerCase().trim().replace(/[‘’´]/g,"'").replace(/[.,!?]/g,'').replace(/\s+/g,' ')}
function rand(a){return a[Math.floor(Math.random()*a.length)]}

/* ---------- icons ---------- */
var ICONS=window.NC_ICONS;
function stars(n,total){var h='';for(var i=0;i<(total||3);i++){h+=ICONS.star.replace('{c}',i<n?'on':'')}return h}

/* ---------- content ---------- */
var LEVELS=NC_DATA.levels;
var LESSONS=NC_DATA.lessons;

/* ---------- random numbers lesson ---------- */
var NUMS=[[0,'zero','zero'],[1,'one','um'],[2,'two','dois'],[3,'three','três'],[4,'four','quatro'],[5,'five','cinco'],[6,'six','seis'],[7,'seven','sete'],[8,'eight','oito'],[9,'nine','nove'],[10,'ten','dez'],[11,'eleven','onze'],[12,'twelve','doze'],[13,'thirteen','treze'],[14,'fourteen','catorze'],[15,'fifteen','quinze'],[16,'sixteen','dezesseis'],[17,'seventeen','dezessete'],[18,'eighteen','dezoito'],[19,'nineteen','dezenove'],[20,'twenty','vinte'],[30,'thirty','trinta'],[40,'forty','quarenta'],[50,'fifty','cinquenta'],[60,'sixty','sessenta'],[70,'seventy','setenta'],[80,'eighty','oitenta'],[90,'ninety','noventa'],[100,'one hundred','cem']];
function genNumbers(){
  return shuffle(NUMS).slice(0,10).sort(function(a,b){return a[0]-b[0]}).map(function(n){return {en:n[1],pt:n[2],e:String(n[0]),num:true}});
}
function vis(w){return w.num?'<span class="nm">'+w.e+'</span>':(w.e?w.e:'<span class="tx">'+esc(w.pt)+'</span>')}

/* ---------- storage ---------- */
var KEY='nightclass-v1';
function fresh(){return {done:{},open:{},xp:0,streak:0,last:'',mute:false}}
function load(){
  try{var r=localStorage.getItem(KEY);if(r){var o=JSON.parse(r);var f=fresh();for(var k in f){if(o&&o[k]!==undefined)f[k]=o[k]}return f}}catch(e){}
  return fresh();
}
var S=load();
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
function dayStr(d){return d.toLocaleDateString('en-CA')}
function liveStreak(){
  if(!S.last)return 0;
  var t=dayStr(new Date());var y=new Date();y.setDate(y.getDate()-1);
  return (S.last===t||S.last===dayStr(y))?S.streak:0;
}
function bumpStreak(){
  var t=dayStr(new Date());if(S.last===t)return;
  var y=new Date();y.setDate(y.getDate()-1);
  S.streak=(S.last===dayStr(y))?S.streak+1:1;S.last=t;
}

/* ---------- speech ---------- */
var curUtt=null,voiceEn=null,sayWarned=false,toastT=0;
function pickVoice(){
  try{
    var vs=speechSynthesis.getVoices()||[];
    var en=vs.filter(function(v){return /^en[-_]US/i.test(v.lang)});
    if(!en.length)en=vs.filter(function(v){return /^en/i.test(v.lang)});
    var pref=['Samantha','Alex','Daniel','Karen','Google US English'],pick=null;
    for(var k=0;k<pref.length&&!pick;k++)pick=en.filter(function(v){return v.name.indexOf(pref[k])===0})[0]||null;
    voiceEn=pick||en[0]||null;
  }catch(e){}
}
try{
  if('speechSynthesis' in window){
    pickVoice();
    if(speechSynthesis.addEventListener)speechSynthesis.addEventListener('voiceschanged',pickVoice);
    else speechSynthesis.onvoiceschanged=pickVoice;
  }
}catch(e){}
function toast(msg){
  var t=$('#toast');
  if(!t){t=document.createElement('div');t.id='toast';t.setAttribute('role','status');document.body.appendChild(t)}
  t.textContent=msg;t.className='toast on';
  clearTimeout(toastT);toastT=setTimeout(function(){t.className='toast'},5000);
}
function sayWarn(msg){if(sayWarned)return;sayWarned=true;toast(msg)}
function sayTTS(t){
  if(!('speechSynthesis' in window)){sayWarn('Este navegador não tem voz para ler as palavras em inglês.');return}
  try{
    if(!voiceEn)pickVoice();
    if(speechSynthesis.speaking||speechSynthesis.pending)speechSynthesis.cancel();
    var u=new SpeechSynthesisUtterance(t);u.lang='en-US';u.rate=.85;u.volume=1;
    if(voiceEn)u.voice=voiceEn;
    var started=false;
    u.onstart=function(){started=true};
    u.onend=function(){started=true};
    u.onerror=function(e){
      var c=e&&e.error;
      if(c==='canceled'||c==='interrupted')return;
      sayWarn('A voz não tocou ('+(c||'erro')+'). Confira o volume e o modo silencioso do aparelho.');
    };
    curUtt=u;
    if(speechSynthesis.paused)speechSynthesis.resume();
    speechSynthesis.speak(u);
    setTimeout(function(){
      if(!started)sayWarn('A voz não respondeu neste aparelho. Confira o volume e o modo silencioso; se continuar, tente abrir o site direto no navegador.');
    },2200);
  }catch(e){sayWarn('Não foi possível tocar a voz neste aparelho.')}
}

/* Pronúncia: toca um arquivo de áudio gravado (audio/<palavra>.mp3). Se o arquivo não existir
   ou o aparelho recusar, usa a voz do sistema (sayTTS). */
var AUDIO_BASE='audio/',wordAudio={},curAudio=null;
function slugOf(t){return String(t).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}
function b64Url(b64){
  var bin=atob(b64),u=new Uint8Array(bin.length);
  for(var i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([u],{type:'audio/mpeg'}));
}
function wordEl(t){
  var k=slugOf(t);
  if(wordAudio[k])return wordAudio[k];
  var m=window.NC_AUDIO,url=(m&&m[k])?b64Url(m[k]):AUDIO_BASE+k+'.mp3';
  var a=new Audio(url);a.preload='auto';wordAudio[k]=a;return a;
}
function say(t){
  try{if(curAudio)curAudio.pause()}catch(e){}
  try{if('speechSynthesis' in window&&(speechSynthesis.speaking||speechSynthesis.pending))speechSynthesis.cancel()}catch(e){}
  var a,failed=false;
  var fb=function(){if(failed)return;failed=true;sayTTS(t)};
  try{a=wordEl(t)}catch(e){fb();return}
  curAudio=a;
  a.onerror=fb;
  try{
    a.muted=false;a.currentTime=0;
    var p=a.play();
    if(p&&p.catch)p.catch(fb);
  }catch(e){fb()}
}

/* ---------- success chime (Web Audio, no files) ---------- */
function chime(){NCSound.chime(S.mute)}
function buzz(){NCSound.buzz(S.mute)}
function sndLabel(){return (S.mute?ICONS.mute:ICONS.speaker)+(S.mute?'Mudo':'Som')}

/* ---------- effects ---------- */
function sky(){
  var c=$('#sky'),x=c.getContext('2d'),w=0,h=0,stars=[],raf=0;
  function size(){
    if(innerWidth===w&&stars.length)return;
    var d=Math.min(window.devicePixelRatio||1,2);w=innerWidth;h=innerHeight;
    c.width=w*d;c.height=h*d;x.setTransform(d,0,0,d,0,0);
    var n=Math.max(30,Math.round(w*h/15000));stars=[];
    for(var i=0;i<n;i++)stars.push({x:Math.random()*w,y:Math.random()*h,r:Math.random()*1.1+.25,p:Math.random()*6.28,s:Math.random()*.7+.2});
    if(RM)draw(0);
  }
  function draw(t){
    x.clearRect(0,0,w,h);
    for(var i=0;i<stars.length;i++){
      var s=stars[i];var a=.12+.38*(.5+.5*Math.sin(t/1000*s.s+s.p));
      x.fillStyle='rgba(235,232,225,'+a.toFixed(3)+')';x.beginPath();x.arc(s.x,s.y,s.r,0,6.283);x.fill();
    }
  }
  size();addEventListener('resize',size);
  if(RM)return;
  function loop(t){draw(t);raf=requestAnimationFrame(loop)}
  document.addEventListener('visibilitychange',function(){if(document.hidden)cancelAnimationFrame(raf);else raf=requestAnimationFrame(loop)});
  raf=requestAnimationFrame(loop);
}
function burst(){
  if(RM)return;
  var c=document.createElement('canvas');c.className='fx';document.body.appendChild(c);
  var d=Math.min(window.devicePixelRatio||1,2),w=innerWidth,h=innerHeight;
  c.width=w*d;c.height=h*d;var x=c.getContext('2d');x.scale(d,d);
  var cols=['#f4b860','#5fd1a1','#ebe8e1','#ffd999'],ps=[];
  for(var i=0;i<90;i++)ps.push({x:w/2,y:h*.36,vx:(Math.random()-.5)*11,vy:-Math.random()*11-3,s:Math.random()*5+3,r:Math.random()*6,vr:(Math.random()-.5)*.4,c:cols[Math.floor(Math.random()*cols.length)],l:1});
  var f=0;
  (function tick(){
    x.clearRect(0,0,w,h);
    ps.forEach(function(p){p.vy+=.28;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;p.l-=.011;x.save();x.globalAlpha=Math.max(p.l,0);x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.c;x.fillRect(-p.s/2,-p.s/2,p.s,p.s*.6);x.restore()});
    f++;if(f<110)requestAnimationFrame(tick);else c.remove();
  })();
}

/* ---------- state ---------- */
var app=$('#app');
var sess=null;
var openLv={};
function idx(id){for(var i=0;i<LESSONS.length;i++)if(LESSONS[i].id===id)return i;return -1}
function unlocked(i){return i===0||!!S.done[LESSONS[i-1].id]||!!(S.open&&S.open[LESSONS[i].level])}
function firstOf(n){for(var i=0;i<LESSONS.length;i++)if(LESSONS[i].level===n)return i;return 0}
function nextLesson(){for(var i=0;i<LESSONS.length;i++){if(!S.done[LESSONS[i].id]&&unlocked(i))return LESSONS[i]}return null}

/* ---------- home ---------- */
function footer(){
  return '<footer class="foot"><nav aria-label="Páginas do site"><a href="como-funciona.html">Como funciona</a><a href="blog.html">Blog</a><a href="sobre.html">Sobre</a><a href="contato.html">Contato</a><a href="privacidade.html">Privacidade</a><a href="doar.html" class="apoie">Apoie o projeto</a></nav><p class="mono">Nightclass · aprenda inglês do zero</p></footer>';
}
var justReset=false;
function resetHtml(ask){
  if(ask)return '<p><b>Apagar todo o progresso?</b> Estrelas, XP, sequência de dias e níveis liberados. Não dá para desfazer.</p>'+
    '<div class="reset-row"><button class="ghost" data-act="reset-no">Cancelar</button><button class="cta danger-cta" data-act="reset-yes">Sim, apagar tudo</button></div>';
  return '<p>'+(justReset?'<b>Progresso zerado.</b> Você pode recomeçar do Nível 1.':'Quer recomeçar do zero? Isso apaga seu progresso só neste aparelho.')+'</p>'+
    '<button class="ghost danger" data-act="reset-ask">Zerar progresso</button>';
}
function home(){
  sess=null;
  var nx=nextLesson();
  var h='<header class="top"><div class="brand"><i></i>Nightclass</div><div class="stats">'+
    '<button class="pill snd" data-act="snd" aria-pressed="'+(S.mute?'false':'true')+'" aria-label="Som de acerto">'+sndLabel()+'</button>'+
    '<span class="pill" title="Dias seguidos"><span class="fl">'+ICONS.flame+'</span>'+liveStreak()+'</span>'+
    '<span class="pill" title="Pontos de XP"><span class="fl">'+ICONS.bolt+'</span>'+S.xp+' XP</span></div></header>';
  h+='<section class="hero rise"><p class="kicker">Inglês · do zero</p>'+
    '<h1>Comece pelo básico. Termine <em>montando frases</em>.</h1>'+
    '<p class="lede">Palavras com imagem, sequências para escrever e frases para completar. Uma lição por vez, no seu ritmo.</p>'+
    '<div class="hero-actions">'+(nx?'<button class="cta" data-start="'+nx.id+'">'+(Object.keys(S.done).length?'Continuar':'Começar')+': '+esc(nx.title)+'</button>':'<p class="kicker" style="color:var(--good)">Você fechou todas as lições. Refaça quando quiser.</p>')+
    '<a class="cta apoiar-btn" href="doar.html">Apoiar</a>'+
    '<p class="saved">Seu progresso fica salvo só neste aparelho e neste navegador.</p>'+
    '</section>';
  if(nx)openLv[nx.level]=true;
  LEVELS.forEach(function(lv){
    var ids=[],doneN=0;
    LESSONS.forEach(function(L,i){if(L.level===lv.n){ids.push(i);if(S.done[L.id])doneN++}});
    var isOpen=!!openLv[lv.n],locked=!unlocked(firstOf(lv.n));
    h+='<section class="level"><h2 class="level-h"><button class="lvbtn" data-lv="'+lv.n+'" aria-expanded="'+(isOpen?'true':'false')+'" aria-controls="lv'+lv.n+'">'+
      '<span class="mono">Nível '+lv.n+'</span><span class="lvname">'+esc(lv.name)+'</span>'+
      '<span class="lvcount">'+(locked?ICONS.lock:'')+doneN+'/'+ids.length+'</span><span class="chev" aria-hidden="true"></span></button></h2>'+
      '<div class="lvbody" id="lv'+lv.n+'"'+(isOpen?'':' hidden')+'><p class="lvblurb">'+esc(lv.blurb)+'</p>'+
      (locked?'<button class="ghost lvopen" data-open="'+lv.n+'">Já sei este nível, liberar</button>':'')+
      '<div class="grid">';
    ids.forEach(function(i){
      var L=LESSONS[i],open=unlocked(i),n=S.done[L.id]||0;
      var meta=L.gen?'10 números · sempre diferentes':(L.kind==='words'?L.words.length+' palavras':L.items.length+' frases');
      h+='<button class="lesson" data-start="'+L.id+'"'+(open?'':' disabled')+'>'+
        (open?'':'<span class="lk">'+ICONS.lock+'</span>')+
        '<span class="em">'+L.icon+'</span><h3>'+esc(L.title)+'</h3>'+
        '<span class="meta">'+meta+'</span><span class="starrow">'+stars(n)+'</span></button>';
    });
    h+='</div></div></section>';
  });
  h+='<section class="reset" id="resetbox">'+resetHtml(false)+'</section>';
  justReset=false;
  h+=footer();
  app.innerHTML=h;
  window.scrollTo(0,0);
}

/* ---------- lesson flow ---------- */
function buildWordQuiz(L){
  var w=L.words,q=[];
  shuffle(w).slice(0,4).forEach(function(x){q.push({t:'pick',word:x})});
  shuffle(w).forEach(function(x){q.push({t:'see',word:x})});
  q.push({t:'seq',words:shuffle(w).slice(0,3)});
  q.push({t:'seq',words:shuffle(w).slice(0,4)});
  return q;
}
function startLesson(id){
  var L=LESSONS[idx(id)];if(!L)return;
  if(L.gen==='numbers')L=Object.assign({},L,{words:genNumbers()});
  var queue=L.kind==='words'?buildWordQuiz(L):L.items.map(function(x){return Object.assign({},x)});
  sess={L:L,phase:L.kind==='words'?'learn':'quiz',li:0,queue:queue,qi:0,base:queue.length,mistakes:0,firstTry:0,xp:0,answered:false,hinted:false,sel:null,bank:[],ans:[],opts:[]};
  if(sess.phase==='learn')renderLearn();else renderQ();
}
function topbar(p,label){
  var pc=Math.round(p*100);
  return '<div class="lbar"><button class="icon-btn" data-act="exit" aria-label="Sair da lição">'+ICONS.x+'</button>'+
    '<div class="track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+pc+'"><i style="width:'+pc+'%"></i></div>'+
    '<span class="mono">'+label+'</span></div>';
}
function renderLearn(){
  var L=sess.L,i=sess.li,w=L.words[i],last=i===L.words.length-1;
  app.innerHTML=topbar(i/L.words.length,(i+1)+'/'+L.words.length)+
   '<section class="learn"><p class="kicker">'+esc(L.title)+' · aprender</p>'+
   '<div class="card rise"><div class="stage"><div class="orb"></div><div class="big-emoji">'+vis(w)+'</div></div>'+
   '<button class="say" data-act="say" aria-label="Ouvir '+esc(w.en)+'"><span class="en">'+esc(w.en)+'</span>'+ICONS.speaker+'</button>'+
   (w.e?'<p class="pt">'+esc(w.pt)+'</p>':'')+'</div>'+
   '<div class="nav-row"><button class="ghost" data-act="prev"'+(i===0?' disabled':'')+'>Voltar</button>'+
   '<button class="cta" data-act="next">'+(last?'Começar exercícios':'Próxima')+'</button></div></section>';
}
function cur(){return sess.queue[sess.qi]}
function renderQ(){
  if(sess.qi>=sess.queue.length){finish();return}
  var q=cur();sess.answered=false;sess.hinted=false;sess.sel=null;sess.ans=[];sess.bank=[];sess.opts=[];
  var b='',L=sess.L;
  var tb=topbar(sess.qi/sess.queue.length,(sess.qi+1)+'/'+sess.queue.length);
  if(q.t==='see'){
    b='<p class="kicker">Escreva em inglês</p>'+
      '<div class="stage rise"><div class="orb"></div><div class="big-emoji">'+vis(q.word)+'</div></div>'+
      '<input id="ans" class="field" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Nome em inglês" placeholder="digite aqui">'+
      '<p class="hintline mono" id="hintline" aria-live="polite"></p>'+
      '<div class="actions"><button class="ghost" data-act="hint">Dica</button><button class="cta" data-act="check">Verificar</button></div>';
  }else if(q.t==='pick'){
    var others=shuffle(L.words.filter(function(x){return x.en!==q.word.en})).slice(0,3);
    sess.opts=shuffle([q.word].concat(others));
    b='<p class="kicker">'+(q.word.e?'Qual imagem combina com a palavra?':'Qual é a tradução?')+'</p>'+
      '<div class="center"><button class="say" data-act="say" aria-label="Ouvir"><span class="en">'+esc(q.word.en)+'</span>'+ICONS.speaker+'</button></div>'+
      '<div class="picks">'+sess.opts.map(function(o,i){return '<button class="pick'+(o.e?'':' tx')+'" data-act="pick" data-i="'+i+'" aria-label="Opção '+(i+1)+'">'+(o.e?vis(o):esc(o.pt))+'</button>'}).join('')+'</div>';
  }else if(q.t==='seq'){
    b='<p class="kicker">Escreva o nome de cada um, na ordem</p><div class="seq">'+
      q.words.map(function(w,i){return '<div class="tile"><span class="n">'+(i+1)+'</span><span class="em">'+vis(w)+'</span><input class="sin seq-in" data-k="'+i+'" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Nome do item '+(i+1)+'"></div>'}).join('')+'</div>'+
      '<p class="hintline mono" id="hintline" aria-live="polite"></p>'+
      '<div class="actions"><button class="ghost" data-act="hint">Dica</button><button class="cta" data-act="check">Verificar</button></div>';
  }else if(q.t==='fill'&&q.mode==='type'){
    b='<p class="kicker">Complete a frase</p><div class="emoji-sm rise">'+q.e+'</div>'+
      '<div class="sentence"><span>'+esc(q.pre)+'</span><input id="ans" class="blank-in" style="width:'+Math.max(5,q.answer.length+2)+'ch" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Palavra que falta"><span>'+esc(q.post)+'</span></div>'+
      '<p class="ptline">'+esc(q.pt)+'</p><p class="hintline mono" id="hintline" aria-live="polite"></p>'+
      '<div class="actions"><button class="ghost" data-act="hint">Dica</button><button class="cta" data-act="check">Verificar</button></div>';
  }else if(q.t==='fill'){
    sess.opts=q.options;
    b='<p class="kicker">Escolha a palavra certa</p><div class="emoji-sm rise">'+q.e+'</div>'+
      '<div class="sentence"><span>'+esc(q.pre)+'</span><span class="blank" id="blank">&nbsp;</span><span>'+esc(q.post)+'</span></div>'+
      '<p class="ptline">'+esc(q.pt)+'</p>'+
      '<div class="opts">'+q.options.map(function(o,i){return '<button class="opt" data-act="opt" data-i="'+i+'">'+esc(o)+'</button>'}).join('')+'</div>'+
      '<div class="actions"><button class="cta" data-act="check" id="chk" disabled>Verificar</button></div>';
  }else if(q.t==='order'){
    b='<p class="kicker">Monte a frase em inglês</p><div class="emoji-sm rise">'+q.e+'</div><p class="ptline">'+esc(q.pt)+'</p>'+
      '<div class="ansrow" id="ansrow" aria-live="polite"></div><div class="bank" id="bank"></div>'+
      '<div class="actions"><button class="cta" data-act="check">Verificar</button></div>';
  }
  app.innerHTML=tb+'<section class="q" id="q">'+b+'</section>';
  if(q.t==='order'){
    var bank=q.words.map(function(w,i){return {w:w,i:i}}),tries=0,same=true;
    var sh=bank;
    while(same&&tries<8&&bank.length>2){sh=shuffle(bank);same=sh.every(function(x,k){return x.i===k});tries++}
    sess.bank=sh;paintOrder();
  }
  var f=$('#q input');
  if(f){try{f.focus({preventScroll:true})}catch(e){}}
}
function paintOrder(){
  var used={},fresh=sess.fresh;sess.fresh=-1;
  sess.ans.forEach(function(a){used[a.i]=1});
  $('#ansrow').innerHTML=sess.ans.length?sess.ans.map(function(a){return '<button class="chip'+(a.i===fresh?' new':'')+'" data-act="chipdel" data-i="'+a.i+'">'+esc(a.w)+'</button>'}).join(''):'<span class="ph">Toque nas palavras abaixo</span>';
  $('#bank').innerHTML=sess.bank.map(function(b){return '<button class="chip'+(used[b.i]?' used':'')+'" data-act="chipadd" data-i="'+b.i+'"'+(used[b.i]?' disabled aria-hidden="true" tabindex="-1"':'')+'>'+esc(b.w)+'</button>'}).join('');
}
function shakeEl(el){if(!el)return;el.classList.remove('shake');void el.offsetWidth;el.classList.add('shake')}
var PRAISE=['Correto!','Isso aí!','Boa!','Perfeito!','Mandou bem!'];
function showFb(ok,msg){
  var old=$('#fb');if(old)old.remove();
  var d=document.createElement('div');d.id='fb';d.className='fb '+(ok?'good':'bad');d.setAttribute('role','status');
  d.innerHTML='<div class="fb-in"><div class="fb-t"><strong>'+(ok?rand(PRAISE):'Quase lá')+'</strong><span>'+(ok?'':'Resposta: ')+esc(msg)+'</span></div><button class="cta" data-act="continue">Continuar</button></div>';
  app.appendChild(d);
  var b=$('[data-act="continue"]',d);if(b)b.focus();
  if(!ok)shakeEl($('#q'));
}
function conclude(ok,msg){
  var q=cur();sess.answered=true;
  if(ok){
    if(!q.retried){sess.firstTry++;sess.xp+=sess.hinted?5:10}else sess.xp+=3;
    chime();
  }else{
    buzz();
    sess.mistakes++;
    if(!q.retried)sess.queue.push(Object.assign({},q,{retried:true}));
  }
  showFb(ok,msg);
}
function check(){
  if(!sess||sess.answered||sess.phase!=='quiz')return;
  var q=cur(),ok=false,msg='';
  if(q.t==='see'){
    var inp=$('#ans'),v=norm(inp.value);
    if(!v){shakeEl(inp);inp.focus();return}
    ok=v===norm(q.word.en);msg=q.word.en+' · '+q.word.pt;
    inp.classList.add(ok?'ok':'bad');inp.readOnly=true;
  }else if(q.t==='seq'){
    var ins=$$('.seq-in');
    if(ins.some(function(i){return !norm(i.value)})){var e=ins.filter(function(i){return !norm(i.value)})[0];shakeEl(e);e.focus();return}
    ok=true;
    ins.forEach(function(i,k){var good=norm(i.value)===norm(q.words[k].en);if(!good)ok=false;i.classList.add(good?'ok':'bad');i.readOnly=true});
    msg=q.words.map(function(w){return w.en}).join(' · ');
  }else if(q.t==='fill'&&q.mode==='type'){
    var bi=$('#ans'),bv=norm(bi.value);
    if(!bv){shakeEl(bi);bi.focus();return}
    var okset=[q.answer].concat(q.alt||[]).map(norm);
    ok=okset.indexOf(bv)>-1;
    msg=q.pre+' '+q.answer+' '+q.post;
    bi.classList.add(ok?'ok':'bad');bi.readOnly=true;
  }else if(q.t==='fill'){
    if(sess.sel===null)return;
    ok=q.options[sess.sel]===q.answer;msg=q.pre+' '+q.answer+' '+q.post;
    $('#blank').classList.add(ok?'ok':'bad');
    $$('.opt').forEach(function(o){o.disabled=true});
  }else if(q.t==='order'){
    if(sess.ans.length<q.words.length){shakeEl($('#ansrow'));return}
    var given=sess.ans.map(function(a){return a.w}).join(' ').toLowerCase();
    ok=[q.words.join(' ')].concat(q.alts||[]).some(function(s){return s.toLowerCase()===given});
    msg=q.words.join(' ')+'.';
    $('#ansrow').classList.add(ok?'ok':'bad');
    $$('#q .chip').forEach(function(c){c.disabled=true});
  }
  var chk=$('[data-act="check"]');if(chk)chk.disabled=true;
  conclude(ok,msg);
}
function hint(){
  var q=cur(),el=$('#hintline');if(!el||sess.answered)return;
  sess.hinted=true;
  if(q.t==='see'){el.textContent=q.word.en.length+' letras · começa com "'+q.word.en[0]+'"'}
  else if(q.t==='seq'){el.textContent='Começam com: '+q.words.map(function(w){return w.en[0]}).join(' · ')}
  else if(q.t==='fill'){el.textContent=q.answer.length+' letras · começa com "'+q.answer[0]+'"'}
}
function finish(){
  var L=sess.L,total=sess.base;
  var mistakes=sess.mistakes,n=mistakes===0?3:(mistakes<=2?2:1);
  var gain=sess.xp+20;
  S.xp+=gain;S.done[L.id]=Math.max(S.done[L.id]||0,n);bumpStreak();save();
  var nxI=idx(L.id)+1,nx=LESSONS[nxI];
  var titles=['Lição concluída','Muito bem','Lição perfeita'];
  app.innerHTML=topbar(1,'fim')+
   '<section class="result"><p class="kicker">'+esc(L.title)+'</p><div class="bigstars" aria-label="'+n+' de 3 estrelas">'+stars(n)+'</div>'+
   '<h2>'+titles[n-1]+'</h2>'+
   '<div class="tiles"><div><b>+'+gain+'</b><span>XP</span></div><div><b>'+sess.firstTry+'/'+total+'</b><span>de primeira</span></div><div><b>'+liveStreak()+'</b><span>dias seguidos</span></div></div>'+
   '<div class="actions">'+(nx?'<button class="cta" data-start="'+nx.id+'">Próxima: '+esc(nx.title)+'</button>':'')+
   '<button class="ghost" data-act="exit">Voltar ao mapa</button></div></section>';
  window.scrollTo(0,0);
  burst();
}

/* ---------- events ---------- */
app.addEventListener('click',function(e){
  var lb=e.target.closest('[data-lv]');
  if(lb){
    var ln=lb.getAttribute('data-lv');openLv[ln]=!openLv[ln];
    lb.setAttribute('aria-expanded',openLv[ln]?'true':'false');
    var lbody=document.getElementById('lv'+ln);if(lbody)lbody.hidden=!openLv[ln];
    return;
  }
  var o=e.target.closest('[data-open]');
  if(o){S.open[o.getAttribute('data-open')]=true;save();home();return}
  var s=e.target.closest('[data-start]');
  if(s&&!s.disabled){startLesson(s.getAttribute('data-start'));return}
  var b=e.target.closest('[data-act]');if(!b||b.disabled)return;
  var act=b.getAttribute('data-act');
  if(act==='exit'){home();return}
  if(act==='reset-ask'){var rb=$('#resetbox');rb.innerHTML=resetHtml(true);var no=$('[data-act="reset-no"]',rb);if(no)no.focus();return}
  if(act==='reset-no'){$('#resetbox').innerHTML=resetHtml(false);return}
  if(act==='reset-yes'){var m=S.mute;S=fresh();S.mute=m;save();openLv={};justReset=true;home();return}
  if(act==='snd'){S.mute=!S.mute;save();b.innerHTML=sndLabel();b.setAttribute('aria-pressed',S.mute?'false':'true');if(!S.mute)chime();return}
  if(!sess)return;
  if(act==='say'){
    if(sess.phase==='learn')say(sess.L.words[sess.li].en);
    else{var q=cur();if(q&&q.word)say(q.word.en)}
    return;
  }
  if(act==='prev'){if(sess.li>0){sess.li--;renderLearn()}return}
  if(act==='next'){
    if(sess.li<sess.L.words.length-1){sess.li++;renderLearn()}
    else{sess.phase='quiz';renderQ()}
    return;
  }
  if(act==='hint'){hint();return}
  if(act==='check'){check();return}
  if(act==='continue'){sess.qi++;renderQ();window.scrollTo(0,0);return}
  if(sess.answered)return;
  if(act==='pick'){
    var i=+b.getAttribute('data-i'),q2=cur(),ok=sess.opts[i].en===q2.word.en;
    b.classList.add(ok?'ok':'bad');
    if(!ok){var rightI=sess.opts.map(function(o){return o.en}).indexOf(q2.word.en);var r=$$('.pick')[rightI];if(r)r.classList.add('ok')}
    $$('.pick').forEach(function(p){p.disabled=true});
    conclude(ok,q2.word.en+' · '+q2.word.pt);
    return;
  }
  if(act==='opt'){
    var k=+b.getAttribute('data-i');sess.sel=k;
    $$('.opt').forEach(function(o,n){o.classList.toggle('sel',n===k)});
    $('#blank').textContent=sess.opts[k];
    var c=$('#chk');if(c)c.disabled=false;
    return;
  }
  if(act==='chipadd'){
    var id=+b.getAttribute('data-i'),it=sess.bank.filter(function(x){return x.i===id})[0];
    if(it&&!sess.ans.some(function(a){return a.i===id})){sess.ans.push(it);sess.fresh=id;paintOrder()}
    return;
  }
  if(act==='chipdel'){
    var id2=+b.getAttribute('data-i');
    sess.ans=sess.ans.filter(function(a){return a.i!==id2});paintOrder();
    return;
  }
});
app.addEventListener('keydown',function(e){
  if(e.key!=='Enter')return;
  var t=e.target;
  if(t.classList&&t.classList.contains('seq-in')){
    e.preventDefault();
    var ins=$$('.seq-in'),i=ins.indexOf(t);
    if(i<ins.length-1)ins[i+1].focus();else check();
  }else if(t.id==='ans'){
    e.preventDefault();check();
  }
});

sky();
home();
})();