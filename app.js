require("dotenv").config();
const cheerio = require("cheerio");
const { count } = require("console");
const fs = require("fs");

async function getHTML(url) {
    const fileName = url.pathname;
    const file = `${fileName.split("/").at(-1)}`
    if (!fs.existsSync(file)){
        try{
            const response = await fetch(url, {
                headers: {
                    "User-Agent" : "FlyRankInternship-9/1.0 (+https://github.com/sabbasova10/web_scrapper_practice.git)"
                },
                signal: AbortSignal.timeout(5000)
            });
            if(!response.ok){
                throw new Error(`Response status: ${response.status}`);
            }
            const result = await response.text();
            fs.writeFileSync(file, result);
            return result;
        } catch (error) {
            console.error(error.message);
        }
    }
    else{
        try {
            const data = fs.readFileSync(file, 'utf8');
            return data;
        } catch (err) {
            console.error(err);
        }
    }
};

function extractBookLinks(html) {
    const $ = cheerio.load(html);
    const link = $('li.next a').attr('href');
    if (!link) return null;
    return link;
};

function findNextPage(url, next) {
    const absoluteUrl = new URL(next, url);
    return absoluteUrl;
};

async function main() {
    let number = 0;
    let link = "None";
    let pageUrl = new URL(process.env.URL);
    /*while(link !== null){
        const html = await getHTML(pageUrl);
        link = extractBookLinks(html);
        pageUrl = findNextPage(pageUrl);
    }*/
   for(i = 0; i<3; i++){
        let html = await getHTML(pageUrl);
        const $ = cheerio.load(html);
        number += $('.product_pod').length;
        link = extractBookLinks(html);
        pageUrl = findNextPage(pageUrl, link);
   }
   console.log(number);
}

main().catch(console.error);