/* Aviso de privacidade (mostra uma vez; lembra no localStorage). */
(function(){
  var KEY='nightclass-aviso';
  try{if(localStorage.getItem(KEY))return}catch(e){}
  var me=document.currentScript;
  var href=(me&&me.getAttribute('data-privacy'))||'privacidade.html';
  var b=document.createElement('div');
  b.id='ccb';
  b.setAttribute('role','region');
  b.setAttribute('aria-label','Aviso de privacidade');
  b.innerHTML='<p>Este site guarda seu progresso no seu aparelho. Quando houver anúncios, o Google pode usar cookies. Saiba mais na <a href="'+href+'">Política de Privacidade</a>.</p><button type="button" id="ccok">Entendi</button>';
  document.body.appendChild(b);
  document.getElementById('ccok').onclick=function(){
    b.remove();
    try{localStorage.setItem(KEY,'1')}catch(e){}
  };
})();
