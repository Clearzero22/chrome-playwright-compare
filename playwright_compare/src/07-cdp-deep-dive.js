/**
 * CDP 深入实战 —— 直接操控用户 Chrome 的完整示例
 *
 * 绕过 Playwright/Puppeteer，通过 CDP 协议直接控制浏览器。
 * 适合：连接用户正在使用的 Chrome，操作已有标签页。
 *
 * 前提：Chrome 需要以 --remote-debugging-port=9222 启动
 */

const WebSocket = require('ws');
const http = require('http');

// ─── 辅助函数 ───────────────────────────────────────────────────────

/** 获取 Chrome 的 WebSocket 端点 */
function getWsEndpoint(port = 9222) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data).webSocketDebuggerUrl));
    }).on('error', reject);
  });
}

/** 获取所有标签页 */
function getTabs(port = 9222) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/json`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

/** 发送 CDP 命令 */
function sendCdp(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Date.now();
    ws.send(JSON.stringify({ id, method, params }));
    const handler = (data) => {
      const resp = JSON.parse(data.toString());
      if (resp.id === id) {
        ws.removeListener('message', handler);
        resolve(resp);
      }
    };
    ws.on('message', handler);
    setTimeout(() => { ws.removeListener('message', handler); reject(new Error('timeout')); }, 10000);
  });
}

// ─── 主流程 ─────────────────────────────────────────────────────────

(async () => {
  // 1. 获取 WebSocket 端点（连接到浏览器本身，而非某个标签页）
  const browserWs = await getWsEndpoint();
  console.log('🔗 浏览器 WebSocket:', browserWs);

  // 2. 连接到浏览器
  const browserSocket = new WebSocket(browserWs);

  await new Promise((resolve, reject) => {
    browserSocket.on('open', resolve);
    browserSocket.on('error', reject);
  });
  console.log('✅ 已连接到 Chrome');

  // 3. 获取所有标签页
  const tabs = await getTabs();
  console.log(`📑 打开的标签页: ${tabs.length}`);
  tabs.forEach((t, i) => {
    console.log(`   [${i}] ${t.title || '(空)'} — ${t.url}`);
  });

  if (tabs.length === 0) {
    console.log('❌ 没有可操作的标签页');
    browserSocket.close();
    return;
  }

  // 4. 选择第一个普通网页标签页（跳过 chrome:// 和 chrome-extension://）
  const pageTab = tabs.find(t =>
    t.url.startsWith('http://') || t.url.startsWith('https://')
  ) || tabs.find(t =>
    t.url.startsWith('chrome://newtab')
  ) || tabs[0];

  const tabWs = new WebSocket(pageTab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    tabWs.on('open', resolve);
    tabWs.on('error', reject);
  });
  console.log(`\n📌 操控标签页: ${pageTab.title || 'New Tab'} — ${pageTab.url}`);

  // 5. 启用必要 domain
  try {
    await sendCdp(tabWs, 'Page.enable');
  } catch {
    console.log('⚠️ Page.enable 不可用（可能是扩展页面）');
  }
  await sendCdp(tabWs, 'Runtime.enable');

  // 6. 获取页面标题
  const titleResult = await sendCdp(tabWs, 'Runtime.evaluate', {
    expression: 'document.title',
  });
  console.log('📰 当前页面标题:', titleResult.result?.result?.value);

  // 7. 注入 JavaScript（修改页面）
  await sendCdp(tabWs, 'Page.addScriptToEvaluateOnNewDocument', {
    source: `
      console.log('🔵 CDP 注入脚本已执行');
      // 覆盖 webdriver 标志
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    `,
  });
  console.log('💉 Stealth 脚本已注入（下次页面加载生效）');

  // 8. 执行 JS（在当前页面实时生效）
  const evalResult = await sendCdp(tabWs, 'Runtime.evaluate', {
    expression: `
      (() => {
        return {
          webdriver: navigator.webdriver,
          url: location.href,
          userAgent: navigator.userAgent,
          cookies: document.cookie
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('\n📊 当前页面状态:');
  console.table(evalResult.result?.result?.value);

  // 9. 导航到新页面（用户会看到标签页跳转）
  console.log('\n🔄 导航到 example.com...');
  await sendCdp(tabWs, 'Page.navigate', { url: 'https://example.com' });

  // 等待页面加载
  await new Promise(r => setTimeout(r, 3000));

  const newTitle = await sendCdp(tabWs, 'Runtime.evaluate', {
    expression: 'document.title',
  });
  console.log('📰 新页面标题:', newTitle.result?.result?.value);

  // 10. 获取页面截图（base64）
  const screenshot = await sendCdp(tabWs, 'Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
  });
  if (screenshot.result?.result?.data) {
    console.log(`📸 截图已获取 (${Math.round(screenshot.result.result.data.length * 0.75 / 1024)} KB)`);
  }

  // 清理
  tabWs.close();
  browserSocket.close();
  console.log('\n✅ CDP 演示完成');
})();
