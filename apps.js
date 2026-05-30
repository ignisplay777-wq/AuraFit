// Obtener fecha actual en formato YYYY-MM-DD
function getTodayString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Estructura del estado
let appState = {
    username: "",
    metaCalories: 2000,
    metaWater: 8,
    history: {} 
};

const todayKey = getTodayString();

// Selectores
const welcomeModal = document.getElementById('welcome-modal');
const welcomeForm = document.getElementById('welcome-form');
const modalUsername = document.getElementById('modal-username');
const inputUsername = document.getElementById('username');
const inputMetaCalories = document.getElementById('meta-calories');
const inputMetaWater = document.getElementById('meta-water');
const txtCalRemaining = document.getElementById('cal-remaining');
const txtCalStatusLabel = document.getElementById('cal-status-label');
const txtCalConsumed = document.getElementById('cal-consumed');
const txtCalTargetDisplay = document.getElementById('cal-target-display');
const progressCircle = document.getElementById('progress-circle');
const txtWaterCounter = document.getElementById('water-counter');
const waterGrid = document.getElementById('water-grid');
const btnAddWater = document.getElementById('btn-add-water');
const btnResetWater = document.getElementById('btn-reset-water');
const foodForm = document.getElementById('food-form');
const inputFoodName = document.getElementById('food-name');
const inputFoodCals = document.getElementById('food-cals');
const foodList = document.getElementById('food-list');
const emptyState = document.getElementById('empty-state');
const btnClearFood = document.getElementById('btn-clear-food');
const dailyNotes = document.getElementById('daily-notes');
const statsRenderContainer = document.getElementById('stats-render-container');
const statsSummaryFooter = document.getElementById('stats-summary-footer');

let activeTab = "day";

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    loadAppState();
    checkUserSession();
    initEventListeners();
    renderAll();
});

// Carga y Persistencia
function loadAppState() {
    const stored = localStorage.getItem('aurafit_pro_state');
    if (stored) {
        try {
            appState = JSON.parse(stored);
        } catch (e) {
            console.error("Error parseando almacenamiento local", e);
        }
    }
    
    // Generar datos falsos para que las gráficas no estén vacías si eres nuevo
    if (Object.keys(appState.history).length <= 1) {
        generateMockHistory();
    }

    // Preparar el día de hoy
    if (!appState.history[todayKey]) {
        appState.history[todayKey] = { foods: [], water: 0, notes: "" };
        saveAppState();
    }
}

function saveAppState() {
    localStorage.setItem('aurafit_pro_state', JSON.stringify(appState));
}

// Control del Modal
function checkUserSession() {
    if (!appState.username || appState.username.trim() === "") {
        welcomeModal.classList.add('show');
    } else {
        welcomeModal.classList.remove('show');
    }
}

// Listeners
function initEventListeners() {
    welcomeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = modalUsername.value.trim();
        if (name) {
            appState.username = name;
            saveAppState();
            welcomeModal.classList.remove('show');
            renderAll();
        }
    });

    inputUsername.addEventListener('input', (e) => {
        appState.username = e.target.value || "Usuario";
        saveAppState();
    });

    inputMetaCalories.addEventListener('change', (e) => {
        let val = parseInt(e.target.value) || 2000;
        if (val < 500) val = 500;
        appState.metaCalories = val;
        saveAppState();
        renderCaloricTracker();
        renderStatsSection();
    });

    inputMetaWater.addEventListener('change', (e) => {
        let val = parseInt(e.target.value) || 8;
        if (val < 1) val = 1;
        appState.metaWater = val;
        saveAppState();
        renderWaterTracker();
    });

    btnAddWater.addEventListener('click', () => {
        appState.history[todayKey].water++;
        saveAppState();
        renderWaterTracker();
    });

    btnResetWater.addEventListener('click', () => {
        appState.history[todayKey].water = 0;
        saveAppState();
        renderWaterTracker();
    });

    foodForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = inputFoodName.value.trim();
        const cals = parseInt(inputFoodCals.value);
        if (name && cals > 0) {
            appState.history[todayKey].foods.push({ id: Date.now(), name, calories: cals });
            inputFoodName.value = '';
            inputFoodCals.value = '';
            saveAppState();
            renderCaloricTracker();
            renderFoodList();
            renderStatsSection();
        }
    });

    btnClearFood.addEventListener('click', () => {
        appState.history[todayKey].foods = [];
        saveAppState();
        renderCaloricTracker();
        renderFoodList();
        renderStatsSection();
    });

    dailyNotes.addEventListener('input', (e) => {
        appState.history[todayKey].notes = e.target.value;
        saveAppState();
    });

    // Filtros de las Gráficas
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            activeTab = e.target.getAttribute('data-tab');
            renderStatsSection();
        });
    });
}

// Funciones de Renderizado
function renderAll() {
    inputUsername.value = appState.username || "";
    inputMetaCalories.value = appState.metaCalories;
    inputMetaWater.value = appState.metaWater;
    dailyNotes.value = appState.history[todayKey]?.notes || "";
    
    renderCaloricTracker();
    renderWaterTracker();
    renderFoodList();
    renderStatsSection();
}

function renderCaloricTracker() {
    const todayData = appState.history[todayKey] || { foods: [] };
    const target = appState.metaCalories;
    const consumed = todayData.foods.reduce((sum, f) => sum + f.calories, 0);
    const remaining = target - consumed;

    txtCalConsumed.innerText = `${consumed} kcal`;
    txtCalTargetDisplay.innerText = `${target} kcal`;

    if (remaining >= 0) {
        txtCalRemaining.innerText = remaining;
        txtCalStatusLabel.innerText = "Restantes";
        txtCalRemaining.className = "block text-4xl font-extrabold text-zinc-100 tracking-tight";
    } else {
        txtCalRemaining.innerText = Math.abs(remaining);
        txtCalStatusLabel.innerText = "Excedidos";
        txtCalRemaining.className = "block text-4xl font-extrabold text-rose-500 tracking-tight";
    }

    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    let percentage = consumed / target;
    if (percentage > 1) percentage = 1;
    if (percentage < 0) percentage = 0;

    const offset = circumference - (percentage * circumference);
    progressCircle.style.strokeDasharray = `${circumference}`;
    progressCircle.style.strokeDashoffset = offset;
}

function renderWaterTracker() {
    const todayData = appState.history[todayKey] || { water: 0 };
    const meta = appState.metaWater;
    const consumed = todayData.water;

    txtWaterCounter.innerText = `${consumed} / ${meta} vasos`;
    waterGrid.innerHTML = '';

    for (let i = 1; i <= meta; i++) {
        const glass = document.createElement('div');
        const isFilled = i <= consumed;
        glass.className = `h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all border text-sm ${
            isFilled ? 'bg-blue-600/20 border-blue-500/50 text-blue-400 water-drop-animate' : 'bg-zinc-950 border-zinc-800 text-zinc-600 hover:border-zinc-700'
        }`;
        glass.innerHTML = `<i class="ph ${isFilled ? 'ph-drop-fill' : 'ph-drop'}"></i>`;
        glass.addEventListener('click', () => {
            appState.history[todayKey].water = i;
            saveAppState();
            renderWaterTracker();
        });
        waterGrid.appendChild(glass);
    }
}

function renderFoodList() {
    foodList.innerHTML = '';
    const todayData = appState.history[todayKey] || { foods: [] };

    if (!todayData.foods || todayData.foods.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }
    emptyState.classList.add('hidden');

    todayData.foods.forEach(food => {
        const li = document.createElement('li');
        li.className = "flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 hover:border-zinc-700 transition-all group animate-fade";
        li.innerHTML = `
            <div class="flex flex-col">
                <span class="text-sm font-medium text-zinc-200">${food.name}</span>
                <span class="text-[11px] text-emerald-400 font-semibold">${food.calories} kcal</span>
            </div>
            <button class="text-zinc-600 hover:text-rose-400 p-1 rounded-lg transition-colors opacity-0 group-hover:opacity-100"><i class="ph ph-x"></i></button>
        `;
        li.querySelector('button').addEventListener('click', () => {
            appState.history[todayKey].foods = appState.history[todayKey].foods.filter(f => f.id !== food.id);
            saveAppState();
            renderCaloricTracker();
            renderFoodList();
            renderStatsSection();
        });
        foodList.appendChild(li);
    });
}

function renderStatsSection() {
    statsRenderContainer.innerHTML = "";
    const history = appState.history;
    const targetCals = appState.metaCalories;

    let dataset = [];
    let titleSummary = "";

    const parseCalories = (dayObj) => dayObj && dayObj.foods ? dayObj.foods.reduce((acc, f) => acc + f.calories, 0) : 0;

    if (activeTab === "day") {
        const currentFoods = history[todayKey]?.foods || [];
        dataset = currentFoods.map((f) => ({ label: f.name.substring(0,8), value: f.calories }));
        if(dataset.length === 0) {
            statsRenderContainer.innerHTML = `<p class="text-xs text-zinc-500 w-full text-center pb-8">Registra comidas hoy para ver tu análisis diario.</p>`;
            statsSummaryFooter.innerText = "";
            return;
        }
        titleSummary = "Muestra de tus comidas de hoy.";
    } 
    else if (activeTab === "week") {
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const label = d.toLocaleDateString('es-ES', { weekday: 'short' });
            dataset.push({ label, value: parseCalories(history[key]) });
        }
        titleSummary = "Consumo de los últimos 7 días.";
    } 
    else if (activeTab === "month") {
        for (let i = 3; i >= 0; i--) {
            let weekSum = 0;
            for(let j = 0; j < 7; j++) {
                const d = new Date();
                d.setDate(d.getDate() - (i * 7 + j));
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                weekSum += parseCalories(history[key]);
            }
            dataset.push({ label: `Sem ${4-i}`, value: Math.round(weekSum / 7) });
        }
        titleSummary = "Promedio semanal en este mes.";
    } 
    else if (activeTab === "year") {
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const label = d.toLocaleDateString('es-ES', { month: 'short' });
            
            const matchPrefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`;
            let totalMonthCals = 0;
            let count = 0;
            Object.keys(history).forEach(k => {
                if(k.startsWith(matchPrefix)) {
                    totalMonthCals += parseCalories(history[k]);
                    count++;
                }
            });
            const avg = count > 0 ? Math.round(totalMonthCals / count) : 0;
            dataset.push({ label, value: avg });
        }
        titleSummary = "Media diaria por mes analizado.";
    }

    const maxVal = Math.max(...dataset.map(d => d.value), targetCals);

    dataset.forEach(item => {
        const column = document.createElement('div');
        column.className = "flex flex-col items-center flex-1 group relative";
        const pct = (item.value / maxVal) * 100;
        const isExceeded = item.value > targetCals;

        column.innerHTML = `
            <div class="absolute top-[-28px] opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 bg-zinc-800 text-zinc-100 font-bold text-[10px] px-2 py-0.5 rounded border border-zinc-700 transition-all pointer-events-none z-20 shadow-xl">
                ${item.value} kcal
            </div>
            <div class="w-full sm:w-8 rounded-t-lg transition-all duration-500 animate-bar relative overflow-hidden ${
                isExceeded ? 'bg-gradient-to-t from-rose-600 to-amber-500' : 'bg-gradient-to-t from-emerald-600 to-teal-400'
            }" style="height: ${Math.max(pct, 6)}%">
                <div class="absolute top-0 inset-x-0 h-1 bg-white/20"></div>
            </div>
            <span class="text-[10px] text-zinc-500 font-medium uppercase mt-2 block tracking-tight truncate w-full text-center">${item.label}</span>
        `;
        statsRenderContainer.appendChild(column);
    });

    statsSummaryFooter.innerHTML = `<span>${titleSummary}</span> <span class="text-zinc-500">Límite: ${targetCals} kcal</span>`;
}

// Simulador de datos para que la app se vea bien al abrirla por primera vez
function generateMockHistory() {
    const today = new Date();
    for(let i = 1; i <= 30; i++) {
        const pastDate = new Date();
        pastDate.setDate(today.getDate() - i);
        const key = `${pastDate.getFullYear()}-${String(pastDate.getMonth() + 1).padStart(2,'0')}-${String(pastDate.getDate()).padStart(2,'0')}`;
        
        const randomCalories = Math.floor(Math.random() * (2300 - 1400 + 1)) + 1400;
        appState.history[key] = {
            foods: [
                { id: i + 100, name: "Cena Base", calories: Math.floor(randomCalories * 0.4) },
                { id: i + 200, name: "Almuerzo Base", calories: Math.floor(randomCalories * 0.6) }
            ],
            water: Math.floor(Math.random() * 9),
            notes: "Día simulado automáticamente."
        };
    }
    saveAppState();
}