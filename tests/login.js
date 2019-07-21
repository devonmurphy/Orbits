
const puppeteer = require('puppeteer');
var assert = require('assert');
var expect = require('chai').expect;
var utils = require('../server/utils.js');

(async () => {
  var login = async function (url) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);
    //await page.screenshot({ path: 'example.png' });
    await page.waitForSelector('#inGameName');
    await page.focus('#inGameName');
    await page.keyboard.type('hello world');
    await page.click('#submitInGameName');
    await page.waitForSelector('button');
    await page.click('#quickMatch');

    await browser.close();

  }
  var url0 = 'http://localhost:5000/game';
  var url1 = 'http://'+utils.getIPAddress() + ':5000/game';
  await login(url0);
  await login(url1);
})();
