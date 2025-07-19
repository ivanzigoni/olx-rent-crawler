import * as dotenv from "dotenv";
import OpenAI from "openai";
import fs from "node:fs";
import path from "node:path";
dotenv.config();

function load() {
  if (!process.env['GPT_KEY']) {
    throw Error("MUST PROVIDE GPT_KEY")
  }

  return process.env['GPT_KEY']
}

const openai = new OpenAI({
        apiKey: load(),
});

function clean(html: string) {
    html.replace("```json", "");
    html.replace("```", "");
    return html;
}

function buildPrompt() {
    const raw = fs.readFileSync(path.resolve(process.cwd(), "assets", "cheerio_sample.html"), "utf-8");
    
    const basePrompt = fs.readFileSync(path.resolve(process.cwd(), "assets", "cheerio_prompt.txt"), "utf-8");

    const html = clean(raw);

    return `${basePrompt}\nHTML:\n${html}`;
}

async function sendPrompt(message: string) {
  const completion = await openai.chat.completions.create({
    messages: [{ role: "system", content: message }],
    model: "gpt-4.1-mini",
  });

  return completion.choices[0].message.content;
}

async function main() {
    const input = buildPrompt();
    
    const res = await sendPrompt(input);

    fs.writeFileSync(
        path.resolve(process.cwd(), "output", `${Date.now()}.txt`),
        res ?? ""
    )
}

main();