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
.filter((property: Input) => {
    const sum = Number(property.price ?? 0) + Number(property.iptu ?? 0) + Number(property.condominio ?? 0);

    return sum <= 1700 && sum >= 1300 && property.area && property.area >= 35;
})

const clean = Object.values(filtered.reduce((acc, el) => {
    if (acc[el.link]) {
        return acc;
    } else {
        acc[el.link] = el
    }
    return acc;
}, {} as { [key: string]: Input }))
.sort((a,b) => a.area - b.area)

fs.writeFileSync(path.resolve(process.cwd(), "output", `result-${Date.now()}.json`), JSON.stringify(clean));
