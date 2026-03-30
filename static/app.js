(function () {
  "use strict";

  var body = document.body;
  var themeToggle = document.getElementById("theme-toggle");
  var themeLabel = document.getElementById("theme-toggle-label");
  var storedTheme = null;
  try {
    storedTheme = localStorage.getItem("smart-campus-theme");
  } catch (e) {
    storedTheme = null;
  }

  function applyTheme(theme) {
    body.setAttribute("data-theme", theme);
    if (themeLabel) {
      themeLabel.textContent = theme === "light" ? "Light" : "Dark";
    }
    document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: theme } }));
  }

  applyTheme(storedTheme || "dark");

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var nextTheme = body.getAttribute("data-theme") === "light" ? "dark" : "light";
      applyTheme(nextTheme);
      try {
        localStorage.setItem("smart-campus-theme", nextTheme);
      } catch (e) {
        // ignore storage failures
      }
    });
  }

  var reveals = Array.prototype.slice.call(document.querySelectorAll(".reveal-up"));
  if ("IntersectionObserver" in window && reveals.length) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.18 });

    reveals.forEach(function (node) {
      observer.observe(node);
    });
  } else {
    reveals.forEach(function (node) {
      node.classList.add("is-visible");
    });
  }

  var tilts = Array.prototype.slice.call(document.querySelectorAll("[data-tilt]"));
  tilts.forEach(function (node) {
    node.addEventListener("mousemove", function (event) {
      var rect = node.getBoundingClientRect();
      var px = (event.clientX - rect.left) / rect.width;
      var py = (event.clientY - rect.top) / rect.height;
      var rx = (0.5 - py) * 10;
      var ry = (px - 0.5) * 12;
      node.style.setProperty("--tilt-x", rx.toFixed(2) + "deg");
      node.style.setProperty("--tilt-y", ry.toFixed(2) + "deg");
    });

    node.addEventListener("mouseleave", function () {
      node.style.setProperty("--tilt-x", "0deg");
      node.style.setProperty("--tilt-y", "0deg");
    });
  });

  var glowNodes = Array.prototype.slice.call(document.querySelectorAll(".card, .feature-card, .page-hero, .hero-dashboard, .showcase-panel"));
  glowNodes.forEach(function (node) {
    node.addEventListener("mousemove", function (event) {
      var rect = node.getBoundingClientRect();
      var x = event.clientX - rect.left;
      var y = event.clientY - rect.top;
      node.style.setProperty("--mx", x + "px");
      node.style.setProperty("--my", y + "px");
    });
  });
})();
