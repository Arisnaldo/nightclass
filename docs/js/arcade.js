/* Nightclass Arcade (beta): ouvir a fala da arma, ver como se escreve e depois escrever de ouvido. */
(function () {
  var ALL = [
    { k: 'H', en: 'Heavy Machine Gun', pt: 'Metralhadora pesada', ph: 'hévi machín gân' },
    { k: 'F', en: 'Flame Shot', pt: 'Tiro de chamas', ph: 'fleim chót' },
    { k: 'R', en: 'Rocket Launcher', pt: 'Lançador de foguetes', ph: 'róquet lónchêr' },
    { k: 'S', en: 'Shotgun', pt: 'Escopeta', ph: 'chótgân' },
    { k: 'L', en: 'Laser Gun', pt: 'Arma a laser', ph: 'lêizêr gân' },
    { k: 'C', en: 'Enemy Chaser', pt: 'Perseguidor de inimigos', ph: 'énemi tcheiser' },
    { k: 'I', en: 'Iron Lizard', pt: 'Lagarto de ferro', ph: 'áiern lízerd' },
    { k: 'D', en: 'Drop Shot', pt: 'Tiro em queda', ph: 'dróp chót' },
    { k: 'G', en: 'Super Grenade', pt: 'Super granada', ph: 'súper grenêid' },
    { k: '2H', en: 'Two Machine Guns', pt: 'Duas metralhadoras', ph: 'tú machín gâns' },
    { k: 'Z', en: 'Zantetsu Sword', pt: 'Espada Zantetsu', ph: 'zantétsu sórd' },
    { k: 'T', en: 'Thunder Shot', pt: 'Tiro de trovão', ph: 'thânder chót' }
  ];
  var SIZE = 9, W = [];
  var ICON = function (k) { return 'img/arcade/' + k.toLowerCase() + '.png'; };
  var SOUND = function (k) { return 'audio/arcade/' + k.toLowerCase() + '.mp3'; };
  var $ = function (s) { return document.querySelector(s); };
  var grid = $('#grid'), crates = [];
  var mode = 'learn', cur = 0, seen = {}, best = 0, revealTimer = null;

  try { seen = JSON.parse(localStorage.getItem('nc-arcade-seen') || '{}') || {}; best = +localStorage.getItem('nc-arcade-best') || 0; } catch (e) {}
  function save() { try { localStorage.setItem('nc-arcade-seen', JSON.stringify(seen)); localStorage.setItem('nc-arcade-best', String(best)); } catch (e) {} }

  /* ---------- áudio ---------- */
  var ac = null, voice = null;
  var canSpeak = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  function pickVoice() {
    if (!canSpeak) return;
    var vs = speechSynthesis.getVoices();
    voice = vs.find(function (v) { return /^en[-_]US/i.test(v.lang); }) || vs.find(function (v) { return /^en/i.test(v.lang); }) || null;
  }
  if (canSpeak) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

  function jingle(seq) {
    return new Promise(function (res) {
      try {
        ac = ac || new (window.AudioContext || window.webkitAudioContext)();
        if (ac.state === 'suspended') ac.resume();
        var t = ac.currentTime;
        seq.forEach(function (n) {
          var o = ac.createOscillator(), g = ac.createGain();
          o.type = 'square'; o.frequency.value = n[0];
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + n[1]);
          o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + n[1] + 0.02);
          t += n[1] * 0.9;
        });
        setTimeout(res, Math.max(0, (t - ac.currentTime) * 1000));
      } catch (e) { res(); }
    });
  }
  var PICK = [[660, .07], [880, .07], [1320, .12]], YES = [[784, .08], [988, .08], [1568, .16]], NO = [[220, .14], [165, .22]];

  function say(text, rate) {
    return new Promise(function (res) {
      if (!canSpeak) return res();
      try {
        speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US'; if (voice) u.voice = voice;
        u.rate = rate || 0.95; u.pitch = 0.85;
        u.onend = res; u.onerror = res;
        speechSynthesis.speak(u);
      } catch (e) { res(); }
    });
  }
  var voiceEl = null;
  function stopAudio() {
    try { if (voiceEl) { voiceEl.pause(); voiceEl.onended = null; voiceEl = null; } } catch (e) {}
    if (canSpeak) { try { speechSynthesis.cancel(); } catch (e) {} }
  }
  function clip(k, rate, fallback) {
    return new Promise(function (res) {
      try {
        stopAudio();
        var a = new Audio(SOUND(k));
        a.preservesPitch = true; a.webkitPreservesPitch = true;
        a.playbackRate = rate || 1;
        a.onended = res; voiceEl = a;
        a.onerror = function () { if (fallback) say(fallback, rate).then(res); else res(); };
        var pr = a.play(); if (pr && pr.catch) pr.catch(function () { res(); });
      } catch (e) { res(); }
    });
  }
  function playWeapon(i, rate) {
    var w = W[i];
    return clip(w.k, rate, w.en + '!');
  }

  /* ---------- grade de caixas ---------- */
  function build() {
    grid.innerHTML = ''; crates = [];
    W.forEach(function (w, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'ax-crate'; b.setAttribute('aria-label', 'Arma ' + w.k);
      b.innerHTML = '<img alt="" src="' + ICON(w.k) + '">';
      b.addEventListener('click', function () { if (mode === 'learn') learn(i, true); });
      grid.appendChild(b); crates.push(b);
    });
  }
  function deal(avoidSame) {
    var prev = W.map(function (w) { return w.k; }).sort().join(), pick, key;
    do { pick = shuffle(ALL.slice()).slice(0, SIZE); key = pick.map(function (w) { return w.k; }).sort().join(); }
    while (avoidSame && key === prev);
    W = pick; cur = 0; build();
    $('#pool').textContent = SIZE + ' de ' + ALL.length + ' armas sorteadas';
  }
  function reshuffle() {
    clearInterval(revealTimer); stopAudio();
    deal(true);
    if (mode === 'train') { $('#tplay').hidden = true; $('#tend').hidden = true; $('#tstart').hidden = false; grid.classList.remove('is-locked'); mark(-1); }
    else learn(0, false);
    paintSeen();
  }
  $('#reshuffle').addEventListener('click', reshuffle);
  function mark(i) { crates.forEach(function (c, j) { c.classList.toggle('is-on', j === i); }); }
  function paintSeen() { crates.forEach(function (c, j) { c.classList.toggle('is-seen', !!seen[W[j].k]); }); }

  /* ---------- modo 1: ouvir e ver ---------- */
  function reveal(text) {
    var el = $('#lw'); clearInterval(revealTimer); el.textContent = '';
    var n = 0;
    revealTimer = setInterval(function () {
      n++; el.innerHTML = '';
      var done = document.createTextNode(text.slice(0, n - 1));
      var last = document.createElement('span'); last.className = 'ax-ch'; last.textContent = text.charAt(n - 1);
      el.appendChild(done); el.appendChild(last);
      if (n >= text.length) { clearInterval(revealTimer); el.textContent = text; }
    }, 70);
  }
  function learn(i, withSound) {
    cur = i; mark(i);
    var w = W[i];
    $('#lpt').textContent = w.pt;
    $('#lph').textContent = 'Pronúncia aproximada: ' + w.ph;
    if (withSound) { reveal(w.en); playWeapon(i); } else { $('#lw').textContent = w.en; }
    if (withSound) { seen[w.k] = 1; save(); }
    paintSeen();
    var n = W.filter(function (x) { return seen[x.k]; }).length;
    $('#lprog').textContent = n + ' de ' + W.length + ' armas ouvidas' + (n === W.length ? ' · pronto para a missão!' : '');
  }
  $('#lplay').addEventListener('click', function () { reveal(W[cur].en); playWeapon(cur); });
  $('#lslow').addEventListener('click', function () { reveal(W[cur].en); playWeapon(cur, 0.6); });

  /* ---------- modo 2: ouvir e escrever ---------- */
  var T = { order: [], pos: 0, score: 0, tries: 0, hint: false, phase: 'ask', hits: 0 };
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function norm(s) { return s.toLowerCase().replace(/[^a-z]/g, ''); }

  function drawSlots(state) {
    var ans = W[T.order[T.pos]].en, typed = norm($('#ans').value), box = $('#slots'), j = 0, atStart = true;
    box.innerHTML = '';
    for (var k = 0; k < ans.length; k++) {
      var ch = ans.charAt(k), s = document.createElement('span');
      if (ch === ' ') { s.className = 'ax-slot is-gap'; atStart = true; box.appendChild(s); continue; }
      s.className = 'ax-slot';
      var t = typed.charAt(j);
      if (state === 'reveal') { s.className += ' is-rev'; s.textContent = ch; }
      else if (t) {
        s.textContent = t;
        if (state === 'ok') s.className += ' is-ok';
        else if (state === 'bad') s.className += t === ch.toLowerCase() ? ' is-ok' : ' is-bad';
      } else if (T.hint && atStart) { s.className += ' is-hint'; s.textContent = ch; }
      atStart = false; j++; box.appendChild(s);
    }
  }
  function setPts() { $('#tp').textContent = T.score; $('#tn').textContent = (T.pos + 1) + '/' + W.length; }
  function setMsg(t, cls) { var m = $('#msg'); m.textContent = t; m.className = 'ax-msg ' + (cls || ''); }

  function startTrain() {
    T = { order: shuffle(W.map(function (_, i) { return i; })), pos: 0, score: 0, tries: 0, hint: false, phase: 'ask', hits: 0 };
    $('#tstart').hidden = true; $('#tend').hidden = true; $('#tplay').hidden = false;
    grid.classList.add('is-locked');
    question();
  }
  function question() {
    var i = T.order[T.pos]; cur = i; mark(i);
    T.tries = 0; T.hint = false; T.phase = 'ask';
    $('#ans').value = ''; $('#ans').disabled = false; $('#tcheck').textContent = 'Verificar';
    setMsg(''); setPts(); drawSlots(null);
    $('#ans').focus();
    playWeapon(i);
  }
  function next() {
    T.pos++;
    if (T.pos >= W.length) return finish();
    question();
  }
  function check() {
    if (T.phase === 'done') return next();
    var i = T.order[T.pos], w = W[i];
    if (!norm($('#ans').value)) { setMsg('Escreva o que você ouviu.', 'bad'); return; }
    if (norm($('#ans').value) === norm(w.en)) {
      var pts = Math.max(0, 10 - 3 * T.tries - (T.hint ? 2 : 0));
      T.score += pts; if (T.tries === 0) T.hits++;
      drawSlots('ok'); setPts();
      setMsg('Correto! ' + w.en + ' = ' + w.pt + ' (+' + pts + ')', 'good');
      T.phase = 'done'; $('#ans').disabled = true; $('#tcheck').textContent = T.pos === W.length - 1 ? 'Ver resultado' : 'Próxima';
      jingle(YES);
    } else {
      T.tries++; drawSlots('bad');
      var s = $('#slots'); s.classList.remove('is-shake'); void s.offsetWidth; s.classList.add('is-shake');
      setMsg('Quase. Ouça de novo e tente outra vez.', 'bad');
      jingle(NO);
    }
  }
  function showAnswer() {
    if (T.phase === 'done') return;
    drawSlots('reveal');
    setMsg(W[T.order[T.pos]].en + ' = ' + W[T.order[T.pos]].pt, 'bad');
    T.phase = 'done'; $('#ans').disabled = true; $('#tcheck').textContent = T.pos === W.length - 1 ? 'Ver resultado' : 'Próxima';
  }
  function finish() {
    $('#tplay').hidden = true; $('#tend').hidden = false; grid.classList.remove('is-locked');
    if (T.score > best) best = T.score; save();
    $('#tscore').textContent = T.score + ' / ' + (W.length * 10) + ' pontos';
    $('#tsum').textContent = 'Você acertou de primeira ' + T.hits + ' de ' + W.length + ' armas. Melhor pontuação: ' + best + '.';
    mark(-1);
  }
  $('#tgo').addEventListener('click', startTrain);
  $('#tagain').addEventListener('click', startTrain);
  $('#tcheck').addEventListener('click', check);
  $('#tplayb').addEventListener('click', function () { playWeapon(T.order[T.pos]); });
  $('#tslow').addEventListener('click', function () { playWeapon(T.order[T.pos], 0.6); });
  $('#thint').addEventListener('click', function () { T.hint = true; drawSlots(null); $('#ans').focus(); });
  $('#tshow').addEventListener('click', showAnswer);
  $('#ans').addEventListener('input', function () { drawSlots(null); });
  $('#ans').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); check(); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && T.phase === 'done' && mode === 'train' && !$('#tplay').hidden) { e.preventDefault(); next(); } });

  /* ---------- abas ---------- */
  function setMode(m) {
    mode = m;
    $('#tab-learn').setAttribute('aria-selected', m === 'learn');
    $('#tab-train').setAttribute('aria-selected', m === 'train');
    $('#learn').hidden = m !== 'learn'; $('#train').hidden = m !== 'train';
    if (m === 'learn') { grid.classList.remove('is-locked'); stopAudio(); learn(cur, false); }
    else {
      mark(-1);
      $('#tbest').textContent = best ? 'Melhor pontuação: ' + best : '';
      if (!$('#tplay').hidden) grid.classList.add('is-locked');
    }
  }
  $('#tab-learn').addEventListener('click', function () { setMode('learn'); });
  $('#tab-train').addEventListener('click', function () { setMode('train'); });

  deal(false); paintSeen(); learn(0, false);
})();
