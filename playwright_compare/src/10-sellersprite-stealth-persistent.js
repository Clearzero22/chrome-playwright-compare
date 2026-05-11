/**
 * SellerSprite 持久化登录方案 — Puppeteer Stealth 增强版
 *
 * 特点：
 * 1. 使用 Puppeteer Extra + Stealth 插件，提供数十种反检测补丁
 * 2. Chrome 持久运行，登录状态保持
 * 3. 智能 CDP 连接，自动检测 Chrome 是否已运行
 * 4. 完整的隐身保护，减少被强制登出的概率
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

// 启用 Stealth 插件（核心反检测能力）
puppeteer.use(StealthPlugin());

const CDP_PORT = 9222;
const SELLERSPRITE_URL = 'https://www.sellersprite.com/v2/welcome';
const PROFILE_DIR = path.join(__dirname, '..', 'sellerssprite_profile');
const LOG_FILE = path.join(__dirname, '..', 'chrome_persistent.log');

// ─── Chrome 进程管理 ─────────────────────────────────────────────────────

let chromeProcess = null;

/**
 * 启动 Chrome（持久运行，使用 Stealth 配置）
 */
function startChrome() {
  return new Promise((resolve, reject) => {
    // 确保 profile 目录存在
    if (!fs.existsSync(PROFILE_DIR)) {
      fs.mkdirSync(PROFILE_DIR, { recursive: true });
    }

    console.log('🚀 正在启动 Chrome（Stealth 模式）...');

    // Chrome 启动参数（优化隐身和稳定性）
    const args = [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${PROFILE_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled', // 虽然 Chrome 147+ 已废弃，但仍尝试
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials',
      '--disable-web-security', // 仅用于开发，减少跨域限制
      '--disable-features=VizDisplayCompositor',
      '--start-maximized',
      '--disable-infobars',
      '--disable-extensions', // 避免扩展干扰
    ];

    // 启动 Chrome
    chromeProcess = spawn(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args,
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    // 记录日志
    const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
    chromeProcess.stdout.pipe(logStream);
    chromeProcess.stderr.pipe(logStream);

    chromeProcess.on('error', (err) => {
      reject(new Error(`Chrome 启动失败: ${err.message}`));
    });

    // 等待 CDP 端口就绪
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      http.get(`http://127.0.0.1:${CDP_PORT}/json/version`, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          clearInterval(checkInterval);
          console.log('✅ Chrome 启动成功（Stealth 模式已启用）\n');
          resolve();
        });
      }).on('error', () => {
        if (Date.now() - startTime > 15000) {
          clearInterval(checkInterval);
          reject(new Error('Chrome 启动超时（15秒）'));
        }
      });
    }, 500);
  });
}

/**
 * 检查 Chrome 是否已在运行
 */
function isChromeRunning() {
  return new Promise((resolve) => {
    http.get(`http://127.0.0.1:${CDP_PORT}/json/version`, (res) => {
      resolve(true);
    }).on('error', () => resolve(false));
  });
}

/**
 * 通过 CDP 获取 WebSocket 端点
 */
function getWsEndpoint() {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${CDP_PORT}/json/version`, (res) => {
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
    }).on('error', reject);
  });
}

// ─── 登录状态检测 ─────────────────────────────────────────────────────

/**
 * 检查 SellerSprite 登录状态
 */
async function checkLoginStatus(page) {
  return await page.evaluate(() => {
    const cookies = document.cookie;
    const hasLoginCookie = cookies.includes('rank-login-user') || cookies.includes('Sprite-X-Token');

    // 页面元素检测
    const hasUserAvatar = !!document.querySelector('[class*="avatar"], [class*="user-info"], [class*="user-avatar"]');
    const hasLogoutBtn = !!document.querySelector('a[href*="logout"], [class*="logout"], [class*="sign-out"]');
    const hasLoginInput = !!document.querySelector('input[type="password"]');

    return {
      hasLoginCookie,
      hasUserAvatar,
      hasLogoutBtn,
      hasLoginInput,
      isLoggedIn: hasLoginCookie || hasUserAvatar || hasLogoutBtn,
      pageTitle: document.title,
      currentUrl: location.href,
    };
  });
}

// ─── 主流程 ─────────────────────────────────────────────────────────────

(async () => {
  try {
    // 1. 检查 Chrome 是否已运行
    const isRunning = await isChromeRunning();

    if (!isRunning) {
      // 未运行，启动 Chrome
      await startChrome();
      chromeStartedHere = true;
    } else {
      console.log('✅ Chrome 已在运行，直接连接\n');
      chromeStartedHere = false;
    }

    // 2. 获取 CDP 端点
    const wsEndpoint = await getWsEndpoint();

    // 3. 使用 Puppeteer Stealth 连接
    console.log('🔗 正在通过 Puppeteer Stealth 连接...\n');
    const browser = await puppeteer.connect({
      browserWSEndpoint: wsEndpoint,
      defaultViewport: null, // 使用浏览器默认窗口大小
    });

    // 4. 获取或创建页面
    const pages = await browser.pages();
    let page = pages[0] || await browser.newPage();

    // 5. 设置额外的隐身脚本（Stealth 插件之外的增强）
    await page.evaluateOnNewDocument(() => {
      // 覆盖 chrome.runtime（模拟扩展环境）
      if (!window.chrome) window.chrome = {};
      window.chrome.runtime = {
        id: 'some-extension-id',
        sendMessage: () => {},
        getManifest: () => ({ name: 'Stealth Mode' }),
      };

      // 修改 navigator.plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // 覆盖 permissions
      const originalQuery = navigator.permissions.query;
      navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: 'prompt' }) :
          originalQuery(parameters)
      );
    });

    console.log('✅ Stealth 补丁已注入\n');

    // 6. 访问 SellerSprite
    console.log(`🚀 正在访问 ${SELLERSPRITE_URL}...`);
    await page.goto(SELLERSPRITE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    console.log('✅ 页面加载完成\n');

    // 7. 等待页面稳定
    await page.waitForTimeout(3000);

    // 8. 检查登录状态
    const loginStatus = await checkLoginStatus(page);

    console.log('📊 SellerSprite 登录状态:');
    console.log(`   页面标题: ${loginStatus.pageTitle}`);
    console.log(`   当前 URL: ${loginStatus.currentUrl}`);
    console.log(`   检测到登录 Cookie: ${loginStatus.hasLoginCookie ? '✅' : '❌'}`);
    console.log(`   检测到用户头像: ${loginStatus.hasUserAvatar ? '✅' : '❌'}`);
    console.log(`   检测到登出按钮: ${loginStatus.hasLogoutBtn ? '✅' : '❌'}`);
    console.log(`\n🎯 结论: ${loginStatus.isLoggedIn ? '✅ 已登录' : '❌ 未登录'}\n`);

    // 9. 获取所有 cookies（用于调试）
    const cookies = await page.cookies();
    console.log(`🍪 总计 ${cookies.length} 个 Cookies`);

    if (loginStatus.isLoggedIn) {
      console.log('\n✅ 登录状态已保持！可以开始自动化操作了');

      // 这里可以添加您的自动化操作逻辑
      // 例如：点击按钮、提取数据、填写表单等

      // 示例：获取页面内容
      const pageContent = await page.evaluate(() => {
        return {
          title: document.title,
          url: location.href,
          hasContent: document.body.innerText.length > 100,
        };
      });

      console.log(`\n📄 页面信息:`);
      console.log(`   标题: ${pageContent.title}`);
      console.log(`   URL: ${pageContent.url}`);
      console.log(`   内容长度: ${document ? 'N/A' : 'unknown'}`);

    } else {
      console.log('\n💡 提示: 未检测到登录状态');
      console.log('   1. 请在浏览器中手动登录 SellerSprite');
      console.log('   2. 登录后，Stealth 插件会帮助保持登录状态');
      console.log('   3. 下次运行此脚本将自动保持登录\n');
    }

    // 10. 保持浏览器打开，不自动关闭
    console.log('✅ 脚本执行完成');
    console.log('💡 Chrome 将保持运行，登录状态会持续保存');
    console.log('   按 Ctrl+C 退出脚本（Chrome 继续运行）\n');

    // 保持连接，不退出
    await new Promise(() => {});

  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    console.error(error.stack);

    // 清理
    if (chromeProcess && chromeStartedHere) {
      console.log('\n🔄 正在关闭 Chrome...');
      chromeProcess.kill();
    }
    process.exit(1);
  }

  // 优雅退出
  process.on('SIGINT', () => {
    console.log('\n\n👋 脚本已退出');
    console.log('💡 Chrome 继续在后台运行，下次连接将复用现有会话\n');
    process.exit(0);
  });
})();
