// 有些站（Carrefour、AH）会按 TLS 指纹和请求头挡掉裸 fetch，
// 这些站统一走真实浏览器。Playwright 按需启动，用完关掉。
let _browser = null;

async function browser() {
  if (_browser) return _browser;
  const { chromium } = await import('playwright');
  _browser = await chromium.launch({ args: ['--disable-blink-features=AutomationControlled'] });
  return _browser;
}

export async function closeBrowser() {
  if (_browser) { await _browser.close(); _browser = null; }
}

async function newContext() {
  const b = await browser();
  return b.newContext({
    locale: 'nl-BE',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: { 'Accept-Language': 'nl-BE,nl;q=0.9,en;q=0.8' },
  });
}

/** 用浏览器取一个页面的 HTML（JS 渲染的内容也在里面） */
export async function fetchHTML(url, { waitFor = 'domcontentloaded', settle = 1200 } = {}) {
  const ctx = await newContext();
  try {
    const page = await ctx.newPage();
    const res = await page.goto(url, { waitUntil: waitFor, timeout: 45000 });
    if (res && res.status() >= 400) throw new Error(`HTTP ${res.status()}`);
    await page.waitForTimeout(settle);
    return await page.content();
  } finally { await ctx.close(); }
}

/** 在浏览器里发请求，带上页面的 cookie 和同源身份 —— 用来调那些认 referer/cookie 的接口 */
export async function fetchJSON(url, { origin, headers = {} } = {}) {
  const ctx = await newContext();
  try {
    const page = await ctx.newPage();
    if (origin) await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 45000 });
    return await page.evaluate(async ([u, h]) => {
      const r = await fetch(u, { headers: h, credentials: 'include' });
      const t = await r.text();
      try { return { status: r.status, json: JSON.parse(t) }; }
      catch { return { status: r.status, text: t.slice(0, 500) }; }
    }, [url, headers]);
  } finally { await ctx.close(); }
}

/** 打开页面，把它自己调的 XHR/fetch 接口抓出来 —— 用来摸未知接口 */
export async function sniff(url, { match = /api|graphql|bonus|promo|product/i, settle = 5000, capture = true } = {}) {
  const ctx = await newContext();
  const hits = [];
  try {
    const page = await ctx.newPage();
    page.on('response', async (r) => {
      const u = r.url();
      if (!match.test(u) || !['xhr', 'fetch'].includes(r.request().resourceType())) return;
      const hit = { status: r.status(), method: r.request().method(), url: u };
      if (capture && r.status() < 400) {
        try {
          const body = await r.text();
          hit.bytes = body.length;
          hit.preview = body.slice(0, 300);
          try { hit.keys = Object.keys(JSON.parse(body)).join(', '); } catch {}
        } catch {}
      }
      hits.push(hit);
    });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(settle);
  } finally { await ctx.close(); }
  return hits;
}
