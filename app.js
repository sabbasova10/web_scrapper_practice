
//const cheerio = require("cheerio");
const fs = require("fs");

//const URL = process.env.URL;
const url = new URL("https://books.toscrape.com/catalogue/page-2.html");
const fileName = url.pathname.split('/').at(-1);

const fileParts = ['cache/' ,'catalogue-', fileName];
let file = fileParts.join("");

async function getHTML() {
    if (!fs.existsSync(file)){
        try{
            const response = await fetch(url, {
                headers: {
                    "User-Agent" : "FlyRankInternship-9/1.0 (+https://github.com/sabbasova10/web_scrapper_practice.git)"
                },
                signal: AbortSignal.timeout(10000)
            });
            if(!response.ok){
                throw new Error(`Response status: ${response.status}`);
            }
            const result = await response.text();
            fs.writeFileSync(file, result);
            return "Cache Hit";
        } catch (error) {
            console.error(error.message);
        }
    }
    else{
        try {
            const data = fs.readFileSync(file, 'utf8');
            return "Read file";
        } catch (err) {
            console.error(err);
        }
    }
};

async function main() {
    const html = await getHTML();
    console.log(html);
}

main().catch(console.error);