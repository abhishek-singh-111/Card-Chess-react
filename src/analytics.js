// src/analytics.js (CRA-compatible)
// Lightweight wrapper for GA4 + Mixpanel with anonymous identity, SPA pageviews, and timers.
import mixpanel from "mixpanel-browser";

// ---- Read env (CRA uses REACT_APP_*) ----
const GA_ID = "G-RXBPVYS969"; // e.g. G-XXXXXXX
const MIXPANEL_TOKEN = "6f0f8171fc410b786f8a1dbcea3aa4d6"; // public browser token

// --- anonymous id (no PII) ---
const ANON_KEY = "cc_anon_id";
function getAnonId() {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id =
        (crypto && crypto.randomUUID && crypto.randomUUID()) ||
        Math.random().toString(36).slice(2);
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return "anon_" + Math.random().toString(36).slice(2);
  }
}
const anonId = getAnonId();

// --- GA loader ---
function loadGA() {
  if (!GA_ID) return;
  if (window.gtag) return; // already loaded
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag(){window.dataLayer.push(arguments);}
  window.gtag = gtag;
  gtag("js", new Date());
  // disable auto page_view, we’ll send manually
  gtag("config", GA_ID, { send_page_view: false });
}

// --- Mixpanel init ---
function initMixpanel() {
  if (!MIXPANEL_TOKEN) return;
  if (window.__mixpanel_inited) return;
  mixpanel.init(MIXPANEL_TOKEN, { persistence: "localStorage", track_pageview: false });
  mixpanel.identify(anonId);
  mixpanel.register_once({ first_visit: new Date().toISOString() });
  window.__mixpanel_inited = true;
}

// --- public API ---
function init() {
  loadGA();
  initMixpanel();
}

function gaEvent(name, params = {}) {
  if (!window.gtag || !GA_ID) return;
  window.gtag("event", name, {
    ...params,
    // do not send PII
  });
}

function mpEvent(name, params = {}) {
  if (!MIXPANEL_TOKEN) return;
  mixpanel.track(name, { ...params, anonId });
}

export function track(name, params = {}) {
  try {
    gaEvent(name, params);
    mpEvent(name, params);
  } catch (e) {
    // ignore
  }
}

export function trackPageView(path) {
  try {
    if (window.gtag && GA_ID) {
      window.gtag("event", "page_view", {
        page_location: window.location.href,
        page_path: path,
      });
    }
    if (MIXPANEL_TOKEN) {
      mixpanel.track("page_view", { path });
    }
  } catch {}
}

const timers = new Map();
export function startTimer(label) {
  timers.set(label, performance.now());
}
export function endTimer(label, extra = {}) {
  const start = timers.get(label);
  if (!start) return;
  const duration = Math.round(performance.now() - start);
  timers.delete(label);
  track("engagement", { label, engagement_time_msec: duration, ...extra });
  // best-effort flush on unload (no-op endpoint)
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify({ label, engagement_time_msec: duration, ...extra })], { type: "application/json" });
      navigator.sendBeacon("/__noop", blob);
    }
  } catch {}
}

export const analytics = { init, track, trackPageView, startTimer, endTimer, anonId };
export default analytics;
