/**
 * SellerSprite 自动登录方案 —— 使用本地 Chrome 的已有登录态
 *
 * 前提：
 * 1. 先手动启动 Chrome（带 CDP 端口）：
 *    /Applications/Google Chrome.app/Contents/MacOS/Google Chrome \
 *      --remote-debugging-port=9222 \
 *      --user-data-dir="$HOME/Library/Application Support/Google/Chrome"
 * 2. 在浏览器中登录 SellerSprite
 * 3. 运行此脚本，自动继承登录状态
 */
const { chromium } = require('playwright');
const http = require('http');

const CDP_PORT = 9222;
const SELLERSPRITE_URL = 'https://www.sellersprite.com/v2/welcome';

/**
 * 获取 Chrome WebSocket 端点
 */
function getWsEndpoint(port, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const tryConnect = () => {
      http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve(result.webSocketDebuggerUrl);
          } catch (e) {
            reject(new Error('Invalid CDP response'));
          }
        });
      }).on('error', (err) => {
        if (Date.now() - startTime < timeoutMs) {
          setTimeout(tryConnect, 500);
        } else {
          reject(new Error(`Chrome 未在端口 ${port} 运行。请先启动：\n` +
            `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome \\` +
            `--remote-debugging-port=${port} \\` +
            `--user-data-dir="$HOME/Library/Application Support/Google/Chrome"`));
        }
      });
    };

    tryConnect();
  });
}

/**
 * 检查是否已登录 SellerSprite
 */
async function checkLoginStatus(page, context) {
  // 方法1：检查关键 cookie
  const cookies = await context.cookies();
  const hasLoginCookie = cookies.some(c =>
    c.name === 'rank-login-user' || c.name === 'Sprite-X-Token'
  );

  // 方法2：检查页面元素
  const pageStatus = await page.evaluate(() => {
    const title = document.title;
    const url = location.href;

    // 登录后的页面特征
    const hasUserAvatar = document.querySelector('[class*="avatar"], [class*="user-info"]');
    const hasLogoutBtn = document.querySelector('a[href*="logout"], [class*="logout"]');
    const hasLoginInput = document.querySelector('input[type="password"]');

    return {
      title,
      url,
      hasUserAvatar: !!hasUserAvatar,
      hasLogoutButton: !!hasLogoutBtn,
      hasLoginInput: !!hasLoginInput,
    };
  });

  return {
    ...pageStatus,
    hasLoginCookie,
    isLoggedIn: hasLoginCookie || pageStatus.hasUserAvatar || pageStatus.hasLogoutButton,
  };
}

/**
 * 主流程
 */
(async () => {
  console.log('🔗 正在连接到本地 Chrome...\n');

  try {
    // 1. 连接到 Chrome
    const wsEndpoint = await getWsEndpoint(CDP_PORT);
    console.log('✅ 已连接到 Chrome (CDP 端口 9222)\n');

    // 2. 连接到浏览器（获取所有 contexts）
    const browser = await chromium.connectOverCDP({ endpointURL: wsEndpoint });
    console.log('✅ Playwright 已连接\n');

    // 3. 获取或创建页面
    const contexts = browser.contexts();
    let context, page;

    if (contexts.length > 0) {
      context = contexts[0];
      const pages = context.pages();
      if (pages.length > 0) {
        page = pages[0];
      } else {
        page = await context.newPage();
      }
    } else {
      context = await browser.newContext();
      page = await context.newPage();
    }

    console.log(`📑 当前页面: ${page.url()}\n`);

    // 4. 访问 SellerSprite
    console.log(`🚀 正在访问 ${SELLERSPRITE_URL}...`);
    try {
      await page.goto(SELLERSPRITE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      console.log('✅ 页面加载完成\n');
    } catch (e) {
      console.log('⚠️ 页面加载超时或被中止，继续执行...\n');
    }

    // 5. 等待一下确保页面完全渲染
    await page.waitForTimeout(2000);

    // 6. 检查登录状态
    const loginStatus = await checkLoginStatus(page, context);

    console.log('📊 SellerSprite 登录状态:');
    console.log(`   页面标题: ${loginStatus.title}`);
    console.log(`   当前 URL: ${loginStatus.url}`);
    console.log(`   检测到登出按钮: ${loginStatus.hasLogoutButton ? '✅' : '❌'}`);
    console.log(`   检测到登录表单: ${loginStatus.hasLoginForm ? '✅' : '❌'}`);
    console.log(`\n🎯 结论: ${loginStatus.isLoggedIn ? '✅ 已登录' : '❌ 未登录'}\n`);

    if (!loginStatus.isLoggedIn) {
      console.log('💡 提示: 请在浏览器中手动登录 SellerSprite');
      console.log('   登录后，此脚本下次运行将自动保持登录状态\n');
    }

    // 7. 获取 SellerSprite 相关 cookies（用于调试）
    const cookies = await context.cookies();
    const sellerSpriteCookies = cookies.filter(c =>
      c.domain.includes('sellersprite') || c.domain.includes(' SellerSprite')
    );

    if (sellerSpriteCookies.length > 0) {
      console.log(`🍪 SellerSprite Cookies (${sellerSpriteCookies.length} 个):`);
      sellerSpriteCookies.forEach(c => {
        console.log(`   ${c.name}: ${c.value.substring(0, 30)}${c.value.length > 30 ? '...' : ''}`);
      });
    }

    console.log('\n✅ 脚本执行完成');
    console.log('💡 浏览器将保持打开，您可以继续手动操作');
    console.log('   按 Ctrl+C 退出脚本（不会关闭浏览器）\n');

    // 保持连接，不自动关闭
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
})();
