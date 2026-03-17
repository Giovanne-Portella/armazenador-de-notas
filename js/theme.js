/* ============================================
   THEME — Dark mode e seleção de temas
   ============================================ */

function isMobile() {
    return window.innerWidth <= 768;
}

export function initTheme() {
    const darkModeToggle = document.getElementById('darkModeToggle');
    const themeSelector = document.getElementById('themeSelector');

    // Dark mode toggle — on mobile opens theme modal, on desktop toggles dark mode
    darkModeToggle.addEventListener('click', () => {
        if (isMobile()) {
            openThemeMobileModal();
        } else {
            toggleDarkMode();
        }
    });

    // Restaurar dark mode
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
    }

    // Theme selector (desktop only)
    themeSelector.addEventListener('change', (event) => {
        applyTheme(event.target.value);
    });

    // Restaurar tema salvo
    const savedTheme = localStorage.getItem('selectedTheme');
    if (savedTheme) {
        document.body.classList.add(savedTheme);
        themeSelector.value = savedTheme;
    }

    // Expose global functions for mobile modal
    window.openThemeMobileModal = openThemeMobileModal;
    window.closeThemeMobileModal = closeThemeMobileModal;
    window.setDarkMode = setDarkMode;
    window.selectThemeMobile = selectThemeMobile;
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

function applyTheme(themeName) {
    document.body.className = document.body.className.replace(/theme-\w+/g, '').trim();
    if (themeName) {
        document.body.classList.add(themeName);
    }
    localStorage.setItem('selectedTheme', themeName);
    // Sync desktop selector
    const sel = document.getElementById('themeSelector');
    if (sel) sel.value = themeName;
}

function openThemeMobileModal() {
    const modal = document.getElementById('themeMobileModal');
    if (!modal) return;
    // Update active states
    updateMobileModalState();
    modal.classList.add('show');
}

function closeThemeMobileModal() {
    const modal = document.getElementById('themeMobileModal');
    if (modal) modal.classList.remove('show');
}

function setDarkMode(enabled) {
    if (enabled) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    localStorage.setItem('darkMode', String(enabled));
    updateMobileModalState();
}

function selectThemeMobile(themeName) {
    applyTheme(themeName);
    updateMobileModalState();
}

function updateMobileModalState() {
    const isDark = document.body.classList.contains('dark-mode');
    const lightBtn = document.getElementById('lightModeBtn');
    const darkBtn = document.getElementById('darkModeBtn');
    if (lightBtn) lightBtn.classList.toggle('active', !isDark);
    if (darkBtn) darkBtn.classList.toggle('active', isDark);

    const savedTheme = localStorage.getItem('selectedTheme') || '';
    document.querySelectorAll('.theme-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === savedTheme);
    });
}
