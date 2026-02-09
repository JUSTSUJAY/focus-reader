/* Focus Reader Content Script */

let state = {
    isReading: false,
    isPaused: false,
    words: [],
    currentIndex: 0,
    wpm: 300,
    timer: null
};

// --- Logic ---

function getPivotIndex(word) {
    const len = word.length;
    if (len === 1) return 0;
    if (len >= 2 && len <= 5) return 1;
    if (len >= 6 && len <= 9) return 2;
    if (len >= 10 && len <= 13) return 3;
    return 4;
}

function formatWord(word) {
    if (!word) return "";
    const pivot = getPivotIndex(word);
    const start = word.substring(0, pivot);
    const middle = word.substring(pivot, pivot + 1);
    const end = word.substring(pivot + 1);
    return `<span style="color:#d1d5db">${start}</span><span class="focus-pivot" style="color:#22c55e; font-weight:bold">${middle}</span><span style="color:#d1d5db">${end}</span>`;
}

function extractContent() {
    // 1. Selection
    const selection = window.getSelection().toString().trim();
    if (selection.length > 0) {
        return selection.split(/\s+/).filter(w => w.length > 0);
    }

    // 2. Simple Heuristic
    // Get all P tags.
    const paragraphs = Array.from(document.querySelectorAll('p'));

    // Scoring: 1 point per char.
    // We want the largest contiguous block of text.
    // For MVP, just joining all decent-length paragraphs is okay.
    const articleText = paragraphs
        .filter(p => p.innerText.trim().length > 40) // Filter out short captions/nav
        .filter(p => p.offsetParent !== null) // Visible only
        .map(p => p.innerText)
        .join(' ');

    if (articleText.length > 100) {
        return articleText.split(/\s+/).filter(w => w.length > 0);
    }

    // Fallback error
    return ["No", "content", "detected.", "Please", "select", "text", "to", "read."];
}

// --- Render & Loop ---

function render() {
    const container = document.getElementById('focus-reader-word-container');
    const progressBar = document.getElementById('focus-progress-bar');
    const wpmDisplay = document.getElementById('focus-wpm-display');

    if (container && state.words[state.currentIndex]) {
        container.innerHTML = formatWord(state.words[state.currentIndex]);
    }

    if (progressBar) {
        const progress = ((state.currentIndex + 1) / state.words.length) * 100;
        progressBar.style.width = `${progress}%`;
    }

    if (wpmDisplay) {
        wpmDisplay.innerText = `${state.wpm} WPM`;
    }
}

function nextStep() {
    if (!state.isReading || state.isPaused) return;

    if (state.currentIndex >= state.words.length - 1) {
        stopReading();
        return;
    }

    state.currentIndex++;
    render();

    const word = state.words[state.currentIndex];
    let delay = 60000 / state.wpm;

    // Punctuation pausing
    if (word.endsWith('.') || word.endsWith('!') || word.endsWith('?')) delay *= 2.2;
    else if (word.endsWith(',') || word.endsWith(';')) delay *= 1.5;

    state.timer = setTimeout(nextStep, delay);
}

// --- Controls ---

function startReading() {
    if (state.isReading) return;

    const wordsLocal = extractContent();
    state = {
        ...state,
        isReading: true,
        isPaused: true,
        words: wordsLocal,
        currentIndex: 0,
    };

    createOverlay();
    document.getElementById('focus-reader-overlay').classList.add('active');
    document.addEventListener('keydown', handleInput);

    // Start loop
    render();
}

function stopReading() {
    state.isReading = false;
    state.isPaused = false;
    if (state.timer) clearTimeout(state.timer);

    const overlay = document.getElementById('focus-reader-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        // Remove from DOM to reset state completely
        setTimeout(() => overlay.remove(), 300);
    }
    document.removeEventListener('keydown', handleInput);
}

function togglePause() {
    state.isPaused = !state.isPaused;
    const container = document.getElementById('focus-reader-word-container');

    if (state.isPaused) {
        if (state.timer) clearTimeout(state.timer);
        if (container) container.style.opacity = '0.5';
    } else {
        if (container) container.style.opacity = '1';
        nextStep();
    }
}

function handleInput(e) {
    if (!state.isReading) return;

    // Prevent scrolling page
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
    }

    switch (e.code) {
        case 'Escape':
            stopReading();
            break;
        case 'Space':
            togglePause();
            break;
        case 'ArrowUp':
            state.wpm += 25;
            render();
            break;
        case 'ArrowDown':
            state.wpm = Math.max(50, state.wpm - 25);
            render();
            break;
        case 'ArrowLeft':
            state.currentIndex = Math.max(0, state.currentIndex - 10);
            render();
            break;
        case 'ArrowRight':
            state.currentIndex = Math.min(state.words.length - 1, state.currentIndex + 10);
            render();
            break;
    }
}

// --- DOM Injection ---

function createOverlay() {
    if (document.getElementById('focus-reader-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'focus-reader-overlay';
    overlay.innerHTML = `
    <div id="focus-progress-bar-container">
        <div id="focus-progress-bar"></div>
    </div>
    <div id="focus-reader-word-container">Ready</div>
    <div id="focus-reader-controls">
        <div class="focus-control-item" id="focus-wpm-display">${state.wpm} WPM</div>
        <div class="focus-control-item">SPACE: Pause</div>
        <div class="focus-control-item">↑/↓: Speed</div>
        <div class="focus-control-item">←/→: Skip</div>
        <div class="focus-control-item" id="focus-close-btn">ESC: Quit</div>
    </div>
  `;
    document.body.appendChild(overlay);

    // Close button
    document.getElementById('focus-close-btn').onclick = stopReading;
}

// --- Entry Point ---

// Use a unique message listener to avoid conflicts
window.addEventListener("message", (event) => {
    if (event.data.type === "FOCUS_READER_TOGGLE") {
        if (state.isReading) stopReading();
        else startReading();
    }
});
