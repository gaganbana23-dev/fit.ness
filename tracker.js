/* Simple browser-only fitness tracker using localStorage.
   Drop this as tracker.js next to tracker.html */

// --- Helpers for storage ---
const store = {
  get(key, fallback) {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  clearAll() {
    localStorage.clear();
  }
};

// Keys used
const KEYS = {
  WEIGHT: "fc_weights",
  CALS: "fc_cals",
  STEPS: "fc_steps_last", // keep the latest steps entry per day
  WORKOUTS: "fc_workouts",
  WATER: "fc_water_total",
  DIET: "fc_diet_plan"
};

// --- UI elements ---
const weightInput = document.getElementById("weightInput");
const addWeightBtn = document.getElementById("addWeight");

const stepsInput = document.getElementById("stepsInput");
const addStepsBtn = document.getElementById("addSteps");

const calInput = document.getElementById("calInput");
const addCalBtn = document.getElementById("addCal");

const waterInput = document.getElementById("waterInput");
const addWaterBtn = document.getElementById("addWater");

const workoutForm = document.getElementById("workoutForm");
const workoutList = document.getElementById("workoutList");
const clearWorkoutsBtn = document.getElementById("clearWorkouts");

const dietPlanEl = document.getElementById("dietPlan");
const saveDietBtn = document.getElementById("saveDiet");
const resetDietBtn = document.getElementById("resetDiet");

const todayStepsEl = document.getElementById("todaySteps");
const todayCaloriesEl = document.getElementById("todayCalories");
const todayWaterEl = document.getElementById("todayWater");
const lastWeightEl = document.getElementById("lastWeight");

const exportBtn = document.getElementById("exportBtn");
const clearBtn = document.getElementById("clearBtn");

// --- Initialize data structures ---
let weightEntries = store.get(KEYS.WEIGHT, []); // array of {date, weight}
let calEntries = store.get(KEYS.CALS, []);    // array of {date, cal}
let stepsEntry = store.get(KEYS.STEPS, { date: todayISO(), steps: 0 });
let workouts = store.get(KEYS.WORKOUTS, []);  // array of {date,type,duration,notes}
let waterTotal = store.get(KEYS.WATER, 0);    // cumulative ml for today
let dietPlan = store.get(KEYS.DIET, "");

// --- Utility ---
function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

// render functions
function renderSummary() {
  todayStepsEl.textContent = stepsEntry?.steps ?? 0;
  todayCaloriesEl.textContent = (calEntries.length ? calEntries[calEntries.length - 1].cal : 0);
  todayWaterEl.textContent = waterTotal;
  lastWeightEl.textContent = (weightEntries.length ? weightEntries[weightEntries.length - 1].weight + " kg" : "—");
}

function renderWorkouts() {
  workoutList.innerHTML = "";
  if (!workouts.length) {
    workoutList.innerHTML = "<li class='muted'>No workouts logged yet</li>";
    return;
  }
  workouts.slice().reverse().forEach((w, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<div>
        <strong>${w.type}</strong>
        <div><small>${w.date} • ${w.duration} min</small></div>
        <div><small>${w.notes || ""}</small></div>
      </div>
      <div>
        <button data-i="${i}" class="del">Delete</button>
      </div>`;
    workoutList.appendChild(li);
  });
}

workoutList.addEventListener("click", (e) => {
  if (e.target.matches(".del")) {
    const index = parseInt(e.target.getAttribute("data-i"), 10);
    // delete by value (we stored old order) — easier: remove last matching index from end
    const idxFromStart = workouts.length - 1 - index;
    workouts.splice(idxFromStart, 1);
    store.set(KEYS.WORKOUTS, workouts);
    renderWorkouts();
  }
});

// charts
let weightChart = null;
let calChart = null;

function renderCharts() {
  // weight chart
  const wLabels = weightEntries.map(x => x.date);
  const wData = weightEntries.map(x => x.weight);

  const weightCtx = document.getElementById("weightChart").getContext("2d");
  if (weightChart) weightChart.destroy();
  weightChart = new Chart(weightCtx, {
    type: "line",
    data: {
      labels: wLabels,
      datasets: [{
        label: "Weight (kg)",
        data: wData,
        fill: false,
        tension: 0.2,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      scales: { x: { display: true }, y: { beginAtZero: false } }
    }
  });

  // calories chart - show last 7 entries
  const cRecent = calEntries.slice(-7);
  const cLabels = cRecent.map(x => x.date);
  const cData = cRecent.map(x => x.cal);

  const calCtx = document.getElementById("calChart").getContext("2d");
  if (calChart) calChart.destroy();
  calChart = new Chart(calCtx, {
    type: "bar",
    data: {
      labels: cLabels,
      datasets: [{
        label: "Calories",
        data: cData,
        borderWidth: 1
      }]
    },
    options: { responsive: true, scales: { y: { beginAtZero: true } } }
  });
}

// --- Event handlers for quick add ---
addWeightBtn.addEventListener("click", () => {
  const v = parseFloat(weightInput.value);
  if (!v || v <= 0) return alert("Enter a valid weight");
  weightEntries.push({ date: todayISO(), weight: v });
  store.set(KEYS.WEIGHT, weightEntries);
  weightInput.value = "";
  renderAll();
});

addStepsBtn.addEventListener("click", () => {
  const v = parseInt(stepsInput.value, 10);
  if (isNaN(v) || v < 0) return alert("Enter steps");
  // only keep today's steps
  stepsEntry = { date: todayISO(), steps: v };
  store.set(KEYS.STEPS, stepsEntry);
  stepsInput.value = "";
  renderAll();
});

addCalBtn.addEventListener("click", () => {
  const v = parseInt(calInput.value, 10);
  if (isNaN(v) || v < 0) return alert("Enter calories");
  calEntries.push({ date: todayISO(), cal: v });
  store.set(KEYS.CALS, calEntries);
  calInput.value = "";
  renderAll();
});

addWaterBtn.addEventListener("click", () => {
  const v = parseInt(waterInput.value, 10);
  if (isNaN(v) || v <= 0) return alert("Enter water (ml)");
  // simple accumulation for the day
  const today = todayISO();
  // if stored water has date? For simplicity track only numeric total for current session
  waterTotal += v;
  store.set(KEYS.WATER, waterTotal);
  waterInput.value = "";
  renderAll();
});

// workout form
workoutForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const type = document.getElementById("workoutType").value.trim();
  const dur = document.getElementById("workoutDuration").value.trim();
  const notes = document.getElementById("workoutNotes").value.trim();
  if (!type || !dur) return alert("Fill workout type and duration");
  workouts.push({ date: todayISO(), type, duration: dur, notes });
  store.set(KEYS.WORKOUTS, workouts);
  workoutForm.reset();
  renderAll();
});

clearWorkoutsBtn.addEventListener("click", () => {
  if (!confirm("Clear all workouts?")) return;
  workouts = [];
  store.set(KEYS.WORKOUTS, workouts);
  renderAll();
});

// diet save/reset
saveDietBtn.addEventListener("click", () => {
  dietPlan = dietPlanEl.value || "";
  store.set(KEYS.DIET, dietPlan);
  alert("Diet plan saved.");
});

resetDietBtn.addEventListener("click", () => {
  if (!confirm("Reset diet plan?")) return;
  dietPlan = "";
  dietPlanEl.value = "";
  store.set(KEYS.DIET, dietPlan);
});

// export / clear
exportBtn.addEventListener("click", () => {
  const data = {
    weights: weightEntries,
    calories: calEntries,
    steps: stepsEntry,
    workouts,
    waterTotal,
    dietPlan
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "fitclub-data.json";
  a.click();
  URL.revokeObjectURL(url);
});

clearBtn.addEventListener("click", () => {
  if (!confirm("Clear ALL data from localStorage?")) return;
  store.clearAll();
  // reset in-memory as well
  weightEntries = [];
  calEntries = [];
  stepsEntry = { date: todayISO(), steps: 0 };
  workouts = [];
  waterTotal = 0;
  dietPlan = "";
  renderAll();
});

// initial render and helper
function loadFromStorage() {
  weightEntries = store.get(KEYS.WEIGHT, []);
  calEntries = store.get(KEYS.CALS, []);
  stepsEntry = store.get(KEYS.STEPS, { date: todayISO(), steps: 0 });
  workouts = store.get(KEYS.WORKOUTS, []);
  waterTotal = store.get(KEYS.WATER, 0);
  dietPlan = store.get(KEYS.DIET, "");
  dietPlanEl.value = dietPlan || "";
}

// render everything
function renderAll() {
  renderSummary();
  renderWorkouts();
  renderCharts();
}

loadFromStorage();
renderAll();
