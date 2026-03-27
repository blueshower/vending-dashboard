// ============================================================
// config.js — 全域設定檔 (支援 CF/Vercel 雙代理與智慧分流)
// v2: 新增大型資料分塊寫入/讀取，解決 localStorage 5MB 限制
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
  CACHE_TTL_MINUTES: 30,

  // ★ 每塊最多幾筆（控制單一 localStorage key 大小）
  // 3~4 萬筆 × 精簡後每筆約 200 bytes = ~8MB → 分成 80 塊每塊 500 筆，每塊 ~100KB
  CHUNK_SIZE: 500,
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
// ★ localStorage 快取讀寫（支援大型資料自動分塊）
// ============================================================
//
// 【設計說明】
//   localStorage 單一 key 上限約 5MB（各瀏覽器略異）。
//   3~4 萬筆交易序列化後可能達 15~50MB，直接寫入必然失敗。
//
//   解法：分塊儲存（Chunking）
//   ┌─────────────────────────────────────────────────────┐
//   │  {storageKey}_index   ← 記錄塊數、updatedAt、metadata │
//   │  {storageKey}_chunk_0 ← 第 0~499 筆                 │
//   │  {storageKey}_chunk_1 ← 第 500~999 筆               │
//   │  ...                                                │
//   └─────────────────────────────────────────────────────┘
//   讀取時先查 index，再逐塊讀取重組成完整陣列。
//
//   另外：精簡欄位（_slimSales）可將每筆 ~1KB 壓縮至 ~200B，
//   大幅降低所需塊數與寫入時間。
// ============================================================

/**
 * 取得快取索引鍵前綴：company_user
 */
function getCacheKey() {
  const s = getSession();
  return `${s.company}_${s.user}`;
}

/**
 * 將陣列均分成多塊
 */
function _chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * 清除某個 storageKey 的所有舊分塊與 index
 * 同時相容舊版單一 key 格式
 */
function _clearChunks(storageKey) {
  try {
    const idx = JSON.parse(localStorage.getItem(`${storageKey}_index`) || "null");
    if (idx && idx.chunks) {
      for (let i = 0; i < idx.chunks; i++) {
        localStorage.removeItem(`${storageKey}_chunk_${i}`);
      }
    }
  } catch(e) { /* ignore */ }
  localStorage.removeItem(`${storageKey}_index`);
  localStorage.removeItem(storageKey); // 清除舊版格式
}

/**
 * 精簡 sales 陣列欄位，只保留頁面實際使用到的欄位
 * 可將每筆資料從 ~1KB 壓縮至 ~150~250B（節省 70~85%）
 */
function _slimSales(sales) {
  return sales.map(s => ({
    time:          s.time,
    code:          s.code,
    name:          s.name,
    commodityName: s.commodityName,
    layer:         s.layer,
    price:         s.price,
    state:         s.state,
    detail:        s.detail,
  }));
}

/**
 * 嘗試清除最舊的快取 key 以騰出空間（簡易 LRU）
 */
function _evictOldestCache() {
  const indexKeys = Object.keys(localStorage).filter(k => k.endsWith("_index"));
  if (indexKeys.length === 0) return;

  let oldestKey = null, oldestTime = Infinity;
  indexKeys.forEach(k => {
    try {
      const t = new Date(JSON.parse(localStorage.getItem(k))?.updatedAt || 0).getTime();
      if (t < oldestTime) { oldestTime = t; oldestKey = k; }
    } catch(e) { /* ignore */ }
  });

  if (oldestKey) {
    const base = oldestKey.replace(/_index$/, "");
    try {
      const idx = JSON.parse(localStorage.getItem(oldestKey));
      for (let i = 0; i < (idx?.chunks || 0); i++) {
        localStorage.removeItem(`${base}_chunk_${i}`);
      }
    } catch(e) { /* ignore */ }
    localStorage.removeItem(oldestKey);
    console.log(`🗑️ [evict] 已清除最舊快取: ${oldestKey}`);
  }
}

/**
 * 寫入快取到 localStorage（自動分塊，支援大型資料）
 *
 * @param {string} sheetName  快取名稱，例如 "cache_sales_month"
 * @param {object} payload    要儲存的資料物件
 *
 * 若 payload.sales 或 payload.inventory 是大陣列（> CHUNK_SIZE），
 * 將自動啟用分塊模式；其餘小型資料仍走單一 key。
 */
async function writeCacheToSheet(sheetName, payload) {
  const key = getCacheKey();
  const storageKey = `${key}_${sheetName}`;

  // 先清除舊資料，避免殘留舊分塊
  _clearChunks(storageKey);

  // 判斷是否有需要分塊的大陣列
  const bigArrayKey = ["sales", "inventory"].find(
    k => Array.isArray(payload[k]) && payload[k].length > CONFIG.CHUNK_SIZE
  );

  // ── 小型資料：單一 key 直接寫入 ──
  if (!bigArrayKey) {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        updatedAt: new Date().toISOString(),
        data: payload,
      }));
      console.log(`✅ [writeCache] ${sheetName} 寫入成功（單一 key）`);
    } catch(e) {
      console.warn(`[writeCache] ${sheetName} 寫入失敗:`, e.message);
    }
    return;
  }

  // ── 大型資料：精簡欄位 → 分塊寫入 ──
  const bigArr = payload[bigArrayKey];
  const slim   = (bigArrayKey === "sales") ? _slimSales(bigArr) : bigArr;
  const chunks = _chunkArray(slim, CONFIG.CHUNK_SIZE);
  const updatedAt = new Date().toISOString();

  // 寫入 index（僅含 metadata，不含資料本體）
  const indexPayload = {
    updatedAt,
    chunks: chunks.length,
    total:  slim.length,
    bigArrayKey,
    // 其他非陣列欄位（company、updatedAt 等）一起存入 index
    meta: Object.fromEntries(
      Object.entries(payload).filter(([k]) => k !== bigArrayKey)
    ),
  };

  try {
    localStorage.setItem(`${storageKey}_index`, JSON.stringify(indexPayload));
  } catch(e) {
    console.warn(`[writeCache] ${sheetName} index 寫入失敗:`, e.message);
    return;
  }

  // 逐塊寫入，失敗時嘗試清理後重試
  let failedChunk = -1;
  for (let i = 0; i < chunks.length; i++) {
    try {
      localStorage.setItem(`${storageKey}_chunk_${i}`, JSON.stringify(chunks[i]));
    } catch(e) {
      console.warn(`[writeCache] ${sheetName} chunk_${i} 空間不足，嘗試清理後重試…`);
      _evictOldestCache();
      try {
        localStorage.setItem(`${storageKey}_chunk_${i}`, JSON.stringify(chunks[i]));
      } catch(e2) {
        console.error(`[writeCache] ${sheetName} chunk_${i} 重試失敗，放棄。`);
        failedChunk = i;
        break;
      }
    }
  }

  if (failedChunk === -1) {
    console.log(`✅ [writeCache] ${sheetName} 分塊完成（${chunks.length} 塊，${slim.length} 筆，已精簡欄位）`);
  } else {
    console.warn(`⚠️ [writeCache] ${sheetName} 在第 ${failedChunk} 塊中斷，快取不完整`);
  }
}

/**
 * 從 localStorage 讀取快取（自動重組分塊）
 *
 * @param {string} sheetName  快取名稱
 * @returns {Promise<{ data: object, updatedAt: string } | null>}
 */
async function readCacheFromSheet(sheetName) {
  const key = getCacheKey();
  const storageKey = `${key}_${sheetName}`;

  // ── 優先：分塊格式（v2）──
  const rawIndex = localStorage.getItem(`${storageKey}_index`);
  if (rawIndex) {
    try {
      const { updatedAt, chunks, bigArrayKey, meta } = JSON.parse(rawIndex);

      const allItems = [];
      for (let i = 0; i < chunks; i++) {
        const raw = localStorage.getItem(`${storageKey}_chunk_${i}`);
        if (!raw) {
          console.warn(`[readCache] ${sheetName} chunk_${i} 遺失，快取視為無效`);
          return null;
        }
        allItems.push(...JSON.parse(raw));
      }

      const data = { ...meta, [bigArrayKey]: allItems, updatedAt };
      console.log(`📦 [readCache] ${sheetName} 分塊讀取（${chunks} 塊，${allItems.length} 筆）`);
      return { data, updatedAt };

    } catch(e) {
      console.warn(`[readCache] ${sheetName} 分塊解析失敗:`, e);
      return null;
    }
  }

  // ── 備援：舊版單一 key 格式 ──
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return { data: parsed.data, updatedAt: parsed.updatedAt };
  } catch(e) {
    console.warn(`[readCache] 解析失敗: ${sheetName}`, e);
    return null;
  }
}

/**
 * 檢查快取是否在有效期內
 */
function isCacheValid(updatedAt) {
  if (!updatedAt) return false;
  const diff = (Date.now() - new Date(updatedAt).getTime()) / 60000;
  return diff <= CONFIG.CACHE_TTL_MINUTES;
}

/**
 * 快取使用量報告（開發除錯用）
 * 在瀏覽器 console 呼叫 debugCacheUsage() 即可查看
 */
function debugCacheUsage() {
  let total = 0;
  const report = {};
  Object.keys(localStorage).forEach(k => {
    const size = (localStorage.getItem(k) || "").length * 2; // UTF-16 bytes
    total += size;
    const group = k.replace(/_chunk_\d+$/, "").replace(/_index$/, "");
    report[group] = (report[group] || 0) + size;
  });
  console.table(
    Object.entries(report)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ key: k, "size (KB)": (v/1024).toFixed(1) }))
  );
  console.log(`📊 localStorage 總用量：${(total/1024/1024).toFixed(2)} MB`);
}
