/* ================================================================
   app.js — Logique de l'application
   Port de TfrmMain (main.pas) — Archers de Laillé V4.2
   ================================================================ */

'use strict';

/* ================================================================
   État global (équivalent des variables globales Pascal)
   ================================================================ */
const state = {
  /* Mode courant */
  mode:       null,    // 'SALLE' | 'TAE' | 'CAMPAGNE'
  nbArrows:   0,       // iNbFleches

  /* Impacts de la volée courante */
  impacts:    [],      // arrImpact (x, y, points, entered)
  nbEntered:  0,       // iNbSaisie
  totalPts:   0,       // iTOTAL (calculé)

  /* Phase de saisie */
  // 'idle'   → pas de volée lancée
  // 'arrows' → saisie des flèches (kClavFle)
  // 'total'  → saisie du total (kClavTot)
  // 'done'   → volée validée
  phase: 'idle',

  /* Mode JEU / Challenge */
  challenge:    false, // bJeu
  chalRound:    0,     // iCurJeu
  chalTimer:    -1,    // iDurJeu
  chalVolleys:  0,     // iVolJeu
  chalScore:    0,     // iScoJeu
  chalLabel:    '',    // sResultat (début)
  timerHandle:  null,  // setInterval handle
};

/* ================================================================
   Références DOM
   ================================================================ */
const canvas       = document.getElementById('targetCanvas');
const timerEl      = document.getElementById('timerDisplay');
const popupEl      = document.getElementById('popup');
const totalInput   = document.getElementById('total');
const arrowList    = document.getElementById('arrowPoints');
const keyGrid      = document.getElementById('keyGrid');
const btnSALLE     = document.getElementById('btnSALLE');
const btnTAE       = document.getElementById('btnTAE');
const btnCAMPAGNE  = document.getElementById('btnCAMPAGNE');
const btnJEU       = document.getElementById('btnJEU');
const btnClose     = document.getElementById('btnClose');
const modalOverlay = document.getElementById('modalOverlay');
const modalMsg     = document.getElementById('modalMsg');
const modalOK      = document.getElementById('modalOK');
const confirmOverlay = document.getElementById('confirmOverlay');
const confirmYes     = document.getElementById('confirmYes');
const confirmNo      = document.getElementById('confirmNo');

/* ================================================================
   Redimensionnement Canvas (équivalent FormResize)
   ================================================================ */
function resizeCanvas() {
  const wrapper = canvas.parentElement;
  const pad = 24;
  const size = Math.min(wrapper.clientWidth - pad, wrapper.clientHeight - pad);
  if (size < 50) return;
  canvas.width  = size;
  canvas.height = size;
  drawTarget(canvas, state.mode, state.impacts);
  positionPanel();
  positionTimer();
}

/**
 * Positionne le chrono dans le coin supérieur gauche du carré blanc,
 * avec un petit décalage intérieur pour ne pas chevaucher le bord.
 */
function positionTimer() {
  const panel = document.querySelector('.side-panel');
  if (!panel) return;

  const arena     = canvas.closest('.arena');
  const arenaRect = arena.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();

  /* Même left que le panneau, 20px au-dessus */
  timerEl.style.left  = Math.round(panelRect.left - arenaRect.left) + 'px';
  timerEl.style.top   = Math.round(panelRect.top  - arenaRect.top - timerEl.offsetHeight - 20) + 'px';
  timerEl.style.right = 'auto';
  /* Même largeur que le panneau pour l'alignement */
  timerEl.style.width = panel.offsetWidth + 'px';
  timerEl.style.textAlign = 'center';
}

/**
 * (B) Positionne le panneau latéral dynamiquement :
 * - horizontalement : bord gauche aligné sur le bord droit du blason
 *   + un espacement égal à la marge LAM'TECH (espace entre blason et bord canvas)
 * - verticalement   : centre géométrique aligné sur le centre du blason (cy)
 */
function positionPanel() {
  const panel = document.querySelector('.side-panel');
  if (!panel) return;

  /* Paramètres de mise en page du canvas (en pixels canvas) */
  const size   = canvas.width;                     /* canvas carré */
  const margin = size * 0.038 + 50;                /* marge LAM'TECH */
  const sqSize = size - 2 * margin;
  const R      = sqSize * 0.476;                   /* rayon zone 1 */
  const cx     = size / 2;                         /* centre X dans le canvas */
  const cy     = size / 2;                         /* centre Y dans le canvas */

  /* Position du canvas dans l'arena */
  const arena      = canvas.closest('.arena');
  const canvasRect = canvas.getBoundingClientRect();
  const arenaRect  = arena.getBoundingClientRect();
  const canvasLeft = canvasRect.left - arenaRect.left;
  const canvasTop  = canvasRect.top  - arenaRect.top;

  /* Bord droit du blason en coordonnées arena */
  const blasonRightInArena = canvasLeft + cx + R;

  /* Espacement = même que la marge LAM'TECH
     (distance entre bord blason et bord canvas) */
  const spacing = size / 2 - R;   /* = margin environ */

  /* Position finale du panneau */
  const panelLeft = blasonRightInArena + spacing + 40;
  const panelTop  = canvasTop + cy - panel.offsetHeight / 2;

  panel.style.left = Math.round(panelLeft) + 'px';
  panel.style.top  = Math.round(Math.max(0, panelTop)) + 'px';
  panel.style.right = 'auto';
}

/* ResizeObserver → recalcul automatique */
const ro = new ResizeObserver(() => requestAnimationFrame(resizeCanvas));
ro.observe(canvas.parentElement);

/* ================================================================
   Champs flèches (Point1..6 — TEdit)
   ================================================================ */
function buildArrowFields(nb) {
  arrowList.innerHTML = '';
  for (let i = 1; i <= nb; i++) {
    const wrap = document.createElement('div');
    wrap.className = 'arrow-field';
    wrap.innerHTML =
      `<span class="arrow-label">F${i}</span>`
      + `<input type="text" id="point${i}" class="point-input" readonly>`;
    arrowList.appendChild(wrap);
  }
}

function fillArrowField(index, value) {
  const el = document.getElementById(`point${index}`);
  if (!el) return;
  el.value = (value === 0) ? 'M' : String(value);
  el.classList.add('filled');
}

function clearArrowFields() {
  for (let i = 1; i <= state.nbArrows; i++) {
    const el = document.getElementById(`point${i}`);
    if (el) { el.value = ''; el.classList.remove('filled'); }
  }
}

/* ================================================================
   Clavier virtuel (Clavier panel — btn1..btn10, btnM, btnEff)
   ================================================================ */

/**
 * buildKeyboard(maxVal)
 * maxVal = 10 pour SALLE/TAE, 6 pour CAMPAGNE
 * Ordre : maxVal → 1, puis M, puis Eff (2 colonnes)
 */
function buildKeyboard(maxVal) {
  keyGrid.innerHTML = '';
  for (let v = maxVal; v >= 1; v--) {
    keyGrid.appendChild(makeKey(String(v), v, ''));
  }
  keyGrid.appendChild(makeKey('M',   0,  'key-m'));
  keyGrid.appendChild(makeKey('Eff', -1, 'key-eff'));
}

function makeKey(label, value, extraClass) {
  const btn = document.createElement('button');
  btn.className   = `key ${extraClass}`.trim();
  btn.textContent = label;
  btn.dataset.value = String(value);
  btn.disabled    = true;
  btn.addEventListener('click', onKeyClick);
  return btn;
}

/** Active/désactive toutes les touches (ClavierOnOff) */
function setKeyboardEnabled(enabled) {
  document.querySelectorAll('#keyGrid .key').forEach(k => {
    k.disabled = !enabled;
  });
}

/**
 * Phase TOTAL : masque toutes les touches sauf Eff,
 * qui est élargie à toute la largeur du clavier.
 */
function setKeyboardTotalMode() {
  document.querySelectorAll('#keyGrid .key').forEach(k => {
    if (k.classList.contains('key-eff')) {
      k.style.gridColumn = '1 / -1';   /* pleine largeur */
      k.style.display    = '';
      k.disabled         = false;
    } else {
      k.style.display = 'none';
    }
  });
}

/**
 * Restaure le clavier à son état normal (après total correct).
 * Appelé au début de chaque launchVolley.
 */
function restoreKeyboard() {
  document.querySelectorAll('#keyGrid .key').forEach(k => {
    k.style.display    = '';
    k.style.gridColumn = '';
  });
}

/** En phase TOTAL la touche M affiche "0" (comportement Pascal) */
function updateMKey(inTotalPhase) {
  const mKey = keyGrid.querySelector('.key-m');
  if (mKey) mKey.textContent = inTotalPhase ? '0' : 'M';
}

/* ================================================================
   Gestionnaire de clic clavier (SaisiePoints + TOTALChange)
   ================================================================ */
function onKeyClick(e) {
  const val = parseInt(e.currentTarget.dataset.value, 10);

  /* ── Touche Eff (-1) ─────────────────────────────────────── */
  if (val === -1) {
    if (state.phase === 'total') {
      totalInput.value = '';
      totalInput.classList.remove('correct', 'error');
      /* Refocus après le clic sur le bouton */
      requestAnimationFrame(() => totalInput.focus());
    } else if (state.phase === 'arrows') {
      state.impacts.forEach(imp => { imp.entered = false; });
      state.nbEntered = 0;
      state.totalPts  = 0;
      clearArrowFields();
      drawTarget(canvas, state.mode, state.impacts);
    }
    return;
  }

  /* ── Phase TOTAL ─────────────────────────────────────────── */
  if (state.phase === 'total') {
    totalInput.value += String(val);
    validateTotal();
    /* Refocus systématique : le clic sur la touche a volé le focus */
    requestAnimationFrame(() => totalInput.focus());
    return;
  }

  /* ── Phase FLECHES ───────────────────────────────────────── */
  if (state.phase !== 'arrows') return;

  /* Cherche le premier impact avec cette valeur non encore saisi
     Pascal : arrImpact[i,kPoints] = iPoint AND arrImpact[i,kSaisie] = -1 */
  const impIdx = state.impacts.findIndex(
    imp => imp.points === val && !imp.entered
  );

  if (impIdx === -1) {
    /* Aucun impact correspondant → erreur visuelle et sonore */
    flashError(
      `Aucun impact dans la zone ${e.currentTarget.textContent} du blason.`
    );
    return;
  }

  /* Valide cet impact */
  state.impacts[impIdx].entered = true;
  state.nbEntered++;
  state.totalPts += val;
  fillArrowField(state.nbEntered, val);
  drawTarget(canvas, state.mode, state.impacts);

  /* Verrouille les boutons de mode dès la 1ère flèche saisie */
  if (state.nbEntered === 1) enableModeButtons(false);

  /* Toutes les flèches saisies → passer en phase TOTAL (kClavTot) */
  if (state.nbEntered === state.nbArrows) {
    switchToTotalPhase();
  }
}

/* ================================================================
   Phases de saisie
   ================================================================ */

/** Passe en phase TOTAL (équivalent ClavierOnOff(kClavTot)) */
function switchToTotalPhase() {
  state.phase          = 'total';
  totalInput.disabled  = false;
  totalInput.value     = '';
  totalInput.className = '';
  updateMKey(true);
  setKeyboardTotalMode();   /* masque tout sauf Eff, élargit Eff */
  totalInput.focus();
  showPopup('Entrez le total des points de la volée.', 'info');
}

/**
 * Valide la saisie du total (TOTALChange)
 * Comparaison chaîne pour gérer les saisies partielles
 */
function validateTotal() {
  const entered = totalInput.value;
  const correct = String(state.totalPts);

  /* Valeur correcte → succès */
  if (entered === correct) {
    totalInput.classList.remove('error');
    totalInput.classList.add('correct');
    hidePopup();
    /* Petit délai visuel avant de passer à la suite */
    setTimeout(onVolleyCorrect, 450);
    return;
  }

  /* Longueur atteinte mais valeur erronée → signal d'erreur */
  if (entered.length >= correct.length) {
    totalInput.classList.remove('correct');
    flashError('Le total des points de la volée est erroné.');
    /* Effacement automatique après le flash (500ms) */
    setTimeout(() => {
      totalInput.value = '';
      totalInput.classList.remove('error');
      requestAnimationFrame(() => totalInput.focus());
    }, 500);
  }
}

/** Volée réussie — équivalent de la branche "text = IntToStr(iTOTAL)" */
function onVolleyCorrect() {
  state.phase = 'done';
  totalInput.disabled = true;
  setKeyboardEnabled(false);
  enableModeButtons(true);

  if (state.challenge) {
    /* Mode Challenge : bonus = 10 + secondes restantes */
    clearInterval(state.timerHandle);
    state.chalScore   += 10 + Math.max(0, state.chalTimer);
    state.chalVolleys += 1;

    if (state.chalRound < 10) {
      /* Délai court pour laisser voir le total vert, puis volée suivante */
      setTimeout(launchVolley, 400);
    } else {
      setTimeout(endChallenge, 400);
    }
  } else {
    /* Mode entraînement : génère automatiquement la prochaine volée
       après un court délai permettant de voir le total valide en vert */
    setTimeout(launchVolley, 500);
  }
}

/* ================================================================
   Lancement d'une volée (btnVoleeClick)
   ================================================================ */
function launchVolley() {
  /* Génère les impacts */
  state.impacts   = generateImpacts(state.nbArrows, canvas, state.mode);
  state.nbEntered = 0;
  state.totalPts  = 0;
  state.phase     = 'arrows';

  /* Reset UI */
  clearArrowFields();
  totalInput.value     = '';
  totalInput.disabled  = true;
  totalInput.className = '';
  updateMKey(false);
  restoreKeyboard();          /* remet le clavier dans son état normal */
  setKeyboardEnabled(true);
  enableModeButtons(true);   /* actifs tant qu'aucune flèche n'est saisie */

  /* Redessine le blason avec les impacts */
  drawTarget(canvas, state.mode, state.impacts);

  /* Séquence par flèche : whoosh → impact sonore → dessin */
  const flightMs  = 420;
  const spacingMs = 700;

  /* Boutons de mode inutilisables pendant toute la génération */
  enableModeButtons(false);

  state.impacts.forEach((imp, i) => {
    const t      = i * spacingMs;
    const isLast = (i === state.impacts.length - 1);
    setTimeout(() => playWhoosh(), t);
    setTimeout(() => {
      playImpact();
      imp.visible = true;
      drawTarget(canvas, state.mode, state.impacts);
      if (isLast) enableModeButtons(true);
    }, t + flightMs);
  });

  /* Mode JEU : démarrage du chrono */
  if (state.challenge) {
    state.chalRound++;
    state.chalTimer = 60;    /* kDuJeu = 60 */
    updateTimerDisplay();
    timerEl.classList.remove('hidden', 'warning');
    clearInterval(state.timerHandle);
    state.timerHandle = setInterval(tickTimer, 1000);
  }
}

/* ================================================================
   Démarrage d'un mode (btnSALLE / btnTAE / btnCampagneClick)
   ================================================================ */
function startMode(mode) {
  /* Met en évidence le bouton actif */
  [btnSALLE, btnTAE, btnCAMPAGNE].forEach(b => {
    b.classList.remove('active-salle', 'active-tae', 'active-campagne');
  });
  if (mode === 'SALLE')    btnSALLE.classList.add('active-salle');
  if (mode === 'TAE')      btnTAE.classList.add('active-tae');
  if (mode === 'CAMPAGNE') btnCAMPAGNE.classList.add('active-campagne');

  state.mode     = mode;
  state.nbArrows = (mode === 'TAE') ? 6 : 3;   /* kNobrImpact * 2 pour TAE */

  if (state.challenge) {
    /* sResultat := 'Gain du jeu sur blason ...' */
    state.chalLabel = `Gain du jeu sur blason « ${mode} » :`;
  }

  buildArrowFields(state.nbArrows);
  buildKeyboard(mode === 'CAMPAGNE' ? 6 : 10);
  requestAnimationFrame(() => { positionPanel(); positionTimer(); });
  launchVolley();
}

/* ================================================================
   Mode JEU / Challenge (btnJEUClick + timJEUTimer)
   ================================================================ */

/** Bascule Challenge ON/OFF */
function toggleChallenge() {
  if (state.challenge) {
    /* ── Arrêt manuel du challenge ─────────────────────────── */
    clearInterval(state.timerHandle);
    timerEl.classList.add('hidden');
    state.challenge = false;
    state.phase     = 'idle';

    btnJEU.textContent = 'Challenge OFF';
    btnJEU.classList.remove('active');

    enableModeButtons(true);
    setKeyboardEnabled(false);

    if (state.chalRound > 0) showModal(buildChallengeResult());
  } else {
    /* ── Démarrage du challenge ─────────────────────────────── */
    state.challenge   = true;
    state.chalRound   = 0;
    state.chalTimer   = -1;
    state.chalVolleys = 0;
    state.chalScore   = 0;
    state.chalLabel   = '';

    btnJEU.textContent = 'Challenge ON';
    btnJEU.classList.add('active');
    /* Le premier lancement se fait en cliquant un bouton de mode */
  }
}

/** timJEUTimer — se déclenche chaque seconde */
function tickTimer() {
  if (!state.challenge || state.chalTimer <= 0) return;

  state.chalTimer--;
  updateTimerDisplay();
  timerEl.classList.toggle('warning', state.chalTimer <= 10);

  if (state.chalTimer <= 0) {
    /* Temps écoulé → volée suivante ou fin */
    clearInterval(state.timerHandle);
    if (state.chalRound < 10) {
      launchVolley();
    } else {
      endChallenge();
    }
  }
}

function updateTimerDisplay() {
  timerEl.textContent = state.chalTimer;
}

/** Fin des 10 volées du challenge */
function endChallenge() {
  clearInterval(state.timerHandle);
  timerEl.classList.add('hidden');
  state.challenge = false;

  btnJEU.textContent = 'Challenge OFF';
  btnJEU.classList.remove('active');

  state.phase = 'done';
  setKeyboardEnabled(false);
  enableModeButtons(true);

  showModal(buildChallengeResult());
}

/** Construit le message de résultat (sResultat Pascal) */
function buildChallengeResult() {
  const now     = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
  const timeStr = now.toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit'
  });
  const vStr = state.chalVolleys;

  return {
    title: state.chalLabel || 'Résultat du Challenge :',
    body:  `${state.chalScore} points.\n`
         + `Pour ${vStr} décompte${vStr > 1 ? 's' : ''} exact${vStr > 1 ? 's' : ''}`
         + ` sur 10 volées.\n`
         + `Le ${dateStr} à ${timeStr}.`,
  };
}

/* ================================================================
   Popup (ShowPopup)
   ================================================================ */
let _popupTimeout = null;

function showPopup(msg, type = 'error') {
  popupEl.textContent = msg;
  popupEl.className   = `popup ${type}`;
  clearTimeout(_popupTimeout);
  _popupTimeout = setTimeout(hidePopup, 5000);   /* 5 s */
}
function hidePopup() {
  popupEl.classList.add('hidden');
}

/** Erreur de saisie — flash rouge 500ms + son Docteur Maboul */
function flashError(msg) {
  showPopup(msg, 'error');
  playError();
  const overlay = document.getElementById('flashOverlay');
  overlay.classList.remove('flash-error');
  void overlay.offsetWidth;
  overlay.classList.add('flash-error');
  overlay.addEventListener('animationend',
    () => overlay.classList.remove('flash-error'),
    { once: true }
  );
}

/* ================================================================
   Modal de résultat (Application.MessageBox)
   ================================================================ */
const modalTitle = document.getElementById('modalTitle');

function showModal(data) {
  modalTitle.textContent = data.title;
  modalMsg.textContent   = data.body;
  modalOverlay.classList.remove('hidden');
}
modalOK.addEventListener('click', () => {
  modalOverlay.classList.add('hidden');
});

/* ================================================================
   Confirmation de fermeture (FormCloseQuery Pascal)
   ================================================================ */
function askClose() {
  confirmOverlay.classList.remove('hidden');
}
btnClose.addEventListener('click', askClose);

confirmYes.addEventListener('click', () => {
  window.close();
  /* Fallback si window.close() est bloqué par le navigateur */
  document.body.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:center;'
    + 'height:100vh;font-family:Arial,sans-serif;font-size:18px;color:#555;">'
    + 'Vous pouvez fermer cet onglet.</div>';
});

confirmNo.addEventListener('click', () => {
  confirmOverlay.classList.add('hidden');
});

/* Interception du bouton fermeture du navigateur (best-effort) */
window.addEventListener('beforeunload', (e) => {
  e.preventDefault();
  e.returnValue = '';  // requis par certains navigateurs
});

/* ================================================================
   Utilitaires
   ================================================================ */
function enableModeButtons(enabled) {
  btnSALLE.disabled    = !enabled;
  btnTAE.disabled      = !enabled;
  btnCAMPAGNE.disabled = !enabled;
}

/* ================================================================
   Saisie directe du clavier physique dans le champ TOTAL
   (l'utilisateur peut aussi taper au clavier)
   ================================================================ */
totalInput.addEventListener('input', () => {
  if (state.phase !== 'total') { totalInput.value = ''; return; }
  /* On n'accepte que des chiffres */
  const clean = totalInput.value.replace(/\D/g, '');
  if (clean !== totalInput.value) {
    totalInput.value = clean;
    return;  /* le 2e event revalidera */
  }
  validateTotal();
});

/* ================================================================
   Branchement des boutons de mode et du challenge
   ================================================================ */
btnSALLE   .addEventListener('click', () => { preloadSounds(); startMode('SALLE'); });
btnTAE     .addEventListener('click', () => { preloadSounds(); startMode('TAE'); });
btnCAMPAGNE.addEventListener('click', () => { preloadSounds(); startMode('CAMPAGNE'); });
btnJEU     .addEventListener('click', toggleChallenge);

/* ================================================================
   Initialisation
   ================================================================ */
(function init() {
  resizeCanvas();
  buildKeyboard(10);
  setKeyboardEnabled(false);

  /* Splash screen — affiché 2,5s puis fondu sortie */
  const splash = document.getElementById('splashOverlay');
  setTimeout(() => {
    splash.style.animation = 'splash-out 0.5s ease-in forwards';
    splash.addEventListener('animationend', () => {
      splash.classList.add('hidden');
    }, { once: true });
  }, 2500);
})();