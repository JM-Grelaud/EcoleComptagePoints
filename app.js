/* ================================================================
   app.js — Logique de l'application
   Port de TfrmMain (main.pas) — Archers de Laillé V4.3.1
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

  /* Joueur identifié au démarrage du challenge */
  player:       null,  // { prenom, nom, licence }
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
const btnMANUEL    = document.getElementById('btnMANUEL');
const btnClose     = document.getElementById('btnClose');
const modalOverlay = document.getElementById('modalOverlay');
const modalMsg     = document.getElementById('modalMsg');
const modalOK      = document.getElementById('modalOK');
const confirmOverlay = document.getElementById('confirmOverlay');
const confirmYes     = document.getElementById('confirmYes');
const confirmNo     = document.getElementById('confirmNo');
const playerOverlay = document.getElementById('playerOverlay');
const playerPrenom  = document.getElementById('playerPrenom');
const playerNom     = document.getElementById('playerNom');
const playerLicence = document.getElementById('playerLicence');
const playerArcher  = document.getElementById('playerArcher');
const playerArcherWrap = document.getElementById('playerArcherWrap');
const playerOK      = document.getElementById('playerOK');
const playerCancel  = document.getElementById('playerCancel');

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

    if (state.chalRound > 0) {
      /* Challenge arrêté avant la 10e volée : le score partiel est
         tracé dans le Journal (le nombre de volées exactes y figure),
         mais il ne compte pas pour le record personnel. */
      registerChallengeRecord(true);
      showModal(buildChallengeResult());
    }
  } else {
    /* ── Démarrage du challenge : identification du joueur ──── */
    openPlayerModal();
  }
}

/* ================================================================
   Identification du joueur (début de challenge)
   ================================================================ */

/** Affiche la modale d'identification du joueur */
function openPlayerModal() {
  /* Pré-remplissage avec le dernier joueur ayant joué sur cet appareil */
  try {
    const last = JSON.parse(localStorage.getItem('ecopo-last-player') || 'null');
    if (last) {
      playerPrenom.value  = last.prenom  || '';
      playerNom.value     = last.nom     || '';
      playerLicence.value = last.licence || '';
      /* Sélectionne l'archer dans la liste déroulante s'il y figure */
      if (playerArcher && last.licence &&
          [...playerArcher.options].some(o => o.value === last.licence)) {
        playerArcher.value = last.licence;
      }
    }
  } catch (_) { /* stockage indisponible → modale vierge */ }

  playerOverlay.classList.remove('hidden');
  playerPrenom.focus();
}

/** Valide l'identification puis lance le challenge */
function confirmPlayer() {
  const prenom  = playerPrenom.value.trim();
  const nom     = playerNom.value.trim();
  const licence = playerLicence.value.trim();

  /* Les trois champs sont obligatoires */
  [playerPrenom, playerNom, playerLicence].forEach(el => {
    el.classList.toggle('invalid', el.value.trim() === '');
  });
  if (prenom === '' || nom === '' || licence === '') return;

  state.player = { prenom, nom, licence };

  /* Mémorise le joueur pour pré-remplir la prochaine fois */
  try {
    localStorage.setItem('ecopo-last-player', JSON.stringify(state.player));
  } catch (_) { /* tant pis */ }

  playerOverlay.classList.add('hidden');
  startChallenge();
}

/** Démarrage effectif du challenge (après identification du joueur) */
function startChallenge() {
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

playerCancel.addEventListener('click', () => {
  playerOverlay.classList.add('hidden');
});
playerOK.addEventListener('click', confirmPlayer);
playerOverlay.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') confirmPlayer();
  if (e.key === 'Escape') playerOverlay.classList.add('hidden');
});

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

  /* Enregistrement du score : uniquement s'il bat le record
     personnel du joueur pour ce type de volée (ou 1er record) */
  const recordInfo = registerChallengeRecord();
  const result = buildChallengeResult();
  if (recordInfo) {
    const modeLabel = state.mode || '';
    result.body += (recordInfo.isNewRecord
      ? `\n🏆 Nouveau record personnel « ${modeLabel} » !`
      : `\nRecord personnel « ${modeLabel} » : ${recordInfo.best} points.`);
  }
  showModal(result);
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
   Archers du club (liste fournie par la web app Google)
   • Récupération au lancement (si en ligne), cache localStorage
   • Auto-complétion de la modale joueur ; repli hors-ligne
   ================================================================ */
const ARCHERS_KEY = 'ecopo-archers';

function loadArchers() {
  try {
    return JSON.parse(localStorage.getItem(ARCHERS_KEY) || 'null');
  } catch (_) {
    return null;
  }
}

function saveArchers(archers) {
  try {
    localStorage.setItem(ARCHERS_KEY, JSON.stringify(archers));
  } catch (_) { /* stockage indisponible → ignoré */ }
}

/** Récupère la liste des archers depuis la web app (GET /exec) */
async function refreshArchers() {
  if (!RECORDS_WEBHOOK_URL || !navigator.onLine) return;
  try {
    const resp = await fetch(RECORDS_WEBHOOK_URL);
    const data  = await resp.json();
    if (data && Array.isArray(data.archers) && data.archers.length) {
      saveArchers(data.archers);
      fillArcherSelect(data.archers);
    }
  } catch (_) { /* réseau indisponible → on garde le cache */ }
}

/** Construit (ou met à jour) le menu déroulant des archers */
function fillArcherSelect(archers) {
  if (!playerArcher || !playerArcherWrap) return;

  /* Pas de liste disponible → saisie manuelle uniquement */
  playerArcherWrap.classList.toggle('hidden', !(archers && archers.length));
  if (!archers || !archers.length) return;

  const current = playerArcher.value;
  playerArcher.innerHTML = '';
  const head = document.createElement('option');
  head.value       = '';
  head.textContent = '— Sélectionner un archer —';
  playerArcher.appendChild(head);
  archers.forEach(a => {
    const opt = document.createElement('option');
    opt.value       = a.licence;
    opt.textContent = a.nom.toUpperCase() + ' ' + a.prenom + ' (' + a.licence + ')';
    playerArcher.appendChild(opt);
  });
  if (current && [...playerArcher.options].some(o => o.value === current)) {
    playerArcher.value = current;
  }
}

/* Sélection d'un archer → pré-remplissage des trois champs */
playerArcher.addEventListener('change', () => {
  const licence = playerArcher.value;
  if (!licence) return;
  const a = (loadArchers() || []).find(x => x.licence === licence);
  if (a) {
    playerPrenom.value   = a.prenom;
    playerNom.value      = a.nom;
    playerLicence.value  = a.licence;
  }
});

/* ================================================================
   Records des challenges
   • Stockage local (localStorage) — fonctionne 100 % hors-ligne
   • Synchronisation optionnelle vers une Google Sheet partagée via
     un web app Apps Script (constante RECORDS_WEBHOOK_URL)
   ================================================================ */
const RECORDS_KEY = 'ecopo-records';

/* URL du web app Apps Script alimentant la Google Sheet partagée
   de classement. Laisser vide pour un fonctionnement 100 % hors-ligne.
   Exemple : 'https://script.google.com/macros/s/AKfycb…/exec' */
const RECORDS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwroHUoAKvizU-pkgsExRtQoPVHyO6xuBbVJmK-BFwxK62gyJpUPdo1cYuNHG87rDX7-Q/exec';

/** Charge les records locaux :
    { licence: { prenom, nom, modes: { MODE: { score, volleys, date } } } } */
function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(RECORDS_KEY) || '{}');
  } catch (_) {
    return {};
  }
}

function saveRecords(records) {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch (_) { /* stockage indisponible → ignoré */ }
}

/**
 * Enregistre le score du challenge qui vient de se terminer :
 * le score ne remplace le record précédent que s'il est MEILLEUR.
 * Si `partial` est vrai (challenge arrêté avant la 10e volée), le score
 * est envoyé au Journal pour trace, mais le record personnel local
 * n'est ni comparé ni modifié — seuls les challenges complets de
 * 10 volées comptent pour le record.
 * Retourne { isNewRecord, best } ou null si non enregistrable.
 */
function registerChallengeRecord(partial) {
  if (!state.player || !state.mode) return null;

  const licence = state.player.licence;
  const mode    = state.mode;
  const score   = state.chalScore;
  const now     = new Date();

  if (partial) {
    /* Trace dans le Journal, sans impact sur le record local */
    sendRecordToSheet({
      licence:  licence,
      prenom:   state.player.prenom,
      nom:      state.player.nom,
      mode:     mode,
      score:    score,
      volleys:  state.chalVolleys,
      date:     now.toISOString(),
    });
    return null;
  }

  const records = loadRecords();
  const entry    = records[licence] ||
    (records[licence] = { prenom: state.player.prenom, nom: state.player.nom, modes: {} });
  const prev = entry.modes[mode];

  /* Score inférieur ou égal au record précédent → rien à enregistrer */
  if (prev && prev.score >= score) {
    return { isNewRecord: false, best: prev.score };
  }

  entry.modes[mode] = {
    score:   score,
    volleys: state.chalVolleys,
    date:    now.toISOString(),
  };
  saveRecords(records);

  /* Synchronisation optionnelle (Google Sheet partagée) */
  sendRecordToSheet({
    licence:  licence,
    prenom:   entry.prenom,
    nom:      entry.nom,
    mode:     mode,
    score:    score,
    volleys:  state.chalVolleys,
    date:     now.toISOString(),
  });

  return { isNewRecord: true, best: score };
}

/** Envoie le record au web app Apps Script (best effort, non bloquant)
 *  puis affiche un message de statut synthétisant ce qui vient d'être
 *  inscrit dans le Journal. */
function sendRecordToSheet(record) {
  if (!RECORDS_WEBHOOK_URL || !navigator.onLine) return;
  try {
    fetch(RECORDS_WEBHOOK_URL, {
      method: 'POST',
      /* text/plain : évite la pré-requête CORS (preflight) */
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(record),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.status === 'ok') {
          showPopup(messageJournal_(record), 'success');
        } else {
          showPopup(
            'Envoi refusé : ' + ((data && data.message) || 'raison inconnue') +
            ' — le score reste enregistré dans l\'appareil.', 'error');
        }
      })
      .catch(() => {
        /* Réponse illisible (CORS) ou échec réseau : l'envoi a bien eu
           lieu, mais on ne peut pas confirmer côté serveur. */
        showPopup(messageJournal_(record, true), 'info');
      });
  } catch (_) { /* tant pis */ }
}

/** Synthèse de la ligne qui vient d'être inscrite dans le Journal */
function messageJournal_(record, envoyeSeulement) {
  const d = record.date ? new Date(record.date) : new Date();
  const dateStr = d.toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
  const timeStr = d.toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  return (envoyeSeulement ? 'Envoyé au Journal : ' : 'Inscrit dans le Journal : ') +
    `${record.prenom} ${record.nom} — ${record.mode}, ` +
    `${record.score} points, ${record.volleys} volées exactes` +
    ` (le ${dateStr} à ${timeStr}).`;
}

/* ================================================================
   Popup (ShowPopup)
   ================================================================ */
let _popupTimeout = null;

function showPopup(msg, type = 'error') {
  popupEl.textContent = msg;
  popupEl.className   = `popup ${type}`;
  clearTimeout(_popupTimeout);
  _popupTimeout = setTimeout(hidePopup, 8000);   /* 8 s */
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
btnMANUEL .addEventListener('click', () => {
  /* Manuel d'utilisation au format PDF (mis en cache hors-ligne) */
  window.open('EcCoPo_Manuel_Utilisateur.pdf', '_blank');
});

/* ================================================================
   Initialisation
   ================================================================ */
(function init() {
  resizeCanvas();
  buildKeyboard(10);
  setKeyboardEnabled(false);

  /* Archers du club : cache local immédiat, puis mise à jour en ligne */
  fillArcherSelect(loadArchers());
  refreshArchers();

  /* Splash screen — affiché 2,5s puis fondu sortie */
  const splash = document.getElementById('splashOverlay');
  setTimeout(() => {
    splash.style.animation = 'splash-out 0.5s ease-in forwards';
    splash.addEventListener('animationend', () => {
      splash.classList.add('hidden');
    }, { once: true });
  }, 2500);
})();
