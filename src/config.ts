import fs from "node:fs";
import path from "node:path";

export type Env = {
  olx: {
    startUrl: string[];
  };
  "viva-real": {
    startUrl: string;
  };
};

export function getConfig() {
  const configPath = path.resolve(process.cwd(), "config.json");

  if (!fs.existsSync(configPath)) {
    throw new Error("must provide config");
  }

  const config: object = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  if (!config) {
    throw new Error("must provide config");
  }

  if (!config["olx"] || !config["olx"]["startUrl"]) {
    throw new Error("must provide olx config");
  }

  if (!config["viva-real"] || !config["viva-real"]["startUrl"]) {
    throw new Error("must provide viva-real config");
  }

  return JSON.parse(fs.readFileSync(configPath, "utf-8")) as Env;
}
