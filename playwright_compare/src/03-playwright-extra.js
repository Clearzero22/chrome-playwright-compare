/**
 * 方案 3：Playwright Extra + Stealth Plugin 桥接
 * 在 Playwright 中使用 puppeteer-extra-plugin-stealth 的反检测能力
 * ⚠️ playwright-extra 维护活跃度低，部分补丁可能不兼容
 *
 * 安装：
 *   npm install playwright-extra puppeteer-extra-plugin-stealth
 */
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

(async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: [],
  });

  const page = await browser.newPage();
  await page.goto('https://www.google.com');
  console.log('✅ 方案 3：Playwright Extra + Stealth');

  const result = await page.evaluate(() => ({
    webdriver: navigator.webdriver,
    pluginsLength: navigator.plugins.length,
  }));
  console.table(result);

  await page.waitForTimeout(3000);
  await browser.close();
})();
