import puppeteer, { Browser } from 'puppeteer';
import fs from "node:fs";
import path from "node:path";

async function scrapeAllProperties(url: string, browser: Browser) {

  console.log('Opening a new page...');
  const page = await browser.newPage();
  
  console.log('Initializing properties array and pagination flag...');
  let properties = [] as any[];
  let hasNextPage = true;

  while (hasNextPage) {
    console.log(`Navigating to URL: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded" });

    console.log('Waiting for property cards to load...');
    // await page.waitForSelector('a[data-testid="adcard-link"]');

    console.log('Extracting property information from current page...');
    const propsOnPage = await page.evaluate(() => {
      console.log('Selecting all property cards on the page...');
      const cards = Array.from(document.querySelectorAll('section.olx-adcard'));

      return cards.map(card => {
        console.log('Processing individual property card...');
        // Link & Title
        const linkEl = card.querySelector('a.olx-adcard__link[href]') as any;
        const link = linkEl ? linkEl.href : null;
        const title = linkEl ? linkEl.title || linkEl.innerText.trim() : null;

        // Details: rooms, area, bathrooms (usually in aria-label or in detail elements)
        let rooms = null, area = null, bathrooms = null;
        const details = card.querySelectorAll('.olx-adcard__detail') as any;
        details.forEach(detail => {
          const label = detail.getAttribute('aria-label') || '';
          const text = detail.innerText.trim();

          if (label.toLowerCase().includes('quarto')) {
            // extract rooms number, it might be like "2 quartos" or aria-label contains number
            const match = label.match(/(\d+)/);
            if(match) rooms = Number(match[1]) as any;
          } else if (label.toLowerCase().includes('metro') || label.toLowerCase().includes('m²') || text.toLowerCase().includes('m²')) {
            // extract area number
            const match = label.match(/(\d+)/);
            if(match) area = Number(match[1]) as any;
          } else if (label.toLowerCase().includes('banheiro')) {
            // extract bathrooms number
            const match = label.match(/(\d+)/);
            if(match) bathrooms = Number(match[1]) as any;
          }
        });

        // Price: main price & old price if present
        const priceEl = card.querySelector('h3.olx-adcard__price') as any;
        const priceText = priceEl ? priceEl.innerText.trim().replace(/\D/g, '') : "0";

        const oldPriceEl = card.querySelector('p.olx-adcard__old-price') as any;
        const oldPriceText = oldPriceEl ? oldPriceEl.innerText.trim() : null;

        // Additional price infos e.g. IPTU, Condomínio etc
        const priceInfosEls = card.querySelectorAll('div.olx-adcard__price-info') as any;
        const priceInfos = {} as any;

        priceInfosEls.forEach(piEl => {
          const piText = piEl.innerText.trim();
          if (piText.toLowerCase().startsWith('iptu')) {
            priceInfos.iptu = piText.replace(/\D/g, '');
          } else if (piText.toLowerCase().startsWith('condomínio') || piText.toLowerCase().startsWith('condominio')) {
            priceInfos.condominio = piText.replace(/\D/g, '');
          }
        });

        // Location
        const locationEl = card.querySelector('p.olx-adcard__location') as any;
        const location = locationEl ? locationEl.innerText.trim() : null;

        // Date posted
        const dateEl = card.querySelector('p.olx-adcard__date') as any;
        const datePosted = dateEl ? dateEl.innerText.trim() : null;

        return {
          link,
          title,
          rooms,
          area,
          bathrooms,
          price: priceText,
          oldPrice: oldPriceText,
          iptu: priceInfos.iptu,
          condominio: priceInfos.condominio,
          location,
          datePosted,
        };
      });
    });

    console.log(`Found ${propsOnPage.length} properties on this page. Adding to results...`);
    properties.push(...propsOnPage);

    console.log('Checking if there is a next page...');
    hasNextPage = await page.evaluate(() => {
      const nextBtn = Array.from(document.querySelectorAll('button')).find(button => button.innerText.includes('Próxima página') || button.innerText.includes('Próxima'));
      if (nextBtn && !nextBtn.disabled) return true;
      // Alternatively try next link by text
      const nextLink = document.querySelector('a[rel="next"], a[aria-label*="Próxima página"], a[aria-label*="Próxima"]');
      if (nextLink) return true;
      return false;
    });

    if (hasNextPage) {
      console.log('Next page available. Attempting to navigate...');
      let clicked = false;

      console.log('Trying to click next page button...');
      const nextPageButton = await (page as any).$x("//button[contains(., 'Próxima página') or contains(., 'Próxima')]");
      if(nextPageButton.length > 0){
        try {
          await Promise.all([
            page.waitForNavigation(),
            nextPageButton[0].click(),
          ]);
          clicked = true;
          console.log('Successfully clicked next page button.');
        } catch(e) {
          console.log('Failed to click next page button.');
          clicked = false;
        }
      }

      if (!clicked) {
        console.log('Trying to click next page link...');
        const nextPageLink = await page.$('a[rel="next"], a[aria-label*="Próxima página"], a[aria-label*="Próxima"]');
        if(nextPageLink){
          try {
            await Promise.all([
              page.waitForNavigation(),
              nextPageLink.click()
            ]);
            clicked = true;
            console.log('Successfully clicked next page link.');
          } catch(e) {
            console.log('Failed to click next page link.');
            clicked = false;
          }
        }
      }

      if(!clicked) {
        console.log('Could not navigate to next page. Ending pagination.');
        break;
      }
    } else {
      console.log('No more pages available. Ending pagination.');
    }
  }

  console.log(`Scraping complete. Found ${properties.length} properties in total.`);
  await page.close();
  return properties;
}


(async () => {
  console.log('Starting scraping process...');
  const urls = [
    //zona leste
    "https://www.olx.com.br/imoveis/aluguel/estado-mg/belo-horizonte-e-regiao/zona-leste?ps=1000&pe=1700&sp=2&coe=500&ipe=500&ros=1&ros=2",
    //zona centro sul
    "https://www.olx.com.br/imoveis/aluguel/estado-mg/belo-horizonte-e-regiao/zona-centro-sul?ps=1000&pe=1700&sp=2&coe=500&ipe=500&ros=1&ros=2",
    //carlos prates
    "https://www.olx.com.br/imoveis/aluguel/estado-mg/belo-horizonte-e-regiao/zona-noroeste/carlos-prates?ps=1000&pe=1700&sp=2&coe=500&ipe=500&ret=1020&ret=1040&ros=1&ros=2",
    //prado
    "https://www.olx.com.br/imoveis/aluguel/estado-mg/belo-horizonte-e-regiao/zona-oeste/prado?ps=1000&pe=1700&sp=2&coe=500&ipe=500&ret=1020&ret=1040&ros=1&ros=2",
    //padre eustaquio
    "https://www.olx.com.br/imoveis/aluguel/estado-mg/belo-horizonte-e-regiao/zona-noroeste/padre-eustaquio?ps=1000&pe=1700&sp=2&coe=500&ipe=500&ret=1020&ret=1040&ros=1&ros=2",
  ]

  console.log('Preparing file name generator function...');
  const fileName = (u: string) => u.split("?")[0].split("/")[u.split("?")[0].split("/").length - 1]

  console.log('Setting up buffer directory...');
  const buffer_path = path.resolve(process.cwd(), "buffer") 

  if (fs.existsSync(buffer_path)){
    console.log('Buffer directory exists. Removing it...');
    fs.rmSync(buffer_path, { recursive:true })
  }

  console.log('Creating new buffer directory...');
  fs.mkdirSync(buffer_path)

  console.log('Launching browser in non-headless mode...');
  const browser = await puppeteer.launch({headless:false});

  console.log('Starting to process each URL...');
  for (const url of urls) {
    console.log(`Processing URL: ${url}`);
    const allProperties = await scrapeAllProperties(url, browser);
    console.log(`Writing results to file for ${fileName(url)}...`);
    fs.writeFileSync(
        path.resolve(buffer_path, `${fileName(url)}-${Date.now()}.json`),
        JSON.stringify(allProperties)
    )
    console.log(`Finished processing ${url}`);
  }

  console.log('Closing browser...');
  await browser.close();

  console.log('All URLs processed. Scraping complete.');
})();