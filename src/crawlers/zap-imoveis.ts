import puppeteer, { Browser, ConsoleMessage } from "puppeteer";
import fs from "node:fs";
import path from "node:path";

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
  console.log("Opening new page...");
  const page = await browser.newPage();
  const properties: Property[] = [];

  try {
    console.log(`Navigating to URL: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    page.on("console", (log: ConsoleMessage) =>
      console.log("inside: ", log.text())
    );

    while (true) {
      console.log("Waiting for property list container...");
      await page.waitForSelector('li[data-cy="rp-property-cd"] > a');

      console.log("Extracting properties from current page...");
      const pageProperties = await page.evaluate(() => {
        console.log("Fetching Anchors");

        const anchors = Array.from(
          document.querySelectorAll(`li[data-cy="rp-property-cd"] > a`)
        ) as any;

        console.log(`Found ${anchors.length} property anchors on page`);
        return anchors.map((anchor: any, index: number) => {
          console.log(`Processing property #${index + 1}`);

          // Link
          const link = anchor.href;
          console.log(`Found link: ${link}`);

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
          console.log(`Created title: ${title}`);

          // Location
          let locationText = "";
          if (titleElem) {
            const children = Array.from(titleElem.childNodes) as any[];
            if (children.length > 1) {
              const lastChild = children[children.length - 1];
              locationText = lastChild.textContent?.trim() ?? "";
            }
          }
          console.log(`Found location: ${locationText}`);

          // Bedrooms
          let bedrooms = 0;
          const bdElem = anchor.querySelector(
            'li[data-cy="rp-cardProperty-bedroomQuantity-txt"] h3'
          );
          if (bdElem) {
            const bdText = bdElem.textContent?.trim() ?? "";
            const bdNum = parseInt(bdText.match(/\d+/)?.[0] ?? "0", 10);
            bedrooms = isNaN(bdNum) ? 0 : bdNum;
            console.log(`Found ${bedrooms} bedrooms`);
          } else {
            console.log("No bedroom element found");
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
            console.log(`Found ${bathrooms} bathrooms`);
          } else {
            console.log("No bathroom element found");
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
              console.log(`Found area: ${area} m²`);
            } else {
              console.log(`Couldn't parse area from text: ${areaText}`);
            }
          } else {
            console.log("No area element found");
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
            console.log(`Found base price: ${price}`);
          } else {
            console.log("No price element found");
          }

          // Fees
          let iptu = 0;
          let condominio = 0;
          const feesElem = anchor.querySelector(
            'div[data-cy="rp-cardProperty-price-txt"] p.text-1-75'
          );
          if (feesElem) {
            const feesText = feesElem.textContent ?? "";
            console.log(`Found fees text: ${feesText}`);

            const iptuMatch = feesText.match(/IPTU\s*R\$[\s]*([\d.,]+)/i);
            if (iptuMatch) {
              iptu = iptuMatch[1].replace(/\D/g, "");
              console.log(`Found IPTU: ${iptu}`);
            }

            const condMatch = feesText.match(/Cond\.\s*R\$[\s]*([\d.,]+)/i);
            if (condMatch) {
              condominio = condMatch[1].replace(/\D/g, "");
              console.log(`Found condominio: ${condominio}`);
            }
          } else {
            console.log("No fees element found");
          }

          const totalPrice =
            Number(price ?? 0) + Number(iptu ?? 0) + Number(condominio ?? 0);
          console.log(`Calculated total price: ${totalPrice}`);

          const datePosted = "";
          const origin = "ZI";

          console.log(`Completed processing property #${index + 1}`);
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

      console.log(`Found ${pageProperties.length} properties on this page`);
      properties.push(...pageProperties);
      console.log(`Total properties collected so far: ${properties.length}`);

      // Try to go to next page
      console.log("Checking for next page button...");
      const nextButtonEnabled = await page
        .$eval(
          'nav[data-testid="l-pagination"] button[aria-label="Próxima página"]',
          (btn) => !btn.hasAttribute("disabled")
        )
        .catch(() => {
          console.log("Error checking next button status, assuming disabled");
          return false;
        });

      if (!nextButtonEnabled) {
        console.log("No more pages available, ending scraping");
        break;
      }

      console.log("Navigating to next page...");
      await Promise.all([
        page.click(
          'nav[data-testid="l-pagination"] button[aria-label="Próxima página"]'
        ),
        page.waitForNavigation({ waitUntil: "domcontentloaded" }),
      ]);
      console.log("Successfully navigated to next page");
    }
  } catch (error) {
    console.error("Error during scraping:", error);
    throw error;
  }

  console.log(
    `Scraping complete. Total properties found: ${properties.length}`
  );
  return properties;
}

async function execute(browser?: Browser) {
  const buffer_path = path.resolve(process.cwd(), "buffer", "zap-imoveis");

  if (fs.existsSync(buffer_path)) {
    fs.rmSync(buffer_path, { recursive: true });
  }

  fs.mkdirSync(buffer_path);

  const url =
    "https://www.zapimoveis.com.br/aluguel/apartamentos/mg+belo-horizonte++prado/1-quarto/?onde=%2CMinas+Gerais%2CBelo+Horizonte%2C%2CPrado%2C%2C%2Cneighborhood%2CBR%3EMinas+Gerais%3ENULL%3EBelo+Horizonte%3EBarrios%3EPrado%2C-19.922983%2C-43.960787%2C%3B%2CMinas+Gerais%2CBelo+Horizonte%2C%2CBarro+Preto%2C%2C%2Cneighborhood%2CBR%3EMinas+Gerais%3ENULL%3EBelo+Horizonte%3EBarrios%3EBarro+Preto%2C-19.923309%2C-43.953608%2C%3B%2CMinas+Gerais%2CBelo+Horizonte%2C%2CSanta+Efig%C3%AAnia%2C%2C%2Cneighborhood%2CBR%3EMinas+Gerais%3ENULL%3EBelo+Horizonte%3EBarrios%3ESanta+Efigenia%2C-19.916704%2C-43.929334%2C%3B%2CMinas+Gerais%2CBelo+Horizonte%2C%2CCarlos+Prates%2C%2C%2Cneighborhood%2CBR%3EMinas+Gerais%3ENULL%3EBelo+Horizonte%3EBarrios%3ECarlos+Prates%2C-19.914795%2C-43.955177%2C%3B%2CMinas+Gerais%2CBelo+Horizonte%2C%2CSanta+Tereza%2C%2C%2Cneighborhood%2CBR%3EMinas+Gerais%3ENULL%3EBelo+Horizonte%3EBarrios%3ESanta+Tereza%2C-19.919168%2C-43.938656%2C%3B%2CMinas+Gerais%2CBelo+Horizonte%2C%2CSagrada+Fam%C3%ADlia%2C%2C%2Cneighborhood%2CBR%3EMinas+Gerais%3ENULL%3EBelo+Horizonte%3EBarrios%3ESagrada+Familia%2C-19.898079%2C-43.917536%2C%3B%2CMinas+Gerais%2CBelo+Horizonte%2C%2CCentro%2C%2C%2Cneighborhood%2CBR%3EMinas+Gerais%3ENULL%3EBelo+Horizonte%3EBarrios%3ECentro%2C-19.919168%2C-43.938656%2C%3B%2CMinas+Gerais%2CBelo+Horizonte%2C%2CS%C3%A3o+Lucas%2C%2C%2Cneighborhood%2CBR%3EMinas+Gerais%3ENULL%3EBelo+Horizonte%3EBarrios%3ESao+Lucas%2C-19.919052%2C-43.938669%2C%3B%2CMinas+Gerais%2CBelo+Horizonte%2C%2CPara%C3%ADso%2C%2C%2Cneighborhood%2CBR%3EMinas+Gerais%3ENULL%3EBelo+Horizonte%3EBarrios%3EParaiso%2C-19.912512%2C-43.903726%2C%3B%2CMinas+Gerais%2CBelo+Horizonte%2C%2CEsplanada%2C%2C%2Cneighborhood%2CBR%3EMinas+Gerais%3ENULL%3EBelo+Horizonte%3EBarrios%3EEsplanada%2C-19.905053%2C-43.903129%2C&tipos=apartamento_residencial%2Ckitnet_residencial%2Ccasa_residencial&quartos=1%2C2&precoMinimo=1000&precoMaximo=1700&ordem=Menor%2520pre%25C3%25A7o&transacao=aluguel";

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
