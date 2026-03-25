// ============================================================
// config.js — 全域設定檔 (支援 CF/Vercel 雙代理與智慧分流)
// ============================================================

const CONFIG = {
  // ★ Google Sheet ID
  SHEET_ID: "1jjTEOLUiOWXRgO1ZTQNl7bKCh_0tDUAc3bMWia5RXEM",

  // ★ Google Apps Script 部署網址（登入 / 修改密碼 / 快取讀寫）
  GAS_URL: "https://script.google.com/macros/s/AKfycbzV6b-_nutzNUdVV9bTt_UgA61KrGpPSFea6yFO2Zv3LfLwk44IIqyWkPCbqhAOLJHp/exec",

  // ★ 代理伺服器設定
  PROXY_CF: "https://vending-proxy.blueshower-tw.workers.dev",
  PROXY_VERCEL: "https://vending-dashboard-amber.vercel.app/api/proxy",

  // API Base 預設值
  API_BASE: "https://api.tenlifeservice.com",

  // 離線判斷：超過幾分鐘算離線
  OFFLINE_MINUTES: 5,

  // 快取過期時間（分鐘），超過此時間 dashboard 提示需重整
  CACHE_TTL_MINUTES: 5,
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
  const isHttps = targetUrl.startsWith("https://");

  if (!isHttps) {
    console.log("📡 [HTTP] 使用 Vercel Proxy...");
    return await _doFetch(CONFIG.PROXY_VERCEL, targetUrl);
  }

  try {
    console.log("⚡ [HTTPS] 嘗試 Cloudflare Proxy...");
    return await _doFetch(CONFIG.PROXY_CF, targetUrl);
  } catch (err) {
    if (err.message.includes("limit") || err.message.includes("1010")) {
      console.warn("⚠️ Cloudflare 額度達上限，切換至 Vercel...");
    } else {
      console.warn("⚠️ Cloudflare 失敗，改由 Vercel 處理...", err.message);
    }
    return await _doFetch(CONFIG.PROXY_VERCEL, targetUrl);
  }
}

async function _doFetch(proxyUrl, target) {
  const res = await fetch(`${proxyUrl}?url=${encodeURIComponent(target)}`);
  if (res.status === 1010 || res.status === 429) throw new Error("Proxy limit reached");
  if (!res.ok) throw new Error(`代理伺服器回報錯誤: ${res.status}`);
  return await res.json();
}

// ============================================================
// ★ Google Sheet 快取讀寫（透過 GAS JSONP）
// ============================================================

/**
 * 取得快取索引鍵：company_user
 */
function getCacheKey() {
  const s = getSession();
  return `${s.company}_${s.user}`;
}

/**
 * 寫入快取到 localStorage
 * @param {string} sheetName 快取名稱 (cache_devices / cache_inventory / cache_sales_month / cache_sales_today)
 * @param {object} payload 要儲存的資料物件（會與 updatedAt 一同包裝）
 */
async function writeCacheToSheet(sheetName, payload) {
  const key = getCacheKey();
  const storageKey = `${key}_${sheetName}`;
  const cacheData = {
    updatedAt: new Date().toISOString(),
    data: payload,
  };
  try {
    localStorage.setItem(storageKey, JSON.stringify(cacheData));
    console.log(`✅ [writeCache] ${sheetName} 寫入 localStorage 成功`);
  } catch (e) {
    console.warn(`[writeCache] ${sheetName} 寫入失敗:`, e.message);
  }
}

/**
 * 從 localStorage 讀取快取
 * @param {string} sheetName 快取名稱
 * @returns {Promise<{ data: object, updatedAt: string } | null>}
 */
async function readCacheFromSheet(sheetName) {
  const key = getCacheKey();
  const storageKey = `${key}_${sheetName}`;
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // 回傳格式需與原本 GAS 回應一致：{ data, updatedAt }
    return { data: parsed.data, updatedAt: parsed.updatedAt };
  } catch (e) {
    console.warn(`[readCache] 解析失敗: ${sheetName}`, e);
    return null;
  }
}
/**
 * 檢查快取是否在有效期內
 * updatedAt: ISO string
 */
function isCacheValid(updatedAt) {
  if (!updatedAt) return false;
  const diff = (Date.now() - new Date(updatedAt).getTime()) / 60000;
  return diff <= CONFIG.CACHE_TTL_MINUTES;
}
