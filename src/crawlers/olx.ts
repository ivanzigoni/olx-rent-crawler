import puppeteer, { Browser } from "puppeteer";
import fs from "node:fs";
import path from "node:path";
import { getConfig } from "../config";

async function scrapeAllProperties(url: string, browser: Browser) {
  const page = await browser.newPage();

  let properties = [] as any[];
  let hasNextPage = true;

  while (hasNextPage) {
    await page.goto(url, { waitUntil: "domcontentloaded" });

    const propsOnPage = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("section.olx-adcard"));

      return cards.map((card) => {
        // Link & Title
        const linkEl = card.querySelector("a.olx-adcard__link[href]") as any;
        const link = linkEl ? linkEl.href : null;
        const title = linkEl ? linkEl.title || linkEl.innerText.trim() : null;

        // Details: rooms, area, bathrooms (usually in aria-label or in detail elements)
        let rooms = null,
          area = null,
          bathrooms = null;
        const details = card.querySelectorAll(".olx-adcard__detail") as any;
        details.forEach((detail: any) => {
          const label = detail.getAttribute("aria-label") || "";
          const text = detail.innerText.trim();

          if (label.toLowerCase().includes("quarto")) {
            // extract rooms number, it might be like "2 quartos" or aria-label contains number
            const match = label.match(/(\d+)/);
            if (match) rooms = Number(match[1]) as any;
          } else if (
            label.toLowerCase().includes("metro") ||
            label.toLowerCase().includes("m²") ||
            text.toLowerCase().includes("m²")
          ) {
            // extract area number
            const match = label.match(/(\d+)/);
            if (match) area = Number(match[1]) as any;
          } else if (label.toLowerCase().includes("banheiro")) {
            // extract bathrooms number
            const match = label.match(/(\d+)/);
            if (match) bathrooms = Number(match[1]) as any;
          }
        });

        // Price: main price & old price if present
        const priceEl = card.querySelector("h3.olx-adcard__price") as any;
        const priceText = priceEl
          ? priceEl.innerText.trim().replace(/\D/g, "")
          : "0";

        const oldPriceEl = card.querySelector("p.olx-adcard__old-price") as any;
        const oldPriceText = oldPriceEl ? oldPriceEl.innerText.trim() : null;

        // Additional price infos e.g. IPTU, Condomínio etc
        const priceInfosEls = card.querySelectorAll(
          "div.olx-adcard__price-info"
        ) as any;
        const priceInfos = {} as any;

        priceInfosEls.forEach((piEl: any) => {
          const piText = piEl.innerText.trim();
          if (piText.toLowerCase().startsWith("iptu")) {
            priceInfos.iptu = piText.replace(/\D/g, "");
          } else if (
            piText.toLowerCase().startsWith("condomínio") ||
            piText.toLowerCase().startsWith("condominio")
          ) {
            priceInfos.condominio = piText.replace(/\D/g, "");
          }
        });

        // Location
        const locationEl = card.querySelector("p.olx-adcard__location") as any;
        const location = locationEl ? locationEl.innerText.trim() : "N/A";

        // Date posted
        const dateEl = card.querySelector("p.olx-adcard__date") as any;
        const datePosted = dateEl ? dateEl.innerText.trim() : "N/A";

        const price = priceText ? Number(priceText) : 0;
        const iptu = priceInfos.iptu ? Number(priceInfos.iptu) : 0;
        const condominio = priceInfos.condominio
          ? Number(priceInfos.condominio)
          : 0;

        return {
          link,
          title,
          bedrooms: rooms ? Number(rooms) : 0,
          area: area ? Number(area) : 0,
          bathrooms: bathrooms ? Number(bathrooms) : 0,
          oldPrice: oldPriceText ? Number(oldPriceText) : 0,
          price,
          iptu,
          condominio,
          totalPrice: price + iptu + condominio,
          location,
          datePosted,
          origin: "OLX",
        };
      });
    });

    properties.push(...propsOnPage);

    hasNextPage = await page.evaluate(() => {
      const nextBtn = Array.from(document.querySelectorAll("button")).find(
        (button) =>
          button.innerText.includes("Próxima página") ||
          button.innerText.includes("Próxima")
      );
      if (nextBtn && !nextBtn.disabled) return true;
      // Alternatively try next link by text
      const nextLink = document.querySelector(
        'a[rel="next"], a[aria-label*="Próxima página"], a[aria-label*="Próxima"]'
      );
      if (nextLink) return true;
      return false;
    });

    if (hasNextPage) {
      let clicked = false;

      const nextPageButton = await (page as any).$x(
        "//button[contains(., 'Próxima página') or contains(., 'Próxima')]"
      );
      if (nextPageButton.length > 0) {
        try {
          await Promise.all([
            page.waitForNavigation(),
            nextPageButton[0].click(),
          ]);
          clicked = true;
        } catch (e) {
          clicked = false;
        }
      }

      if (!clicked) {
        const nextPageLink = await page.$(
          'a[rel="next"], a[aria-label*="Próxima página"], a[aria-label*="Próxima"]'
        );
        if (nextPageLink) {
          try {
            await Promise.all([page.waitForNavigation(), nextPageLink.click()]);
            clicked = true;
          } catch (e) {
            clicked = false;
          }
        }
      }

      if (!clicked) {
        break;
      }
    } else {
    }
  }

  await page.close();
  return properties;
}

async function execute(browser?: Browser) {
  const urls = getConfig().olx.startUrl;

  const buffer_path = path.resolve(process.cwd(), "buffer", "olx");

  if (fs.existsSync(buffer_path)) {
    fs.rmSync(buffer_path, { recursive: true });
  }

  fs.mkdirSync(buffer_path);

  const b = browser ?? (await puppeteer.launch({ headless: false }));

  for (const url of urls) {
    const allProperties = await scrapeAllProperties(url, b);

    fs.writeFileSync(
      path.resolve(buffer_path, `olx-${Date.now()}.json`),
      JSON.stringify(allProperties)
    );
  }

  if (!browser) {
    await b.close();
  }
}

if (require.main === module) {
  execute();
}

export default execute;
