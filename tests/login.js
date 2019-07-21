
const puppeteer = require('puppeteer');
var assert = require('assert');
var expect = require('chai').expect;
var utils = require('../server/utils.js');


// puppeteer options
const opts = {
  //headless: false,
  //slowMo: 100,
  timeout: 10000
};

var login = async function (url) {
  const browser = await puppeteer.launch(opts);
  const page = await browser.newPage();
  await page.goto('http://localhost:5000/game', { waitUntil: ['load', 'domcontentloaded'] });
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

describe('login test', function () {
  var instance0;
  var instance1;

  before(async function () {
    this.timeout(20000);
    instance0 = await login();
    instance1 = await login();
  });

  after(async function () {

  })

  it('should be able to login', async function () {
    var result = false;
    this.timeout(20000);

    try {
      await instance0.page.waitForSelector('#playAgainBtn');
      await instance1.page.waitForSelector('#playAgainBtn');
      result = true;
    } catch (error) {
      console.log(error);
    }

    expect(result).to.be.true;
    await instance0.browser.close();
    await instance1.browser.close();
  });

});