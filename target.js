/* ================================================================
   target.js — Canvas : dessin du blason et génération des impacts
   Port du Pascal TfrmMain.FormResize + SimImpacts (main.pas)
   ================================================================ */

'use strict';

/* ----------------------------------------------------------------
   Couleurs des zones — extraites du main.lfm (valeurs BGR converties)
   Zone 1 = la plus externe / Zone 10 = la plus interne
   ---------------------------------------------------------------- */
const ZONE_COLORS = [
  null,
  { fill: '#FFFFFF', stroke: '#AAAAAA' },   // [1]  blanc
  { fill: '#FFFFFF', stroke: '#AAAAAA' },   // [2]  blanc
  { fill: '#000000', stroke: '#333333' },   // [3]  noir
  { fill: '#000000', stroke: '#FFFFFF' },   // [4]  noir liseré blanc
  { fill: '#00B4E4', stroke: '#333333' },   // [5]  bleu
  { fill: '#00B4E4', stroke: '#333333' },   // [6]  bleu
  { fill: '#F65058', stroke: '#333333' },   // [7]  rouge
  { fill: '#F65058', stroke: '#333333' },   // [8]  rouge
  { fill: '#FFE552', stroke: '#333333' },   // [9]  or
  { fill: '#FFE552', stroke: '#333333' },   // [10] or
];

const ZONE_COLORS_CAMPAGNE = [
  null, null, null, null, null,
  { fill: '#000000', stroke: '#FFFFFF' },   // [5]
  { fill: '#000000', stroke: '#FFFFFF' },   // [6]
  { fill: '#000000', stroke: '#FFFFFF' },   // [7]
  { fill: '#000000', stroke: '#FFFFFF' },   // [8]
  { fill: '#FFE552', stroke: '#333333' },   // [9]
  { fill: '#FFE552', stroke: '#333333' },   // [10]
];

/* ----------------------------------------------------------------
   Mise en page (partagée dessin ↔ génération ↔ scoring)
   Fond paille / carré blanc / blason centré
   ---------------------------------------------------------------- */
function getLayout(canvas) {
  const W      = canvas.width;
  const H      = canvas.height;
  const size   = Math.min(W, H);
  const margin = size * 0.038 + 50;   /* +50px LAM'TECH de chaque côté */
  const sqSize = size - 2 * margin;
  const sqX    = (W - sqSize) / 2;
  const sqY    = (H - sqSize) / 2;
  const cx     = W / 2;
  const cy     = H / 2;
  const R      = sqSize * 0.476;   // rayon zone 1
  return { W, H, size, margin, sqSize, sqX, sqY, cx, cy, R };
}

/* ----------------------------------------------------------------
   Rayon de la zone i  (Pascal: arrZone[i,kR] = rZone10*(11-i)/...)
   zoneRadius(1, R) = R  →  zone extérieure
   zoneRadius(10, R) = R/10  →  zone centrale
   ---------------------------------------------------------------- */
function zoneRadius(i, R) {
  return R * (11 - i) / 10;
}

/* ----------------------------------------------------------------
   Rayon des impacts — ratio LFM : Impact.Width=15 / Disque_1.Width=800
   ---------------------------------------------------------------- */
function impactRadius(R) {
  return R * 15 / 800;
}

/* ================================================================
   LAM'TECH — bandes horizontales aléatoires, mises en cache
   ================================================================ */
const LAMTECH_COLORS = [
  '#000000', '#000000', '#000000', '#000000',
  '#000000', '#000000', '#000000', '#000000', 
  '#000000', '#000000', '#000000', '#000000',   /* noir 12× plus fréquent */
  '#F65058',                          /* rouge */
  '#00B4E4',                          /* bleu */
  '#FFE552',                          /* jaune */
  '#F6A050',                          /* orange */
  '#8B4513',                          /* marron */
  '#50C878',                          /* vert */
  '#9B59B6',                          /* violet */
];

let _lamtechBands  = null;
let _lamtechForH   = 0;

function _buildLamtech(H) {
  if (_lamtechBands && _lamtechForH === H) return;
  const bands = [];
  let y = 0;
  while (y < H) {
    const h = Math.floor(Math.random() * 5) + 2;   /* 2-6 px */
    const c = LAMTECH_COLORS[Math.floor(Math.random() * LAMTECH_COLORS.length)];
    bands.push({ y, h, c });
    y += h;
  }
  _lamtechBands = bands;
  _lamtechForH  = H;
}

function _drawLamtech(ctx, W, H) {
  _buildLamtech(H);
  _lamtechBands.forEach(({ y, h, c }) => {
    ctx.fillStyle = c;
    ctx.fillRect(0, y, W, h);
  });
}

/* ================================================================
   drawTarget(canvas, mode, impacts)
   ================================================================ */
function drawTarget(canvas, mode, impacts) {
  const ctx = canvas.getContext('2d');
  const { W, H, size, margin, sqSize, sqX, sqY, cx, cy, R } = getLayout(canvas);

  ctx.clearRect(0, 0, W, H);

  /* ── 1. Fond LAM'TECH — bandes aléatoires 2-6px ─────────────── */
  _drawLamtech(ctx, W, H);

  /* ── 1b. Supports chêne (haut et bas) ───────────────────────── */
  const plankH  = Math.max(8, size * 0.028);   /* épaisseur des planches */
  const plankC  = 'rgb(140,95,80)';
  const plankD  = 'rgb(100,65,50)';            /* ombre/grain */
  /* Planche haute */
  ctx.fillStyle = plankC;
  ctx.fillRect(0, 0, W, plankH);
  ctx.fillStyle = plankD;
  ctx.fillRect(0, plankH - 2, W, 2);
  /* Planche basse */
  ctx.fillStyle = plankC;
  ctx.fillRect(0, H - plankH, W, plankH);
  ctx.fillStyle = plankD;
  ctx.fillRect(0, H - plankH, W, 2);

/* ── 1c. Sangles à cliquet (gauche et droite) ────────────────── */
  const strapW  = Math.max(4, size * 0.012);   /* Largeur sangle */
  
  // On décolle les sangles du bord (environ 1.5x leur largeur) pour loger les cliquets
  const sideMargin = strapW * 1.5; 
  const strapX1 = sideMargin;                           
  const strapX2 = W - strapW - sideMargin;                  
  
  const strapC  = 'rgb(0,0,255)';
  const strapD  = 'rgb(0,0,160)';              
  
  const ratchetGold  = '#B8860B'; 
  const ratchetLight = '#FFD700'; 
  const ratchetDark  = '#5D4037'; 
  
  [strapX1, strapX2].forEach((sx, i) => {
    // 1. Dessin de la sangle bleue
    ctx.fillStyle = strapC;
    ctx.fillRect(sx, 0, strapW, H);
    ctx.fillStyle = strapD;
    ctx.fillRect(sx + strapW * 0.7, 0, strapW * 0.2, H);

    // 2. Configuration du cliquet
    const ry = i === 0 ? H * 0.25 : H * 0.65; // Désalignement vertical
    const rH = strapW * 4;       
    const rW = strapW * 1.8; // Largeur du boîtier doré
    
    // Centrage du cliquet sur la sangle :
    // On aligne le centre du cliquet (rx + rW/2) avec le centre de la sangle (sx + strapW/2)
    const rx = sx + (strapW / 2) - (rW / 2);

    ctx.save();
    
    // -- Corps principal (Boîtier) --
    ctx.fillStyle = ratchetGold;
    ctx.strokeStyle = ratchetDark;
    ctx.lineWidth = 1;
    ctx.fillRect(rx, ry, rW, rH);
    ctx.strokeRect(rx, ry, rW, rH);
    
    // -- Tambour central --
    ctx.beginPath();
    ctx.arc(rx + rW/2, ry + rH*0.4, rW/2.5, 0, Math.PI * 2);
    ctx.fillStyle = ratchetDark;
    ctx.fill();

    // -- Poignée (Levier) : Orientée vers l'extérieur --
    ctx.fillStyle = ratchetGold;
    ctx.beginPath();
    ctx.moveTo(rx + rW/2, ry + rH*0.4);
    
    // Direction : vers la gauche pour la sangle 0, vers la droite pour la sangle 1
    const dir = (i === 0) ? -1 : 1;
    const handleLength = rW * 1.2;
    
    ctx.lineTo(rx + rW/2 + (handleLength * dir), ry - rH*0.2);
    ctx.lineTo(rx + rW/2 + (handleLength * 1.2 * dir), ry - rH*0.1);
    ctx.lineTo(rx + rW/2, ry + rH*0.6);
    
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // -- Reflet pour l'aspect métallique --
    ctx.fillStyle = ratchetLight;
    ctx.fillRect(rx + 2, ry + 2, 1.5, rH - 4);

    ctx.restore();
  });  
  /* ── 2. Carré blanc ──────────────────────────────────────────── */
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(sqX, sqY, sqSize, sqSize);
  ctx.strokeStyle = '#C8C0A0';
  ctx.lineWidth   = Math.max(1, size * 0.0015);
  ctx.strokeRect(sqX, sqY, sqSize, sqSize);

  /* ── 3. Zones du blason (extérieur → intérieur) ──────────────── */
  const isCampagne = (mode === 'CAMPAGNE');
  const colors     = isCampagne ? ZONE_COLORS_CAMPAGNE : ZONE_COLORS;
  const firstZone  = isCampagne ? 5 : 1;

  for (let i = firstZone; i <= 10; i++) {
    const col = colors[i];
    const r   = zoneRadius(i, R);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle   = col.fill;
    ctx.fill();
    ctx.strokeStyle = col.stroke;
    ctx.lineWidth   = Math.max(0.7, R * 0.003);
    ctx.stroke();
  }

  /* ── 4. Croix centrale ───────────────────────────────────────── */
  const crossLen = Math.max(3, R * 0.022);
  const crossW   = Math.max(0.8, R * 0.004);
  ctx.save();
  ctx.strokeStyle = 'rgba(90,90,90,0.8)';
  ctx.lineWidth   = crossW;
  ctx.beginPath(); ctx.moveTo(cx - crossLen, cy); ctx.lineTo(cx + crossLen, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy - crossLen); ctx.lineTo(cx, cy + crossLen); ctx.stroke();
  ctx.restore();

  /* ── 5. Clous bordeaux en losange + diagonales coin-à-coin ─── */
  const clouSize  = size * 0.022;
  const clouInset = clouSize * 0.8;
  const s = clouSize / 2;             /* demi-diagonale du losange */
  const corners = [
    [ sqX + clouInset,          sqY + clouInset          ],
    [ sqX + sqSize - clouInset, sqY + clouInset          ],
    [ sqX + clouInset,          sqY + sqSize - clouInset ],
    [ sqX + sqSize - clouInset, sqY + sqSize - clouInset ],
  ];
  corners.forEach(([px, py]) => {
    /* Losange tracé directement (4 sommets) sans rotation */
    ctx.beginPath();
    ctx.moveTo(px,     py - s);   /* haut   */
    ctx.lineTo(px + s, py    );   /* droite */
    ctx.lineTo(px,     py + s);   /* bas    */
    ctx.lineTo(px - s, py    );   /* gauche */
    ctx.closePath();
    ctx.fillStyle = '#7A1212';
    ctx.fill();

    /* Diagonales 0.5px d'un coin à l'autre, bordeaux très foncé */
    ctx.strokeStyle = '#3A0808';
    ctx.lineWidth   = 0.5;
    ctx.beginPath();
    ctx.moveTo(px,     py - s);   /* haut → bas */
    ctx.lineTo(px,     py + s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px - s, py    );   /* gauche → droite */
    ctx.lineTo(px + s, py    );
    ctx.stroke();
  });

/* ── 6. Impacts ──────────────────────────────────────────────── */
  if (!impacts || impacts.length === 0) return;

  const rImp = impactRadius(R);

  impacts.forEach((imp, idx) => {
    if (!imp.visible) return;   /* révélation progressive */
    const px = cx + imp.nx * R;
    const py = cy + imp.ny * R;

    /* Épaisseur du périmètre du cercle */
    const strokeW = Math.max(1, rImp * 0.22);

    /* ── Cercle argenté ── */
    ctx.beginPath();
    ctx.arc(px, py, rImp, 0, Math.PI * 2);
    ctx.fillStyle   = '#C0C0C0';
    ctx.fill();
    ctx.strokeStyle = '#808080';
    ctx.lineWidth   = strokeW;
    ctx.stroke();

/* ── 3 plumes (Bleu, Blanc, Rouge) ── */
    const baseAngle = (idx * 40) * Math.PI / 180;
	// Index 0 : Orange Fluo | Index 1 & 2 : Vert Fluo
    const rayColors = ['#FF7600', '#39FF14', '#39FF14'];
    
    ctx.lineWidth = strokeW * 2; 
    ctx.lineCap = 'round';

    for (let r = 0; r < 3; r++) {
      const angle = baseAngle + r * (2 * Math.PI / 3);
      
      // Départ : sur le bord (1 * rImp)
      const startX = px + rImp * Math.cos(angle);
      const startY = py + rImp * Math.sin(angle);
      
      // Arrivée : Départ (1 * rImp) + Longueur (1.2 * rImp) = 2.2 * rImp
      const endX = px + (rImp * 2.2) * Math.cos(angle);
      const endY = py + (rImp * 2.2) * Math.sin(angle);

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = rayColors[r];
      ctx.stroke();
    }
    
    // Reset du lineCap pour ne pas affecter les autres dessins si nécessaire
    ctx.lineCap = 'butt'; 
  });
 }

/* ================================================================
   generateImpacts(nbArrows, canvas, mode)
   Port fidèle de TfrmMain.SimImpacts() — main.pas

   Retourne [{nx, ny, points, entered:false}, ...]
   nx, ny : décalage depuis le centre en fraction de R
            px = cx + nx*R  ;  py = cy + ny*R

   En coordonnées normalisées, la cohérence dessin/scoring est
   garantie quelle que soit la taille du canvas au moment du dessin.
   ================================================================ */
function generateImpacts(nbArrows, canvas, mode) {
  const { cx, cy, R } = getLayout(canvas);
  const rImp       = impactRadius(R);
  const isCampagne = (mode === 'CAMPAGNE');

  /* Zone cible aléatoire (iZone := Random(10) + 1) */
  const targetZone = Math.floor(Math.random() * 10) + 1;
  const zr         = zoneRadius(targetZone, R);

  /* Carré englobant, inset de 2*rImp (fidèle Pascal) */
  const xMinAbs = cx - zr + 2 * rImp;
  const xMaxAbs = cx + zr - 2 * rImp;
  const yMinAbs = cy - zr + 2 * rImp;
  const yMaxAbs = cy + zr - 2 * rImp;

  const impacts = [];

  for (let k = 0; k < nbArrows; k++) {
    /* Coordonnées pixel absolues dans le carré englobant */
    const ax = Math.random() * (xMaxAbs - xMinAbs) + xMinAbs;
    const ay = Math.random() * (yMaxAbs - yMinAbs) + yMinAbs;

    /* Décalage normalisé depuis le centre (invariant au resize) */
    const nx = (ax - cx) / R;
    const ny = (ay - cy) / R;

    /* ── Scoring — Implémentation N°2 adaptée en coordonnées normalisées ──
       Paramètres normalisés (R = rayon zone 1 = 1.0) :
         R1_n          = 0.1    rayon du cercle central (zone 10)
         pasRadial_n   = 0.1    écart de rayon entre deux zones
         rImp_n        = rImp/R rayon de l'impact
         epaisseur_n   = 0.003  épaisseur du trait de bordure (= R*0.003 du dessin)

       cercleIndex 1 = zone la plus centrale  → 10 pts (SALLE/TAE) / 6 pts (CAMPAGNE)
       cercleIndex 10 = zone la plus externe  →  1 pt  dans tous les modes
       → zone = 11 - cercleIndex                                                    */

    const rawDist_n   = Math.sqrt(nx * nx + ny * ny);
    const rImp_n      = rImp / R;
    const R1_n        = 0.1;
    const pasRadial_n = 0.1;
    const epaisseur_n = 0.003;

    /* 1. Bord de l'impact le plus proche du centre */
    const bordProche = rawDist_n - rImp_n;

    let points = 0;

    /* 2. Dans le cercle central (y compris sur son trait) → score maximal */
    if (bordProche <= R1_n + epaisseur_n) {
      points = isCampagne ? 6 : 10;
    } else {
      /* 3. Index du cercle (1 = central, 10 = externe) */
      const distNorm   = bordProche - R1_n - epaisseur_n;
      const cercleIndex = Math.ceil(distNorm / pasRadial_n) + 1;

      if (cercleIndex <= 10) {
        /* 4. Conversion cercleIndex → zone (zone = 11 - cercleIndex) */
        const zone = 11 - cercleIndex;

        /* 5. Score selon le mode */
        if (isCampagne) {
          points = (zone < 5) ? 0 : (zone - 4);
        } else {
          points = zone;
        }
      }
      /* cercleIndex > 10 → hors blason → points reste 0 */
    }

    impacts.push({ nx, ny, points, entered: false, visible: false });
  }

  return impacts;
}