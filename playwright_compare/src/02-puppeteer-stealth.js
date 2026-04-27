/**
 * 方案 2：Puppeteer Extra + Stealth Plugin ✅ 最成熟方案
 * 内置几十种反检测补丁，专门对付 Google 等强检测站点
 *
 * 安装：
 *   npm install puppeteer-extra puppeteer-extra-plugin-stealth puppeteer
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { getChromePath } = require('./_platform');
puppeteer.use(StealthPlugin());

(async () => {
  const chromePath = getChromePath();
  // Windows 返回数组，取第一个存在的
  const executablePath = Array.isArray(chromePath) ? chromePath[0] : chromePath;

  const browser = await puppeteer.launch({
    headless: false,
    executablePath,
    userDataDir: '/tmp/puppeteer_user_data',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  const page = await browser.newPage();
  await page.goto('https://www.google.com');
  console.log('✅ 方案 2：Puppeteer Extra + Stealth Plugin');

  // 检测反隐身效果
  const result = await page.evaluate(() => ({
    webdriver: navigator.webdriver,
    pluginsLength: navigator.plugins.length,
    languages: navigator.languages,
    webglVendor: document.createElement('canvas')
      .getContext('webgl')
      ?.getParameter(document.createElement('canvas').getContext('webgl').VENDOR),
  }));
  console.table(result);

  await new Promise(r => setTimeout(r, 3000));
  await browser.close();
})();
