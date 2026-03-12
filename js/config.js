// ============================================================
// config.js — 全域設定檔
// ============================================================

const CONFIG = {
  // ★ Google Sheet ID（帳號管理用）
  SHEET_ID: "1jjTEOLUiOWXRgO1ZTQNl7bKCh_0tDUAc3bMWia5RXEM",

  // API Base — 透過 CORS Proxy 轉發
  API_BASE: "https://corsproxy.io/?https://api.tenlifeservice.com",

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
  const sign = await buildSign(params, session.token);
  const query = Object.keys(params).sort()
    .map(k=>`${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join("&");
  const url = `${CONFIG.API_BASE}${endpoint}?${query}&sign=${sign}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API 錯誤 ${res.status}`);
  return await res.json();
}
