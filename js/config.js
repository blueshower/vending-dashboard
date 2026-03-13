// ============================================================
// config.js — 全域設定檔
// ============================================================

const CONFIG = {
  // ★ Google Sheet ID（帳號管理用）
  SHEET_ID: "1jjTEOLUiOWXRgO1ZTQNl7bKCh_0tDUAc3bMWia5RXEM",

  // ★ Cloudflare Worker Proxy
  PROXY_BASE: "https://vending-proxy.blueshower-tw.workers.dev",

  // API Base 預設值（Sheet 的 path 欄優先）
  API_BASE: "https://api.tenlifeservice.com",

  // 離線判斷：超過幾分鐘算離線
  OFFLINE_MINUTES: 5,
};

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

async function callAPI(endpoint, params) {
  const session = getSession();
  if (!session) throw new Error("未登入");

  // 優先使用 session 內的 apiBase（來自 Sheet path 欄），否則用預設值
  const apiBase = session.apiBase || CONFIG.API_BASE;

  const sign = await buildSign(params, session.token);
  const query = Object.keys(params).sort()
    .map(k=>`${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join("&");

  // 透過 Cloudflare Worker Proxy 轉發
  const targetUrl = `${apiBase}${endpoint}?${query}&sign=${sign}`;
  const proxyUrl  = `${CONFIG.PROXY_BASE}?url=${encodeURIComponent(targetUrl)}`;

  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error(`API 錯誤 ${res.status}`);
  return await res.json();
}
