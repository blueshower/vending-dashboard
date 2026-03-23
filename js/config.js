// ============================================================
// config.js — 全域設定檔 (支援 CF/Vercel 雙代理與智慧分流)
// ============================================================

const CONFIG = {
  // ★ Google Sheet ID
  SHEET_ID: "1jjTEOLUiOWXRgO1ZTQNl7bKCh_0tDUAc3bMWia5RXEM",

  // ★ Google Apps Script 部署網址（登入 / 修改密碼）
  GAS_URL: "https://script.google.com/macros/s/AKfycbw9C2v6SrN3za7DAHnowQVpPrNMSnqb-R23crJ3ivLapxAQpDLJcFalvyXkKH4e2zEi/exec",

  // ★ 代理伺服器設定
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

// Session 管理
function saveSession(data) { sessionStorage.setItem("session", JSON.stringify(data)); }
function getSession() { const s=sessionStorage.getItem("session"); return s?JSON.parse(s):null; }
function clearSession() { sessionStorage.removeItem("session"); }

/**
 * 權限檢查：確保使用者已登入
 */
function requireLogin() {
  const s = getSession();
  if (!s) window.location.href = "../index.html";
  return s;
}

/**
 * 核心 API 呼叫：具備自動分流與備援功能
 */
async function callAPI(endpoint, params) {
  const session = getSession();
  if (!session) throw new Error("未登入");

  const apiBase = session.apiBase || CONFIG.API_BASE;
  const sign = await buildSign(params, session.token);
  const query = Object.keys(params).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join("&");

  const targetUrl = `${apiBase}${endpoint}?${query}&sign=${sign}`;
  
  // 判斷是否為 HTTPS
  const isHttps = targetUrl.startsWith("https://");

  // 策略 A: 如果是 http:// 直接走 Vercel，避開 Cloudflare 的限制
  if (!isHttps) {
    console.log("📡 [HTTP] 檢測到非加密連線，使用 Vercel Proxy...");
    return await _doFetch(CONFIG.PROXY_VERCEL, targetUrl);
  }

  // 策略 B: 如果是 https:// 優先走 Cloudflare，失敗則自動切換至 Vercel
  try {
    console.log("⚡ [HTTPS] 嘗試使用 Cloudflare Proxy...");
    return await _doFetch(CONFIG.PROXY_CF, targetUrl);
  } catch (err) {
    // 檢查是否為 Cloudflare 的額度限制錯誤
    if (err.message.includes("limit") || err.message.includes("1010")) {
      console.warn("⚠️ Cloudflare 額度已達上限，自動切換至 Vercel 備援...");
    } else {
      console.warn("⚠️ Cloudflare 請求失敗，改由 Vercel 處理...", err.message);
    }
    return await _doFetch(CONFIG.PROXY_VERCEL, targetUrl);
  }
}

/**
 * 實際執行網路請求的封裝
 */
async function _doFetch(proxyUrl, target) {
  const res = await fetch(`${proxyUrl}?url=${encodeURIComponent(target)}`);
  
  // Cloudflare 免費版上限時會回傳 1010 或 429
  if (res.status === 1010 || res.status === 429) {
    throw new Error("Proxy limit reached");
  }

  if (!res.ok) throw new Error(`代理伺服器回報錯誤: ${res.status}`);
  
  return await res.json();
}
