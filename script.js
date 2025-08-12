// מילון בסיסי להמחשה (אפשר להרחיב או להחליף)
const dictionary = [
    "APPLE", "APPLY", "BAT", "BALL", "CAT", "CALL", "CAMP", "DAMP",
    "DOG", "DOLL", "EAT", "EAR", "FAN", "FALL", "GAP", "GALL", "HALL",
    "HAT", "JUMP", "JAR", "KITE", "LAMP", "MAP", "NAP", "PAN", "PART",
    "RAMP", "TAP", "TAPAS", "TARP", "TRAP", "VAN", "WALK", "YAP"
];

// שימוש באותיות בלבד, לא @ (שזה "מכתב לא ידוע")
function isValidChar(c) {
    return /^[A-Z]$/.test(c);
}

const boardInput = document.getElementById("boardInput");
const solveBtn = document.getElementById("solveBtn");
const prefixFilter = document.getElementById("prefixFilter");
const wordList = document.getElementById("wordList");
const usedWordList = document.getElementById("usedWordList");

let foundWords = [];
let usedWords = JSON.parse(localStorage.getItem("usedWords") || "[]");

// שמירת מילים שכבר סימנו
function saveUsedWords() {
    localStorage.setItem("usedWords", JSON.stringify(usedWords));
}

function renderWordLists() {
    // סינון לפי prefix
    const prefix = prefixFilter.value.trim().toUpperCase();
    const filtered = foundWords.filter(w => !usedWords.includes(w) && w.startsWith(prefix));

    // מילים לא בשימוש
    wordList.innerHTML = "";
    filtered.forEach(word => {
        const li = document.createElement("li");
        li.textContent = word;

        const btn = document.createElement("button");
        btn.textContent = "סמן/מחק";
        btn.onclick = () => {
            usedWords.push(word);
            saveUsedWords();
            renderWordLists();
        };

        li.appendChild(btn);
        wordList.appendChild(li);
    });

    // מילים שכבר השתמשו
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

// פונקציה פשוטה למציאת מילים ברשת (לצורך הדגמה בלבד)
// מחפשת מילים במילון שניתן לבנות מהאותיות בטקסט בלי התחשבות במיקום
// (אפשר להחליף באלגוריתם משוכלל יותר)
function findWords(boardText) {
    const letters = boardText.toUpperCase().replace(/[^A-Z@]/g, "");
    // @ מייצג כל אות אפשרית, אז פשוט נתעלם ממנו לבדיקה פשוטה
    const availableLetters = letters.replace(/@/g, "");

    return dictionary.filter(word => {
        // בדיקה אם אפשר להרכיב את המילה מאותיות זמינות (פשוט לפי ספירה)
        let tempLetters = availableLetters.split("");
        for (let ch of word) {
            if (tempLetters.includes(ch)) {
                tempLetters.splice(tempLetters.indexOf(ch), 1);
            } else if (!letters.includes("@")) {
                // אם אין @ ואין את האות, לא מתקבל
                return false;
            }
        }
        return true;
    });
}

solveBtn.onclick = () => {
    const boardText = boardInput.value;
    if (boardText.trim() === "") {
        alert("אנא הזן אותיות ברשת");
        return;
    }
    foundWords = findWords(boardText);
    renderWordLists();
};

prefixFilter.oninput = () => {
    renderWordLists();
};

// טעינת מילים שכבר סימנו בהתחלה
renderWordLists();
