/* ============================================================
   AuraFit v2 — app.js
   ============================================================ */

// ============================================================
// FIREBASE CONFIG & AUTH
// ============================================================
const firebaseConfig = {
    apiKey: "AIzaSyAqMiSsf2zQ0h15lkeBzoNeDKEphK4Aer0",
    authDomain: "aurafit-c1a7b.firebaseapp.com",
    projectId: "aurafit-c1a7b",
    storageBucket: "aurafit-c1a7b.firebasestorage.app",
    messagingSenderId: "246832653452",
    appId: "1:246832653452:web:b601739d36f228ca9a47a9",
    measurementId: "G-545X3QPF67"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

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

const MEAL_CATEGORIES = {
    desayuno: { label: 'Desayuno', emoji: '🌅' },
    almuerzo: { label: 'Almuerzo', emoji: '🍽️' },
    cena:     { label: 'Cena',     emoji: '🌙' },
    snack:    { label: 'Snack',    emoji: '🍎' },
};

const ACHIEVEMENTS = [
    { id: 'first_food',   label: 'Primer registro',    emoji: '🥗', check: (s) => Object.values(s.history).some(d => d.foods && d.foods.length > 0) },
    { id: 'week_streak',  label: 'Racha de 7 días',    emoji: '🔥', check: (s) => calcStreak(s) >= 7 },
    { id: 'month_streak', label: 'Racha de 30 días',   emoji: '🏆', check: (s) => calcStreak(s) >= 30 },
    { id: 'hydrated',     label: 'Hidratación perfecta',emoji: '💧', check: (s) => { const k = getTodayKey(); const d = s.history[k]; return d && d.water >= s.metaWater && s.metaWater > 0; } },
    { id: 'macro_master', label: 'Registró macros',    emoji: '💪', check: (s) => Object.values(s.history).some(d => d.foods && d.foods.some(f => f.protein > 0 || f.carbs > 0 || f.fat > 0)) },
];

let appState = {
    username: '',
    metaCalories: 2000,
    metaWater: 8,
    metaProtein: 0,
    metaCarbs: 0,
    metaFat: 0,
    colorTheme: 'emerald',
    history: {}
};

let selectedMealCat = 'desayuno';
let activeTab = 'day';
let searchTimer = null;
let confirmCallback = null;

// ---- Helpers ----
function getTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function saveAppState() {
    localStorage.setItem('aurafit_pro_state_v2', JSON.stringify(appState));
    const user = auth.currentUser;
    if (user) {
        db.collection('users').doc(user.uid).set(appState).catch(e => console.error('Firestore save error:', e));
    }
}

function loadAppState() {
    const raw = localStorage.getItem('aurafit_pro_state_v2');
    // Also try old key migration
    const oldRaw = localStorage.getItem('aurafit_pro_state');
    const source = raw || oldRaw;
    if (source) {
        try {
            const loaded = JSON.parse(source);
            // Migrate old food entries (no category, no macros)
            if (loaded.history) {
                Object.keys(loaded.history).forEach(k => {
                    if (loaded.history[k].foods) {
                        loaded.history[k].foods = loaded.history[k].foods.map(f => ({
                            ...f,
                            category: f.category || 'almuerzo',
                            protein: f.protein || 0,
                            carbs: f.carbs || 0,
                            fat: f.fat || 0,
                        }));
                    }
                });
            }
            appState = { ...appState, ...loaded };
        } catch(e) { console.error(e); }
    }
    const todayKey = getTodayKey();
    if (!appState.history[todayKey]) {
        appState.history[todayKey] = { foods: [], water: 0, notes: '' };
        saveAppState();
    }
    // NO mock history — start clean for real users
}

// ---- Calcular racha de días consecutivos ----
function calcStreak(state) {
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const k = fmtKey(d);
        const day = state.history[k];
        if (day && day.foods && day.foods.length > 0) {
            streak++;
        } else if (i > 0) {
            break; // broken streak
        }
    }
    return streak;
}

// ---- Tema ----
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
    const g1 = document.getElementById('grad-stop-1');
    const g2 = document.getElementById('grad-stop-2');
    if (g1) g1.setAttribute('stop-color', theme.light);
    if (g2) g2.setAttribute('stop-color', theme.dark);
    const onbGlow = document.getElementById('onb-glow');
    if (onbGlow) onbGlow.style.background = theme.accent + '1a';
    const onbIcon = document.getElementById('onb-icon-bg');
    if (onbIcon) onbIcon.style.background = `linear-gradient(135deg, ${theme.light}, ${theme.dark})`;
}

// ---- Modales ----
function showModal(id) {
    document.getElementById(id).classList.add('modal-visible');
}
function hideModal(id) {
    document.getElementById(id).classList.remove('modal-visible');
}

function showConfirm(title, msg, callback) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-msg').textContent = msg;
    confirmCallback = callback;
    showModal('confirm-modal');
}

// ---- Toast ----
function showToast(msg, type = 'default') {
    let toast = document.getElementById('aura-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'aura-toast';
        toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] text-sm font-semibold px-5 py-2.5 rounded-2xl shadow-2xl transition-all duration-300 opacity-0 translate-y-4';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    if (type === 'error') {
        toast.className = toast.className.replace(/bg-\S+|border-\S+|text-\S+/g, '');
        toast.classList.add('bg-rose-900', 'border', 'border-rose-700', 'text-rose-200');
    } else {
        toast.style.cssText = '';
        toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm font-semibold px-5 py-2.5 rounded-2xl shadow-2xl transition-all duration-300 opacity-0 translate-y-4';
    }
    toast.classList.remove('opacity-0', 'translate-y-4');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.add('opacity-0', 'translate-y-4'), 2400);
}

// ============================================================
// BUSCADOR DE ALIMENTOS (Open Food Facts + Base chilena)
// ============================================================

// Base de datos chilena embebida (productos comunes de Chile)
const CHILE_FOODS = [
    { name: 'Pan marraqueta', calories: 267, protein: 9, carbs: 52, fat: 2 },
    { name: 'Completo italiano', calories: 520, protein: 18, carbs: 48, fat: 28 },
    { name: 'Empanada de pino', calories: 380, protein: 14, carbs: 42, fat: 17 },
    { name: 'Cazuela de vacuno', calories: 280, protein: 22, carbs: 24, fat: 8 },
    { name: 'Porotos con riendas', calories: 320, protein: 15, carbs: 55, fat: 5 },
    { name: 'Arroz con leche', calories: 190, protein: 5, carbs: 38, fat: 3 },
    { name: 'Sopaipillas (2 unidades)', calories: 260, protein: 4, carbs: 38, fat: 11 },
    { name: 'Mote con huesillo', calories: 220, protein: 4, carbs: 52, fat: 0 },
    { name: 'Manjar (1 cda)', calories: 60, protein: 1, carbs: 12, fat: 1 },
    { name: 'Leche Colún entera (1 vaso)', calories: 150, protein: 8, carbs: 11, fat: 8 },
    { name: 'Yogur Soprole natural', calories: 80, protein: 5, carbs: 10, fat: 2 },
    { name: 'Queso gauda (30g)', calories: 105, protein: 7, carbs: 0, fat: 8 },
    { name: 'Cecinas longaniza (50g)', calories: 180, protein: 8, carbs: 1, fat: 16 },
    { name: 'Palta chilena (½)', calories: 120, protein: 1, carbs: 6, fat: 11 },
    { name: 'Chirimoya (100g)', calories: 94, protein: 1, carbs: 24, fat: 0 },
    { name: 'Lúcuma (100g)', calories: 99, protein: 2, carbs: 25, fat: 0 },
    { name: 'Pan de molde (1 rebanada)', calories: 79, protein: 3, carbs: 15, fat: 1 },
    { name: 'Coca-Cola 350ml', calories: 140, protein: 0, carbs: 39, fat: 0 },
    { name: 'Bilz 350ml', calories: 130, protein: 0, carbs: 33, fat: 0 },
    { name: 'Pap 350ml', calories: 130, protein: 0, carbs: 33, fat: 0 },
    { name: 'Jugo Watt\'s naranja (200ml)', calories: 90, protein: 0, carbs: 22, fat: 0 },
    { name: 'Néctar Watt\'s durazno (200ml)', calories: 100, protein: 0, carbs: 25, fat: 0 },
    { name: 'Té con leche (taza)', calories: 70, protein: 3, carbs: 8, fat: 3 },
    { name: 'Nescafé con leche (taza)', calories: 80, protein: 4, carbs: 10, fat: 3 },
    { name: 'Hallulla (1 unidad)', calories: 240, protein: 7, carbs: 46, fat: 3 },
    { name: 'Galleta Tritón (3 unidades)', calories: 140, protein: 2, carbs: 20, fat: 6 },
    { name: 'Galleta Picaroco (3 unidades)', calories: 130, protein: 2, carbs: 19, fat: 5 },
    { name: 'Churrascas (1 unidad)', calories: 290, protein: 8, carbs: 52, fat: 6 },
    { name: 'Arvejas cocidas (½ taza)', calories: 60, protein: 4, carbs: 11, fat: 0 },
    { name: 'Tomate chileno (1 mediano)', calories: 22, protein: 1, carbs: 5, fat: 0 },
    { name: 'Pechuga de pollo a la plancha (100g)', calories: 165, protein: 31, carbs: 0, fat: 4 },
    { name: 'Reineta al horno (100g)', calories: 110, protein: 22, carbs: 0, fat: 3 },
    { name: 'Merluza frita (100g)', calories: 195, protein: 18, carbs: 8, fat: 10 },
    { name: 'Asado vacuno (100g)', calories: 250, protein: 26, carbs: 0, fat: 16 },
    { name: 'Plateada estofada (100g)', calories: 280, protein: 24, carbs: 2, fat: 19 },
    { name: 'Arroz cocido (½ taza)', calories: 103, protein: 2, carbs: 22, fat: 0 },
    { name: 'Papa cocida (1 mediana)', calories: 110, protein: 3, carbs: 26, fat: 0 },
    { name: 'Fideos cocidos (½ taza)', calories: 110, protein: 4, carbs: 22, fat: 1 },
    { name: 'Lentejas cocidas (½ taza)', calories: 115, protein: 9, carbs: 20, fat: 0 },
    { name: 'Huevo frito (1 unidad)', calories: 90, protein: 6, carbs: 0, fat: 7 },
    { name: 'Huevo a la copa (1 unidad)', calories: 74, protein: 6, carbs: 0, fat: 5 },
    { name: 'Sandwich ave mayo', calories: 430, protein: 20, carbs: 42, fat: 20 },
    { name: 'Chorrillana (porción)', calories: 780, protein: 28, carbs: 70, fat: 42 },
    { name: 'Calzone de ave (porción)', calories: 650, protein: 30, carbs: 58, fat: 32 },
    { name: 'Manzana chilena (1 mediana)', calories: 72, protein: 0, carbs: 19, fat: 0 },
    { name: 'Uvas (100g)', calories: 69, protein: 1, carbs: 18, fat: 0 },
    { name: 'Plátano (1 mediano)', calories: 89, protein: 1, carbs: 23, fat: 0 },
    { name: 'Naranja (1 mediana)', calories: 62, protein: 1, carbs: 15, fat: 0 },
    { name: 'Durazno (1 mediano)', calories: 58, protein: 1, carbs: 14, fat: 0 },
    { name: 'Ramitas Manty (30g)', calories: 145, protein: 2, carbs: 19, fat: 7 },
    { name: 'Papas fritas bolsa (30g)', calories: 155, protein: 2, carbs: 15, fat: 10 },
    { name: 'Helado Savory paleta', calories: 120, protein: 2, carbs: 18, fat: 5 },
    { name: 'Kuchen de frambuesa (porción)', calories: 320, protein: 5, carbs: 48, fat: 13 },
    { name: 'Strudel de manzana (porción)', calories: 290, protein: 4, carbs: 44, fat: 11 },
];

function searchChileFoods(query) {
    const q = query.toLowerCase().trim();
    return CHILE_FOODS.filter(f => f.name.toLowerCase().includes(q)).slice(0, 5);
}

async function searchOpenFoodFacts(query) {
    try {
        const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=8&lc=es&cc=cl`;
        const res = await fetch(url);
        const data = await res.json();
        if (!data.products) return [];
        return data.products
            .filter(p => p.product_name && p.nutriments)
            .map(p => ({
                name: p.product_name,
                brand: p.brands || '',
                calories: Math.round(p.nutriments['energy-kcal_100g'] || p.nutriments['energy-kcal'] || 0),
                protein: Math.round(p.nutriments['proteins_100g'] || 0),
                carbs: Math.round(p.nutriments['carbohydrates_100g'] || 0),
                fat: Math.round(p.nutriments['fat_100g'] || 0),
            }))
            .filter(p => p.calories > 0)
            .slice(0, 6);
    } catch (e) {
        return [];
    }
}

function renderSearchResults(chileResults, offResults, query) {
    const container = document.getElementById('search-results-inner');
    container.innerHTML = '';

    if (chileResults.length === 0 && offResults.length === 0) {
        container.innerHTML = `<div class="px-4 py-3 text-sm text-zinc-500">Sin resultados para "${query}". Registra manualmente.</div>`;
        return;
    }

    if (chileResults.length > 0) {
        const header = document.createElement('div');
        header.className = 'px-4 pt-3 pb-1 text-[10px] font-bold text-emerald-400 uppercase tracking-widest';
        header.textContent = '🇨🇱 Base de datos Chile';
        container.appendChild(header);
        chileResults.forEach(food => appendSearchItem(container, food));
    }

    if (offResults.length > 0) {
        const header = document.createElement('div');
        header.className = 'px-4 pt-3 pb-1 text-[10px] font-bold text-zinc-500 uppercase tracking-widest';
        header.textContent = '🌍 Open Food Facts';
        container.appendChild(header);
        offResults.forEach(food => appendSearchItem(container, food));
    }
}

function appendSearchItem(container, food) {
    const div = document.createElement('div');
    div.className = 'search-result-item';
    div.innerHTML = `
        <div class="flex items-center justify-between">
            <div>
                <p class="text-sm text-zinc-200 font-medium">${food.name}${food.brand ? ` <span class="text-zinc-500 font-normal text-xs">· ${food.brand}</span>` : ''}</p>
                <p class="text-xs text-zinc-500 mt-0.5">
                    <span class="text-accent font-semibold">${food.calories} kcal</span>
                    ${food.protein ? ` · <span class="text-emerald-400">${food.protein}g P</span>` : ''}
                    ${food.carbs ? ` · <span class="text-amber-400">${food.carbs}g C</span>` : ''}
                    ${food.fat ? ` · <span class="text-blue-400">${food.fat}g G</span>` : ''}
                </p>
            </div>
            <i class="ph ph-plus-circle text-accent text-xl flex-shrink-0 ml-2"></i>
        </div>
    `;
    div.addEventListener('click', () => {
        fillFoodForm(food);
        closeSearchResults();
    });
    container.appendChild(div);
}

function fillFoodForm(food) {
    document.getElementById('food-name').value = food.name;
    document.getElementById('food-cals').value = food.calories || '';
    // Show macros section and fill
    if (food.protein || food.carbs || food.fat) {
        document.getElementById('macros-input-row').classList.remove('hidden');
        document.getElementById('macros-input-row').classList.add('grid');
        document.getElementById('toggle-macros-icon').className = 'ph ph-caret-down text-sm';
        document.getElementById('food-protein').value = food.protein || 0;
        document.getElementById('food-carbs').value = food.carbs || 0;
        document.getElementById('food-fat').value = food.fat || 0;
    }
    document.getElementById('food-search').value = '';
    clearInputErrors();
}

function closeSearchResults() {
    document.getElementById('search-results').classList.add('hidden');
}

async function runSearch(query) {
    if (query.length < 2) { closeSearchResults(); return; }
    document.getElementById('search-spinner').classList.remove('hidden');
    document.getElementById('search-results').classList.remove('hidden');
    document.getElementById('search-results-inner').innerHTML = '<div class="px-4 py-3 text-sm text-zinc-500">Buscando...</div>';

    const chileResults = searchChileFoods(query);
    const offResults = await searchOpenFoodFacts(query);

    document.getElementById('search-spinner').classList.add('hidden');
    renderSearchResults(chileResults, offResults, query);
}

// ---- Validación del formulario ----
function clearInputErrors() {
    document.getElementById('food-name').classList.remove('input-error');
    document.getElementById('food-cals').classList.remove('input-error');
    document.getElementById('food-name-error').classList.add('hidden');
    document.getElementById('food-cals-error').classList.add('hidden');
}

function validateFoodForm() {
    clearInputErrors();
    const name = document.getElementById('food-name').value.trim();
    const cals = parseInt(document.getElementById('food-cals').value);
    let valid = true;
    if (!name) {
        document.getElementById('food-name').classList.add('input-error');
        document.getElementById('food-name-error').classList.remove('hidden');
        valid = false;
    }
    if (!cals || cals <= 0) {
        document.getElementById('food-cals').classList.add('input-error');
        document.getElementById('food-cals-error').classList.remove('hidden');
        valid = false;
    }
    return valid;
}

// ---- Exportar CSV ----
function exportCSV() {
    const rows = [['Fecha', 'Categoría', 'Alimento', 'Calorías (kcal)', 'Proteínas (g)', 'Carbohidratos (g)', 'Grasas (g)']];
    const sortedKeys = Object.keys(appState.history).sort();
    sortedKeys.forEach(key => {
        const day = appState.history[key];
        if (day.foods) {
            day.foods.forEach(f => {
                rows.push([key, f.category || '', f.name, f.calories, f.protein || 0, f.carbs || 0, f.fat || 0]);
            });
        }
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aurafit_historial_${getTodayKey()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✓ CSV exportado exitosamente');
}

// ============================================================
// INIT
// ============================================================

function checkOnboarding() {
    if (!appState.username || appState.username.trim() === '') showModal('onboarding-modal');
}

function initOnboarding() {
    const googleBtn = document.getElementById('onb-google-btn');
    if (googleBtn) {
        googleBtn.addEventListener('click', () => {
            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider).catch(err => {
                console.error('Login error:', err);
                alert('Error al iniciar sesión. Intenta de nuevo.');
            });
        });
    }
}

function openConfig() {
    document.getElementById('cfg-username').value  = appState.username;
    document.getElementById('cfg-calories').value  = appState.metaCalories;
    document.getElementById('cfg-water').value     = appState.metaWater;
    document.getElementById('cfg-protein').value   = appState.metaProtein || '';
    document.getElementById('cfg-carbs').value     = appState.metaCarbs || '';
    document.getElementById('cfg-fat').value       = appState.metaFat || '';
    renderColorSwatches(appState.colorTheme);
    showModal('config-modal');
}

function initConfig() {
    document.getElementById('open-config-btn').addEventListener('click', openConfig);
    document.getElementById('config-close-btn').addEventListener('click', () => hideModal('config-modal'));
    document.getElementById('config-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('config-modal')) hideModal('config-modal');
    });

    document.getElementById('cfg-save-btn').addEventListener('click', () => {
        const newName = document.getElementById('cfg-username').value.trim();
        const newCals = parseInt(document.getElementById('cfg-calories').value) || 2000;
        const newWater = parseInt(document.getElementById('cfg-water').value) || 8;
        const newProtein = parseInt(document.getElementById('cfg-protein').value) || 0;
        const newCarbs = parseInt(document.getElementById('cfg-carbs').value) || 0;
        const newFat = parseInt(document.getElementById('cfg-fat').value) || 0;

        if (newName) appState.username = newName;
        appState.metaCalories = Math.max(500, newCals);
        appState.metaWater    = Math.max(1, newWater);
        appState.metaProtein  = newProtein;
        appState.metaCarbs    = newCarbs;
        appState.metaFat      = newFat;

        saveAppState();
        applyTheme(appState.colorTheme);
        hideModal('config-modal');
        renderAll();
        showToast('✓ Configuración guardada');
    });

    document.getElementById('cfg-reset-btn').addEventListener('click', () => {
        showConfirm('¿Borrar todos los datos?', '⚠️ Esto eliminará permanentemente todo tu historial, progreso y configuración.', async () => {
            localStorage.removeItem('aurafit_pro_state_v2');
            localStorage.removeItem('aurafit_pro_state');
            const user = auth.currentUser;
            if (user) {
                await db.collection('users').doc(user.uid).delete().catch(() => {});
            }
            location.reload();
        });
    });

    // Botón cerrar sesión
    const logoutBtn = document.getElementById('cfg-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            auth.signOut().then(() => location.reload());
        });
    }

    document.getElementById('cfg-export-btn').addEventListener('click', exportCSV);

    // Confirm modal
    document.getElementById('confirm-cancel').addEventListener('click', () => hideModal('confirm-modal'));
    document.getElementById('confirm-ok').addEventListener('click', () => {
        hideModal('confirm-modal');
        if (confirmCallback) confirmCallback();
        confirmCallback = null;
    });
}

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
            renderColorSwatches(theme.id);
        });
        container.appendChild(div);
    });
}

// ---- Edit food modal ----
function openEditFood(foodId) {
    const key = getTodayKey();
    const food = appState.history[key].foods.find(f => f.id === foodId);
    if (!food) return;
    document.getElementById('edit-food-id').value   = foodId;
    document.getElementById('edit-food-name').value = food.name;
    document.getElementById('edit-food-cals').value = food.calories;
    document.getElementById('edit-food-protein').value = food.protein || 0;
    document.getElementById('edit-food-carbs').value = food.carbs || 0;
    document.getElementById('edit-food-fat').value  = food.fat || 0;
    showModal('edit-food-modal');
}

function initEditFoodModal() {
    document.getElementById('edit-food-close').addEventListener('click', () => hideModal('edit-food-modal'));
    document.getElementById('edit-food-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('edit-food-modal')) hideModal('edit-food-modal');
    });
    document.getElementById('edit-food-save').addEventListener('click', () => {
        const id = parseInt(document.getElementById('edit-food-id').value);
        const name = document.getElementById('edit-food-name').value.trim();
        const cals = parseInt(document.getElementById('edit-food-cals').value);
        const protein = parseInt(document.getElementById('edit-food-protein').value) || 0;
        const carbs = parseInt(document.getElementById('edit-food-carbs').value) || 0;
        const fat = parseInt(document.getElementById('edit-food-fat').value) || 0;
        if (!name || !cals || cals <= 0) { showToast('⚠ Nombre y calorías son requeridos', 'error'); return; }
        const key = getTodayKey();
        const foods = appState.history[key].foods;
        const idx = foods.findIndex(f => f.id === id);
        if (idx !== -1) {
            foods[idx] = { ...foods[idx], name, calories: cals, protein, carbs, fat };
            saveAppState();
            hideModal('edit-food-modal');
            renderCaloricTracker();
            renderMacros();
            renderFoodList();
            renderStatsSection();
            showToast('✓ Alimento actualizado');
        }
    });
}

function initEventListeners() {

    // ---- Buscador Open Food Facts ----
    let searchTimeout = null;

    async function searchFoods(query) {
        if (query.length < 2) {
            document.getElementById('food-search-results').classList.add('hidden');
            return;
        }
        document.getElementById('food-search-spinner').classList.remove('hidden');
        try {
            const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=8&lc=es`;
            const res = await fetch(url);
            const data = await res.json();
            renderFoodSearchResults(data.products || []);
        } catch(e) {
            console.error('Error buscando alimentos:', e);
        } finally {
            document.getElementById('food-search-spinner').classList.add('hidden');
        }
    }

    function renderFoodSearchResults(products) {
        const container = document.getElementById('food-search-results');
        const valid = products.filter(p => p.product_name && p.nutriments && p.nutriments['energy-kcal_100g'] > 0);
        if (valid.length === 0) {
            container.innerHTML = `<div class="px-4 py-3 text-sm text-zinc-500">Sin resultados. Completa los campos manualmente.</div>`;
            container.classList.remove('hidden');
            return;
        }
        container.innerHTML = valid.map(p => {
            const name = p.product_name || 'Sin nombre';
            const brand = p.brands ? `<span class="text-zinc-600"> · ${p.brands.split(',')[0]}</span>` : '';
            const kcal = Math.round(p.nutriments['energy-kcal_100g'] || 0);
            const prot = Math.round(p.nutriments['proteins_100g'] || 0);
            const carbs = Math.round(p.nutriments['carbohydrates_100g'] || 0);
            const fat = Math.round(p.nutriments['fat_100g'] || 0);
            return `<button type="button" class="food-search-item w-full text-left px-4 py-2.5 hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-0"
                data-name="${name.replace(/"/g,'&quot;')}" data-kcal="${kcal}" data-prot="${prot}" data-carbs="${carbs}" data-fat="${fat}">
                <div class="text-sm text-zinc-100 font-medium">${name}${brand}</div>
                <div class="text-xs text-zinc-500 mt-0.5">${kcal} kcal · ${prot}g prot · ${carbs}g carbs · ${fat}g grasas <span class="text-zinc-600">/ 100g</span></div>
            </button>`;
        }).join('');
        container.classList.remove('hidden');

        container.querySelectorAll('.food-search-item').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('food-name').value = btn.dataset.name;
                document.getElementById('food-cals').value = btn.dataset.kcal;
                document.getElementById('food-protein').value = btn.dataset.prot;
                document.getElementById('food-carbs').value = btn.dataset.carbs;
                document.getElementById('food-fat').value = btn.dataset.fat;
                // Mostrar macros automáticamente
                document.getElementById('macros-input-row').classList.remove('hidden');
                document.getElementById('toggle-macros-icon').classList.add('rotate-90');
                container.classList.add('hidden');
                document.getElementById('food-search').value = '';
            });
        });
    }

    document.getElementById('food-search').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => searchFoods(e.target.value.trim()), 400);
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#food-search') && !e.target.closest('#food-search-results')) {
            document.getElementById('food-search-results').classList.add('hidden');
        }
    });

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

    // Categorías de comida
    document.querySelectorAll('.meal-cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.meal-cat-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedMealCat = btn.getAttribute('data-cat');
        });
    });

    // Toggle macros input
    document.getElementById('toggle-macros-btn').addEventListener('click', () => {
        const row = document.getElementById('macros-input-row');
        const icon = document.getElementById('toggle-macros-icon');
        const hidden = row.classList.contains('hidden');
        row.classList.toggle('hidden', !hidden);
        row.classList.toggle('grid', hidden);
        icon.className = hidden ? 'ph ph-caret-down text-sm' : 'ph ph-caret-right text-sm';
    });

    // Submit alimento
    document.getElementById('food-submit-btn').addEventListener('click', () => {
        if (!validateFoodForm()) return;
        const key = getTodayKey();
        const name = document.getElementById('food-name').value.trim();
        const cals = parseInt(document.getElementById('food-cals').value);
        const protein = parseInt(document.getElementById('food-protein').value) || 0;
        const carbs = parseInt(document.getElementById('food-carbs').value) || 0;
        const fat = parseInt(document.getElementById('food-fat').value) || 0;

        appState.history[key].foods.push({
            id: Date.now(),
            name, calories: cals, protein, carbs, fat,
            category: selectedMealCat,
        });
        document.getElementById('food-name').value = '';
        document.getElementById('food-cals').value = '';
        document.getElementById('food-protein').value = '';
        document.getElementById('food-carbs').value = '';
        document.getElementById('food-fat').value = '';
        clearInputErrors();
        saveAppState();
        renderCaloricTracker();
        renderMacros();
        renderFoodList();
        renderStatsSection();
        renderAchievements();
        showToast('✓ Alimento registrado');
    });

    // Vaciar comidas
    document.getElementById('btn-clear-food').addEventListener('click', () => {
        const key = getTodayKey();
        if (!appState.history[key].foods.length) return;
        showConfirm('¿Vaciar todas las comidas?', 'Se eliminarán todos los alimentos registrados hoy.', () => {
            appState.history[key].foods = [];
            saveAppState();
            renderCaloricTracker();
            renderMacros();
            renderFoodList();
            renderStatsSection();
        });
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

    // Buscador
    document.getElementById('food-search').addEventListener('input', (e) => {
        clearTimeout(searchTimer);
        const q = e.target.value.trim();
        if (q.length < 2) { closeSearchResults(); return; }
        searchTimer = setTimeout(() => runSearch(q), 350);
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#food-search') && !e.target.closest('#search-results')) {
            closeSearchResults();
        }
    });
}

// ============================================================
// RENDERIZADO
// ============================================================

function renderAll() {
    const key = getTodayKey();
    document.getElementById('header-username').textContent   = appState.username || '—';
    document.getElementById('header-cal-meta').textContent   = `${appState.metaCalories} kcal`;
    document.getElementById('header-water-meta').textContent = appState.metaWater;
    document.getElementById('daily-notes').value = appState.history[key]?.notes || '';
    renderCaloricTracker();
    renderMacros();
    renderWaterTracker();
    renderFoodList();
    renderStatsSection();
    renderStreak();
    renderAchievements();
}

function renderCaloricTracker() {
    const key      = getTodayKey();
    const todayData = appState.history[key] || { foods: [] };
    const target   = appState.metaCalories;
    const consumed = todayData.foods.reduce((sum, f) => sum + f.calories, 0);
    const remaining = target - consumed;

    document.getElementById('cal-consumed').textContent      = `${consumed} kcal`;
    document.getElementById('cal-target-display').textContent = `${target} kcal`;

    const calEl = document.getElementById('cal-remaining');
    const lblEl = document.getElementById('cal-status-label');
    if (remaining >= 0) {
        calEl.textContent = remaining;
        lblEl.textContent = 'Restantes';
        calEl.className = 'block text-3xl font-extrabold text-zinc-100 tracking-tight transition-all duration-300';
    } else {
        calEl.textContent = Math.abs(remaining);
        lblEl.textContent = 'Excedidos';
        calEl.className = 'block text-3xl font-extrabold text-rose-500 tracking-tight transition-all duration-300';
    }

    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const pct    = Math.min(consumed / target, 1);
    const offset = circumference - pct * circumference;
    const circle = document.getElementById('progress-circle');
    circle.style.strokeDasharray  = circumference;
    circle.style.strokeDashoffset = offset;
}

function renderMacros() {
    const key = getTodayKey();
    const foods = appState.history[key]?.foods || [];
    const totalProtein = foods.reduce((s, f) => s + (f.protein || 0), 0);
    const totalCarbs   = foods.reduce((s, f) => s + (f.carbs || 0), 0);
    const totalFat     = foods.reduce((s, f) => s + (f.fat || 0), 0);

    document.getElementById('macro-protein-val').textContent = `${totalProtein}g`;
    document.getElementById('macro-carbs-val').textContent   = `${totalCarbs}g`;
    document.getElementById('macro-fat-val').textContent     = `${totalFat}g`;

    const hasMetas = appState.metaProtein > 0 || appState.metaCarbs > 0 || appState.metaFat > 0;
    const hasData  = totalProtein > 0 || totalCarbs > 0 || totalFat > 0;

    if (hasMetas) {
        document.getElementById('macro-protein-bar').style.width = `${Math.min((totalProtein / appState.metaProtein) * 100, 100)}%`;
        document.getElementById('macro-carbs-bar').style.width   = `${Math.min((totalCarbs / appState.metaCarbs) * 100, 100)}%`;
        document.getElementById('macro-fat-bar').style.width     = `${Math.min((totalFat / appState.metaFat) * 100, 100)}%`;
        document.getElementById('macros-hint').style.opacity = '0';
    } else if (hasData) {
        // Show relative bars among themselves
        const max = Math.max(totalProtein, totalCarbs, totalFat, 1);
        document.getElementById('macro-protein-bar').style.width = `${(totalProtein / max) * 100}%`;
        document.getElementById('macro-carbs-bar').style.width   = `${(totalCarbs / max) * 100}%`;
        document.getElementById('macro-fat-bar').style.width     = `${(totalFat / max) * 100}%`;
        document.getElementById('macros-hint').style.opacity = '1';
    } else {
        document.getElementById('macro-protein-bar').style.width = '0%';
        document.getElementById('macro-carbs-bar').style.width   = '0%';
        document.getElementById('macro-fat-bar').style.width     = '0%';
        document.getElementById('macros-hint').style.opacity = '1';
    }
}

function renderWaterTracker() {
    const key      = getTodayKey();
    const todayData = appState.history[key] || { water: 0 };
    const meta     = appState.metaWater;
    const consumed = todayData.water;

    document.getElementById('water-counter').textContent = `${consumed} / ${meta} vasos`;

    const pct = meta > 0 ? Math.min((consumed / meta) * 100, 100) : 0;
    document.getElementById('water-progress-bar').style.width = `${pct}%`;
    document.getElementById('water-pct-label').textContent = `${Math.round(pct)}%`;

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
    const container = document.getElementById('food-list-categorized');
    const empty     = document.getElementById('empty-state');

    container.innerHTML = '';
    if (!todayData.foods || todayData.foods.length === 0) {
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    // Group by category
    const grouped = {};
    todayData.foods.forEach(food => {
        const cat = food.category || 'almuerzo';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(food);
    });

    const catOrder = ['desayuno', 'almuerzo', 'cena', 'snack'];
    catOrder.forEach(cat => {
        if (!grouped[cat] || grouped[cat].length === 0) return;
        const { label, emoji } = MEAL_CATEGORIES[cat] || { label: cat, emoji: '🍽️' };
        const catTotal = grouped[cat].reduce((s, f) => s + f.calories, 0);

        const header = document.createElement('div');
        header.className = 'cat-group-header mt-3 first:mt-0';
        header.innerHTML = `<span>${emoji} ${label}</span><span class="ml-auto text-[10px] text-zinc-600 font-normal mr-2">${catTotal} kcal</span>`;
        container.appendChild(header);

        grouped[cat].forEach(food => {
            const li = document.createElement('div');
            li.className = 'food-item mb-1.5 animate-fade group';
            const hasMacros = food.protein > 0 || food.carbs > 0 || food.fat > 0;
            li.innerHTML = `
                <div class="flex flex-col min-w-0">
                    <span class="text-sm font-medium text-zinc-200 truncate">${food.name}</span>
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-[11px] text-accent font-semibold">${food.calories} kcal</span>
                        ${hasMacros ? `
                            <span class="text-[10px] text-emerald-400">${food.protein || 0}g P</span>
                            <span class="text-[10px] text-amber-400">${food.carbs || 0}g C</span>
                            <span class="text-[10px] text-blue-400">${food.fat || 0}g G</span>
                        ` : ''}
                    </div>
                </div>
                <div class="flex items-center gap-1 flex-shrink-0">
                    <button class="edit-btn text-zinc-600 hover:text-accent p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100" title="Editar">
                        <i class="ph ph-pencil text-sm"></i>
                    </button>
                    <button class="delete-btn text-zinc-600 hover:text-rose-400 p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100" title="Eliminar">
                        <i class="ph ph-x text-sm"></i>
                    </button>
                </div>
            `;
            li.querySelector('.delete-btn').addEventListener('click', () => {
                const k = getTodayKey();
                appState.history[k].foods = appState.history[k].foods.filter(f => f.id !== food.id);
                saveAppState();
                renderCaloricTracker();
                renderMacros();
                renderFoodList();
                renderStatsSection();
            });
            li.querySelector('.edit-btn').addEventListener('click', () => openEditFood(food.id));
            container.appendChild(li);
        });
    });
}

function renderStatsSection() {
    const container = document.getElementById('stats-render-container');
    const footer    = document.getElementById('stats-summary-footer');
    container.innerHTML = '';

    const history   = appState.history;
    const target    = appState.metaCalories;
    const parseCals = (d) => d?.foods?.reduce((a, f) => a + f.calories, 0) || 0;

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
        title = 'Tus comidas de hoy.';
    } else if (activeTab === 'week') {
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            dataset.push({ label: d.toLocaleDateString('es-ES', { weekday: 'short' }), value: parseCals(history[fmtKey(d)]) });
        }
        title = 'Consumo de los últimos 7 días.';
    } else if (activeTab === 'month') {
        for (let i = 3; i >= 0; i--) {
            let sum = 0;
            for (let j = 0; j < 7; j++) {
                const d = new Date(); d.setDate(d.getDate() - (i*7+j));
                sum += parseCals(history[fmtKey(d)]);
            }
            dataset.push({ label: `Sem ${4-i}`, value: Math.round(sum/7) });
        }
        title = 'Promedio semanal en este mes.';
    } else if (activeTab === 'year') {
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

function renderStreak() {
    const streak = calcStreak(appState);
    document.getElementById('streak-days').textContent = streak;
    document.getElementById('streak-count').textContent = streak;
    const badge = document.getElementById('streak-badge');
    if (streak > 0) {
        badge.classList.remove('hidden');
        badge.classList.add('flex');
    } else {
        badge.classList.add('hidden');
    }
    const flame = document.getElementById('streak-flame');
    if (streak >= 30) flame.textContent = '🏆';
    else if (streak >= 7) flame.textContent = '🔥';
    else flame.textContent = '✨';
}

function renderAchievements() {
    const list = document.getElementById('achievements-list');
    list.innerHTML = '';
    ACHIEVEMENTS.forEach(ach => {
        const unlocked = ach.check(appState);
        const div = document.createElement('div');
        div.className = `achievement-badge ${unlocked ? 'unlocked' : ''}`;
        div.innerHTML = `
            <span class="text-lg">${ach.emoji}</span>
            <span class="${unlocked ? 'text-zinc-200' : 'text-zinc-600'} font-medium text-xs">${ach.label}</span>
            ${unlocked ? '<i class="ph ph-check-circle text-accent ml-auto"></i>' : '<i class="ph ph-lock-simple text-zinc-700 ml-auto"></i>'}
        `;
        list.appendChild(div);
    });
}

// ============================================================
// INICIO
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    applyTheme(appState.colorTheme || 'emerald');
    initOnboarding();
    initConfig();
    initEditFoodModal();
    initEventListeners();

    // Firebase auth state listener — se ejecuta al cargar y al hacer login/logout
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // Usuario logueado: cargar datos desde Firestore
            try {
                const doc = await db.collection('users').doc(user.uid).get();
                if (doc.exists) {
                    const data = doc.data();
                    // Migrar alimentos sin categoría ni macros
                    if (data.history) {
                        Object.keys(data.history).forEach(k => {
                            if (data.history[k].foods) {
                                data.history[k].foods = data.history[k].foods.map(f => ({
                                    ...f,
                                    category: f.category || 'almuerzo',
                                    protein: f.protein || 0,
                                    carbs: f.carbs || 0,
                                    fat: f.fat || 0,
                                }));
                            }
                        });
                    }
                    appState = { ...appState, ...data };
                } else {
                    // Primera vez: usar nombre de Google
                    appState.username = user.displayName ? user.displayName.split(' ')[0] : 'Usuario';
                    const todayKey = getTodayKey();
                    if (!appState.history[todayKey]) {
                        appState.history[todayKey] = { foods: [], water: 0, notes: '' };
                    }
                    saveAppState();
                }
            } catch(e) {
                console.error('Error cargando datos:', e);
                // Fallback a localStorage si hay error de red
                loadAppState();
            }
            hideModal('onboarding-modal');
            applyTheme(appState.colorTheme || 'emerald');
            renderAll();
        } else {
            // No hay sesión: mostrar login
            showModal('onboarding-modal');
        }
    });
});
