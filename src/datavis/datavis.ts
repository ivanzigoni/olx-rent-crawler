import path from "node:path";
import fs from "node:fs";
import { generatePropertiesHtml } from "./table";

type Input = {
  link: string;
  title: string;
  bedrooms: number;
  area: number;
  bathrooms: number;
  price: number;
  oldPrice: number | null;
  iptu: number;
  condominio: number;
  totalPrice: number;
  location: string;
  datePosted: string;
  origin: string;
};

function loadBuffer(baseBufferPath: string) {
  const result: Input[] = [];

  for (const pathName of fs.readdirSync(baseBufferPath)) {
    const p = path.resolve(baseBufferPath, pathName);

    if (fs.lstatSync(p).isDirectory()) {
      result.push(...loadBuffer(p));
      continue;
    }

    result.push(
      ...JSON.parse(
        fs.readFileSync(path.resolve(process.cwd(), "buffer", p), "utf-8")
      )
    );
  }

  return result;
}

const filtered = loadBuffer(path.resolve(process.cwd(), "buffer")).filter(
  (property: Input) => {
    return (
      property.totalPrice &&
      property.totalPrice <= 1700 &&
      property.totalPrice >= 1300 &&
      property.area &&
      property.area >= 35
    );
  }
);

const clean = Object.values(
  filtered.reduce((acc, el) => {
    if (acc[el.link]) {
      return acc;
    } else {
      acc[el.link] = el;
    }
    return acc;
  }, {} as { [key: string]: Input })
).sort((a, b) => a.area - b.area);

const resultName = `result-${Date.now()}`;

fs.writeFileSync(
  path.resolve(process.cwd(), "output", `${resultName}.json`),
  JSON.stringify(clean)
);

generatePropertiesHtml(
  path.resolve(process.cwd(), "output", `${resultName}.json`),
  path.resolve(process.cwd(), "output", `${resultName}.html`),
  15
);
