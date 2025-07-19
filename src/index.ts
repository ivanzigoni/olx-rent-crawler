import cp from "node:child_process";
import olx from "./crawlers/olx";
import vr from "./crawlers/viva-real";
import puppeteer from "puppeteer";

async function main() {
  try {
    const browser = await puppeteer.launch({ headless: false });
    await Promise.all([olx(browser), vr(browser)]);
    cp.execSync("npm run datavis");
    cp.execSync("npm run buffer:clean");
    await browser.close();
  } catch (e) {
    console.log("ERROR");
    console.log(e);
    process.exit(0);
  }
}
main();
