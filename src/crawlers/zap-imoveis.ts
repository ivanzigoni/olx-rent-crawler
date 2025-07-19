import puppeteer, { Browser, ConsoleMessage } from "puppeteer";
import fs from "node:fs";
import path from "node:path";
import { getConfig } from "../config";

type Property = {
  link: string;
  title: string;
  bedrooms: number;
  area: number;
  bathrooms: number;
  price: number;
  iptu: number;
  condominio: number;
  totalPrice: number;
  location: string;
  datePosted: string;
  origin: string;
};

async function scrapeZapImoveis(
  url: string,
  browser: Browser
): Promise<Property[]> {
  const page = await browser.newPage();
  page.on("console", (log: ConsoleMessage) => console.log("[ZI]", log.text()));

  const properties: Property[] = [];

  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });

    while (true) {
      await page.waitForSelector('li[data-cy="rp-property-cd"] > a');

      const pageProperties = await page.evaluate(() => {
        const anchors = Array.from(
          document.querySelectorAll(`li[data-cy="rp-property-cd"] > a`)
        ) as any;

        return anchors.map((anchor: any, index: number) => {
          // Link
          const link = anchor.href;

          // Title
          const titleElem = anchor.querySelector(
            'h2[data-cy="rp-cardProperty-location-txt"]'
          );
          const subtitleElem = anchor.querySelector(
            'p[data-cy="rp-cardProperty-street-txt"]'
          );
          const title = [
            titleElem ? titleElem.textContent?.trim() ?? "" : "",
            subtitleElem ? subtitleElem.textContent?.trim() ?? "" : "",
          ]
            .filter(Boolean)
            .join(" - ");

          // Location
          let locationText = "";
          if (titleElem) {
            const children = Array.from(titleElem.childNodes) as any[];
            if (children.length > 1) {
              const lastChild = children[children.length - 1];
              locationText = lastChild.textContent?.trim() ?? "";
            }
          }

          // Bedrooms
          let bedrooms = 0;
          const bdElem = anchor.querySelector(
            'li[data-cy="rp-cardProperty-bedroomQuantity-txt"] h3'
          );
          if (bdElem) {
            const bdText = bdElem.textContent?.trim() ?? "";
            const bdNum = parseInt(bdText.match(/\d+/)?.[0] ?? "0", 10);
            bedrooms = isNaN(bdNum) ? 0 : bdNum;
          } else {
          }

          // Bathrooms
          let bathrooms = 0;
          const baElem = anchor.querySelector(
            'li[data-cy="rp-cardProperty-bathroomQuantity-txt"] h3'
          );
          if (baElem) {
            const baText = baElem.textContent?.trim() ?? "";
            const baNum = parseInt(baText.match(/\d+/)?.[0] ?? "0", 10);
            bathrooms = isNaN(baNum) ? 0 : baNum;
          } else {
          }

          // Area
          let area = 0;
          const areaElem = anchor.querySelector(
            'li[data-cy="rp-cardProperty-propertyArea-txt"] h3'
          );
          if (areaElem) {
            const areaText = areaElem.textContent ?? "";
            const areaMatch = areaText.match(/(\d+)(-\d+)?\s*m²/);
            if (areaMatch) {
              area = parseInt(areaMatch[1], 10);
            } else {
            }
          } else {
          }

          // Price
          let price = 0;
          const priceElem = anchor.querySelector(
            'div[data-cy="rp-cardProperty-price-txt"] p.text-2-25'
          );
          if (priceElem) {
            const priceText =
              priceElem.textContent?.replace(/\/mês/i, "").trim() ?? "";
            price = priceText.replace(/\D/g, "");
            // price = parsePrice(priceText));
          } else {
          }

          // Fees
          let iptu = 0;
          let condominio = 0;
          const feesElem = anchor.querySelector(
            'div[data-cy="rp-cardProperty-price-txt"] p.text-1-75'
          );
          if (feesElem) {
            const feesText = feesElem.textContent ?? "";

            const iptuMatch = feesText.match(/IPTU\s*R\$[\s]*([\d.,]+)/i);
            if (iptuMatch) {
              iptu = iptuMatch[1].replace(/\D/g, "");
            }

            const condMatch = feesText.match(/Cond\.\s*R\$[\s]*([\d.,]+)/i);
            if (condMatch) {
              condominio = condMatch[1].replace(/\D/g, "");
            }
          } else {
          }

          const totalPrice =
            Number(price ?? 0) + Number(iptu ?? 0) + Number(condominio ?? 0);

          const datePosted = "";
          const origin = "ZI";

          return {
            link,
            title,
            bedrooms: bedrooms ? Number(bedrooms) : 0,
            area: area ? Number(area) : 0,
            bathrooms: bathrooms ? Number(bathrooms) : 0,
            price: price ? Number(price) : 0,
            iptu: iptu ? Number(iptu) : 0,
            condominio: condominio ? Number(condominio) : 0,
            totalPrice: totalPrice ? Number(totalPrice) : 0,
            location: locationText,
            datePosted,
            origin,
          };
        });
      });

      properties.push(...pageProperties);

      // Try to go to next page

      const nextButtonEnabled = await page
        .$eval(
          'nav[data-testid="l-pagination"] button[aria-label="Próxima página"]',
          (btn) => !btn.hasAttribute("disabled")
        )
        .catch(() => {
          return false;
        });

      if (!nextButtonEnabled) {
        break;
      }

      await Promise.all([
        page.click(
          'nav[data-testid="l-pagination"] button[aria-label="Próxima página"]'
        ),
        page.waitForNavigation({ waitUntil: "domcontentloaded" }),
      ]);
    }
    return properties;
  } catch (error) {
    console.log(`[ZI][ERROR] - ERROR TRYING TO SCRAPE PROPERTIES`);
    console.log(error);
    throw properties;
  }
}

async function execute(browser?: Browser) {
  const url = getConfig()["zap-imoveis"].startUrl;

  const buffer_path = path.resolve(process.cwd(), "buffer", "zap-imoveis");

  if (fs.existsSync(buffer_path)) {
    fs.rmSync(buffer_path, { recursive: true });
  }

  fs.mkdirSync(buffer_path);

  const b = browser ?? (await puppeteer.launch({ headless: false }));

  const listings = await scrapeZapImoveis(url, b);

  fs.writeFileSync(
    path.resolve(buffer_path, `zap-imoveis-${Date.now()}.json`),
    JSON.stringify(listings)
  );

  if (!browser) {
    await b.close();
  }
}

if (require.main === module) {
  execute();
}

export default execute;
