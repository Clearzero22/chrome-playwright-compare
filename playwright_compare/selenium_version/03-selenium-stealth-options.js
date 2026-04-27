/**
 * Selenium 版本 3：Chrome Options 隐身方案
 * 通过 Chrome 启动参数 + 排除开关 + CDP 联合实现隐身
 * 对应 Puppeteer Stealth 的设计思路：多层防御
 *
 * 核心策略：
 *   1. 排除 --enable-automation 开关（隐藏"受自动化控制"横幅）
 *   2. 用 CDP 注入 stealth 脚本
 *   3. 忽略浏览器证书/自动化相关错误
 */
const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

const STEALTH_SCRIPT = () => {
  Object.defineProperty(navigator, 'webdriver', { get: () => false });
  window.chrome = window.chrome || {};
  window.chrome.runtime = {};
  if (navigator.plugins.length === 0) {
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5].map(i => ({
        name: `Plugin ${i}`,
        filename: `plugin-${i}`,
        description: '',
        length: 1,
      })),
    });
  }
};

(async () => {
  const options = new chrome.Options();
  options.setBinaryPath('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  options.setPageLoadStrategy('normal');

  // 排除自动化标志（关键：隐藏 Chrome 的"受自动化控制"提示）
  options.excludeSwitches('enable-automation');
  options.excludeSwitches('disable-component-update');

  // 启动参数
  options.addArguments(
    '--no-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-background-networking',
    '--no-first-run',
    '--no-default-browser-check',
  );

  // 禁用自动化扩展
  options.setUserPreferences({
    'credentials_enable_service': false,
    'profile.password_manager_enabled': false,
  });

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  // CDP 注入（确保在页面加载前执行）
  await driver.sendDevToolsCommand('Page.addScriptToEvaluateOnNewDocument', {
    source: `(${STEALTH_SCRIPT.toString()})()`,
  });

  await driver.get('https://www.google.com');
  console.log('✅ Selenium 方案 3：Options + CDP 联合隐身');

  const result = await driver.executeScript(() => ({
    webdriver: navigator.webdriver,
    pluginsLength: navigator.plugins.length,
    chromeRuntime: !!window.chrome?.runtime,
  }));
  console.table(result);

  await new Promise(r => setTimeout(r, 3000));
  await driver.quit();
})();
