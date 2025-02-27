import {launch} from 'chrome-launcher';
import chromium from 'chromium';
import CDP from 'chrome-remote-interface';
import axios from 'axios'
import puppeteer from 'puppeteer-extra';
import Xvfb from 'xvfb';
import clc from 'cli-color'


export const puppeteerRealBrowser = async ({
                                               proxy = {},
                                               action = 'default',
                                               headless = false,
                                               executablePath = 'default'
                                           } = {}) => {
    let xvfbsession = null;
    let chromePath = chromium.path;

    if (process.platform === 'linux' && headless === false) {
        console.log(clc.yellow('[WARNING] [PUPPETEER-REAL-BROWSER] | On the Linux platform you can only run the browser in headless true mode.'));
        headless = true
    }

    if (executablePath !== 'default') {
        chromePath = executablePath
    }

    const chromeFlags = ['--no-sandbox'];

    if (headless === true && process.platform !== 'linux') {
        chromeFlags.push('--headless')
    }

    if (proxy && proxy.host && proxy.host.length > 0) {
        chromeFlags.push(`--proxy-server=${proxy.host}:${proxy.port}`);
    }

    if (process.platform === 'linux') {
        try {
            xvfbsession = new Xvfb({
                silent: true,
                xvfb_args: ['-screen', '0', '1280x720x24', '-ac']
            });
            xvfbsession.startSync();
        } catch (err) {
            console.log(clc.red('[ERROR] [PUPPETEER-REAL-BROWSER] | You are running on a Linux platform but do not have xvfb installed. The browser can be captured. Please install it with the following command\n\nsudo apt-get install xvfb'));
            console.log(err.message);
        }

        // if (action === 'socket') {
        //     console.log(clc.red('[ERROR] [PUPPETEER-REAL-BROWSER] | Manageable Usage is only available on windows platform. On Linux platform it should be used with the default usage.'));
        //     throw new Error('Manageable Usage is only available on windows platform. On Linux platform it should be used with the default usage.')
        //     return false
        // }

    }

    const chrome = await launch({
        chromePath,
        chromeFlags
    });
    const cdpSession = await CDP({port: chrome.port});

    const {Network, Page, Runtime} = cdpSession;

    await Runtime.enable();
    await Network.enable();
    await Page.enable();
    await Page.setLifecycleEventsEnabled({enabled: true});

    const data = await axios.get('http://127.0.0.1:' + chrome.port + '/json/version').then(response => {
        response = response.data
        return {
            browserWSEndpoint: response.webSocketDebuggerUrl,
            agent: response['User-Agent']
        }
    })
        .catch(err => {
            throw new Error(err.message)
        });

    if (action !== 'default') {
        const closeSession = async () => {
            try {
                if (cdpSession) {
                    await cdpSession.close();
                }
                if (chrome) {
                    await chrome.kill();
                }

                if (xvfbsession) {
                    try {
                        xvfbsession.stopSync();
                        xvfbsession = null;
                    } catch (err) {
                    }
                }
            } catch (err) {
            }
            return true
        }

        return {
            userAgent: data.agent,
            browserWSEndpoint: data.browserWSEndpoint,
            closeSession: closeSession,
            chromePath: chromePath
        }
    }

    const browser = await puppeteer.connect({
        targetFilter: (target) => !!target.url(),
        browserWSEndpoint: data.browserWSEndpoint,
    });
    browser.close = async () => {
        if (cdpSession) {
            await cdpSession.close();
        }
        if (chrome) {
            await chrome.kill();
        }

        if (xvfbsession) {
            try {
                xvfbsession.stopSync();
                xvfbsession = null;
            } catch (err) {
            }
        }
    }

    const pages = await browser.pages();
    const page = pages[0];
    if (proxy && proxy.username && proxy.username.length > 0) {
        await page.authenticate({username: proxy.username, password: proxy.password});
    }
    await page.setUserAgent(data.agent);
    await page.setViewport({
        width: 1920,
        height: 1080,
    });

    return {
        browser: browser,
        page: page
    };
}
