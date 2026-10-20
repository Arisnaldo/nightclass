/* Preenche e-mail, nome e Pix nas páginas, a partir de js/config.js. */
(function(){
  var NC=window.NC||{};
  function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  var els=document.querySelectorAll('[data-k]');
  for(var i=0;i<els.length;i++){
    var el=els[i],k=el.getAttribute('data-k'),v=NC[k];
    if(!v)continue;
    if(k==='email'){el.outerHTML='<a href="mailto:'+esc(v)+'">'+esc(v)+'</a>'}
    else{el.textContent=v;el.classList.remove('fill')}
  }
  var box=document.getElementById('pixbox');
  if(box){
    var empty=document.getElementById('pixempty');
    if(NC.pix){
      document.getElementById('pixkey').textContent=NC.pix;
      if(NC.pixNome){var w=document.getElementById('pixwho');w.textContent='Recebedor: '+NC.pixNome;w.hidden=false}
      box.hidden=false;empty.hidden=true;
      var btn=document.getElementById('pixcopy');
      btn.addEventListener('click',function(){
        var done=function(){btn.textContent='Chave copiada';setTimeout(function(){btn.textContent='Copiar chave Pix'},2200)};
        var fallback=function(){var r=document.createRange();r.selectNodeContents(document.getElementById('pixkey'));var s=getSelection();s.removeAllRanges();s.addRange(r);btn.textContent='Selecionada, copie com Ctrl+C'};
        try{navigator.clipboard.writeText(NC.pix).then(done,fallback)}catch(e){fallback()}
      });
    }
  }
})();
