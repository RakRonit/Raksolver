/************ קישוריות ל-DOM ************/
const boardInput      = document.getElementById("boardInput");
const solveBtn        = document.getElementById("solveBtn");
const prefixFilter    = document.getElementById("prefixFilter");
const wordList        = document.getElementById("wordList");
const usedWordList    = document.getElementById("usedWordList");
const rotateLeftBtn   = document.getElementById("rotateLeftBtn");
const rotateRightBtn  = document.getElementById("rotateRightBtn");
const hintBtn         = document.getElementById("hintBtn");
const hintBox         = document.getElementById("hintBox");

/************ פס סטטוס קטן ************/
const dictStatus = document.createElement("div");
dictStatus.style.margin = "6px 0 0";
dictStatus.textContent = "טוען מילון…";
document.querySelector(".container")?.prepend(dictStatus);

/************ מילון גדול מהאינטרנט + קאש ************/
let dictionary = [];
let dictLoaded = false;

if (solveBtn) {
  solveBtn.disabled = true;
  solveBtn.style.opacity = 0.6;
  solveBtn.textContent = "טוען…";
  solveBtn.style.fontSize = "20px";
  solveBtn.style.fontWeight = "bold";
}

const DICT_VERSION = "dwyl-v1";
const DICT_URL = "https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt";

async function loadDictionaryFromRemote() {
  try {
    const cachedV = localStorage.getItem("words_cache_v");
    const cachedData = localStorage.getItem("words_cache_data");
    if (cachedV === DICT_VERSION && cachedData) {
      dictionary = JSON.parse(cachedData).map(w => w.toUpperCase());
      dictLoaded = true;
      if (solveBtn) { solveBtn.disabled = false; solveBtn.style.opacity = 1; solveBtn.textContent = "קדימה!"; }
      dictStatus.textContent = `המילון נטען מהקאש (${dictionary.length.toLocaleString()} מילים) — מוכן!`;
      return;
    }

    dictStatus.textContent = "מוריד מילון גדול… זה יכול לקחת כמה שניות";
    const res = await fetch(DICT_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Dictionary fetch failed: ${res.status}`);

    const text = await res.text();
    dictionary = text
      .split(/\r?\n/)
      .map(w => w.trim())
      .filter(w => w.length >= 4 && /^[a-z]+$/.test(w))
      .map(w => w.toUpperCase());

    localStorage.setItem("words_cache_v", DICT_VERSION);
    localStorage.setItem("words_cache_data", JSON.stringify(dictionary));

    dictLoaded = true;
    if (solveBtn) { solveBtn.disabled = false; solveBtn.style.opacity = 1; solveBtn.textContent = "קדימה!"; }
    dictStatus.textContent = `המילון נטען (${dictionary.length.toLocaleString()} מילים) — מוכן!`;
  } catch (e) {
    console.error("Dictionary load error:", e);
    dictStatus.textContent = "שגיאה בטעינת המילון מהאינטרנט. נסי לרענן או בדקי חיבור.";
    alert("לא הצלחתי לטעון מילון.");
  }
}
document.addEventListener("DOMContentLoaded", loadDictionaryFromRemote);

/************ עזר: לוח/רוטציות/חתימה ************/
function parseBoardToMatrix(text) {
  const rows = (text.includes("-") ? text.split("-") : text.split(/\r?\n/))
    .map(r => r.trim().toUpperCase())
    .filter(Boolean);
  return rows.map(r => r.replace(/[^A-Z@]/g, "").split(""));
}
function matrixToText(mat) { return mat.map(row => row.join("")).join("\n"); }
function rotateMatrixRight(mat) {
  const n = mat.length, m = mat[0]?.length || 0;
  const out = Array.from({length: m}, () => Array(n).fill(""));
  for (let i=0;i<n;i++) for (let j=0;j<m;j++) out[j][n-1-i] = mat[i][j];
  return out;
}
function rotateMatrixLeft(mat) {
  const n = mat.length, m = mat[0]?.length || 0;
  const out = Array.from({length: m}, () => Array(n).fill(""));
  for (let i=0;i<n;i++) for (let j=0;j<m;j++) out[m-1-j][i] = mat[i][j];
  return out;
}
/* חתימת חידה חסינה לרוטציה: נבנה את 4 הרוטציות וניקח את המחרוזת הקטנה ביותר */
function boardSignature(mat) {
  if (!mat || !mat.length) return "";
  const asString = m => m.map(r => r.join("")).join("|");
  const r1 = rotateMatrixRight(mat);
  const r2 = rotateMatrixRight(r1);
  const r3 = rotateMatrixRight(r2);
  const candidates = [mat, r1, r2, r3].map(asString);
  candidates.sort();
  return candidates[0]; // הקטנה ביותר לקנוניזציה
}

/************ אחסון "כבר השתמשתי" פר-חידה ************/
function getUsedMap() {
  try { return JSON.parse(localStorage.getItem("usedWordsByBoard") || "{}"); }
  catch { return {}; }
}
function setUsedMap(map) {
  localStorage.setItem("usedWordsByBoard", JSON.stringify(map));
}
let currentSignature = "";       // חתימת החידה הנוכחית
let usedWords = [];              // הרשימה עבור החתימה הנוכחית בלבד

function loadUsedForSignature(sig) {
  const map = getUsedMap();
  usedWords = map[sig] || [];
}
function saveUsedForSignature(sig) {
  const map = getUsedMap();
  map[sig] = usedWords;
  setUsedMap(map);
}

/************ Trie ************/
function buildTrie(words) {
  const root = {};
  for (const w of words) {
    let node = root;
    for (const ch of w) {
      node[ch] = node[ch] || {};
      node = node[ch];
    }
    node.$ = true;
  }
  return root;
}

/************ DFS שכנים + @ ג'וקר ************/
const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [ 0, -1],          [ 0, 1],
  [ 1, -1], [ 1, 0], [ 1, 1],
];
function inBounds(r, c, R, C) { return r >= 0 && r < R && c >= 0 && c < C; }

function findWords(boardText) {
  const MIN_LEN = 4;

  const grid = parseBoardToMatrix(boardText);
  const R = grid.length;
  const C = R ? grid[0].length : 0;
  if (!R || !C) return [];

  for (const row of grid) if (row.length !== C) {
    alert("כל השורות צריכות להיות באותו אורך (למשל 4 תווים בכל שורה).");
    return [];
  }

  const trie = buildTrie(dictionary);
  const found = new Set();
  const visited = Array.from({ length: R }, () => Array(C).fill(false));

  function dfs(r, c, node, prefix) {
    if (node.$ && prefix.length >= MIN_LEN) found.add(prefix);

    for (const [dr, dc] of DIRS) {
      const nr = r + dr, nc = c + dc;
      if (!inBounds(nr, nc, R, C) || visited[nr][nc]) continue;

      const ch = grid[nr][nc];
      if (ch === "@") {
        for (const nextCh of Object.keys(node)) {
          if (nextCh === "$") continue;
          visited[nr][nc] = true;
          dfs(nr, nc, node[nextCh], prefix + nextCh);
          visited[nr][nc] = false;
        }
      } else {
        const nextNode = node[ch];
        if (!nextNode) continue;
        visited[nr][nc] = true;
        dfs(nr, nc, nextNode, prefix + ch);
        visited[nr][nc] = false;
      }
    }
  }

  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      visited[r][c] = true;
      const ch = grid[r][c];
      if (ch === "@") {
        for (const nextCh of Object.keys(trie)) {
          if (nextCh === "$") continue;
          dfs(r, c, trie[nextCh], nextCh);
        }
      } else {
        const node = trie[ch];
        if (node) dfs(r, c, node, ch);
      }
      visited[r][c] = false;
    }
  }

  return Array.from(found).sort((a, b) => a.length - b.length || a.localeCompare(b));
}

/************ UI: סינון, סימון, רענון רשימות ************/
function renderWordLists() {
  const prefix = (prefixFilter?.value || "").trim().toUpperCase();
  const filtered = foundWords.filter(w => !usedWords.includes(w) && w.startsWith(prefix));

  wordList.innerHTML = "";
  filtered.forEach(word => {
    const li = document.createElement("li");
    li.textContent = word;

    const btn = document.createElement("button");
    btn.textContent = "סמן/הסר";
    btn.onclick = () => {
      usedWords.push(word);
      saveUsedForSignature(currentSignature);
      renderWordLists();
    };

    li.appendChild(btn);
    wordList.appendChild(li);
  });

  usedWordList.innerHTML = "";
  usedWords.forEach(word => {
    const li = document.createElement("li");
    li.textContent = word;
    li.classList.add("used");

    const btn = document.createElement("button");
    btn.textContent = "בטל סימון";
    btn.onclick = () => {
      usedWords = usedWords.filter(w => w !== word);
      saveUsedForSignature(currentSignature);
      renderWordLists();
    };

    li.appendChild(btn);
    usedWordList.appendChild(li);
  });
}

/************ מאזינים ************/
solveBtn && (solveBtn.onclick = () => {
  if (!dictLoaded) {
    dictStatus.textContent = "המילון עדיין נטען… נסי שוב בעוד רגע.";
    return;
  }
  const boardText = boardInput.value;
  if (!boardText.trim()) {
    alert("אנא הזיני את הלוח");
    return;
  }

  // חתימת החידה (בלתי תלויה ברוטציה)
  const mat = parseBoardToMatrix(boardText);
  currentSignature = boardSignature(mat);

  // טוענים / מאפסים רשימת 'כבר השתמשתי' בהתאם לחידה הנוכחית
  loadUsedForSignature(currentSignature);

  foundWords = findWords(boardText);
  renderWordLists();
});

prefixFilter && (prefixFilter.oninput = renderWordLists);

rotateRightBtn && (rotateRightBtn.onclick = () => {
  if (!boardInput.value.trim()) return;
  const mat = parseBoardToMatrix(boardInput.value);
  boardInput.value = matrixToText(rotateMatrixRight(mat));
  // רוטציה לא משנה חתימה — כך ש-used יישאר
  if (dictLoaded) { foundWords = findWords(boardInput.value); renderWordLists(); }
});

rotateLeftBtn && (rotateLeftBtn.onclick = () => {
  if (!boardInput.value.trim()) return;
  const mat = parseBoardToMatrix(boardInput.value);
  boardInput.value = matrixToText(rotateMatrixLeft(mat));
  if (dictLoaded) { foundWords = findWords(boardInput.value); renderWordLists(); }
});

hintBtn && (hintBtn.onclick = () => {
  const candidates = foundWords.filter(w => !usedWords.includes(w));
  if (!candidates.length) {
    hintBox && (hintBox.textContent = "אין מילים חדשות לרמוז כרגע 😊");
    return;
  }
  const pick = [...candidates].sort((a,b) => b.length - a.length)[0];
  const prefixLen = Math.min(2, Math.max(1, pick.length - 1));
  hintBox && (hintBox.textContent = `רמז: המילה מתחילה ב־ "${pick.slice(0, prefixLen)}" (${pick.length} אותיות).`);
});

/************ רענון ראשוני ************/
(function initUsedOnLoad() {
  // אם יש לוח כבר כתוב כשנטען העמוד – נטען חתימה מתאימה
  const text = (boardInput?.value || "").trim();
  if (text) {
    const mat = parseBoardToMatrix(text);
    currentSignature = boardSignature(mat);
    loadUsedForSignature(currentSignature);
  }
  renderWordLists();
})();
