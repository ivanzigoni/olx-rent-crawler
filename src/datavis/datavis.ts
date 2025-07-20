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

function removeDuplicates<T = object>(arr: T[], k: string): T[] {
  return Object.values(
    arr.reduce((acc, el) => {
      if (acc[(el as { [key: string]: any })[k]]) {
        return acc;
      } else {
        acc[(el as { [key: string]: any })[k]] = el;
      }
      return acc;
    }, {} as { [key: string]: T })
  );
}

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

const output = removeDuplicates<Input>(
  loadBuffer(path.resolve(process.cwd(), "buffer")).filter(
    (property: Input) => {
      return (
        property.totalPrice &&
        property.totalPrice <= 1700 &&
        property.totalPrice >= 1300 &&
        property.area &&
        property.area >= 35
      );
    }
  ),
  "link"
).sort((a, b) => b.area - a.area);

const resultName = `result-${Date.now()}`;

fs.writeFileSync(
  path.resolve(process.cwd(), "output", `${resultName}.json`),
  JSON.stringify(output)
);

generatePropertiesHtml(
  path.resolve(process.cwd(), "output", `${resultName}.json`),
  path.resolve(process.cwd(), "output", `${resultName}.html`),
  15
);
