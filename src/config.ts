import fs from "node:fs";
import path from "node:path";

export type Env = {
    "olx": {
        "startUrl": string[]
    },
    "viva-real": {
        "startUrl": string
    }
}

export function getConfig() {
    const configPath = path.resolve(process.cwd(), "config.json");

    if (!fs.existsSync(configPath)) {
        throw new Error("must provide config")
    }

    return JSON.parse(fs.readFileSync(configPath, "utf-8")) as Env;
}