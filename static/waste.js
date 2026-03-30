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

  const plasticEl = document.getElementById("sl-plastic");
  const organicEl = document.getElementById("sl-organic");
  const ewasteEl = document.getElementById("sl-ewaste");
  const rvPlastic = document.getElementById("rv-plastic");
  const rvOrganic = document.getElementById("rv-organic");
  const rvEwaste = document.getElementById("rv-ewaste");
  const statusStrip = document.getElementById("status-strip");
  const solutionsRoot = document.getElementById("solutions-root");
  const comparisonSection = document.getElementById("comparison-section");
  const comparisonHeadline = document.getElementById("comparison-headline");
  const predictionWrap = document.getElementById("prediction-wrap");
  const toast = document.getElementById("waste-toast");
  const focusType = document.getElementById("focus-type");
  const focusCopy = document.getElementById("focus-copy");
  const metricPlastic = document.getElementById("metric-plastic");
  const metricOrganic = document.getElementById("metric-organic");
  const metricEwaste = document.getElementById("metric-ewaste");
  const recoveryScore = document.getElementById("waste-recovery-score");
  const criticality = document.getElementById("waste-criticality");
  const targetStream = document.getElementById("waste-target-stream");
  const resetBtn = document.getElementById("waste-reset");
  const presetButtons = Array.prototype.slice.call(document.querySelectorAll("[data-preset]"));

  let predictionChart = null;
  let compareBeforeChart = null;
  let compareAfterChart = null;
  let lastComparison = null;
  let fetchTimer = null;

  const PRESETS = {
    normal: { plastic: 16, organic: 39, ewaste: 2 },
    stress: { plastic: 24, organic: 52, ewaste: 4.3 },
    optimized: { plastic: 11, organic: 28, ewaste: 1.2 },
  };

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("is-on");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      toast.classList.remove("is-on");
    }, 4200);
  }

  function readouts() {
    var p = parseFloat(plasticEl.value);
    var o = parseFloat(organicEl.value);
    var e = parseFloat(ewasteEl.value);
    rvPlastic.textContent = p.toFixed(1) + " kg";
    rvOrganic.textContent = o.toFixed(1) + " kg";
    rvEwaste.textContent = e.toFixed(1) + " kg";
    metricPlastic.textContent = p.toFixed(1) + " kg";
    metricOrganic.textContent = o.toFixed(1) + " kg";
    metricEwaste.textContent = e.toFixed(1) + " kg";
  }

  function commonScales() {
    var palette = getThemePalette();
    return {
      x: {
        grid: { color: palette.grid },
        ticks: { maxRotation: 40, minRotation: 0 },
      },
      y: {
        beginAtZero: true,
        grid: { color: palette.grid },
      },
    };
  }

  function renderStatusStrip(pills) {
    statusStrip.innerHTML = "";
    pills.forEach(function (row) {
      var p = row.pill;
      var cls = "pill ";
      if (p.tone === "danger") cls += "pill-danger";
      else if (p.tone === "warn") cls += "pill-warn";
      else cls += "pill-ok";
      var span = document.createElement("span");
      span.className = cls + " mono";
      span.textContent = row.label + " · " + p.emoji + " " + p.text;
      statusStrip.appendChild(span);
    });
  }

  function renderSolutions(solutions) {
    var types = ["plastic", "organic", "ewaste"];
    var frag = document.createElement("div");
    frag.className = "sol-grid";
    types.forEach(function (key) {
      var sol = solutions[key];
      var card = document.createElement("article");
      card.className = "sol-card";
      var top = document.createElement("div");
      top.className = "solution-topline";
      var badge = document.createElement("span");
      badge.className = "solution-badge mono";
      badge.textContent = sol.level.toUpperCase() + " • " + sol.reduction_pct + "%";
      top.appendChild(badge);
      card.appendChild(top);
      var h = document.createElement("h3");
      h.textContent = key.charAt(0).toUpperCase() + key.slice(1) + " stream";
      card.appendChild(h);
      var sub = document.createElement("p");
      sub.className = "muted small";
      sub.textContent = sol.headline;
      card.appendChild(sub);
      var ul = document.createElement("ul");
      ul.className = "sol-actions";
      sol.actions.forEach(function (a) {
        var li = document.createElement("li");
        li.textContent = a.icon + " " + a.title + " — " + a.impact;
        ul.appendChild(li);
      });
      card.appendChild(ul);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-ghost btn-small show-impact";
      btn.textContent = "Show impact";
      card.appendChild(btn);
      frag.appendChild(card);
    });
    solutionsRoot.innerHTML = "";
    solutionsRoot.appendChild(frag);
  }

  function updateFocus(comp) {
    if (!comp) return;
    focusType.textContent = comp.focus_label + " needs the fastest response";
    focusCopy.textContent =
      "The current inputs make " +
      comp.focus_label.replace(/\s+/g, " ").trim() +
      " the dominant risk area. Prioritized action is modeled to reduce that stream by about " +
      comp.reduction_pct +
      "%.";
    if (recoveryScore) {
      recoveryScore.textContent = Math.max(18, 100 - comp.reduction_pct / 2).toFixed(0) + "%";
    }
    if (targetStream) {
      targetStream.textContent = comp.focus_label;
    }
    if (criticality) {
      criticality.textContent = comp.reduction_pct >= 35 ? "High" : comp.reduction_pct >= 20 ? "Moderate" : "Controlled";
    }
  }

  function setPreset(name) {
    var values = PRESETS[name];
    if (!values) return;
    plasticEl.value = values.plastic;
    organicEl.value = values.organic;
    ewasteEl.value = values.ewaste;
    presetButtons.forEach(function (btn) {
      btn.classList.toggle("is-active", btn.dataset.preset === name);
    });
    fetchWaste();
  }

  function updatePredictionChart(payload) {
    var ctx = document.getElementById("chart-prediction");
    if (!ctx) return;
    var ds = payload.chart.datasets.map(function (d) {
      return {
        label: d.label,
        data: d.data,
        borderColor: d.borderColor,
        backgroundColor: d.backgroundColor || "transparent",
        borderDash: d.borderDash || [],
        fill: Boolean(d.fill),
        borderWidth: 3,
        tension: d.tension != null ? d.tension : 0.35,
        pointRadius: d.pointRadius != null ? d.pointRadius : 2,
        pointHoverRadius: 6,
        spanGaps: false,
      };
    });

    if (predictionChart) {
      predictionChart.data.labels = payload.chart.labels;
      predictionChart.data.datasets = ds;
      predictionChart.update("active");
    } else {
      predictionChart = new Chart(ctx, {
        type: "line",
        data: { labels: payload.chart.labels, datasets: ds },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          animation: { duration: 600, easing: "easeOutQuart" },
          interaction: { mode: "index", intersect: false },
          scales: commonScales(),
          plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } } },
        },
      });
    }
  }

  function updateCompareCharts(comp) {
    lastComparison = comp;
    var weeks = comp.weeks;
    var beforeDatasets = [
      { label: "Plastic", data: comp.without.plastic, backgroundColor: "rgba(200,71,63,0.45)", borderColor: "#c8473f", borderWidth: 1 },
      { label: "Organic", data: comp.without.organic, backgroundColor: "rgba(216,148,28,0.38)", borderColor: "#d8941c", borderWidth: 1 },
      { label: "E-waste", data: comp.without.ewaste, backgroundColor: "rgba(110,95,160,0.35)", borderColor: "#6e5fa0", borderWidth: 1 },
    ];
    var afterDatasets = [
      { label: "Plastic", data: comp.with.plastic, backgroundColor: "rgba(15,118,110,0.5)", borderColor: "#0f766e", borderWidth: 1 },
      { label: "Organic", data: comp.with.organic, backgroundColor: "rgba(47,143,91,0.42)", borderColor: "#2f8f5b", borderWidth: 1 },
      { label: "E-waste", data: comp.with.ewaste, backgroundColor: "rgba(26,141,132,0.34)", borderColor: "#1a8d84", borderWidth: 1 },
    ];

    var barOpts = {
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: 520, easing: "easeOutCubic" },
      scales: {
        x: { grid: { color: "rgba(24,48,43,0.08)" } },
        y: { beginAtZero: true, grid: { color: "rgba(24,48,43,0.08)" } },
      },
      plugins: { legend: { position: "bottom" } },
    };

    var c1 = document.getElementById("chart-compare-before");
    var c2 = document.getElementById("chart-compare-after");
    if (compareBeforeChart) {
      compareBeforeChart.data.labels = weeks;
      compareBeforeChart.data.datasets = beforeDatasets;
      compareBeforeChart.update("active");
    } else if (c1) {
      compareBeforeChart = new Chart(c1, { type: "bar", data: { labels: weeks, datasets: beforeDatasets }, options: barOpts });
    }
    if (compareAfterChart) {
      compareAfterChart.data.labels = weeks;
      compareAfterChart.data.datasets = afterDatasets;
      compareAfterChart.update("active");
    } else if (c2) {
      compareAfterChart = new Chart(c2, { type: "bar", data: { labels: weeks, datasets: afterDatasets }, options: barOpts });
    }
  }

  function revealComparison() {
    if (!lastComparison) return;
    comparisonHeadline.textContent =
      "Focus: " + lastComparison.focus_label + " — modeled reduction about " + lastComparison.reduction_pct + "% versus the unmitigated path";
    comparisonSection.hidden = false;
    comparisonSection.classList.remove("is-visible");
    requestAnimationFrame(function () {
      comparisonSection.classList.add("is-visible");
    });
    updateCompareCharts(lastComparison);
  }

  async function fetchWaste() {
    readouts();
    predictionWrap.classList.add("loading");
    try {
      var res = await fetch("/api/waste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plastic: parseFloat(plasticEl.value),
          organic: parseFloat(organicEl.value),
          ewaste: parseFloat(ewasteEl.value),
        }),
      });
      var payload = await res.json();
      if (!res.ok || !payload.ok) {
        throw new Error((payload && payload.error) || "Request failed");
      }
      renderStatusStrip(payload.status_strip);
      renderSolutions(payload.solutions);
      updatePredictionChart(payload);
      lastComparison = payload.comparison;
      updateFocus(lastComparison);
      if (!comparisonSection.hidden) {
        updateCompareCharts(lastComparison);
      }
    } catch (e) {
      showToast("Could not refresh data. Check connection and try again.");
      console.error(e);
    } finally {
      predictionWrap.classList.remove("loading");
    }
  }

  solutionsRoot.addEventListener("click", function (e) {
    if (e.target.classList && e.target.classList.contains("show-impact")) {
      revealComparison();
    }
  });

  presetButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setPreset(btn.dataset.preset);
    });
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      setPreset("normal");
      comparisonSection.hidden = true;
      comparisonSection.classList.remove("is-visible");
    });
  }

  [plasticEl, organicEl, ewasteEl].forEach(function (el) {
    el.addEventListener("input", function () {
      clearTimeout(fetchTimer);
      presetButtons.forEach(function (btn) {
        btn.classList.remove("is-active");
      });
      fetchTimer = setTimeout(fetchWaste, 120);
    });
  });

  applyChartDefaults();
  readouts();
  fetchWaste();

  document.addEventListener("themechange", function () {
    applyChartDefaults();
    if (predictionChart) {
      predictionChart.options.scales = commonScales();
      predictionChart.update();
    }
    if (compareBeforeChart) {
      compareBeforeChart.options.scales.x.grid.color = getThemePalette().grid;
      compareBeforeChart.options.scales.y.grid.color = getThemePalette().grid;
      compareBeforeChart.update();
    }
    if (compareAfterChart) {
      compareAfterChart.options.scales.x.grid.color = getThemePalette().grid;
      compareAfterChart.options.scales.y.grid.color = getThemePalette().grid;
      compareAfterChart.update();
    }
  });
})();
