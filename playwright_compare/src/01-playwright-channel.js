/**
 * 方案 1：Playwright + channel:chrome
 * 最简洁的方式，使用本机 Chrome，零反检测
 * 适合：不需要反检测的常规自动化场景
 */
const { chromium } = require('playwright');
const path = require('path');

const userDataDir = path.join(__dirname, '..', 'user_data');

(async () => {
  const browser = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chrome',
    headless: false,
    // ⚠️ Chrome 147+ 已废弃此 flag，仅做演示
    // 见 README "重要发现" 章节
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const page = await browser.newPage();
  await page.goto('https://www.google.com');
  console.log('✅ 方案 1：Playwright + channel:chrome');

  // 检测 webdriver 标志
  const result = await page.evaluate(() => ({
    webdriver: navigator.webdriver,
    pluginsLength: navigator.plugins.length,
    chromeRuntime: !!window.chrome?.runtime,
  }));
  console.table(result);

  console.log('⏳ 浏览器将保持打开 120 秒...');
  await page.waitForTimeout(120000);
  await browser.close();
})();
