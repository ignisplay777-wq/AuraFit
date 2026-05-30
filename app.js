/* ============================================================
   AuraFit — app.js
   ============================================================ */

// ---- Paleta de colores disponibles ----
const COLOR_THEMES = [
    { id: 'emerald', label: 'Esmeralda', accent: '#10b981', light: '#34d399', dark: '#059669', spotlight1: 'rgba(16,185,129,0.12)', spotlight2: 'rgba(139,92,246,0.08)' },
    { id: 'violet',  label: 'Violeta',   accent: '#8b5cf6', light: '#a78bfa', dark: '#7c3aed', spotlight1: 'rgba(139,92,246,0.12)', spotlight2: 'rgba(16,185,129,0.08)' },
    { id: 'rose',    label: 'Rosa',      accent: '#f43f5e', light: '#fb7185', dark: '#e11d48', spotlight1: 'rgba(244,63,94,0.12)',   spotlight2: 'rgba(139,92,246,0.08)' },
    { id: 'amber',   label: 'Ámbar',     accent: '#f59e0b', light: '#fbbf24', dark: '#d97706', spotlight1: 'rgba(245,158,11,0.12)',  spotlight2: 'rgba(239,68,68,0.08)'   },
    { id: 'sky',     label: 'Cielo',     accent: '#0ea5e9', light: '#38bdf8', dark: '#0284c7', spotlight1: 'rgba(14,165,233,0.12)',  spotlight2: 'rgba(139,92,246,0.08)'  },
    { id: 'pink',    label: 'Rosa Pastel',accent:'#ec4899', light: '#f472b6', dark: '#db2777', spotlight1: 'rgba(236,72,153,0.12)',  spotlight2: 'rgba(245,158,11,0.08)'  },
    { id: 'teal',    label: 'Teal',      accent: '#14b8a6', light: '#2dd4bf', dark: '#0f766e', spotlight1: 'rgba(20,184,166,0.12)',  spotlight2: 'rgba(139,92,246,0.08)'  },
    { id: 'orange',  label: 'Naranja',   accent: '#f97316', light: '#fb923c', dark: '#ea580c', spotlight1: 'rgba(249,115,22,0.12)',  spotlight2: 'rgba(239,68,68,0.08)'   },
];

// ---- Estado global ----
let appState = {
    username: '',
    metaCalories: 2000,
    metaWater: 8,
    colorTheme: 'emerald',
    history: {}
};

// ---- Clave de hoy (se recalcula en cada acción para cubrir cambio de día) ----
function getTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ---- Persistencia ----
function saveAppState() {
    localStorage.setItem('aurafit_pro_state', JSON.stringify(appState));
}

function loadAppState() {
    const raw = localStorage.getItem('aurafit_pro_state');
    if (raw) {
        try { appState = { ...appState, ...JSON.parse(raw) }; } catch(e) { console.error(e); }
    }
    // Asegurar que existe entrada de hoy
    const todayKey = getTodayKey();
    if (!appState.history[todayKey]) {
        appState.history[todayKey] = { foods: [], water: 0, notes: '' };
        saveAppState();
    }
    // Mock history solo si es nuevo usuario sin historial
    if (Object.keys(appState.history).length <= 1) {
        generateMockHistory();
    }
}

// ---- Aplicar tema de color ----
function applyTheme(themeId) {
    const theme = COLOR_THEMES.find(t => t.id === themeId) || COLOR_THEMES[0];
    const root = document.documentElement;
    root.style.setProperty('--accent',        theme.accent);
    root.style.setProperty('--accent-light',  theme.light);
    root.style.setProperty('--accent-dark',   theme.dark);
    root.style.setProperty('--accent-bg',     theme.accent + '1a');
    root.style.setProperty('--accent-border', theme.accent + '4d');
    root.style.setProperty('--spotlight-1',   theme.spotlight1);
    root.style.setProperty('--spotlight-2',   theme.spotlight2);

    // Actualizar gradiente del SVG
    const g1 = document.getElementById('grad-stop-1');
    const g2 = document.getElementById('grad-stop-2');
    if (g1) g1.setAttribute('stop-color', theme.light);
    if (g2) g2.setAttribute('stop-color', theme.dark);

    // Onboarding glow
    const onbGlow = document.getElementById('onb-glow');
    if (onbGlow) onbGlow.style.background = theme.accent + '1a';
    const onbIcon = document.getElementById('onb-icon-bg');
    if (onbIcon) onbIcon.style.background = `linear-gradient(135deg, ${theme.light}, ${theme.dark})`;
}

// ============================================================
// MODALES
// ============================================================

function showModal(id) {
    const el = document.getElementById(id);
    el.classList.add('modal-visible');
}
function hideModal(id) {
    const el = document.getElementById(id);
    el.classList.remove('modal-visible');
}

// ---- Onboarding ----
function checkOnboarding() {
    if (!appState.username || appState.username.trim() === '') {
        showModal('onboarding-modal');
    }
}

function initOnboarding() {
    document.getElementById('onb-save-btn').addEventListener('click', () => {
        const name = document.getElementById('onb-username').value.trim();
        if (!name) {
            document.getElementById('onb-username').focus();
            document.getElementById('onb-username').classList.add('border-rose-500');
            return;
        }
        appState.username = name;
        saveAppState();
        hideModal('onboarding-modal');
        renderAll();
    });
    document.getElementById('onb-username').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('onb-save-btn').click();
        document.getElementById('onb-username').classList.remove('border-rose-500');
    });
}

// ---- Config ----
function openConfig() {
    // Rellenar valores actuales
    document.getElementById('cfg-username').value  = appState.username;
    document.getElementById('cfg-calories').value  = appState.metaCalories;
    document.getElementById('cfg-water').value     = appState.metaWater;
    renderColorSwatches(appState.colorTheme);
    showModal('config-modal');
}

function initConfig() {
    document.getElementById('open-config-btn').addEventListener('click', openConfig);
    document.getElementById('config-close-btn').addEventListener('click', () => hideModal('config-modal'));

    // Guardar cambios
    document.getElementById('cfg-save-btn').addEventListener('click', () => {
        const newName = document.getElementById('cfg-username').value.trim();
        const newCals = parseInt(document.getElementById('cfg-calories').value) || 2000;
        const newWater = parseInt(document.getElementById('cfg-water').value) || 8;

        if (newName) appState.username = newName;
        appState.metaCalories = Math.max(500, newCals);
        appState.metaWater    = Math.max(1, newWater);

        saveAppState();
        applyTheme(appState.colorTheme);
        hideModal('config-modal');
        renderAll();

        // Toast de confirmación
        showToast('✓ Configuración guardada');
    });

    // Reset total con confirmación
    document.getElementById('cfg-reset-btn').addEventListener('click', () => {
        if (confirm('⚠️ ¿Seguro? Esto borrará TODOS tus datos permanentemente.')) {
            localStorage.removeItem('aurafit_pro_state');
            location.reload();
        }
    });

    // Cerrar al hacer clic fuera
    document.getElementById('config-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('config-modal')) hideModal('config-modal');
    });
}

// ---- Swatches de color ----
function renderColorSwatches(selectedId) {
    const container = document.getElementById('color-options');
    container.innerHTML = '';
    COLOR_THEMES.forEach(theme => {
        const div = document.createElement('div');
        div.className = 'flex flex-col items-center gap-1';
        div.innerHTML = `
            <div class="color-swatch ${theme.id === selectedId ? 'selected' : ''}"
                 style="background: linear-gradient(135deg, ${theme.light}, ${theme.dark});"
                 data-theme="${theme.id}" title="${theme.label}">
                ${theme.id === selectedId ? '<i class="ph ph-check text-white text-sm font-bold"></i>' : ''}
            </div>
            <span class="text-[9px] text-zinc-500 text-center leading-tight">${theme.label}</span>
        `;
        div.querySelector('.color-swatch').addEventListener('click', () => {
            appState.colorTheme = theme.id;
            applyTheme(theme.id);
            renderColorSwatches(theme.id); // re-render para marcar seleccionado
        });
        container.appendChild(div);
    });
}

// ---- Toast notification ----
function showToast(msg) {
    let toast = document.getElementById('aura-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'aura-toast';
        toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm font-semibold px-5 py-2.5 rounded-2xl shadow-2xl transition-all duration-300 opacity-0 translate-y-4';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.remove('opacity-0', 'translate-y-4');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.add('opacity-0', 'translate-y-4'), 2200);
}

// ============================================================
// EVENT LISTENERS PRINCIPALES
// ============================================================

function initEventListeners() {
    // Agua
    document.getElementById('btn-add-water').addEventListener('click', () => {
        const key = getTodayKey();
        appState.history[key].water++;
        saveAppState();
        renderWaterTracker();
    });
    document.getElementById('btn-reset-water').addEventListener('click', () => {
        const key = getTodayKey();
        appState.history[key].water = 0;
        saveAppState();
        renderWaterTracker();
    });

    // Comida
    document.getElementById('food-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const key = getTodayKey();
        const name = document.getElementById('food-name').value.trim();
        const cals = parseInt(document.getElementById('food-cals').value);
        if (name && cals > 0) {
            appState.history[key].foods.push({ id: Date.now(), name, calories: cals });
            document.getElementById('food-name').value = '';
            document.getElementById('food-cals').value = '';
            saveAppState();
            renderCaloricTracker();
            renderFoodList();
            renderStatsSection();
        }
    });

    document.getElementById('btn-clear-food').addEventListener('click', () => {
        if (!confirm('¿Vaciar todas las comidas de hoy?')) return;
        const key = getTodayKey();
        appState.history[key].foods = [];
        saveAppState();
        renderCaloricTracker();
        renderFoodList();
        renderStatsSection();
    });

    // Notas
    let noteTimer;
    document.getElementById('daily-notes').addEventListener('input', (e) => {
        const key = getTodayKey();
        appState.history[key].notes = e.target.value;
        saveAppState();
        clearTimeout(noteTimer);
        const ind = document.getElementById('notes-saved-indicator');
        ind.style.opacity = '0';
        noteTimer = setTimeout(() => { ind.style.opacity = '1'; setTimeout(() => ind.style.opacity = '0', 1500); }, 600);
    });

    // Tabs estadísticas
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            activeTab = e.target.getAttribute('data-tab');
            renderStatsSection();
        });
    });
}

// ============================================================
// RENDERIZADO
// ============================================================

let activeTab = 'day';

function renderAll() {
    const key = getTodayKey();
    document.getElementById('header-username').textContent   = appState.username || '—';
    document.getElementById('header-cal-meta').textContent   = `${appState.metaCalories} kcal`;
    document.getElementById('header-water-meta').textContent = appState.metaWater;
    document.getElementById('daily-notes').value = appState.history[key]?.notes || '';

    renderCaloricTracker();
    renderWaterTracker();
    renderFoodList();
    renderStatsSection();
}

function renderCaloricTracker() {
    const key      = getTodayKey();
    const todayData = appState.history[key] || { foods: [] };
    const target   = appState.metaCalories;
    const consumed = todayData.foods.reduce((sum, f) => sum + f.calories, 0);
    const remaining = target - consumed;

    document.getElementById('cal-consumed').textContent     = `${consumed} kcal`;
    document.getElementById('cal-target-display').textContent = `${target} kcal`;

    const calEl  = document.getElementById('cal-remaining');
    const lblEl  = document.getElementById('cal-status-label');

    if (remaining >= 0) {
        calEl.textContent = remaining;
        lblEl.textContent = 'Restantes';
        calEl.className   = 'block text-4xl font-extrabold text-zinc-100 tracking-tight transition-all duration-300';
    } else {
        calEl.textContent = Math.abs(remaining);
        lblEl.textContent = 'Excedidos';
        calEl.className   = 'block text-4xl font-extrabold text-rose-500 tracking-tight transition-all duration-300';
    }

    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const pct    = Math.min(consumed / target, 1);
    const offset = circumference - pct * circumference;
    const circle = document.getElementById('progress-circle');
    circle.style.strokeDasharray  = circumference;
    circle.style.strokeDashoffset = offset;
}

function renderWaterTracker() {
    const key      = getTodayKey();
    const todayData = appState.history[key] || { water: 0 };
    const meta     = appState.metaWater;
    const consumed = todayData.water;

    document.getElementById('water-counter').textContent = `${consumed} / ${meta} vasos`;

    const grid = document.getElementById('water-grid');
    grid.innerHTML = '';
    for (let i = 1; i <= meta; i++) {
        const glass = document.createElement('div');
        const filled = i <= consumed;
        glass.className = `h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all border text-sm ${
            filled ? 'bg-blue-600/20 border-blue-500/50 text-blue-400 water-drop-animate' : 'bg-zinc-950 border-zinc-800 text-zinc-600 hover:border-zinc-700'
        }`;
        glass.innerHTML = `<i class="ph ${filled ? 'ph-drop-fill' : 'ph-drop'}"></i>`;
        glass.addEventListener('click', () => {
            appState.history[getTodayKey()].water = i;
            saveAppState();
            renderWaterTracker();
        });
        grid.appendChild(glass);
    }
}

function renderFoodList() {
    const key      = getTodayKey();
    const todayData = appState.history[key] || { foods: [] };
    const list      = document.getElementById('food-list');
    const empty     = document.getElementById('empty-state');

    list.innerHTML = '';
    if (!todayData.foods || todayData.foods.length === 0) {
        empty.classList.remove('hidden'); return;
    }
    empty.classList.add('hidden');

    todayData.foods.forEach(food => {
        const li = document.createElement('li');
        li.className = 'flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 hover:border-zinc-700 transition-all group animate-fade';
        li.innerHTML = `
            <div class="flex flex-col">
                <span class="text-sm font-medium text-zinc-200">${food.name}</span>
                <span class="text-[11px] text-accent font-semibold">${food.calories} kcal</span>
            </div>
            <button class="text-zinc-600 hover:text-rose-400 p-1 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                <i class="ph ph-x"></i>
            </button>
        `;
        li.querySelector('button').addEventListener('click', () => {
            const k = getTodayKey();
            appState.history[k].foods = appState.history[k].foods.filter(f => f.id !== food.id);
            saveAppState();
            renderCaloricTracker();
            renderFoodList();
            renderStatsSection();
        });
        list.appendChild(li);
    });
}

function renderStatsSection() {
    const container = document.getElementById('stats-render-container');
    const footer    = document.getElementById('stats-summary-footer');
    container.innerHTML = '';

    const history   = appState.history;
    const target    = appState.metaCalories;
    const parseCals = (d) => d?.foods?.reduce((a, f) => a + f.calories, 0) || 0;
    const fmtKey    = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

    let dataset = [], title = '';

    if (activeTab === 'day') {
        const key = getTodayKey();
        const foods = history[key]?.foods || [];
        dataset = foods.map(f => ({ label: f.name.substring(0,8), value: f.calories }));
        if (dataset.length === 0) {
            container.innerHTML = `<p class="text-xs text-zinc-500 w-full text-center pb-8">Registra comidas hoy para ver tu análisis diario.</p>`;
            footer.textContent = '';
            return;
        }
        title = 'Muestra de tus comidas de hoy.';
    }
    else if (activeTab === 'week') {
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            dataset.push({ label: d.toLocaleDateString('es-ES', { weekday: 'short' }), value: parseCals(history[fmtKey(d)]) });
        }
        title = 'Consumo de los últimos 7 días.';
    }
    else if (activeTab === 'month') {
        for (let i = 3; i >= 0; i--) {
            let sum = 0;
            for (let j = 0; j < 7; j++) {
                const d = new Date(); d.setDate(d.getDate() - (i*7+j));
                sum += parseCals(history[fmtKey(d)]);
            }
            dataset.push({ label: `Sem ${4-i}`, value: Math.round(sum/7) });
        }
        title = 'Promedio semanal en este mes.';
    }
    else if (activeTab === 'year') {
        for (let i = 5; i >= 0; i--) {
            const d = new Date(); d.setMonth(d.getMonth()-i);
            const prefix = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
            let total = 0, count = 0;
            Object.keys(history).forEach(k => { if (k.startsWith(prefix)) { total += parseCals(history[k]); count++; } });
            dataset.push({ label: d.toLocaleDateString('es-ES', { month: 'short' }), value: count > 0 ? Math.round(total/count) : 0 });
        }
        title = 'Media diaria por mes analizado.';
    }

    const maxVal = Math.max(...dataset.map(d => d.value), target, 1);

    dataset.forEach(item => {
        const col = document.createElement('div');
        col.className = 'flex flex-col items-center flex-1 group relative';
        const pct = (item.value / maxVal) * 100;
        const exceeded = item.value > target;

        col.innerHTML = `
            <div class="absolute top-[-28px] opacity-0 group-hover:opacity-100 bg-zinc-800 text-zinc-100 font-bold text-[10px] px-2 py-0.5 rounded border border-zinc-700 transition-all pointer-events-none z-20 shadow-xl whitespace-nowrap">
                ${item.value} kcal
            </div>
            <div class="w-full sm:w-8 rounded-t-lg transition-all duration-500 animate-bar relative overflow-hidden ${
                exceeded ? 'bg-gradient-to-t from-rose-600 to-amber-500' : 'bg-gradient-to-t from-[var(--accent-dark)] to-[var(--accent-light)]'
            }" style="height: ${Math.max(pct, 6)}%">
                <div class="absolute top-0 inset-x-0 h-1 bg-white/20"></div>
            </div>
            <span class="text-[10px] text-zinc-500 font-medium uppercase mt-2 block tracking-tight truncate w-full text-center">${item.label}</span>
        `;
        container.appendChild(col);
    });

    footer.innerHTML = `<span>${title}</span> <span class="text-zinc-500">Límite: ${target} kcal</span>`;
}

// ---- Mock history para usuarios nuevos ----
function generateMockHistory() {
    for (let i = 1; i <= 30; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const cals = Math.floor(Math.random() * 900) + 1400;
        appState.history[key] = {
            foods: [
                { id: i+100, name: 'Cena',    calories: Math.floor(cals * 0.4) },
                { id: i+200, name: 'Almuerzo', calories: Math.floor(cals * 0.6) }
            ],
            water: Math.floor(Math.random() * 9),
            notes: ''
        };
    }
    saveAppState();
}

// ============================================================
// INICIO
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    loadAppState();
    applyTheme(appState.colorTheme || 'emerald');
    initOnboarding();
    initConfig();
    initEventListeners();
    checkOnboarding();
    renderAll();
});
