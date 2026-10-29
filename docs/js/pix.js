(function(){
  var NC=window.NC||{};
  var img=document.getElementById('pixqr');
  if(!NC.pix||!img||typeof qrcode!=='function')return;

  function clean(s,max){
    s=String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9 ]/g,' ').replace(/\s+/g,' ').trim().toUpperCase();
    if(s.length>max){
      s=s.split(' ').filter(function(w){return ['DE','DA','DO','DAS','DOS'].indexOf(w)<0}).join(' ');
    }
    return s.slice(0,max).trim();
  }
  function tlv(id,v){var n=String(v.length);return id+(n.length<2?'0'+n:n)+v}
  function crc16(str){
    var crc=0xFFFF;
    for(var i=0;i<str.length;i++){
      crc^=str.charCodeAt(i)<<8;
      for(var b=0;b<8;b++){crc=(crc&0x8000)?((crc<<1)^0x1021):(crc<<1);crc&=0xFFFF}
    }
    var h=crc.toString(16).toUpperCase();
    while(h.length<4)h='0'+h;
    return h;
  }
  function payload(valor){
    var p=tlv('00','01')+tlv('01','11')+
      tlv('26',tlv('00','br.gov.bcb.pix')+tlv('01',NC.pix)+tlv('02','Doacao Nightclass'))+
      tlv('52','0000')+tlv('53','986')+
      (valor?tlv('54',valor.toFixed(2)):'')+
      tlv('58','BR')+
      tlv('59',clean(NC.pixNomeQR||NC.pixNome||NC.nome,25)||'NIGHTCLASS')+
      tlv('60',clean(NC.pixCidade,15)||'BRASIL')+
      tlv('62',tlv('05','***'))+'6304';
    return p+crc16(p);
  }
  function brl(v){return 'R$ '+v.toFixed(2).replace('.',',')}

  var valor=0,code='';
  var show=document.getElementById('amtshow'),
      other=document.getElementById('amtother'),
      btns=Array.prototype.slice.call(document.querySelectorAll('[data-amt]')),
      copy=document.getElementById('pixcode');

  function draw(){
    code=payload(valor);
    try{
      var qr=qrcode(0,'M');qr.addData(code);qr.make();
      img.src=qr.createDataURL(8,0);
      var bx=document.getElementById('pixqrbox');if(bx)bx.hidden=false;
    }catch(e){}
    if(show)show.textContent=valor?brl(valor):'você escolhe no app do banco';
  }
  function setValor(v,fromBtn){
    valor=v;
    btns.forEach(function(b){var on=fromBtn&&parseFloat(b.getAttribute('data-amt'))===v;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false')});
    draw();
  }
  btns.forEach(function(b){
    b.addEventListener('click',function(){
      var v=parseFloat(b.getAttribute('data-amt'));
      if(valor===v&&b.classList.contains('on')){setValor(0,false)}else{setValor(v,true)}
      if(other)other.value='';
    });
  });
  if(other)other.addEventListener('input',function(){
    var t=other.value.replace(/[^\d,.]/g,'').replace(',','.');
    var v=parseFloat(t);
    if(!isFinite(v)||v<1||v>99999)v=0;
    setValor(Math.round(v*100)/100,false);
  });
  if(copy)copy.addEventListener('click',function(){
    var done=function(){copy.textContent='Código copiado';setTimeout(function(){copy.textContent='Copiar código Pix (copia e cola)'},2200)};
    var fb=function(){window.prompt('Copie o código Pix:',code)};
    try{navigator.clipboard.writeText(code).then(done,fb)}catch(e){fb()}
  });
  window.NC_PIX={payload:payload};
  setValor(10,true);
})();