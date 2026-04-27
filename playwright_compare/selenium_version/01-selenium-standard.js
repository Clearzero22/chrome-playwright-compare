/**
 * Selenium 版本 1：标准 ChromeDriver
 * 对应 Playwright 方案 1，纯标准 API，零反检测
 *
 * 安装：npm install selenium-webdriver
 * 注意：selenium-webdriver 4.x+ 自动管理 chromedriver，无需手动下载
 */
const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

(async () => {
  const options = new chrome.Options();
  // 使用本机 Chrome（不指定路径则自动查找）
  options.setBinaryPath('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  await driver.get('https://www.google.com');
  console.log('✅ Selenium 方案 1：标准 ChromeDriver');

  const result = await driver.executeScript(() => ({
    webdriver: navigator.webdriver,
    pluginsLength: navigator.plugins.length,
    chromeRuntime: !!window.chrome?.runtime,
  }));
  console.table(result);

  await new Promise(r => setTimeout(r, 3000));
  await driver.quit();
})();
