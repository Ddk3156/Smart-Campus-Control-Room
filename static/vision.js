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

  var input = document.getElementById("vision-image");
  var analyzeBtn = document.getElementById("vision-analyze-btn");
  var previewShell = document.getElementById("vision-preview-shell");
  var preview = document.getElementById("vision-preview");
  var toast = document.getElementById("vision-toast");
  var statusLabel = document.getElementById("vision-status-label");
  var resultTitle = document.getElementById("vision-result-title");
  var resultCopy = document.getElementById("vision-result-copy");
  var impactScore = document.getElementById("vision-impact-score");
  var confidence = document.getElementById("vision-confidence");
  var severity = document.getElementById("vision-severity");
  var metricBrightness = document.getElementById("metric-brightness");
  var metricTexture = document.getElementById("metric-texture");
  var metricGreen = document.getElementById("metric-green");
  var metricRisk = document.getElementById("metric-risk");
  var actionsList = document.getElementById("vision-actions-list");
  var chart = null;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-on");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(function () {
      toast.classList.remove("is-on");
    }, 3600);
  }

  function renderPreview(file) {
    var reader = new FileReader();
    reader.onload = function (event) {
      preview.src = event.target.result;
      previewShell.hidden = false;
    };
    reader.readAsDataURL(file);
  }

  function updateChart(mix) {
    var canvas = document.getElementById("chart-vision");
    if (!canvas) return;
    var data = {
      labels: ["Plastic", "Organic", "E-waste"],
      datasets: [{
        data: [mix.plastic, mix.organic, mix.ewaste],
        backgroundColor: ["#1ec8ab", "#f09a43", "#6a7cff"],
        borderWidth: 0,
        hoverOffset: 10,
      }],
    };

    if (chart) {
      chart.data = data;
      chart.update();
      return;
    }

    chart = new Chart(canvas, {
      type: "doughnut",
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: "64%",
        plugins: {
          legend: {
            position: "bottom",
            labels: { usePointStyle: true, boxWidth: 10 }
          }
        }
      },
    });
  }

  function renderAnalysis(analysis) {
    statusLabel.textContent = "Scan complete";
    resultTitle.textContent = analysis.label;
    resultCopy.textContent = analysis.impact_summary;
    impactScore.textContent = String(Math.round(analysis.impact_score));
    confidence.textContent = analysis.confidence + "%";
    severity.textContent = analysis.severity;
    metricBrightness.textContent = analysis.metrics.brightness;
    metricTexture.textContent = analysis.metrics.texture_complexity;
    metricGreen.textContent = analysis.metrics.green_signal + "%";
    metricRisk.textContent = analysis.metrics.handling_risk;
    actionsList.innerHTML = "";
    analysis.actions.forEach(function (action) {
      var li = document.createElement("li");
      li.textContent = action;
      actionsList.appendChild(li);
    });
    updateChart(analysis.waste_mix);
  }

  async function analyzeImage() {
    if (!input.files || !input.files[0]) {
      showToast("Please choose an image first.");
      return;
    }

    var formData = new FormData();
    formData.append("image", input.files[0]);
    statusLabel.textContent = "Analyzing image...";
    analyzeBtn.disabled = true;

    try {
      var response = await fetch("/api/vision-analyze", {
        method: "POST",
        body: formData,
      });
      var payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error((payload && payload.error) || "Image analysis failed");
      }
      renderAnalysis(payload.analysis);
    } catch (error) {
      console.error(error);
      statusLabel.textContent = "Ready to scan";
      showToast("Image analysis failed. Try another image.");
    } finally {
      analyzeBtn.disabled = false;
    }
  }

  if (input) {
    input.addEventListener("change", function () {
      if (input.files && input.files[0]) {
        renderPreview(input.files[0]);
        statusLabel.textContent = "Image loaded";
      }
    });
  }

  if (analyzeBtn) {
    analyzeBtn.addEventListener("click", analyzeImage);
  }

  applyChartDefaults();

  document.addEventListener("themechange", function () {
    applyChartDefaults();
    if (chart) {
      chart.update();
    }
  });
})();
