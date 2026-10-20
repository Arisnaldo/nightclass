/* Sons de acerto e de erro (Web Audio, sem arquivos de áudio). */
window.NCSound = (function(){
var actx=null,SNDURL={},SNDEL={},sndUnlocked=false;
/* Notas: [frequência, início, duração]. Os sons são gerados como arquivos WAV em memória e tocados
   com <audio>, que no iPhone toca mesmo com o botão de silencioso ligado (o Web Audio não toca). */
var CHIME_NOTES=[[880,0,.14],[1319,.11,.34]];
var BUZZ_NOTES=[[330,0,.16],[247,.13,.3]];
function makeWav(name){
  var parts=[],total=.5,sr=22050;
  if(name==='chime'){
    CHIME_NOTES.forEach(function(n){[[1,.2],[2,.05]].forEach(function(h){parts.push({f:n[0]*h[0],s:n[1],d:n[2],k:h[1],a:.015,tri:false})})});
  }else{
    BUZZ_NOTES.forEach(function(n){parts.push({f:n[0],s:n[1],d:n[2],k:.16,a:.02,tri:true})});
  }
  var len=Math.ceil(sr*total),data=new Float32Array(len);
  parts.forEach(function(p){
    var i0=Math.floor(p.s*sr),i1=Math.min(len,Math.floor((p.s+p.d+.03)*sr));
    for(var i=i0;i<i1;i++){
      var t=i/sr-p.s,env;
      if(t<p.a)env=.0001*Math.pow(p.k/.0001,t/p.a);
      else if(t<p.d)env=p.k*Math.pow(.0001/p.k,(t-p.a)/(p.d-p.a));
      else env=0;
      var ph=2*Math.PI*p.f*t;
      data[i]+=(p.tri?(2/Math.PI)*Math.asin(Math.sin(ph)):Math.sin(ph))*env;
    }
  });
  var buf=new ArrayBuffer(44+len*2),v=new DataView(buf);
  function str(o,x){for(var k=0;k<x.length;k++)v.setUint8(o+k,x.charCodeAt(k))}
  str(0,'RIFF');v.setUint32(4,36+len*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);
  v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);
  v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,len*2,true);
  for(var k=0;k<len;k++){var x=Math.max(-1,Math.min(1,data[k]*1.6));v.setInt16(44+k*2,x*32767,true)}
  return buf;
}
function sndEl(name){
  if(SNDEL[name])return SNDEL[name];
  try{
    var buf=makeWav(name),url;
    try{url=URL.createObjectURL(new Blob([buf],{type:'audio/wav'}))}
    catch(e){var b='',u8=new Uint8Array(buf);for(var i=0;i<u8.length;i++)b+=String.fromCharCode(u8[i]);url='data:audio/wav;base64,'+btoa(b)}
    var a=new Audio(url);a.preload='auto';SNDEL[name]=a;return a;
  }catch(e){return null}
}
function unlockSnd(){
  if(sndUnlocked)return;
  sndUnlocked=true;
  try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch(e){}
  ['chime','buzz'].forEach(function(n){
    var a=sndEl(n);if(!a)return;
    try{
      a.muted=true;
      var p=a.play();
      var done=function(){try{a.pause();a.currentTime=0}catch(e){}a.muted=false};
      if(p&&p.then)p.then(done,function(){a.muted=false});else done();
    }catch(e){try{a.muted=false}catch(_){}}
  });
  try{
    var AC=window.AudioContext||window.webkitAudioContext;
    if(AC){actx=actx||new AC();if(actx.state==='suspended')actx.resume()}
  }catch(e){}
}
['touchstart','touchend','pointerdown','click','keydown'].forEach(function(ev){document.addEventListener(ev,unlockSnd,{capture:true,passive:true})});
function playSnd(name,fallback){
  var a=sndEl(name);
  if(a){
    try{
      a.muted=false;a.currentTime=0;
      var p=a.play();
      if(p&&p.catch)p.catch(fallback);
      return;
    }catch(e){}
  }
  fallback();
}
function chimeWA(){
  try{
    var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    actx=actx||new AC();
    if(actx.state==='suspended')actx.resume();
    var t=actx.currentTime;
    CHIME_NOTES.forEach(function(n){
      [[1,.2],[2,.05]].forEach(function(h){
        var o=actx.createOscillator(),g=actx.createGain(),s=t+n[1];
        o.type='sine';o.frequency.value=n[0]*h[0];
        g.gain.setValueAtTime(.0001,s);
        g.gain.exponentialRampToValueAtTime(h[1],s+.015);
        g.gain.exponentialRampToValueAtTime(.0001,s+n[2]);
        o.connect(g);g.connect(actx.destination);
        o.start(s);o.stop(s+n[2]+.03);
      });
    });
  }catch(e){}
}
function buzzWA(){
  try{
    var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    actx=actx||new AC();
    if(actx.state==='suspended')actx.resume();
    var t=actx.currentTime;
    BUZZ_NOTES.forEach(function(n){
      var o=actx.createOscillator(),g=actx.createGain(),s=t+n[1];
      o.type='triangle';o.frequency.value=n[0];
      g.gain.setValueAtTime(.0001,s);
      g.gain.exponentialRampToValueAtTime(.16,s+.02);
      g.gain.exponentialRampToValueAtTime(.0001,s+n[2]);
      o.connect(g);g.connect(actx.destination);
      o.start(s);o.stop(s+n[2]+.03);
    });
  }catch(e){}
}
function chime(muted){
  if(muted)return;
  playSnd('chime',chimeWA);
}
function buzz(muted){
  if(muted)return;
  playSnd('buzz',buzzWA);
}
return {chime:chime, buzz:buzz};
})();
