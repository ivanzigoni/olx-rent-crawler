import path from "node:path";
import fs from "node:fs";

type Input = {
    "link": string,
    "title": string,
    "rooms": number,
    "area": number,
    "bathrooms": number,
    "price": string,
    "oldPrice": string | null,
    "iptu": string,
    "condominio":string,
    "location": string,
    "datePosted":string,
}

const filtered = fs.readdirSync(path.resolve(process.cwd(), "buffer"))
.reduce((acc, p) => {
    acc = [...acc, ...JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "buffer", p), "utf-8"))];
    return acc;
}, [] as Input[])
.filter((property) => {
    const sum = Number(property.price) + Number(property.iptu) + Number(property.condominio);

    return sum <= 1700;
})

const clean = filtered.reduce((acc, el) => {
    if (acc[el.link]) {
        return acc;
    } else {
        acc[el.link] = el
    }
    return acc;
}, {} as { [key: string]: Input })

Object.values(clean)
.sort((a,b) => a.area - b.area)
fs.writeFileSync(path.resolve(process.cwd(), "output", `result-${Date.now()}.json`), JSON.stringify(filtered));
