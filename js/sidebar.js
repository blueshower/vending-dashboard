// ============================================================
// sidebar.js — 注入側欄 + 頂部列（所有子頁面共用）
// ============================================================

function renderLayout(pageTitle, activePage) {
  const session = requireLogin(); // 未登入會自動跳回 login

  const nav = [
    { id: "dashboard",    label: "📊 Dashboard",      href: "dashboard.html"  },
    { id: "device",       label: "🖥️ 設備狀態",        href: "device.html"     },
    { id: "inventory",    label: "📦 庫存預訂",         href: "inventory.html"  },
    { id: "transaction",  label: "💳 本月交易",  href: "transaction_month.html"},
    { id: "transaction_today", label: "📌 今日交易",  href: "transaction_today.html"},
  ];

  const navHTML = nav.map((n) => `
    <a href="${n.href}" class="${activePage === n.id ? "active" : ""}">
      ${n.label}
    </a>
  `).join("");

  const layout = `
  <div id="loading-overlay" class="hidden">
    <div class="spinner"></div>
  </div>

  <div class="app-layout">
    <!-- 側欄 -->
    <aside class="sidebar">
      <div class="sidebar-logo">🏪 <span>販賣機</span>數據平台</div>
      <div class="sidebar-hint">(縮放或旋轉視窗取得最佳瀏覽體驗)</div>
      <nav>${navHTML}</nav>
      <div class="sidebar-footer">
        公司：${session.company}<br/>
        帳號：${session.user}
      </div>
    </aside>

    <!-- 主區 -->
    <div class="main-content">
      <div class="topbar">
        <div class="topbar-title">${pageTitle}</div>
        <div class="topbar-actions">
          <button class="btn-icon" onclick="openChangePass()">🔑 修改密碼</button>
          <button class="btn-icon" onclick="doLogout()">🚪 登出</button>
        </div>
      </div>
      <div class="page-body" id="page-body">
        <!-- 頁面內容由各頁 JS 注入 -->
      </div>
    </div>
  </div>

  <!-- 修改密碼 Modal -->
  <div class="modal-overlay hidden" id="modal-pass">
    <div class="modal-box">
      <h2>🔑 修改密碼</h2>
      <div class="form-group">
        <label>舊密碼</label>
        <input id="old-pass" type="password" placeholder="請輸入舊密碼" />
      </div>
      <div class="form-group">
        <label>新密碼</label>
        <input id="new-pass" type="password" placeholder="請輸入新密碼" />
      </div>
      <div class="form-group">
        <label>確認新密碼</label>
        <input id="cfm-pass" type="password" placeholder="再輸入一次" />
      </div>
      <p id="pass-err" style="color:#dc2626;font-size:12px;min-height:16px;"></p>
      <div class="btn-row">
        <button class="btn-secondary" onclick="closeChangePass()">取消</button>
        <button class="btn-primary" style="width:auto;padding:9px 22px;" onclick="submitChangePass()">確認修改</button>
      </div>
    </div>
  </div>
  `;

  document.body.innerHTML = layout;
}

// ── Loading 控制 ──
function showLoading(b) {
  const el = document.getElementById("loading-overlay");
  if (el) el.classList.toggle("hidden", !b);
}

// ── JSONP 呼叫 GAS ──
function callGAS(url) {
  return new Promise((resolve, reject) => {
    const cbName = "gas_cb_" + Date.now();
    const timeout = setTimeout(() => {
      delete window[cbName];
      document.getElementById("_gas_script_")?.remove();
      reject(new Error("請求逾時"));
    }, 15000);
    window[cbName] = (data) => {
      clearTimeout(timeout);
      delete window[cbName];
      document.getElementById("_gas_script_")?.remove();
      resolve(data);
    };
    const s = document.createElement("script");
    s.id = "_gas_script_";
    s.src = url + "&callback=" + cbName;
    s.onerror = () => { clearTimeout(timeout); reject(new Error("連線失敗")); };
    document.body.appendChild(s);
  });
}

// ── 登出 ──
function doLogout() {
  if (confirm("確定要登出？")) {
    clearSession();
    window.location.href = "../index.html";
  }
}

// ── 修改密碼 ──
function openChangePass() {
  document.getElementById("modal-pass").classList.remove("hidden");
}
function closeChangePass() {
  document.getElementById("modal-pass").classList.add("hidden");
  document.getElementById("pass-err").textContent = "";
}

async function submitChangePass() {
  const oldP = document.getElementById("old-pass").value.trim();
  const newP = document.getElementById("new-pass").value.trim();
  const cfm  = document.getElementById("cfm-pass").value.trim();
  const errEl = document.getElementById("pass-err");

  errEl.textContent = "";
  if (!oldP || !newP || !cfm) { errEl.textContent = "請填寫所有欄位"; return; }
  if (newP !== cfm)            { errEl.textContent = "新密碼與確認不符"; return; }

  const session = getSession();
  try {
    const url = `${CONFIG.GAS_URL}?action=changePass&company=${session.company}&user=${session.user}&oldPass=${encodeURIComponent(oldP)}&newPass=${encodeURIComponent(newP)}`;
    const data = await callGAS(url);
    if (data.success) {
      alert("密碼修改成功，請重新登入");
      clearSession();
      window.location.href = "../index.html";
    } else {
      errEl.textContent = data.message || "舊密碼錯誤";
    }
  } catch(e) {
    errEl.textContent = "連線失敗";
  }
}
