import fs from "node:fs";
import path from "node:path";

export type Env = {
  olx: {
    startUrl: string[];
  };
  netimoveis: {
    startUrl: string[];
  };
  "viva-real": {
    startUrl: string;
  };
  "zap-imoveis": {
    startUrl: string;
  };
};

export function getConfig() {
  const configPath = path.resolve(process.cwd(), "config.json");

  if (!fs.existsSync(configPath)) {
    throw new Error("must provide config");
  }

  const config: Env = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  if (!config) {
    throw new Error("must provide config");
  }

  if (!config["olx"] || !config["olx"]["startUrl"]) {
    throw new Error("must provide olx config");
  }

  if (!config["viva-real"] || !config["viva-real"]["startUrl"]) {
    throw new Error("must provide viva-real config");
  }

  if (!config["zap-imoveis"] || !config["zap-imoveis"]["startUrl"]) {
    throw new Error("must provide zap-imoveis config");
  }

  if (!config["netimoveis"] || !config["netimoveis"]["startUrl"]) {
    throw new Error("must provide netimoveis config");
  }

  return config;
}
