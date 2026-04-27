/**
 * Selenium 版本 2：CDP 协议层隐身
 * 通过 Chrome DevTools Protocol 在页面创建前注入反检测脚本
 * 对应 Playwright 方案 2 的隐身效果（CDP 级别）
 *
 * Selenium 4.x+ 支持 executeCdpCommand 直接发送 CDP 命令
 */
const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

const STEALTH_SCRIPT = () => {
  // 1. 隐藏 webdriver
  Object.defineProperty(navigator, 'webdriver', { get: () => false });

  // 2. 模拟 chrome.runtime
  window.chrome = window.chrome || {};
  window.chrome.runtime = {};

  // 3. 填充 plugins（真实 Chrome 通常有 5+ 个）
  if (navigator.plugins.length === 0) {
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5].map((_, i) => ({
        name: `Chrome Plugin ${i}`,
        filename: `plugin-${i}`,
        description: '',
        length: 1,
      })),
    });
  }

  // 4. WebGL 厂商伪装
  const getWebGL = () => {
    const canvas = document.createElement('canvas');
    return canvas.getContext('webgl');
  };
  const gl = getWebGL();
  if (gl) {
    const vendorSymbol = gl.getParameter(gl.VENDOR);
    // 保持正常厂商字符串
  }

  // 5. languages
  Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
  });
};

(async () => {
  const options = new chrome.Options();
  options.setBinaryPath('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  options.addArguments('--no-sandbox');

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  // Selenium CDP: 在每个新文档上注入 stealth 脚本
  await driver.sendDevToolsCommand('Page.addScriptToEvaluateOnNewDocument', {
    source: `(${STEALTH_SCRIPT.toString()})()`,
  });

  await driver.get('https://www.google.com');
  console.log('✅ Selenium 方案 2：CDP Stealth 注入');

  const result = await driver.executeScript(() => ({
    webdriver: navigator.webdriver,
    pluginsLength: navigator.plugins.length,
    languages: navigator.languages,
  }));
  console.table(result);

  await new Promise(r => setTimeout(r, 3000));
  await driver.quit();
})();
