
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
  await page.goto('http://localhost:8081/game', { waitUntil: ['load', 'domcontentloaded'] });
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


  it('players can login', async function () {
    instance0 = await login();
    instance1 = await login();
  }).timeout(20000);

  it('players can join quick match', async function () {
    await joinQuickMatch(instance0);
    await joinQuickMatch(instance1);
  });

  it('players can die to distance', async function () {
    // register that the players have hit thrust forward
    await instance0.page.keyboard.down('w');
    await instance1.page.keyboard.down('w');

    // wait for the play again btns to appear (game ended)
    await instance0.page.waitForSelector('#playAgainBtn', { timeout: 20000 });
    await instance1.page.waitForSelector('#playAgainBtn', { timeout: 20000 });

    // long timeout because it takes a while for players to die
  }).timeout(20000);

  it('players can click play again button', async function () {
    await instance0.page.click('#playAgainBtn', { timeout: 200 });
    await instance1.page.click('#playAgainBtn', { timeout: 200 });
  });

  it('players can join quick match again', async function () {
    await joinQuickMatch(instance0);
    await joinQuickMatch(instance1);
  });


  it('players can die to planet', async function () {
    // register that the players have hit thrust backward
    await instance0.page.keyboard.down('s');
    await instance1.page.keyboard.down('s');

    // register that the players have released thrust backward 5 secs later
    setTimeout(async () => {
      await instance0.page.keyboard.up('s');
      await instance1.page.keyboard.up('s');
    }, 4000);

    // wait for the play again btns to appear (game ended)
    await instance0.page.waitForSelector('#playAgainBtn', { timeout: 20000 });
    await instance1.page.waitForSelector('#playAgainBtn', { timeout: 20000 });


    // long timeout because it takes a while for players to die
  }).timeout(20000);


  it('windows can be closed', async function () {
    // tests are over close the windows
    await instance0.browser.close();
    await instance1.browser.close();
  });
});