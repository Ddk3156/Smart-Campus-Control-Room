(function () {
  "use strict";

  function getThemePalette() {
    var styles = getComputedStyle(document.body);
    return {
      text: styles.getPropertyValue("--chart-text").trim() || "#5d746d",
      grid: styles.getPropertyValue("--chart-grid").trim() || "rgba(24,48,43,0.08)",
      tooltipBg: styles.getPropertyValue("--tooltip-bg").trim() || "#fffaf1",
      tooltipTitle: styles.getPropertyValue("--tooltip-title").trim() || "#18302b",
      tooltipBody: styles.getPropertyValue("--tooltip-body").trim() || "#40534d",
      tooltipBorder: styles.getPropertyValue("--tooltip-border").trim() || "rgba(24,48,43,0.14)",
    };
  }

  function applyChartDefaults() {
    if (typeof Chart === "undefined") return;
    var palette = getThemePalette();
    Chart.defaults.color = palette.text;
    Chart.defaults.borderColor = palette.grid;
    Chart.defaults.font.family = "'Space Grotesk', sans-serif";
    Chart.defaults.plugins = Chart.defaults.plugins || {};
    Chart.defaults.plugins.tooltip = Object.assign({}, Chart.defaults.plugins.tooltip, {
      backgroundColor: palette.tooltipBg,
      titleColor: palette.tooltipTitle,
      bodyColor: palette.tooltipBody,
      borderColor: palette.tooltipBorder,
      borderWidth: 1,
      cornerRadius: 14,
      padding: 12,
    });
  }

  var recycleEl = document.getElementById("sim-recycle");
  var reduceEl = document.getElementById("sim-reduce");
  var rvRecycle = document.getElementById("rv-recycle");
  var rvReduce = document.getElementById("rv-reduce");
  var wrap = document.getElementById("sim-chart-wrap");
  var resetBtn = document.getElementById("sim-reset");
  var scenarioName = document.getElementById("sim-scenario-name");
  var scenarioCopy = document.getElementById("sim-scenario-copy");
  var heroScore = document.getElementById("sim-hero-score");
  var adoptionScore = document.getElementById("sim-adoption-score");
  var presetButtons = Array.prototype.slice.call(document.querySelectorAll("[data-sim-preset]"));
  var chart = null;
  var debounceTimer = null;
  var PRESETS = {
    balanced: { recycle: 30, reduce: 20 },
    aggressive: { recycle: 62, reduce: 42 },
    cautious: { recycle: 18, reduce: 10 }
  };

  function readouts() {
    rvRecycle.textContent = recycleEl.value + "%";
    rvReduce.textContent = reduceEl.value + "%";
  }

  function makeGradient(canvas, top, bottom) {
    if (!canvas || !canvas.getContext) return "transparent";
    var ctx = canvas.getContext("2d");
    var gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 280);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    return gradient;
  }

  function updateScenarioText() {
    var recycle = parseFloat(recycleEl.value);
    var reduce = parseFloat(reduceEl.value);
    if (recycle >= 50 || reduce >= 35) {
      scenarioName.textContent = "Aggressive green transition";
      scenarioCopy.textContent = "This scenario leans into operational change and produces the strongest modeled waste decline.";
      if (heroScore) heroScore.textContent = "Aggressive";
      return;
    }
    if (recycle <= 20 && reduce <= 12) {
      scenarioName.textContent = "Cautious first phase";
      scenarioCopy.textContent = "This is a lighter intervention path, useful for pilot programs and gradual adoption.";
      if (heroScore) heroScore.textContent = "Cautious";
      return;
    }
    scenarioName.textContent = "Balanced campus upgrade";
    scenarioCopy.textContent = "A moderate plan that raises recycling while steadily reducing overall waste generation.";
    if (heroScore) heroScore.textContent = "Balanced";
  }

  function updateStats(stats) {
    document.getElementById("st-waste").textContent =
      stats.waste_avoided_kg_day != null ? stats.waste_avoided_kg_day + " kg" : "—";
    document.getElementById("st-co2").textContent =
      stats.co2_saved_kg_month != null ? stats.co2_saved_kg_month + " kg" : "—";
    document.getElementById("st-trees").textContent =
      stats.trees_equivalent != null ? String(stats.trees_equivalent) : "—";
  }

  function setPreset(name) {
    var preset = PRESETS[name];
    if (!preset) return;
    recycleEl.value = preset.recycle;
    reduceEl.value = preset.reduce;
    presetButtons.forEach(function (btn) {
      btn.classList.toggle("is-active", btn.dataset.simPreset === name);
    });
    readouts();
    updateScenarioText();
    fetchSimulate();
  }

  async function fetchSimulate() {
    readouts();
    if (adoptionScore) {
      adoptionScore.textContent = Math.round((parseFloat(recycleEl.value) + parseFloat(reduceEl.value)) / 2) + "%";
    }
    wrap.classList.add("loading");
    try {
      var res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recycle: parseFloat(recycleEl.value),
          reduce: parseFloat(reduceEl.value),
        }),
      });
      var payload = await res.json();
      if (!res.ok || !payload.ok) {
        throw new Error((payload && payload.error) || "Request failed");
      }
      var months = payload.months;
      var t = payload.totals;
      var canvas = document.getElementById("chart-simulator");
      var ds = [
        {
          label: "No action (worst case)",
          data: t.worst,
          borderColor: "rgba(200,71,63,0.55)",
          backgroundColor: makeGradient(canvas, "rgba(200,71,63,0.18)", "rgba(200,71,63,0.01)"),
          borderDash: [4, 4],
          tension: 0.35,
          fill: true,
          pointRadius: 0,
        },
        {
          label: "Current trajectory",
          data: t.current,
          borderColor: "#5d746d",
          backgroundColor: makeGradient(canvas, "rgba(111,124,118,0.15)", "rgba(111,124,118,0.01)"),
          tension: 0.35,
          fill: true,
          pointRadius: 2,
        },
        {
          label: "Improved",
          data: t.improved,
          borderColor: "#0f766e",
          backgroundColor: makeGradient(canvas, "rgba(13,118,111,0.24)", "rgba(13,118,111,0.01)"),
          tension: 0.35,
          fill: true,
          pointRadius: 2,
        },
      ];
      if (chart) {
        chart.data.labels = months;
        chart.data.datasets = ds;
        chart.update("active");
      } else {
        chart = new Chart(canvas, {
          type: "line",
          data: { labels: months, datasets: ds },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: { mode: "index", intersect: false },
            scales: {
              x: { grid: { color: getThemePalette().grid } },
              y: { beginAtZero: true, grid: { color: getThemePalette().grid } },
            },
            plugins: { legend: { position: "bottom" } },
          },
        });
      }
      updateStats(payload.stats);
      updateScenarioText();
    } catch (e) {
      console.error(e);
      updateStats({ waste_avoided_kg_day: null, co2_saved_kg_month: null, trees_equivalent: null });
    } finally {
      wrap.classList.remove("loading");
    }
  }

  function scheduleFetch() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fetchSimulate, 150);
  }

  recycleEl.addEventListener("input", function () {
    readouts();
    presetButtons.forEach(function (btn) {
      btn.classList.remove("is-active");
    });
    updateScenarioText();
    scheduleFetch();
  });

  reduceEl.addEventListener("input", function () {
    readouts();
    presetButtons.forEach(function (btn) {
      btn.classList.remove("is-active");
    });
    updateScenarioText();
    scheduleFetch();
  });

  presetButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setPreset(btn.dataset.simPreset);
    });
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      setPreset("balanced");
    });
  }

  applyChartDefaults();
  readouts();
  updateScenarioText();
  fetchSimulate();

  document.addEventListener("themechange", function () {
    applyChartDefaults();
    if (chart) {
      chart.options.scales.x.grid.color = getThemePalette().grid;
      chart.options.scales.y.grid.color = getThemePalette().grid;
      chart.update();
    }
  });
})();
