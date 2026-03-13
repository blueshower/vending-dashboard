// ============================================================
// config.js — 智慧分流與故障轉移版本
// ============================================================

const CONFIG = {
  SHEET_ID: "1jjTEOLUiOWXRgO1ZTQNl7bKCh_0tDUAc3bMWia5RXEM",

  // ★ 代理設定
  PROXY_CF: "https://vending-proxy.blueshower-tw.workers.dev",
  PROXY_VERCEL: "https://vending-dashboard-amber.vercel.app/api/proxy"

  API_BASE: "https://api.tenlifeservice.com",
  OFFLINE_MINUTES: 5,
};

// 工具函式 (保持原樣)
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

// Session 管理 (保持原樣)
function saveSession(data) { sessionStorage.setItem("session", JSON.stringify(data)); }
function getSession() { const s=sessionStorage.getItem("session"); return s?JSON.parse(s):null; }
function clearSession() { sessionStorage.removeItem("session"); }

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

  // 1. 如果是 http 直接走 Vercel (Cloudflare 不支援)
  if (!isHttps) {
    console.log("📡 [HTTP] 導向 Vercel 代理...");
    return await executeFetch(CONFIG.PROXY_VERCEL, targetUrl);
  }

  // 2. 如果是 https 優先試用 Cloudflare
  try {
    console.log("⚡ [HTTPS] 嘗試 Cloudflare 代理...");
    return await executeFetch(CONFIG.PROXY_CF, targetUrl);
  } catch (err) {
    // 若 Cloudflare 回傳 429 (太多請求) 或 1010 (受限)，觸發降級機制
    if (err.message.includes("1010") || err.message.includes("429")) {
      console.warn("🚀 Cloudflare 次數達上限，切換至 Vercel 備援...");
    } else {
      console.warn("⚠️ Cloudflare 請求失敗，改由 Vercel 接手...", err.message);
    }
    return await executeFetch(CONFIG.PROXY_VERCEL, targetUrl);
  }
}

/**
 * 內部的 Fetch 邏輯封裝
 */
async function executeFetch(proxyBase, target) {
  const res = await fetch(`${proxyBase}?url=${encodeURIComponent(target)}`);

  // Cloudflare 流量超標的特定狀態碼
  if (res.status === 1010 || res.status === 429) {
    throw new Error(`Proxy Limit Reached (${res.status})`);
  }

  if (!res.ok) throw new Error(`代理服務異常: ${res.status}`);
  
  return await res.json();
}
