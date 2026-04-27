/**
 * Selenium 版本 5：完整隐身方案（综合方案 2+3 所有技术）
 * 对应 Java/Python 生态中的 undetected-chromedriver 设计思路
 *
 * 多层防御：
 *   1. Chrome Options 排除自动化标志
 *   2. CDP 页面注入 stealth 脚本
 *   3. 运行时 JS 执行额外补丁
 *   4. 禁用自动化特征
 *
 * ⚠️ 注意：Node.js Selenium 生态缺乏像 undetected-chromedriver 这样的成熟包
 * 本方案是最佳实践的汇编，但仍需配合住宅代理应对强检测。
 */
const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

const FULL_STEALTH_SCRIPT = () => {
  // 1. webdriver
  Object.defineProperty(navigator, 'webdriver', { get: () => false });

  // 2. chrome.runtime
  window.chrome = window.chrome || {};
  window.chrome.runtime = {
    id: 'abcdefghijklmnopabcdefghijklmnop',
    connect: () => null,
    sendMessage: () => null,
  };
  window.chrome.loadTimes = () => ({});

  // 3. plugins
  if (navigator.plugins.length === 0) {
    const pluginData = [
      { name: 'Chrome PDF Plugin', file: 'internal-pdf-viewer' },
      { name: 'Chrome PDF Viewer', file: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
      { name: 'Native Client', file: 'internal-nacl-plugin' },
    ];
    const plugins = pluginData.map((p, i) => ({
      ...p,
      description: '',
      length: 1,
      item: () => null,
      namedItem: () => null,
    }));
    Object.defineProperty(navigator, 'plugins', {
      get: () => ({
        ...plugins,
        length: plugins.length,
        item: (i) => plugins[i],
        namedItem: (n) => plugins.find(p => p.name === n),
      }),
    });
  }

  // 4. languages
  Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en', 'zh-CN'],
  });

  // 5. permissions
  if (navigator.permissions) {
    const origQuery = navigator.permissions.query;
    navigator.permissions.query = (params) =>
      origQuery.call(navigator.permissions, params).then(status => {
        if (['notifications', 'clipboard-read', 'clipboard-write'].includes(params.name)) {
          status.onchange = null;
        }
        return status;
      });
  }

  // 6. webdriver 相关属性
  for (const prop of ['webdriver', '__webdriver_script_fn', '__driver_evaluate']) {
    if (prop in window) delete window[prop];
  }

  // 7. 隐藏 sourceURL
  Object.defineProperty(document, 'hidden', { get: () => false });
};

(async () => {
  const options = new chrome.Options();
  options.setBinaryPath('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  options.setPageLoadStrategy('normal');

  // 排除自动化标志
  options.excludeSwitches('enable-automation', 'disable-component-update');
  options.addArguments(
    '--no-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-client-side-phishing-detection',
    '--no-first-run',
  );
  options.setUserPreferences({
    'credentials_enable_service': false,
    'profile.password_manager_enabled': false,
  });

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  // CDP 层注入（每个新页面自动执行）
  await driver.sendDevToolsCommand('Page.addScriptToEvaluateOnNewDocument', {
    source: `(${FULL_STEALTH_SCRIPT.toString()})()`,
  });

  await driver.get('https://www.google.com');
  console.log('✅ Selenium 方案 5：完整隐身方案');

  const result = await driver.executeScript(() => ({
    webdriver: navigator.webdriver,
    pluginsLength: navigator.plugins.length,
    languages: navigator.languages,
    chromeRuntime: !!window.chrome?.runtime,
    hasPlugins: typeof navigator.plugins.item === 'function',
  }));
  console.table(result);

  await new Promise(r => setTimeout(r, 3000));
  await driver.quit();
})();
