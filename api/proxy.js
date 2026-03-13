// api/proxy.js
export default async function handler(req, res) {
  // 1. 設定跨網域標頭 (CORS)，讓你的 GitHub Pages 網域能順利呼叫
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // 處理瀏覽器發出的 OPTIONS 預檢請求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. 解析參數
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: "Missing ?url= parameter" });
  }

  try {
    // 3. 執行請求 (Node.js 18+ 環境支援 http 與 https)
    const apiResponse = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json, text/plain, */*",
      }
    });

    const body = await apiResponse.text();

    // 4. 回傳與目標 API 相同的狀態碼與內容
    return res.status(apiResponse.status).send(body);
  } catch (err) {
    return res.status(500).json({ 
      error: "Vercel Proxy Fail", 
      message: err.message 
    });
  }
}
