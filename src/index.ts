import cp from "node:child_process";
import puppeteer from "puppeteer";
import olx from "./crawlers/olx";
import vr from "./crawlers/viva-real";
import zi from "./crawlers/zap-imoveis";
import ni from "./crawlers/netimoveis";

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
    await Promise.allSettled([zi(), ni()]);
    await Promise.allSettled([olx(), vr()]);

    cp.execSync("npm run datavis");

    // cp.execSync("npm run buffer:clean");
  } catch (e) {
    console.log("ERROR");
    console.log(e);
    process.exit(0);
  }
}
main();
