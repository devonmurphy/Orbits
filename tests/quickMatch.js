
const puppeteer = require('puppeteer');
var expect = require('chai').expect;

// puppeteer options
const opts = {
  headless: false,
  defaultViewport: {
    width: 1000,
    height: 1000,
    timeout: 20000
  }
};

var login = async function () {
  const browser = await puppeteer.launch(opts);
  const page = await browser.newPage();
  await page.goto('http://localhost:5000/game', { waitUntil: ['load', 'domcontentloaded'] });
  await page.waitForSelector('#inGameName');
  await page.type('#inGameName', 'hello world', { delay: 20 })

  await page.waitForSelector('#submitInGameName');
  await page.click('#submitInGameName');

  return { browser, page };
}

var joinQuickMatch = async function (instance) {
  var page = instance.page;
  await page.waitForSelector('#quickMatch');
  await page.click('#quickMatch');
}

var instance0;
var instance1;

describe('running quick match tests', function () {



  it('test playing with 200 players in 100 quick matches', async function () {
    var joinPlayer = async function () {
      var newPlayer = await login();
      await joinQuickMatch(newPlayer);
      await newPlayer.browser.close();
    }

    for (var i = 0; i < 100; i++) {
      joinPlayer();
    }

  }).timeout(20000000);
});