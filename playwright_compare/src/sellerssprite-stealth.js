const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

puppeteer.use(StealthPlugin());

const CDP_PORT = 9222;
const SELLERSPRITE_URL = 'https://www.sellersprite.com/v2/welcome';
const PROFILE_DIR = path.join(__dirname, '..', 'sellerssprite_profile');

let chromeProcess = null;

function startChrome() {
  return new Promise((resolve, reject) => {
    console.log('Starting Chrome with Stealth...');
    
    const args = [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${PROFILE_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
    ];

    chromeProcess = spawn(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args,
      { stdio: 'ignore' }
    );

    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      http.get(`http://127.0.0.1:${CDP_PORT}/json/version`, (res) => {
        clearInterval(checkInterval);
        console.log('Chrome started!\n');
        resolve();
      }).on('error', () => {
        if (Date.now() - startTime > 15000) {
          clearInterval(checkInterval);
          reject(new Error('Chrome startup timeout'));
        }
      });
    }, 500);
  });
}

function isChromeRunning() {
  return new Promise((resolve) => {
    http.get(`http://127.0.0.1:${CDP_PORT}/json/version`, (res) => resolve(true))
      .on('error', () => resolve(false));
  });
}

function getWsEndpoint() {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${CDP_PORT}/json/version`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data).webSocketDebuggerUrl);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  try {
    const isRunning = await isChromeRunning();
    if (!isRunning) {
      await startChrome();
    } else {
      console.log('Chrome already running\n');
    }

    const wsEndpoint = await getWsEndpoint();
    console.log('Connecting via Puppeteer Stealth...\n');
    
    const browser = await puppeteer.connect({
      browserWSEndpoint: wsEndpoint,
      defaultViewport: null,
    });

    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();

    console.log('Visiting SellerSprite...');
    await page.goto(SELLERSPRITE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    await sleep(3000);

    const status = await page.evaluate(() => {
      const cookies = document.cookie;
      return {
        hasLoginCookie: cookies.includes('rank-login-user') || cookies.includes('Sprite-X-Token'),
        hasUserAvatar: !!document.querySelector('[class*="avatar"], [class*="user-info"]'),
        title: document.title,
        url: location.href,
      };
    });

    console.log('Login Status:');
    console.log(`  Title: ${status.title}`);
    console.log(`  URL: ${status.url}`);
    console.log(`  Has Login Cookie: ${status.hasLoginCookie ? 'YES' : 'NO'}`);
    console.log(`  Has User Avatar: ${status.hasUserAvatar ? 'YES' : 'NO'}`);
    console.log(`\n${status.hasLoginCookie || status.hasUserAvatar ? '✅ LOGGED IN' : '❌ NOT LOGGED IN'}\n`);

    if (status.hasLoginCookie || status.hasUserAvatar) {
      console.log('✅ Login status maintained! Ready for automation.\n');
    } else {
      console.log('💡 Please login manually in the browser.\n');
    }

    console.log('Press Ctrl+C to exit (Chrome keeps running)\n');
    await new Promise(() => {});

  } catch (error) {
    console.error('Error:', error.message);
    if (chromeProcess) chromeProcess.kill();
    process.exit(1);
  }
})();
