const puppeteer = require('puppeteer');
const path = require("node:path");
const fs = require("node:fs");

async function scrapeAllProperties(initialURL) {
    const browser = await puppeteer.launch({ headless: false, dumpio: true });
    const page = await browser.newPage();

    page.on('framedetached', (frame) => {
     console.log(`Frame detached: ${frame.url()}`);
    //  page.
    });
    browser.on('disconnected', () => {
        console.log('Browser disconnected.');
    });

    const results = [];

    await page.goto(initialURL);
    // await page.goto(initialURL, { waitUntil: 'networkidle2' });

    try {

    while (true) {
        // Wait for property cards to load
        console.log('Wait for property cards to load')
        await page.waitForSelector('li[data-cy="rp-property-cd"]');
        // await new Promise(res => setTimeout(() => {
        //         console.log("GOING NEXT PAGE")
        //         return res()
        //     }, 30000))
        // await new Promise(res => setTimeout(res, 10000));

        // Extract properties data on this page
        const propertiesOnPage = await page.evaluate(() => {
            const properties = [];
            console.log("GETTING ITEMS")
            const items = document.querySelectorAll('li[data-cy="rp-property-cd"]');
            items.forEach(item => {
                try {
                    const linkTag = item.querySelector('a[href]');
                    if (!linkTag) return;

                    const href = linkTag.href || null;

                    // Name or title: use the h2 tag data-cy rp-cardProperty-location-txt span block before neighborhood text
                    const h2 = item.querySelector('h2[data-cy="rp-cardProperty-location-txt"]');
                    let title = null;
                    if (h2) {
                        // text is like "Apartamento para alugar em Barro Preto, Belo Horizonte"
                        // we can get full innerText
                        title = h2.innerText.trim()
                            .replace(/\s+/g, ' '); // normalize spaces
                    }

                    // Street name
                    const street = item.querySelector('p[data-cy="rp-cardProperty-street-txt"]');
                    const streetName = street ? street.textContent.trim() : null;

                    // Area, Bedrooms, Bathrooms, Parking (amount)
                    // They are in ul > li with data-cy starting with rp-cardProperty-
                    const details = {};
                    item.querySelectorAll('li[data-cy^="rp-cardProperty-"]').forEach(li => {
                        if (li.dataset.cy === 'rp-cardProperty-propertyArea-txt') {
                            const areaText = li.innerText.trim();
                            details.area = areaText; // e.g. "85 m²"
                        }
                        else if (li.dataset.cy === 'rp-cardProperty-bedroomQuantity-txt') {
                            const bedroomsText = li.innerText.trim();
                            details.bedrooms = bedroomsText; // e.g. "2"
                        }
                        else if (li.dataset.cy === 'rp-cardProperty-bathroomQuantity-txt') {
                            const bathroomsText = li.innerText.trim();
                            details.bathrooms = bathroomsText; // e.g. "1"
                        }
                        else if (li.dataset.cy === 'rp-cardProperty-parkingSpacesQuantity-txt') {
                            const parkingText = li.innerText.trim();
                            details.parking = parkingText; // e.g. "2"
                        }
                    });

                    // Price and additional pricing details (condominium, IPTU)
                    const priceContainer = item.querySelector('div[data-cy="rp-cardProperty-price-txt"]');
                    let price = null;
                    let condominium = null;
                    let iptu = null;
                    if (priceContainer) {
                        // First p tag: main price text 'R$ 4.500/mês'
                        const priceP = priceContainer.querySelector('p.text-2-25');
                        if (priceP) {
                            // extract just the number with currency, e.g. "R$ 4.500/mês"
                            price = priceP.textContent.trim().replace(/\s/g, ''); // compact spacing
                        }
                        // Second p tag: "Cond. R$ 720 • IPTU R$ 271"
                        const feesP = priceContainer.querySelectorAll('p.text-1-75');
                        if (feesP && feesP.length > 0) {
                            feesP.forEach(p => {
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

                    properties.push({
                        title,
                        link: href,
                        street: streetName,
                        area: details.area ? details.area.replace(/\D/g, '') : null,
                        bedrooms: details.bedrooms ? details.bedrooms.replace(/\D/g, '') : null,
                        bathrooms: details.bathrooms || null,
                        parking: details.parking || null,
                        price: price.replace(/\D/g, ''),
                        condominio: condominium.replace(/\D/g, ''),
                        iptu: iptu.replace(/\D/g, ''),
                    });
                } catch (ex) {
                    // Catch any errors per item to not fail the entire extraction
                    console.error('Error parsing property item:', ex);
                }
            });
            return properties;
        });

        results.push(...propertiesOnPage);

        // Check for next page button
        const nextDisabled = await page.$('button[data-testid="next-page"][disabled]');
        if (nextDisabled) {
            // No next page, break the loop
            break;
        } else {
            // Click on next page
            await Promise.all([
                // page.waitForNavigation(),
                // page.waitForNavigation({ waitUntil: 'networkidle2' }),
                page.click('button[data-testid="next-page"]')
            ]);
        }
    }

    return results;
    } catch (e) {
        console.log("failed do to frame closing. will process what went so far");
        return results
    } finally {
        await browser.close();
    }
}

// Usage example:
(async () => {
    const url = "https://www.vivareal.com.br/aluguel/minas-gerais/belo-horizonte/bairros/prado/apartamento_residencial/?onde=%2CMinas+Gerais%2CBelo+Horizonte%2CBairros%2CPrado%2C%2C%2Cneighborhood%2CBR%3EMinas+Gerais%3ENULL%3EBelo+Horizonte%3EBarrios%3EPrado%2C-19.922983%2C-43.960787%2C%3B%2CMinas+Gerais%2CBelo+Horizonte%2CBairros%2CSanta+Efig%C3%AAnia%2C%2C%2Cneighborhood%2CBR%3EMinas+Gerais%3ENULL%3EBelo+Horizonte%3EBarrios%3ESanta+Efigenia%2C-19.916704%2C-43.929334%2C%3B%2CMinas+Gerais%2CBelo+Horizonte%2CBairros%2CFloresta%2C%2C%2Cneighborhood%2CBR%3EMinas+Gerais%3ENULL%3EBelo+Horizonte%3EBarrios%3EFloresta%2C-19.916704%2C-43.929334%2C%3B%2CMinas+Gerais%2CBelo+Horizonte%2CBairros%2CCarlos+Prates%2C%2C%2Cneighborhood%2CBR%3EMinas+Gerais%3ENULL%3EBelo+Horizonte%3EBarrios%3ECarlos+Prates%2C-19.914795%2C-43.955177%2C%3B%2CMinas+Gerais%2CBelo+Horizonte%2CBairros%2CSagrada+Fam%C3%ADlia%2C%2C%2Cneighborhood%2CBR%3EMinas+Gerais%3ENULL%3EBelo+Horizonte%3EBarrios%3ESagrada+Familia%2C-19.898079%2C-43.917536%2C%3B%2CMinas+Gerais%2CBelo+Horizonte%2CBairros%2CHorto%2C%2C%2Cneighborhood%2CBR%3EMinas+Gerais%3ENULL%3EBelo+Horizonte%3EBarrios%3EHorto%2C-19.919052%2C-43.938669%2C%3B%2CMinas+Gerais%2CBelo+Horizonte%2CBairros%2CBarro+Preto%2C%2C%2Cneighborhood%2CBR%3EMinas+Gerais%3ENULL%3EBelo+Horizonte%3EBarrios%3EBarro+Preto%2C-19.923309%2C-43.953608%2C%3B%2CMinas+Gerais%2CBelo+Horizonte%2CBairros%2CSanta+Tereza%2C%2C%2Cneighborhood%2CBR%3EMinas+Gerais%3ENULL%3EBelo+Horizonte%3EBarrios%3ESanta+Tereza%2C-19.919168%2C-43.938656%2C&tipos=apartamento_residencial%2Ccasa_residencial%2Cedificio-residencial_comercial&quartos=1%2C2&precoMinimo=1000&precoMaximo=1700&transacao=aluguel";
    const buffer_path = path.resolve(process.cwd(), "buffer");
    const allProperties = await scrapeAllProperties(url);

    fs.writeFileSync(
        path.resolve(buffer_path, `viva-real-${Date.now()}.json`),
        JSON.stringify(allProperties)
    )
    // You can save the array to a file if needed.
})();

/////////////////////////////
// Explanation:
//
// - We navigate to the initial URL of the listing.
//
// - On each page, we wait for the property items to load.
//
// - Use page.evaluate to get all properties on the page by selecting the <li> with data-cy="rp-property-cd".
//
// - Extract relevant information such as title, link, address, area, rooms info, prices, tags and images.
//
// - Use pagination buttons with data-testid='next-page' to go through next pages until no next page is available.
//
// - Collect all properties info into an array and return at the end.
//
//
// Adjust the initialURL to your actual page URL.
//
// Note: Puppeteer will load all pages dynamically and run JavaScript so items hidden initially or loaded later will be available.
//
/////////////////////////////