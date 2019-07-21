
const puppeteer = require('puppeteer');
var assert = require('assert');
var expect = require('chai').expect;
var utils = require('../server/utils.js');

(async () => {
  var login = async function (url) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: ['load', 'domcontentloaded'] });
    console.log('joining from: ' + url);
    await page.waitForSelector('#inGameName');
    await page.type('#inGameName', 'hello world', { delay: 20 })

    await page.waitForSelector('#submitInGameName');
    await page.click('#submitInGameName');
    await page.waitForSelector('#quickMatch');
    await page.click('#quickMatch');

    await page.waitForSelector('canvas');
    await page.keyboard.down('w');

    //await browser.close();
    return { browser, page };
  }
  var url0 = 'http://localhost:5000/game';
  var url1 = 'http://' + utils.getIPAddress() + ':5000/game';
  var instance0 = await login(url0);
  var instance1 = await login(url1);

  await instance0.page.waitForSelector('#playAgainBtn');
  await instance0.page.click('#playAgainBtn');
  await instance1.page.waitForSelector('#playAgainBtn');
  await instance1.page.click('#playAgainBtn');

  //await instance0.page.screenshot({ path: 'example.png' });

  await instance0.browser.close();
  await instance1.browser.close();
})();
