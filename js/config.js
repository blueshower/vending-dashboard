// ============================================================
// config.js — 全域設定檔 (支援 CF/Vercel 雙代理與故障轉移)
// ============================================================

const CONFIG = {
  // ★ Google Sheet ID
  SHEET_ID: "1jjTEOLUiOWXRgO1ZTQNl7bKCh_0tDUAc3bMWia5RXEM",

  // ★ 代理設定
  PROXY_CF: "https://vending-proxy.blueshower-tw.workers.dev",
  PROXY_VERCEL: "https://vending-dashboard-amber.vercel.app/api/proxy", // 這是你剛部署成功的網址

  // API Base 預設值
  API_BASE: "https://api.tenlifeservice.com",

  // 離線判斷
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

// 權限檢查函式
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
    .map(k=>`${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join("&");

  const targetUrl = `${apiBase}${endpoint}?${query}&sign=${sign}`;
  const isHttps = targetUrl.startsWith("https://");

  // 分流邏輯
  if (!isHttps) {
    console.log("📡 [HTTP] 使用 Vercel 代理...");
    return await _doFetch(CONFIG.PROXY_VERCEL, targetUrl);
  }

  try {
    console.log("⚡ [HTTPS] 嘗試 Cloudflare 代理...");
    return await _doFetch(CONFIG.PROXY_CF, targetUrl);
  } catch (err) {
    console.warn("⚠️ Cloudflare 失敗，轉向 Vercel 備援...", err.message);
    return await _doFetch(CONFIG.PROXY_VERCEL, targetUrl);
  }
}

async function _doFetch(proxyUrl, target) {
  const res = await fetch(`${proxyUrl}?url=${encodeURIComponent(target)}`);
  if (res.status === 1010 || res.status === 429) throw new Error("Limit Reached");
  if (!res.ok) throw new Error(`API 錯誤 ${res.status}`);
  return await res.json();
}
