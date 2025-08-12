/************ אלמנטים מה-DOM ************/
const boardInput      = document.getElementById("boardInput");
const solveBtn        = document.getElementById("solveBtn");
const prefixFilter    = document.getElementById("prefixFilter");
const wordList        = document.getElementById("wordList");
const usedWordList    = document.getElementById("usedWordList");
const rotateLeftBtn   = document.getElementById("rotateLeftBtn");
const rotateRightBtn  = document.getElementById("rotateRightBtn");
const hintBtn         = document.getElementById("hintBtn");
const hintBox         = document.getElementById("hintBox");

/************ מצב זיכרון ************/
let foundWords = [];
let usedWords = JSON.parse(localStorage.getItem("usedWords") || "[]");
function saveUsedWords() {
  localStorage.setItem("usedWords", JSON.stringify(usedWords));
}

/************ טעינת מילון חיצוני ************/
let dictionary = [];
let dictLoaded = false;

async function loadDictionary(url = "words.txt") {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Dictionary fetch failed: ${res.status}`);
    const text = await res.text();
    dictionary = text
      .split(/\r?\n/)
      .map(w => w.trim())
      .filter(w => w.length >= 4)     // רק 4+ אותיות
      .map(w => w.toUpperCase());     // הכל לאותיות גדולות
    dictLoaded = true;
  } catch (e) {
    console.error(e);
    alert("לא הצלחתי לטעון מילון. ודאי שקיים קובץ words.txt בריפו.");
  }
}
loadDictionary();

/************ עזר: המרת לוח למטריצה / רוטציות ************/
function parseBoardToMatrix(text) {
  // תומך גם בפורמט עם מקפים ABCD-EFGH-IJKL-MNOP וגם ב-4 שורות
  const rows = (text.includes("-") ? text.split("-") : text.split(/\r?\n/))
    .map(r => r.trim().toUpperCase())
    .filter(Boolean);
  return rows.map(r => r.replace(/[^A-Z@]/g, "").split(""));
}
function matrixToText(mat) {
  return mat.map(row => row.join("")).join("\n");
}
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
function inBounds(r, c, R, C) {
  return r >= 0 && r < R && c >= 0 && c < C;
}

function findWords(boardText) {
  const MIN_LEN = 4;

  const grid = parseBoardToMatrix(boardText);
  const R = grid.length;
  const C = R ? grid[0].length : 0;
  if (!R || !C) return [];

  // בדיקת אורך אחיד לשורות
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
        // ג'וקר: ננסה כל ילד אפשרי
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

  // התחלת DFS מכל תא (תומך גם ב-@ כפתח)
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
  const prefix = (prefixFilter.value || "").trim().toUpperCase();
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
solveBtn.onclick = () => {
  if (!dictLoaded || !dictionary.length) {
    alert("המילון עדיין נטען. נסי שוב בעוד כמה שניות או בדקי שהקובץ words.txt קיים.");
    return;
  }
  const boardText = boardInput.value;
  if (!boardText.trim()) {
    alert("אנא הזיני את הלוח");
    return;
  }
  foundWords = findWords(boardText);
  renderWordLists();
};

prefixFilter.oninput = renderWordLists;

rotateRightBtn && (rotateRightBtn.onclick = () => {
  if (!boardInput.value.trim()) return;
  const mat = parseBoardToMatrix(boardInput.value);
  boardInput.value = matrixToText(rotateMatrixRight(mat));
  // אפשר ישירות לחשב מחדש
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
  // בחרי ארוכה (יותר מועיל), אפשר גם אקראי
  const pick = [...candidates].sort((a,b) => b.length - a.length)[0];
  const prefixLen = Math.min(2, Math.max(1, pick.length - 1));
  hintBox && (hintBox.textContent = `רמז: המילה מתחילה ב־ "${pick.slice(0, prefixLen)}" (${pick.length} אותיות).`);
});

/************ רענון ראשוני ************/
renderWordLists();
