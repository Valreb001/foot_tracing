(function () {
  "use strict";

  // ---------- Theme ----------
  const THEME_KEY = "foot-tracing-theme";
  const themeToggle = document.getElementById("theme-toggle");
  const root = document.documentElement;

  function applyTheme(theme) {
    if (theme === "light" || theme === "dark") {
      root.setAttribute("data-theme", theme);
    } else {
      root.removeAttribute("data-theme");
    }
  }

  function currentSystemTheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  (function initTheme() {
    let stored = null;
    try {
      stored = localStorage.getItem(THEME_KEY);
    } catch (e) {
      /* storage unavailable — fall back to system preference */
    }
    applyTheme(stored);
  })();

  themeToggle.addEventListener("click", () => {
    const active = root.getAttribute("data-theme") || currentSystemTheme();
    const next = active === "dark" ? "light" : "dark";
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (e) {
      /* ignore */
    }
  });

  // ---------- Step-length constants (mirrors backend) ----------
  const STEP_LENGTH_M = { male: 0.78, female: 0.70 };

  // ---------- Map setup ----------
  const DEFAULT_CENTER = [51.505, -0.09]; // fallback if location is unavailable
  const map = L.map("map").setView(DEFAULT_CENTER, 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  const liveMarker = L.circleMarker(DEFAULT_CENTER, {
    radius: 7,
    color: "#fc4c02",
    fillColor: "#fc4c02",
    fillOpacity: 1,
    weight: 2,
  });
  let livePath = [];
  let liveLine = null;
  let hasCentered = false;

  function redrawLiveLine() {
    if (liveLine) {
      map.removeLayer(liveLine);
      liveLine = null;
    }
    if (livePath.length > 1) {
      liveLine = L.polyline(livePath, { color: "#fc4c02", weight: 4 }).addTo(map);
    }
  }

  // ---------- Duration timer ----------
  let trackingStartTimestamp = null;
  let accumulatedDurationMs = 0;
  let durationIntervalId = null;
  const statDurationEl = document.getElementById("stat-duration");

  function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }

  function currentDurationMs() {
    return accumulatedDurationMs + (trackingStartTimestamp ? Date.now() - trackingStartTimestamp : 0);
  }

  function updateDurationDisplay() {
    statDurationEl.textContent = formatDuration(currentDurationMs());
  }

  function startDurationTimer() {
    if (trackingStartTimestamp) return;
    trackingStartTimestamp = Date.now();
    if (!durationIntervalId) durationIntervalId = setInterval(updateDurationDisplay, 1000);
  }

  function stopDurationTimer() {
    if (trackingStartTimestamp) {
      accumulatedDurationMs += Date.now() - trackingStartTimestamp;
      trackingStartTimestamp = null;
    }
    if (durationIntervalId) {
      clearInterval(durationIntervalId);
      durationIntervalId = null;
    }
  }

  function resetDurationTimer() {
    stopDurationTimer();
    accumulatedDurationMs = 0;
    updateDurationDisplay();
  }

  // ---------- Live tracking state ----------
  let watchId = null;
  let trackingPaused = false;
  let lastLivePoint = null;
  let liveDistanceMeters = 0;

  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");
  const toggleTrackingBtn = document.getElementById("toggle-tracking");
  const resetTrackingBtn = document.getElementById("reset-tracking");

  function setStatus(text, kind) {
    statusText.textContent = text;
    statusDot.classList.remove("status-dot--active", "status-dot--error");
    if (kind === "active") statusDot.classList.add("status-dot--active");
    if (kind === "error") statusDot.classList.add("status-dot--error");
  }

  function toRad(deg) {
    return (deg * Math.PI) / 180;
  }

  function haversineDistance(a, b) {
    const R = 6371000; // meters
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function formatDistance(meters) {
    if (meters >= 1000) {
      return (meters / 1000).toFixed(2) + " km";
    }
    return Math.round(meters) + " m";
  }

  function startTracking() {
    if (!navigator.geolocation) {
      setStatus("Location isn't available on this device.", "error");
      return;
    }

    setStatus("Locating you…", null);

    watchId = navigator.geolocation.watchPosition(onPositionUpdate, onPositionError, {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 15000,
    });
  }

  // A fix this precise or better is treated as a real GPS/Wi-Fi lock rather
  // than a coarse IP-based guess (which can be tens or hundreds of km off —
  // e.g. resolving to Lagos for a user physically in Kaduna, since Nigerian
  // ISP IP blocks often geolocate to wherever the ISP's core routing sits).
  const GOOD_ACCURACY_M = 50;

  function onPositionUpdate(pos) {
    const point = L.latLng(pos.coords.latitude, pos.coords.longitude);
    const accuracy = pos.coords.accuracy;
    const isGoodFix = typeof accuracy !== "number" || accuracy <= GOOD_ACCURACY_M;

    liveMarker.setLatLng(point).addTo(map);

    // Keep re-centering on every update until we get a trustworthy fix, so an
    // initial coarse/wrong-city guess gets corrected instead of sticking
    // forever. Once locked, stop auto-panning so it doesn't fight the user
    // while they're looking around the map mid-walk.
    if (!hasCentered) {
      map.setView(point, isGoodFix ? 16 : Math.min(map.getZoom(), 12));
      if (isGoodFix) {
        hasCentered = true;
        startDurationTimer();
      }
    }

    if (trackingPaused) return;

    if (!isGoodFix) {
      setStatus(`Refining your location (accurate to ±${formatDistance(accuracy)})…`, null);
      return;
    }

    setStatus(
      typeof accuracy === "number" ? `Tracking your steps (±${Math.round(accuracy)} m)` : "Tracking your steps",
      "active"
    );

    if (lastLivePoint) {
      const delta = haversineDistance(lastLivePoint, point);
      // Ignore tiny deltas — GPS jitter while stationary, not real movement.
      if (delta < 2) return;
      liveDistanceMeters += delta;
      lastLivePoint = point;
      livePath.push(point);
      redrawLiveLine();
    } else {
      lastLivePoint = point;
      livePath.push(point);
    }

    if (activeTab === "live") updateLiveResult();
  }

  function onPositionError(err) {
    if (err.code === err.PERMISSION_DENIED) {
      setStatus("Location permission denied — switch to “Enter distance”.", "error");
    } else {
      setStatus("Couldn't get a location fix. Retrying…", "error");
    }
  }

  function pauseTracking() {
    trackingPaused = true;
    lastLivePoint = null; // avoid one giant jump distance when resuming later
    stopDurationTimer();
    setStatus("Paused", null);
    toggleTrackingBtn.classList.add("fab--paused");
    toggleTrackingBtn.setAttribute("aria-label", "Resume tracking");
  }

  function resumeTracking() {
    trackingPaused = false;
    if (hasCentered) {
      startDurationTimer();
      setStatus("Tracking your steps", "active");
    } else {
      setStatus("Locating you…", null);
    }
    toggleTrackingBtn.classList.remove("fab--paused");
    toggleTrackingBtn.setAttribute("aria-label", "Pause tracking");
  }

  toggleTrackingBtn.addEventListener("click", () => {
    if (trackingPaused) {
      resumeTracking();
    } else {
      pauseTracking();
    }
  });

  resetTrackingBtn.addEventListener("click", () => {
    liveDistanceMeters = 0;
    lastLivePoint = null;
    livePath = [];
    redrawLiveLine();
    resetDurationTimer();
    if (activeTab === "live") {
      showPlaceholderStats();
    }
    if (!trackingPaused && hasCentered) setStatus("Tracking your steps", "active");
  });

  startTracking();

  // ---------- Tabs ----------
  const tabs = document.querySelectorAll(".tab");
  const tabsIndicator = document.getElementById("tabs-indicator");
  const panelLive = document.getElementById("panel-live");
  const panelManual = document.getElementById("panel-manual");
  let activeTab = "live";

  function moveIndicator(tabEl) {
    const index = Array.from(tabs).indexOf(tabEl);
    tabsIndicator.style.transform = `translateX(${index * 100}%)`;
  }

  function syncTabUI() {
    panelLive.classList.toggle("hidden", activeTab !== "live");
    panelManual.classList.toggle("hidden", activeTab !== "manual");
    clearError();
    if (activeTab === "live") {
      if (liveDistanceMeters > 0) {
        updateLiveResult();
      } else {
        showPlaceholderStats();
      }
    } else {
      showPlaceholderStats("Enter a distance and calculate to see your steps.");
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("tab--active"));
      tab.classList.add("tab--active");
      moveIndicator(tab);
      activeTab = tab.dataset.tab;
      syncTabUI();
    });
  });

  // ---------- Gender toggle ----------
  const genderBtns = document.querySelectorAll(".gender-toggle .pill-btn");
  let selectedGender = "male";

  genderBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      genderBtns.forEach((b) => b.classList.remove("pill-btn--active"));
      btn.classList.add("pill-btn--active");
      selectedGender = btn.dataset.gender;
      if (activeTab === "live" && liveDistanceMeters > 0) {
        updateLiveResult();
      }
    });
  });

  // ---------- Unit toggle ----------
  const unitBtns = document.querySelectorAll(".unit-toggle .pill-btn");
  let selectedUnit = "km";

  unitBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      unitBtns.forEach((b) => b.classList.remove("pill-btn--active"));
      btn.classList.add("pill-btn--active");
      selectedUnit = btn.dataset.unit;
    });
  });

  function manualDistanceInMeters() {
    const value = parseFloat(document.getElementById("manual-distance").value);
    if (!Number.isFinite(value)) return NaN;
    switch (selectedUnit) {
      case "km":
        return value * 1000;
      case "mi":
        return value * 1609.344;
      default:
        return value;
    }
  }

  // ---------- Result display ----------
  const form = document.getElementById("steps-form");
  const errorEl = document.getElementById("form-error");
  const submitBtn = document.getElementById("submit-btn");
  const stepsEl = document.getElementById("result-steps");
  const statDistanceEl = document.getElementById("stat-distance");
  const resultMetaEl = document.getElementById("result-meta");

  function showError(message) {
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
  }

  function clearError() {
    errorEl.classList.add("hidden");
    errorEl.textContent = "";
  }

  function animateSteps(target) {
    const duration = 400;
    const start = performance.now();
    const from = parseInt(stepsEl.textContent.replace(/,/g, ""), 10) || 0;

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = from + (target - from) * eased;
      stepsEl.textContent = Math.round(value).toLocaleString();
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function showPlaceholderStats(message) {
    stepsEl.textContent = "0";
    statDistanceEl.textContent = "0 m";
    statDurationEl.textContent = activeTab === "live" ? formatDuration(currentDurationMs()) : "—";
    resultMetaEl.textContent = message || "Start walking, or switch to “Enter distance”.";
  }

  function updateLiveResult() {
    const stepLength = STEP_LENGTH_M[selectedGender];
    const steps = Math.ceil(liveDistanceMeters / stepLength);
    animateSteps(steps);
    statDistanceEl.textContent = formatDistance(liveDistanceMeters);
    updateDurationDisplay();
    resultMetaEl.textContent = `${stepLength.toFixed(2)} m average step (${selectedGender})`;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();

    if (activeTab === "live") return; // live results already update themselves

    const distanceMeters = manualDistanceInMeters();

    if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
      showError("Enter a valid distance greater than zero.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Calculating…";

    try {
      const res = await fetch("/api/steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ distance_meters: distanceMeters, gender: selectedGender }),
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.error || "Something went wrong. Try again.");
        return;
      }

      animateSteps(data.steps);
      statDistanceEl.textContent = formatDistance(data.distance_meters);
      statDurationEl.textContent = "—";
      resultMetaEl.textContent = `${data.step_length_m.toFixed(2)} m average step (${selectedGender})`;
    } catch (err) {
      showError("Couldn't reach the server. Please try again.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Calculate steps";
    }
  });

  syncTabUI();
})();
