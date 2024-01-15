import {puppeteerRealBrowser} from "../src/index.js";

async function sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
}

async function testNowSecure(page) {
    await page.goto('https://nowsecure.nl/');

    await sleep(10000);

    const h1El = await page.$('h1');
    const h1Text = await page.evaluate(el => el.textContent, h1El);

    if (h1Text !== 'OH YEAH, you passed!') {
        throw new Error(`expected h1 text to be "OH YEAH, you passed!" but was "${h1Text}"`);
    }
}

async function test() {
    let error = false;

    // test headfull browser
    const headfullBrowser = await puppeteerRealBrowser({headless: false});

    try {
        await testNowSecure(headfullBrowser.page);
    } catch (e) {
        error = true;
        console.error(`Headfull Browser failed test:`, e);
    }

    await headfullBrowser.browser.close();

    // test headless browser
    const headlessBrowser = await puppeteerRealBrowser({headless: true});

    try {
        await testNowSecure(headlessBrowser.page);
    } catch (e) {
        error = true;
        console.error(`Headless Browser failed test:`, e);
    }

    await headlessBrowser.browser.close();

    if (error) {
        throw new Error('At least one browser configuration did not pass the test.');
    }
}

test().then(() => {});
