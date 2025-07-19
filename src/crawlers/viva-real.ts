import { Browser, ConsoleMessage } from "puppeteer";

const puppeteer = require("puppeteer");
const path = require("node:path");
const fs = require("node:fs");
const { getConfig } = require("../config");

async function scrapeAllProperties(initialURL: string, browser: Browser) {
  const page = await browser.newPage();
  page.on("console", (log: ConsoleMessage) => console.log("[VR]", log.text()));

  const results: any[] = [];

  await page.goto(initialURL);

  try {
    while (true) {
      await page.waitForSelector('li[data-cy="rp-property-cd"]');

      // Extract properties data on this page
      const propertiesOnPage = await page.evaluate(() => {
        const properties: any[] = [];

        const items = document.querySelectorAll('li[data-cy="rp-property-cd"]');
        items.forEach((item) => {
          try {
            const linkTag = item.querySelector("a[href]") as any;
            if (!linkTag) return;

            const href = linkTag.href || "_blank";

            // Name or title: use the h2 tag data-cy rp-cardProperty-location-txt span block before neighborhood text
            const h2 = item.querySelector(
              'h2[data-cy="rp-cardProperty-location-txt"]'
            ) as any;
            let title = null;
            if (h2) {
              // text is like "Apartamento para alugar em Barro Preto, Belo Horizonte"
              // we can get full innerText
              title = h2.innerText.trim().replace(/\s+/g, " "); // normalize spaces
            }

            // Street name
            const street = item.querySelector(
              'p[data-cy="rp-cardProperty-street-txt"]'
            ) as any;
            const streetName = street ? street.textContent.trim() : "N/A";

            // Area, Bedrooms, Bathrooms, Parking (amount)
            // They are in ul > li with data-cy starting with rp-cardProperty-
            const details: any = {};
            item
              .querySelectorAll('li[data-cy^="rp-cardProperty-"]')
              .forEach((li: any) => {
                if (li.dataset.cy === "rp-cardProperty-propertyArea-txt") {
                  const areaText = li.innerText.trim();
                  details.area = areaText; // e.g. "85 m²"
                } else if (
                  li.dataset.cy === "rp-cardProperty-bedroomQuantity-txt"
                ) {
                  const bedroomsText = li.innerText.trim();
                  details.bedrooms = bedroomsText; // e.g. "2"
                } else if (
                  li.dataset.cy === "rp-cardProperty-bathroomQuantity-txt"
                ) {
                  const bathroomsText = li.innerText.trim();
                  details.bathrooms = bathroomsText; // e.g. "1"
                } else if (
                  li.dataset.cy === "rp-cardProperty-parkingSpacesQuantity-txt"
                ) {
                  const parkingText = li.innerText.trim();
                  details.parking = parkingText; // e.g. "2"
                }
              });

            // Price and additional pricing details (condominium, IPTU)
            const priceContainer = item.querySelector(
              'div[data-cy="rp-cardProperty-price-txt"]'
            );
            let price = "0";
            let condominium = "0";
            let iptu = "0";
            if (priceContainer) {
              // First p tag: main price text 'R$ 4.500/mês'
              const priceP = priceContainer.querySelector("p.text-2-25") as any;
              if (priceP) {
                // extract just the number with currency, e.g. "R$ 4.500/mês"
                price = priceP.textContent.trim().replace(/\s/g, ""); // compact spacing
              }
              // Second p tag: "Cond. R$ 720 • IPTU R$ 271"
              const feesP = priceContainer.querySelectorAll(
                "p.text-1-75"
              ) as any;
              if (feesP && feesP.length > 0) {
                feesP.forEach((p: any) => {
                  const txt = p.textContent;
                  const condMatch = txt.match(/Cond\.\s*R\$\s*([\d\.\,]+)/i);
                  if (condMatch) {
                    condominium = condMatch[1];
                  }
                  const iptuMatch = txt.match(/IPTU\s*R\$\s*([\d\.\,]+)/i);
                  if (iptuMatch) {
                    iptu = iptuMatch[1];
                  }
                });
              }
            }

            const p = price ? Number(price.replace(/\D/g, "")) : 0;
            const c = condominium ? Number(condominium.replace(/\D/g, "")) : 0;
            const i = iptu ? Number(iptu.replace(/\D/g, "")) : 0;

            properties.push({
              title,
              link: href,
              location: streetName,
              area: details.area ? Number(details.area.replace(/\D/g, "")) : 0,
              bedrooms: details.bedrooms
                ? Number(details.bedrooms.replace(/\D/g, ""))
                : 0,
              bathrooms: details.bathrooms
                ? Number(details.bathrooms.replace(/\D/g, ""))
                : 0,
              parking: details.parking || 0,
              price: p,
              condominio: c,
              iptu: i,
              totalPrice: p + c + i,
              datePosted: "N/A",
              origin: "VR",
            });
          } catch (ex) {
            // Catch any errors per item to not fail the entire extraction
            console.error("Error parsing property item:", ex);
          }
        });
        return properties;
      });

      results.push(...propertiesOnPage);

      // Check for next page button
      const nextDisabled = await page.$(
        'button[data-testid="next-page"][disabled]'
      );
      if (nextDisabled) {
        // No next page, break the loop
        break;
      } else {
        // Click on next page
        await Promise.all([
          page.waitForNavigation({ waitUntil: "domcontentloaded" }),
          page.click('button[data-testid="next-page"]'),
        ]);
      }
    }
    return results;
  } catch (e) {
    console.log("[VR][ERROR] - ERROR TRYING TO SCRAPE");
    console.log(e);
    return results;
  }
}

async function execute(browser?: Browser) {
  const url = getConfig()["viva-real"].startUrl;

  const buffer_path = path.resolve(process.cwd(), "buffer", "viva-real");

  if (fs.existsSync(buffer_path)) {
    fs.rmSync(buffer_path, { recursive: true });
  }

  fs.mkdirSync(buffer_path);

  const b = browser ?? (await puppeteer.launch({ headless: false }));

  const allProperties = await scrapeAllProperties(url, b);

  fs.writeFileSync(
    path.resolve(buffer_path, `viva-real-${Date.now()}.json`),
    JSON.stringify(allProperties)
  );

  if (!browser) {
    await b.close();
  }
}

if (require.main === module) {
  execute();
}

export default execute;
