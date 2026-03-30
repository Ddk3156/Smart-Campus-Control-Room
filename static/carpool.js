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

  var originInput = document.getElementById("cp-origin");
  var findBtn = document.getElementById("cp-find");
  var cardsRoot = document.getElementById("cp-cards");
  var resultsSection = document.getElementById("cp-results-section");
  var emptySection = document.getElementById("cp-empty");
  var impactSection = document.getElementById("cp-impact-section");
  var chartWrap = document.getElementById("cp-chart-wrap");
  var toast = document.getElementById("cp-toast");
  var matchCount = document.getElementById("cp-match-count");
  var fuelTotal = document.getElementById("cp-fuel-total");
  var co2Total = document.getElementById("cp-co2-total");
  var heroScore = document.getElementById("cp-hero-score");
  var quickOrigins = Array.prototype.slice.call(document.querySelectorAll("[data-origin]"));

  var barChart = null;

  function makeGradient(canvas, top, bottom) {
    if (!canvas || !canvas.getContext) return top;
    var ctx = canvas.getContext("2d");
    var gradient = ctx.createLinearGradient(0, 0, canvas.width || 320, 0);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    return gradient;
  }

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("is-on");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      toast.classList.remove("is-on");
    }, 4000);
  }

  function updateCollectiveChart(collective) {
    var canvas = document.getElementById("chart-carpool");
    if (!canvas) return;
    var labels = ["Fuel saved (L/mo)", "CO2 avoided (kg/mo)"];
    var data = [collective.fuel_l_month, collective.co2_kg_month];
    var ds = [
      {
        label: "Collective (all matches)",
        data: data,
        backgroundColor: [
          makeGradient(canvas, "rgba(15,118,110,0.85)", "rgba(32,205,174,0.4)"),
          makeGradient(canvas, "rgba(255,153,67,0.85)", "rgba(255,209,132,0.4)")
        ],
        borderColor: ["#0f766e", "#1a8d84"],
        borderWidth: 1,
        borderRadius: 14,
      },
    ];
    if (barChart) {
      barChart.data.labels = labels;
      barChart.data.datasets = ds;
      barChart.update("active");
    } else {
      barChart = new Chart(canvas, {
        type: "bar",
        data: { labels: labels, datasets: ds },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: true,
          animation: { duration: 600 },
          scales: {
            x: { beginAtZero: true, grid: { color: getThemePalette().grid } },
            y: { grid: { display: false } },
          },
          plugins: { legend: { display: false } },
        },
      });
    }
  }

  function renderCards(matches) {
    cardsRoot.innerHTML = "";
    matches.forEach(function (m, idx) {
      var card = document.createElement("article");
      card.className = "cp-card";
      var head = document.createElement("div");
      head.className = "cp-card-head";
      var left = document.createElement("div");
      var h = document.createElement("h3");
      h.style.margin = "0 0 4px";
      h.textContent = m.name;
      left.appendChild(h);
      var route = document.createElement("p");
      route.className = "muted small cp-route";
      route.textContent = m.from + " to " + m.to + " · " + m.time + " · " + m.seats + " seats";
      left.appendChild(route);
      head.appendChild(left);
      var score = document.createElement("span");
      score.className = "badge";
      score.textContent = m.distance_km + " km corridor";
      head.appendChild(score);
      card.appendChild(head);

      var badges = document.createElement("div");
      badges.className = "cp-badges";
      var b1 = document.createElement("span");
      b1.className = "badge";
      b1.textContent = "Fuel ≈ " + m.impact.fuel_l_month + " L/mo saved";
      var b2 = document.createElement("span");
      b2.className = "badge";
      b2.textContent = "CO2 ≈ " + m.impact.co2_kg_month + " kg/mo";
      badges.appendChild(b1);
      badges.appendChild(b2);
      card.appendChild(badges);

      var contact = document.createElement("div");
      contact.className = "cp-contact is-hidden";
      contact.id = "cp-contact-" + idx;
      contact.innerHTML =
        '<div class="cp-contact-grid">' +
        "<div><strong>Email</strong><br>" + m.contact.email + "</div>" +
        "<div><strong>Phone</strong><br>" + m.contact.phone + "</div>" +
        "<div><strong>Branch</strong><br>" + m.contact.branch + "</div>" +
        "<div><strong>Role</strong><br>" + m.contact.designation + "</div>" +
        "</div>";

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-ghost btn-small";
      btn.textContent = "Contact";
      btn.dataset.idx = String(idx);
      btn.addEventListener("click", function () {
        contact.classList.toggle("is-hidden");
        btn.textContent = contact.classList.contains("is-hidden") ? "Contact" : "Hide contact";
      });

      card.appendChild(btn);
      card.appendChild(contact);
      cardsRoot.appendChild(card);
    });
  }

  async function findMatches() {
    chartWrap.classList.add("loading");
    emptySection.hidden = true;
    resultsSection.hidden = true;
    impactSection.hidden = true;
    matchCount.textContent = "0";
    fuelTotal.textContent = "—";
    co2Total.textContent = "—";
    try {
      var res = await fetch("/api/carpool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin: originInput.value.trim() }),
      });
      var payload = await res.json();
      if (!res.ok || !payload.ok) {
        throw new Error((payload && payload.error) || "Request failed");
      }
      if (!payload.matches.length) {
        emptySection.hidden = false;
        emptySection.innerHTML =
          '<div class="empty-state"><p>No matches for that start point yet.</p><p class="small">Try a nearby area like Pimpri, Chinchwad, Nigdi, or Bopkhel heading toward campus.</p></div>';
        return;
      }
      resultsSection.hidden = false;
      impactSection.hidden = false;
      renderCards(payload.matches);
      updateCollectiveChart(payload.collective);
      matchCount.textContent = String(payload.matches.length);
      fuelTotal.textContent = payload.collective.fuel_l_month + " L";
      co2Total.textContent = payload.collective.co2_kg_month + " kg";
      if (heroScore) {
        heroScore.textContent = payload.matches.length >= 3 ? "Dense corridor" : payload.matches.length >= 2 ? "Growing cluster" : "Early match";
      }
    } catch (e) {
      console.error(e);
      showToast("Something went wrong. Please try again.");
      emptySection.hidden = false;
      emptySection.innerHTML = '<div class="empty-state">Unable to load matches. Check your connection.</div>';
    } finally {
      chartWrap.classList.remove("loading");
    }
  }

  findBtn.addEventListener("click", findMatches);
  originInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      findMatches();
    }
  });

  quickOrigins.forEach(function (btn) {
    btn.addEventListener("click", function () {
      originInput.value = btn.dataset.origin;
      findMatches();
    });
  });

  applyChartDefaults();

  document.addEventListener("themechange", function () {
    applyChartDefaults();
    if (barChart) {
      barChart.options.scales.x.grid.color = getThemePalette().grid;
      barChart.update();
    }
  });
})();
