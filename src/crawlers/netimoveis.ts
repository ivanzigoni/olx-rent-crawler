import puppeteer, { Browser, ConsoleMessage } from "puppeteer";
import path from "node:path";
import fs from "node:fs";
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

async function scrapeNetImoveis(
  url: string,
  browser: Browser
): Promise<Property[]> {
  const page = await browser.newPage();
  page.on("console", (log: ConsoleMessage) =>
    console.log("[NETIMOVEIS]", log.text())
  );

  // Set user-agent as some sites block headless clients
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)" +
      " Chrome/112.0.0.0 Safari/537.36"
  );

  let results: Property[] = [];

  async function extractUrls() {
    return page.evaluate(() => {
      console.log("Inside page.evaluate - extracting urls");

      const cards = Array.from(
        document.querySelectorAll("article.card-imovel")
      );

      return cards.map((c) => {
        let linkEl = c.querySelector("a.link-imovel");
        return linkEl ? (linkEl as HTMLAnchorElement).href : "";
      });
    });
  }

  async function extractProperty(url: string) {
    await page.goto(url, { waitUntil: "networkidle2" });

    await page.waitForSelector(".detail-value");
    await page.waitForSelector("h1#titulo");
    await page.waitForSelector("section.section-title > div.text-gray");
    await page.waitForSelector("section.details.prices div.detail");
    // await page.waitForSelector("section.details.features.arealote div.detail");

    return page.evaluate((url: string) => {
      const p: Property = {
        link: url,
        title: "",
        bedrooms: 0,
        area: 0,
        bathrooms: 0,
        price: 0,
        iptu: 0,
        condominio: 0,
        totalPrice: 0,
        location: "",
        datePosted: "N/A",
        origin: "NETIMOVEIS",
      };

      // title: first h1 with id="titulo"
      const titleEl = document.querySelector("h1#titulo") as any;
      if (titleEl) {
        // The h1 text contains extra line breaks, just get normalized text
        p.title = titleEl.textContent.trim().replace(/\s+/g, " ");
      }

      // location: div text-gray inside section mb-3 section-title
      // From example: <div class="mb-1 text-gray">Rua Itanhandu, Carlos Prates – Belo Horizonte</div>
      const locationEl = document.querySelector(
        "section.section-title > div.text-gray"
      ) as any;
      if (locationEl) {
        p.location = locationEl.textContent.trim();
      }

      // price, iptu, condominio from section.details.prices div.detail where detail-name contains key
      const detailElements = document.querySelectorAll(
        "section.details.prices div.detail"
      ) as any;
      detailElements.forEach((detail: any) => {
        const name =
          detail
            .querySelector(".detail-name")
            ?.textContent.trim()
            .toLowerCase() ?? "";
        const value =
          detail.querySelector(".detail-value")?.textContent.trim() ?? "";
        if (name.includes("valor de locação")) {
          p.price = Number(value.split(",")[0].replace(/\D/g, ""));
        } else if (name.includes("condomínio")) {
          p.condominio = Number(value.split(",")[0].replace(/\D/g, ""));
        } else if (name.includes("iptu")) {
          p.iptu = Number(value.split(",")[0].replace(/\D/g, ""));
        }
      });

      // totalPrice: price + iptu + condominio
      p.totalPrice = p.price + p.iptu + p.condominio;

      // features: bedrooms, area, bathrooms from section.details.features.arealote div.detail
      // We look for specific detail-value containing "quartos", "banheiros", "m²"
      const features = document.querySelectorAll(".detail-value");
      features.forEach((valEl: any) => {
        if (!valEl) return;

        const textVal = valEl.textContent.trim().toLowerCase();

        // bedrooms: look for "quartos"
        if (textVal.includes("quart")) {
          p.bedrooms = Number(textVal.replace(/\D/g, "") ?? 0);
        }
        // bathrooms: look for "banheiros"
        else if (textVal.includes("banhei")) {
          p.bathrooms = Number(textVal.replace(/\D/g, "") ?? 0);
        }
        // area: look for "m²" and "área aproximada"
        else if (textVal.includes("m²")) {
          // In the example, the area is under "área aproximada" with line break, pick first matching number
          p.area = Number(textVal.split(",")[0].replace(/\D/g, ""));
        }
      });

      return p;
    }, url);
  }

  async function hasNextPage(): Promise<boolean> {
    // Look for next button that is not disabled
    return await page.evaluate(() => {
      const nextBtn = document.querySelector("nav ul.pagination li.clnext");
      if (!nextBtn) {
        return false;
      }
      const hasNext = !nextBtn.classList.contains("disabled");
      return hasNext;
    });
  }

  async function goToNextPage() {
    // Click next button
    await page.evaluate(() => {
      const nextBtn = document.querySelector("nav ul.pagination li.clnext");
      if (nextBtn && !nextBtn.classList.contains("disabled")) {
        (
          (nextBtn.querySelector("span") ||
            nextBtn.querySelector("a") ||
            nextBtn) as any
        ).click();
      }
    });
  }

  const urls: string[] = [];

  // Load first page
  await page.goto(url, { waitUntil: "networkidle2" });

  let pageCount = 1;
  while (true) {
    const extracted = await extractUrls();
    urls.push(...extracted);

    if (!(await hasNextPage())) {
      break;
    }
    await goToNextPage();
    pageCount++;
  }

  const filtered = urls.filter(
    (u: string) => !u.toLowerCase().includes("urldetalheimovel")
  );

  for (const url of filtered) {
    const property = await extractProperty(url);

    results.push(property);
  }

  return results;
}

async function execute(browser?: Browser) {
  const urls = getConfig().netimoveis.startUrl;

  const buffer_path = path.resolve(process.cwd(), "buffer", "netimoveis");

  if (fs.existsSync(buffer_path)) {
    fs.rmSync(buffer_path, { recursive: true });
  }

  fs.mkdirSync(buffer_path);

  const b =
    browser ??
    (await puppeteer.launch({
      headless: false,
      args: ["--disable-features=site-per-process"],
    }));

  const result: Property[] = [];

  for (const url of urls) {
    const properties = await scrapeNetImoveis(url, b);

    result.push(...properties);
  }

  const outputFile = path.resolve(buffer_path, `netimoveis-${Date.now()}.json`);

  fs.writeFileSync(outputFile, JSON.stringify(result));

  if (!browser) {
    await b.close();
  }
}

if (require.main === module) {
  execute();
}

export default execute;
