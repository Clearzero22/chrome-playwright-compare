/**
 * CDP 连接已有 Chrome —— Google 登录态测试
 *
 * 原理：连接到用户正在使用的 Chrome，Google 登录态天然存在
 * 因为 cookies 和 session 都在用户已有的浏览器里
 */

const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const CDP_PORT = 9222;

function findWsEndpoint(port) {
  return new Promise((resolve, reject) => {
    const tryConnect = (attempts = 0) => {
      http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve(JSON.parse(d).webSocketDebuggerUrl));
      }).on('error', () => {
        if (attempts < 30) setTimeout(() => tryConnect(attempts + 1), 300);
        else reject(new Error(`Chrome 未在端口 ${port} 上运行`));
      });
    };
    tryConnect();
  });
}

(async () => {
  // 1. 检查 Chrome 是否已在调试端口运行
  let chromeProcess = null;
  let wsEndpoint;

  try {
    wsEndpoint = await findWsEndpoint(CDP_PORT);
    console.log('✅ 检测到 Chrome 已在 9222 端口运行');
  } catch {
    // 2. 未运行，启动新 Chrome（用干净的 user-data-dir）
    const userDataDir = path.join(__dirname, '..', 'chrome_login_profile');
    fs.mkdirSync(userDataDir, { recursive: true });

    console.log('🚀 启动 Chrome（调试端口 9222）...');
    chromeProcess = spawn(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      [
        `--remote-debugging-port=${CDP_PORT}`,
        `--user-data-dir=${userDataDir}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
      { stdio: 'ignore' }
    );
    wsEndpoint = await findWsEndpoint(CDP_PORT);
    console.log('✅ Chrome 已启动');
  }

  // 3. 通过 CDP 连接
  const browser = await chromium.connectOverCDP({ endpointURL: wsEndpoint });
  console.log('✅ Playwright 已连接到 Chrome\n');

  // 4. 获取已有页面或新建
  let page;
  try {
    page = browser.contexts()[0]?.pages()[0];
  } catch {}
  if (!page) page = await browser.newPage();

  // 5. 访问 Google
  await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded' });

  // 6. 检查登录状态
  const loginStatus = await page.evaluate(() => {
    // Google 登录状态标志
    const links = Array.from(document.querySelectorAll('a'));
    const profileLink = links.find(l =>
      l.href?.includes('https://accounts.google.com/SignOut') ||
      l.href?.includes('myaccount.google.com') ||
      l.getAttribute('aria-label')?.includes('Google Account')
    );
    const signInBtn = document.querySelector('#gb_70, a[href*="SignOut"]');

    return {
      url: location.href,
      title: document.title,
      hasProfileIcon: !!profileLink,
      isLoggedIn: !!profileLink,
      note: profileLink
        ? '✅ 已登录 Google（检测到账户元素）'
        : '⚠️ 未登录 Google（显示登录按钮）',
    };
  });

  console.log('📊 Google 登录状态:');
  console.log(`   页面: ${loginStatus.title}`);
  console.log(`   状态: ${loginStatus.note}`);

  if (!loginStatus.isLoggedIn) {
    console.log('\n💡 未检测到登录。如果是新启动的 Chrome：');
    console.log('   1. 手动在浏览器中登录 Google');
    console.log('   2. 关闭浏览器');
    console.log(`   3. 再运行此脚本，profile 会记住登录态`);
    console.log(`   Profile 位置: ${path.join(__dirname, '..', 'chrome_login_profile')}`);
  }

  // 7. 获取当前 cookies（确认 Google 登录态）
  const cookies = await page.context().cookies();
  const googleCookies = cookies.filter(c => c.domain.includes('google'));
  console.log(`\n🍪 Google cookies: ${googleCookies.length} 个`);
  googleCookies.forEach(c =>
    console.log(`   ${c.name}: ${c.value.substring(0, 20)}...`)
  );

  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
  if (chromeProcess) chromeProcess.kill();
})();
