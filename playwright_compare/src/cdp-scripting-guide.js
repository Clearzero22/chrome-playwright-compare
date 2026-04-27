/**
 * CDP 脚本编写完全指南
 *
 * CDP = Chrome DevTools Protocol
 * Playwright/Puppeteer 底层用的都是 CDP，本文直接操作 CDP 协议。
 *
 * ─── 核心概念 ───
 * 1. 连接到浏览器 WebSocket 端点
 * 2. 发送 { id, method, params } 格式的命令
 * 3. 接收 { id, result } 格式的响应
 * 4. 通过 domain 组织功能（Page、Runtime、Network、DOM 等）
 */

const WebSocket = require('ws');
const http = require('http');
const util = require('util');

// ═══════════════════════════════════════════════════════════════════
// 第一部分：基础设施
// ═══════════════════════════════════════════════════════════════════

/** 获取浏览器 WebSocket 端点 */
async function getBrowserWs(port = 9222) {
  const data = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/json/version`, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
  return data.webSocketDebuggerUrl;
}

/** 获取所有标签页 */
async function getTabs(port = 9222) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/json`, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

/** 打开新标签页（CDP HTTP API） */
async function openNewTab(url, port = 9222) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1', port, path: `/json/new?${encodeURIComponent(url)}`,
      method: 'PUT',
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.end();
  });
}

/** 关闭标签页 */
async function closeTab(tabId, port = 9222) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1', port, path: `/json/close/${tabId}`,
      method: 'PUT',
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.end();
  });
}

/** 连接到 tab 的 WebSocket，返回 { ws, cdp } */
function connectTab(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.on('open', () => {
      // cdp 命令函数（绑定到该连接）
      const cdp = (method, params = {}) => {
        return new Promise((resolveCmd, rejectCmd) => {
          const id = Date.now() + Math.random() * 10000;
          ws.send(JSON.stringify({ id, method, params }));

          const handler = data => {
            const resp = JSON.parse(data.toString());
            if (resp.id === id) {
              ws.removeListener('message', handler);
              // CDP 错误
              if (resp.error) {
                rejectCmd(new Error(`CDP error: ${resp.error.message} (code: ${resp.error.code})`));
              } else {
                resolveCmd(resp.result);
              }
            }
          };
          ws.on('message', handler);
          setTimeout(() => {
            ws.removeListener('message', handler);
            rejectCmd(new Error(`CDP timeout: ${method}`));
          }, 15000);
        });
      };
      resolve({ ws, cdp });
    });
    ws.on('error', reject);
  });
}

// ═══════════════════════════════════════════════════════════════════
// 第二部分：CDP 命令速查
// ═══════════════════════════════════════════════════════════════════

/**
 * CDP 命令结构：
 *
 * 发送 →   { id: 1, method: 'Domain.action', params: { ... } }
 * 接收 ←   { id: 1, result: { ... } }
 *
 * 事件 ←   { method: 'Domain.eventName', params: { ... } }
 */

// ─── 最常用的 Domain 和命令 ───

/*
 * Page —— 页面控制
 *   Page.navigate({ url })                        导航
 *   Page.reload({ ignoreCache: true })             刷新
 *   Page.captureScreenshot({ format: 'png' })      截图
 *   Page.printToPDF({})                            导出 PDF
 *   Page.addScriptToEvaluateOnNewDocument({ source }) 注入脚本
 *   Page.enable()                                 启用 Page 事件
 *
 * Runtime —— JavaScript 执行
 *   Runtime.evaluate({ expression, returnByValue }) 执行 JS
 *   Runtime.consoleAPICalled                       控制台事件
 *
 * DOM —— DOM 操作
 *   DOM.getDocument()                             获取 DOM 树
 *   DOM.querySelector({ nodeId, selector })        查找元素
 *   DOM.getOuterHTML({ nodeId })                   获取 HTML
 *
 * Network —— 网络拦截
 *   Network.enable()                              启用网络监控
 *   Network.setBlockedURLs({ urls })              屏蔽资源
 *   Network.setUserAgentOverride({ userAgent })   修改 UA
 *
 * Input —— 模拟输入
 *   Input.dispatchMouseEvent({ type, x, y })      鼠标事件
 *   Input.dispatchKeyEvent({ type, text })        键盘事件
 *
 * Emulation —— 模拟
 *   Emulation.setDeviceMetricsOverride({ width, height })  设备模拟
 *   Emulation.setGeolocationOverride({ latitude, longitude })  位置模拟
 *   Emulation.setLocaleOverride({ locale })                 语言模拟
 *
 * Browser —— 浏览器级操作
 *   Browser.getVersion()                           获取版本
 *   Browser.setDownloadBehavior({ behavior })      下载策略
 *
 * Target —— 标签管理
 *   Target.getTargets()                            获取所有目标
 *   Target.createTarget({ url })                   创建新标签
 */

// ═══════════════════════════════════════════════════════════════════
// 第三部分：实战示例
// ═══════════════════════════════════════════════════════════════════

async function example0_connectAndList() {
  /** 示例 0：连接并列出所有标签 */
  const tabs = await getTabs();
  console.log(`打开的标签: ${tabs.length}`);
  tabs.forEach((t, i) => console.log(`  [${i}] ${t.title} — ${t.url.slice(0, 60)}`));
}

async function example1_createTab() {
  /** 示例 1：用 HTTP API 开新标签 */
  // PUT /json/new?url=https://example.com 是最简单的方式
  const tab = await openNewTab('https://example.com');
  console.log('新标签:', tab.id, tab.url);
  return tab;
}

async function example2_navigateExistingTab() {
  /**
   * 示例 2：在已有的标签页中导航（用 CDP WebSocket）
   *
   * 场景：用户正在看 A 页面，脚本让它跳到 B 页面
   */
  const tabs = await getTabs();
  const target = tabs.find(t => t.url.startsWith('http'));
  if (!target) throw new Error('没有可用的网页标签');

  const { cdp, ws } = await connectTab(target.webSocketDebuggerUrl);

  // 启用 Page 和 Runtime domain（必须先 enable 才能用）
  await cdp('Page.enable');
  await cdp('Runtime.enable');

  // 导航
  const navResult = await cdp('Page.navigate', { url: 'https://www.amazon.com' });
  console.log('导航结果, frameId:', navResult.frameId);

  // 等待页面加载（监听 Page.frameStoppedLoading 事件更准确）
  await new Promise(r => setTimeout(r, 3000));

  // 获取页面标题
  const title = await cdp('Runtime.evaluate', {
    expression: 'document.title',
    returnByValue: true,
  });
  console.log('页面标题:', title.result.value);

  // 获取页面文本
  const bodyText = await cdp('Runtime.evaluate', {
    expression: 'document.body.innerText.substring(0, 200)',
    returnByValue: true,
  });
  console.log('页面文本:', bodyText.result.value.substring(0, 100) + '...');

  ws.close();
}

async function example3_injectScript() {
  /**
   * 示例 3：注入 Stealth 脚本
   *
   * 注意：addScriptToEvaluateOnNewDocument 只在"新文档"加载时执行
   * 对当前页面要用 Runtime.evaluate 实时注入
   */
  const tabs = await getTabs();
  const target = tabs.find(t => t.url.startsWith('http'));
  if (!target) throw new Error('No tab');

  const { cdp, ws } = await connectTab(target.webSocketDebuggerUrl);
  await cdp('Runtime.enable');

  // 当前页面注入
  await cdp('Runtime.evaluate', {
    expression: `
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.chrome = window.chrome || {};
      window.chrome.runtime = {};
    `,
  });

  console.log('✅ Stealth 脚本已注入当前页面');

  // 验证
  const check = await cdp('Runtime.evaluate', {
    expression: 'navigator.webdriver',
    returnByValue: true,
  });
  console.log('navigator.webdriver =', check.result.value);

  ws.close();
}

async function example4_takeScreenshot() {
  /**
   * 示例 4：截图
   */
  const tabs = await getTabs();
  const target = tabs.find(t => t.url.startsWith('http'));
  if (!target) throw new Error('No tab');

  const { cdp, ws } = await connectTab(target.webSocketDebuggerUrl);
  await cdp('Page.enable');

  const result = await cdp('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
  });
  console.log(`截图已获取 (${Math.round(result.data.length * 0.75 / 1024)} KB)`);
  // result.data 是 base64 编码的图片

  ws.close();
}

async function example5_domQuery() {
  /**
   * 示例 5：用 DOM domain 操作页面元素
   *
   * CDP 的 DOM domain 可以：
   * - 获取完整 DOM 树
   * - 用 CSS 选择器查找元素
   * - 修改元素属性/文本
   * - 获取 computed style
   */
  const tabs = await getTabs();
  const target = tabs.find(t => t.url.startsWith('http'));
  if (!target) throw new Error('No tab');

  const { cdp, ws } = await connectTab(target.webSocketDebuggerUrl);
  await cdp('DOM.enable');
  await cdp('Runtime.enable');

  // 获取文档根节点
  const doc = await cdp('DOM.getDocument', { depth: 0 });
  const rootNodeId = doc.root.nodeId;
  console.log('文档根节点 ID:', rootNodeId);

  // 用 CSS 选择器查找元素
  const search = await cdp('DOM.querySelector', {
    nodeId: rootNodeId,
    selector: 'title',
  });
  console.log('title 元素 nodeId:', search.nodeId);

  if (search.nodeId) {
    const html = await cdp('DOM.getOuterHTML', { nodeId: search.nodeId });
    console.log('outerHTML:', html.outerHTML);
  }

  ws.close();
}

async function example6_listenEvents() {
  /**
   * 示例 6：监听浏览器事件
   *
   * CDP 会通过 WebSocket 推送事件，格式：
   * { method: 'Network.requestWillBeSent', params: { ... } }
   */
  const tabs = await getTabs();
  const target = tabs.find(t => t.url.startsWith('http'));
  if (!target) throw new Error('No tab');

  const { cdp, ws } = await connectTab(target.webSocketDebuggerUrl);
  await cdp('Network.enable');
  await cdp('Page.enable');

  // 监听网络请求
  ws.on('message', data => {
    const msg = JSON.parse(data.toString());
    if (msg.method === 'Network.requestWillBeSent') {
      console.log('🌐 请求:', msg.params.request.url.slice(0, 80));
    }
    if (msg.method === 'Network.responseReceived') {
      console.log('✅ 响应:', msg.params.response.status, msg.params.response.url.slice(0, 60));
    }
    if (msg.method === 'Page.frameStoppedLoading') {
      console.log('🛑 页面加载完成');
    }
  });

  // 导航触发事件
  await cdp('Page.navigate', { url: 'https://www.amazon.com' });
  await new Promise(r => setTimeout(r, 5000));

  ws.close();
}

async function example7_customUa() {
  /**
   * 示例 7：修改 User-Agent
   */
  const tabs = await getTabs();
  const target = tabs.find(t => t.url.startsWith('http'));
  if (!target) throw new Error('No tab');

  const { cdp, ws } = await connectTab(target.webSocketDebuggerUrl);
  await cdp('Page.enable');

  // 自定义 UA
  await cdp('Network.setUserAgentOverride', {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    acceptLanguage: 'en-US,en;q=0.9',
    platform: 'Win32',
  });

  await cdp('Page.navigate', { url: 'https://www.whatsmyua.info' });
  await new Promise(r => setTimeout(r, 3000));

  const result = await cdp('Runtime.evaluate', {
    expression: 'navigator.userAgent',
    returnByValue: true,
  });
  console.log('✅ UA 已修改:', result.result.value);

  ws.close();
}

// ═══════════════════════════════════════════════════════════════════
// 第四部分：CDP 对比 Playwright/Puppeteer
// ═══════════════════════════════════════════════════════════════════

// CDP 原始操作                    Playwright 封装
// ──────────────────────────────────────────────────
// Page.navigate({ url })        page.goto(url)
// Runtime.evaluate({exp})       page.evaluate(fn)
// DOM.querySelector()           page.$('selector')
// Page.captureScreenshot()     page.screenshot()
// Network.enable + 事件监听     page.route()
// Page.addScriptToEvaluateOnNewDocument  page.addInitScript()
// Input.dispatchMouseEvent     page.mouse.click(x, y)
// Emulation.setDeviceMetricsOverride   page.setViewportSize()
//
// 什么时候该用 CDP 而不是 Playwright？
//
// 1. 需要操作"用户正在使用的 Chrome"
//    → Playwright 的 connectOverCDP 更方便，但 CDP 直接控制更灵活
//
// 2. 需要 Playwright 没暴露的 CDP API
//    → 比如 Page.setDownloadBehavior、Target.setAutoAttach 等
//
// 3. 性能敏感场景
//    → 跳过 Playwright 的封装层，直接 CDP 更轻量
//
// 4. 调试/诊断
//    → 通过 CDP 查看浏览器内部状态、协议消息

// ═══════════════════════════════════════════════════════════════════
// 运行示例（取消注释要运行的示例）
// ═══════════════════════════════════════════════════════════════════

(async () => {
  console.log('═══════════════════════════════════════════');
  console.log('CDP 脚本编写示例');
  console.log('要求: Chrome 已在 --remote-debugging-port=9222 运行');
  console.log('═══════════════════════════════════════════\n');

  try {
    // 选择要运行的示例
    await example0_connectAndList();   // 列标签
    // await example1_createTab();     // 开新标签
    // await example2_navigateExistingTab(); // 导航
    // await example3_injectScript();  // 注入 stealth
    // await example4_takeScreenshot(); // 截图
    // await example5_domQuery();      // DOM 操作
    // await example6_listenEvents();  // 监听事件
    // await example7_customUa();      // 修改 UA
  } catch (err) {
    console.error('错误:', err.message);
  }

  console.log('\n✅ 完成');
})();
