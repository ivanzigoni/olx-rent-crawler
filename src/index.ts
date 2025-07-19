import cp from "node:child_process";
import puppeteer from "puppeteer";
import olx from "./crawlers/olx";
import vr from "./crawlers/viva-real";
import vi from "./crawlers/zap-imoveis";

async function wrapper(fn: Function) {
  try {
    return await fn();
  } catch (e) {
    console.log(`ERROR AT: ${fn.name}`);
    console.log(e);
  }
}

async function main() {
  try {
    // const browser = await puppeteer.launch({ headless: false });
    const res = await Promise.allSettled([
      wrapper(olx),
      wrapper(vr),
      wrapper(vi),
    ]);
    cp.execSync("npm run datavis");
    cp.execSync("npm run buffer:clean");
    // await browser.close();
  } catch (e) {
    console.log("ERROR");
    console.log(e);
    process.exit(0);
  }
}
main();
