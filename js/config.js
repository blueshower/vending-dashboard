// ============================================================
// config.js — 智慧分流與故障轉移版本
// ============================================================

const CONFIG = {
  // ★ Google Sheet ID
  SHEET_ID: "1jjTEOLUiOWXRgO1ZTQNl7bKCh_0tDUAc3bMWia5RXEM",

  // ★ 代理設定
  PROXY_CF: "https://vending-proxy.blueshower-tw.workers.dev",
  PROXY_VERCEL: "https://vending-dashboard-amber.vercel.app/api/proxy",

  // API Base 預設值
  API_BASE: "https://api.tenlifeservice.com",

  // 離線判斷：超過幾分鐘算離線
  OFFLINE_MINUTES: 5
};

// --- 工具函式 ---

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function buildSign(params, token) {
  const sorted = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
  return await sha256(sorted + token);
}

function getMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
}

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function saveSession(data) { sessionStorage.setItem("session", JSON.stringify(data)); }
function getSession() { const s=sessionStorage.getItem("session"); return s?JSON.parse(s):null; }
function clearSession() { sessionStorage.removeItem("session"); }

function requireLogin() {
  const s = getSession();
  if (!s) window.location.href = "../index.html";
  return s;
}

/**
 * 核心 API 呼叫：自動判斷 Protocol 與進行故障轉移 (Failover)
 */
async function callAPI(endpoint, params) {
  const session = getSession();
  if (!session) throw new Error("未登入");

  const apiBase = session.apiBase || CONFIG.API_BASE;
  const sign = await buildSign(params, session.token);
  const query = Object.keys(params).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join("&");

  const targetUrl = `${apiBase}${endpoint}?${query}&sign=${sign}`;
  const isHttps = targetUrl.startsWith("https://");

  // 1. 如果是 http 直接走 Vercel
  if (!isHttps) {
    console.log("📡 [HTTP] 導向 Vercel 代理...");
    return await _executeFetch(CONFIG.PROXY_VERCEL, targetUrl);
  }

  // 2. 如果是 https 優先試用 Cloudflare
  try {
    console.log("⚡ [HTTPS] 嘗試 Cloudflare 代理...");
    return await _executeFetch(CONFIG.PROXY_CF, targetUrl);
  } catch (err) {
    console.warn("⚠️ Cloudflare 請求失敗或達上限，改由 Vercel 接手...", err.message);
    return await _executeFetch(CONFIG.PROXY_VERCEL, targetUrl);
  }
}

/**
 * 內部 Fetch 邏輯封裝
 */
async function _executeFetch(proxyUrl, target) {
  const res = await fetch(`${proxyUrl}?url=${encodeURIComponent(target)}`);
  
  // 處理 Cloudflare 額度爆量 (1010 或 429)
  if (res.status === 1010 || res.status === 429) {
    throw new Error("Proxy Limit Reached");
  }

  if (!res.ok) throw new Error(`API 錯誤 ${res.status}`);
  return await res.json();
}
