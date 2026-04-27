/**
 * Selenium 版本 4：Remote WebDriver（连接已有 Chrome）
 * 对应 Playwright CDP connect 方案
 *
 * 需要先启动 Chrome + chromedriver：
 *   1. /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
 *        --remote-debugging-port=9222 \
 *        --user-data-dir=/tmp/chrome_selenium
 *   2. chromedriver --port=9515
 *
 * 或使用 Selenium Grid：selenium-server standalone --port 4444
 */
const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

(async () => {
  const options = new chrome.Options();
  options.setBinaryPath('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  options.addArguments(
    '--no-sandbox',
  );

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    // Remote WebDriver 地址（Selenium Grid 或独立 chromedriver）
    .usingServer('http://localhost:9515')
    .build();

  console.log('✅ Selenium 方案 4：Remote WebDriver');

  await driver.get('https://www.google.com');

  const result = await driver.executeScript(() => ({
    webdriver: navigator.webdriver,
    url: location.href,
  }));
  console.table(result);

  await new Promise(r => setTimeout(r, 3000));
  await driver.quit();
})();
