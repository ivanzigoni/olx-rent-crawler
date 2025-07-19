import fs from "node:fs";
import path from "node:path";

(() => {
  const buffer = path.resolve(process.cwd(), "buffer");

  if (fs.existsSync(buffer)) {
    fs.rmSync(buffer, { recursive: true });
  }

  fs.mkdirSync(buffer);
})();
