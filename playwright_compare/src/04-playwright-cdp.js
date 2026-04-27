/**
 * 方案 4：Playwright + CDP connect
 * 1. 用 child_process 启动本机 Chrome（带 remote-debugging-port）
 * 2. 通过 CDP 连接并控制
 *
 * 优势：完全手动控制 Chrome 启动参数，适合精细调试
 * 劣势：无反检测补丁，进程管理复杂
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const CDP_PORT = 9333;
const userDataDir = path.join(__dirname, '..', 'user_data_cdp');

function getWsEndpoint(port) {
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve(JSON.parse(d).webSocketDebuggerUrl));
      }).on('error', () => setTimeout(tryConnect, 200));
    };
    tryConnect();
  });
}

(async () => {
  // 1. 启动本机 Chrome 进程
  const chromeProcess = spawn(
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      // ⚠️ Chrome 147+ 已废弃此 flag，仅做演示
      '--disable-blink-features=AutomationControlled',
    ],
    { stdio: 'ignore' }
  );

  // 2. 等待 Chrome 启动并通过 CDP 连接
  const wsEndpoint = await getWsEndpoint(CDP_PORT);
  const browser = await chromium.connect(wsEndpoint);
  console.log('✅ 方案 4：CDP connect（自启动 Chrome）');

  const page = await browser.newPage();
  await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded' });

  const result = await page.evaluate(() => ({
    webdriver: navigator.webdriver,
    url: location.href,
  }));
  console.table(result);

  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
  chromeProcess.kill();
})();
