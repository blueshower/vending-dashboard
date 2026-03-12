// ============================================================
// config.js — 全域設定檔
// ============================================================

const CONFIG = {
  // ★ 請填入你的 Google Apps Script Web App URL
  GAS_URL: "https://script.google.com/macros/s/AKfycby1aRPw7Wjr56BFwUnWXJSQCEIW9BWIHKkHETQwOxNm2WQpxLJ-K4AezMracfrpqGYhzg/exec",

  // API Base
  API_BASE: "https://api.tenlifeservice.com",

  // 離線判斷：超過幾分鐘算離線
  OFFLINE_MINUTES: 5,
};

// ============================================================
// SHA-256 工具函式（純前端，不需安裝任何套件）
// ============================================================
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ============================================================
// 建立 sign 參數
// params: 物件 { begin, company, end, ... }（會自動 ASCII 排序）
// token:  字串
// ============================================================
async function buildSign(params, token) {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const raw = sorted + token;
  return await sha256(raw);
}

// ============================================================
// 取得當月第一天 / 今天（YYYY-MM-DD）
// ============================================================
function getMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ============================================================
// Session 存取（登入資訊暫存在 sessionStorage）
// ============================================================
function saveSession(data) {
  sessionStorage.setItem("session", JSON.stringify(data));
}

function getSession() {
  const s = sessionStorage.getItem("session");
  return s ? JSON.parse(s) : null;
}

function clearSession() {
  sessionStorage.removeItem("session");
}

// ============================================================
// 守衛：未登入就跳回 login
// ============================================================
function requireLogin() {
  const s = getSession();
  if (!s) {
    window.location.href = "../index.html";
  }
  return s;
}

// ============================================================
// 通用 API 呼叫（加上 sign）
// endpoint: "/MachineState.aspx"
// params:   物件（不含 sign）
// ============================================================
async function callAPI(endpoint, params) {
  const session = getSession();
  if (!session) throw new Error("未登入");

  const token = session.token;
  const sign = await buildSign(params, token);
  const query = Object.keys(params)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join("&");
  const url = `${CONFIG.API_BASE}${endpoint}?${query}&sign=${sign}`;

  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`API 錯誤 ${res.status}`);
  return await res.json();
}
