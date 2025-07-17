
import puppeteer from 'puppeteer';
import fs from "node:fs";
import path from "node:path";

async function scrapeAllProperties(url: string) {
  const browser = await puppeteer.launch({headless:false});
  // const browser = await puppeteer.launch({headless: true});
  const page = await browser.newPage();

  // Open the first page
  await page.goto(url, {waitUntil: 'networkidle2'});
  
  let properties = [] as any[];
  let hasNextPage = true;

  while (hasNextPage) {
    // Wait for property listing sections to load
    // await page.waitForSelector('section.olx-adcard');
    await page.waitForSelector('a[data-testid="adcard-link"]');

    // Extract property info of the current page
    const propsOnPage = await page.evaluate(() => {
      // Select all property cards
      const cards = Array.from(document.querySelectorAll('section.olx-adcard'));

      return cards.map(card => {
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

    properties.push(...propsOnPage);

    // Check if next page button exists and is enabled
    // Using pagination buttons bottom, class 'ListingPagination_wrapper__y_Gg5' or just using "Próxima página" link
    hasNextPage = await page.evaluate(() => {
      const nextBtn = Array.from(document.querySelectorAll('button')).find(button => button.innerText.includes('Próxima página') || button.innerText.includes('Próxima'));
      if (nextBtn && !nextBtn.disabled) return true;
      // Alternatively try next link by text
      const nextLink = document.querySelector('a[rel="next"], a[aria-label*="Próxima página"], a[aria-label*="Próxima"]');
      if (nextLink) return true;
      return false;
    });

    if (hasNextPage) {
      // Try clicking the next page button or link
      let clicked = false;

      // Try button first
      const nextPageButton = await (page as any).$x("//button[contains(., 'Próxima página') or contains(., 'Próxima')]");
      if(nextPageButton.length > 0){
        try {
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
            nextPageButton[0].click(),
          ]);
          clicked = true;
        } catch(e) {clicked = false;}
      }

      // If no button or failed clicking, try link
      if (!clicked) {
        const nextPageLink = await page.$('a[rel="next"], a[aria-label*="Próxima página"], a[aria-label*="Próxima"]');
        if(nextPageLink){
          try {
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'networkidle2' }),
              nextPageLink.click()
            ]);
            clicked = true;
          } catch(e) {clicked = false;}
        }
      }

      if(!clicked) {
        // Can't navigate further, break loop
        break;
      }
    }
  }

  await browser.close();
  return properties;
}


(async () => {
  const urls = [
    //zona leste
    "https://www.olx.com.br/imoveis/aluguel/estado-mg/belo-horizonte-e-regiao/zona-leste?ps=1000&pe=1700&sp=2&coe=500&ipe=500&ros=1&ros=2",
    //centro
    "https://www.olx.com.br/imoveis/aluguel/estado-mg/belo-horizonte-e-regiao/zona-centro-sul/centro?ps=1000&pe=1700&sp=2&coe=500&ipe=500&ros=1&ros=2",
    //noroeste
    "https://www.olx.com.br/imoveis/aluguel/estado-mg/belo-horizonte-e-regiao/zona-noroeste?ps=1000&pe=1700&sp=2&coe=500&ipe=500&ros=1&ros=2",
    //grande belo horizonte
    "https://www.olx.com.br/imoveis/aluguel/estado-mg/belo-horizonte-e-regiao/grande-belo-horizonte?ps=1000&pe=1700&sp=2&coe=500&ipe=500&ros=1&ros=2",
    //belo horizonte ddd 31
    "https://www.olx.com.br/imoveis/aluguel/estado-mg/belo-horizonte-e-regiao?ps=1000&pe=1700&sp=2&coe=500&ipe=500&ros=1&ros=2",
    
  ]

  const fileName = (u: string) => u.split("?")[0].split("/")[u.split("?")[0].split("/").length - 1]

  const buffer_path = path.resolve(process.cwd(), "buffer") 

  if (fs.existsSync(buffer_path)){
    fs.rmSync(buffer_path, { recursive:true })
  }

  fs.mkdirSync(buffer_path)

  for (const url of urls) {
    const allProperties = await scrapeAllProperties(url);
        fs.writeFileSync(
            path.resolve(buffer_path, `${fileName(url)}-${Date.now()}.json`),
            JSON.stringify(allProperties)
        )
  }

})();