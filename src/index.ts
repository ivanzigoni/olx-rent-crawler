import cp from "node:child_process";

async function main() {
    try {
        await Promise.all([
            cp.exec("npm run crawler:olx"),
            cp.exec("npm run crawler:viva-real")
        ])
        cp.execSync("npm run datavis");
    } catch (e) {
        console.log(e);
        process.exit(0);
    }
}
main();