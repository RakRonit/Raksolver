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

/************ מצב ושמירה מקומית ************/
let foundWords = [];
let usedWords = JSON.parse(localStorage.getItem("usedWords") || "[]");
function saveUsedWords() {
  localStorage.setItem("usedWords", JSON.stringify(usedWords));
}

/************ טעינת מילון גדול מהאינטרנט + קאש ************/
let dictionary = [];
let dictLoaded = false;

// ננעל את הכפתור בזמן הטעינה
if (solveBtn) {
  solveBtn.disabled = true;
  solveBtn.style.opacity = 0.6;
  solveBtn.textContent = "טוען…";
  solveBtn.style.fontSize = "20px";
  solveBtn.style.fontWeight = "bold";
}

// גרסה למילון (שינוי המספר יכריח רענון קאש)
const DICT_VERSION = "dwyl-v1";
const DICT_URL = "https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt";

async function loadDictionaryFromRemote() {
  try {
    // קודם ננסה מה-cache המקומי
    const cachedV = localStorage.getItem("words_cache_v");
    const cachedData = localStorage.getItem("words_cache_data");
    if (cachedV === DICT_VERSION && cachedData) {
      dictionary = JSON.parse(cachedData);
      dictLoaded = true;
      if (solveBtn) { solveBtn.disabled = false; solveBtn.style.opacity = 1; solveBtn.textContent = "קדימה!"; }
      dictStatus.textContent = `המילון נטען מהקאש (${dictionary.length.toLocaleString()} מילים) — מוכן!`;
      return;
    }

    // הורדה ראשונה / גרסה חדשה
    dictStatus.textContent = "מוריד מילון גדול… זה יכול לקחת כמה שניות";
    const res = await fetch(DICT_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Dictionary fetch failed: ${res.status}`);

    const text = await res.text();
    // רק אותיות a-z, 4+ תווים, ל-UPPERCASE
    dictionary = text
      .split(/\r?\n/)
      .map(w => w.trim())
      .filter(w => w.length >= 4 && /^[a-z]+$/.test(w))
      .map(w => w.toUpperCase());

    // שמירה לקאש
    localStorage.setItem("words_cache_v", DICT_VERSION);
    localStorage.setItem("words_cache_data", JSON.stringify(dictionary));

    dictLoaded = true;
    if (solveBtn) { solveBtn.disabled = false; solveBtn.style.opacity = 1; solveBtn.textContent = "קדימה!"; }
    dictStatus.textContent = `המילון נטען (${dictionary.length.toLocaleString()} מילים) — מוכן!`;
  } catch (e) {
    console.error("Dictionary load error:", e);
    dictStatus.textContent = "שגיאה בטעינת המילון מהאינטרנט. נסי לרענן או בדקי חיבור.";
    alert("לא הצלחתי לטעון מילון. אם תרצי, אפשר לחזור לגרסא עם words.txt מקומי.");
  }
}
document.addEventListener("DOMContentLoaded", loadDictionaryFromRemote);

/************ עזר: המרת לוח / רוטציות ************/
function parseBoardToMatrix(text) {
  // תומך גם בפורמט ABCD-EFGH-IJKL-MNOP וגם ב-4 שורות
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

/************ זיהוי "חידה חדשה" (איפוס used לא ברוטציה) ************/
function gridsEqual(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length || a[0].length !== b[0].length) return false;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < a[0].length; j++) {
      if (a[i][j] !== b[i][j]) return false;
    }
  }
  return true;
}
function equalUpToRotation(curr, prev) {
  if (!prev) return false;
  if (gridsEqual(curr, prev)) return true;
  let r1 = rotateMatrixRight(prev);
  if (gridsEqual(curr, r1)) return true;
  let r2 = rotateMatrixRight(r1);
  if (gridsEqual(curr, r2)) return true;
  let r3 = rotateMatrixRight(r2);
  if (gridsEqual(curr, r3)) return true;
  return false;
}
function loadLastBoard() {
  const raw = localStorage.getItem("lastBoardMatrix");
  return raw ? JSON.parse(raw) : null;
}
function saveLastBoard(mat) {
  localStorage.setItem("lastBoardMatrix", JSON.stringify(mat));
}

/************ Trie לביצועים ************/
function buildTrie(words) {
  const root = {};
  for (const w of words) {
    let node = root;
    for (const ch of w) {
      node[ch] = node[ch] || {};
      node = node[ch];
    }
    node.$ = true; // סוף מילה
  }
  return root;
}

/************ DFS על שכנים (כולל אלכסון), בלי חזרה על תא ************/
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

  // בדיקת אורך אחיד לכל השורות
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
        // ג'וקר: כל ילד אפשרי
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

  // התחלה מכל תא (כולל @ כפתח)
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

  // רשימת מילים זמינות
  wordList.innerHTML = "";
  filtered.forEach(word => {
    const li = document.createElement("li");
    li.textContent = word;

    const btn = document.createElement("button");
    btn.textContent = "סמן/הסר";
    btn.onclick = () => {
      usedWords.push(word);
      saveUsedWords();
      renderWordLists();
    };

    li.appendChild(btn);
    wordList.appendChild(li);
  });

  // רשימת מילים שסומנו
  usedWordList.innerHTML = "";
  usedWords.forEach(word => {
    const li = document.createElement("li");
    li.textContent = word;
    li.classList.add("used");

    const btn = document.createElement("button");
    btn.textContent = "בטל סימון";
    btn.onclick = () => {
      usedWords = usedWords.filter(w => w !== word);
      saveUsedWords();
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

  // זיהוי חידה חדשה (איפוס used), אבל לא אם זו רק רוטציה
  const currentMat = parseBoardToMatrix(boardText);
  const prevMat = loadLastBoard();
  const samePuzzleByRotation = prevMat && equalUpToRotation(currentMat, prevMat);

  if (!samePuzzleByRotation) {
    usedWords = [];
    saveUsedWords();
    saveLastBoard(currentMat);
  }

  foundWords = findWords(boardText);
  renderWordLists();
});

prefixFilter && (prefixFilter.oninput = renderWordLists);

rotateRightBtn && (rotateRightBtn.onclick = () => {
  if (!boardInput.value.trim()) return;
  const mat = parseBoardToMatrix(boardInput.value);
  boardInput.value = matrixToText(rotateMatrixRight(mat));
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
renderWordLists();
