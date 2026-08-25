require("dotenv").config();
const cheerio = require("cheerio");
const fs = require("fs");
const z = require("zod");

const schema = z.object({
    title: z.string(),
    product_url: z.string().url(),
    price_text: z.string(),
    price_gbp: z.number(),
    availability_text: z.string(),
    available_books: z.number(),
    rating_text: z.string(),
    description: z.string().nullable(),
    source_page: z.string().url(),
    fetched_at: z.string().datetime()
});

let metaData = [];

async function dataFetching(url){
    const response = await fetch(url, {
        headers: {
            "User-Agent": "FlyRankInternship-9/1.0 (+https://github.com/sabbasova10/web_scrapper_practice.git)"
        },
        signal: AbortSignal.timeout(5000)
    });

    return response;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getHTML(url) {
    const fileName = url.pathname.replace(/\//g, "_") || "index.html";
    const file = `cache/cache_${fileName}`;

    if (!fs.existsSync(file)) {
        try {
            let response = await dataFetching(url);
            if((response.status >= 500 && response.status < 600) || response.status == 429){
                await sleep(5000);
                response = await dataFetching(url);
                if (!response.ok) return null;
            }
            else if (!response.ok){
                console.log(`Status code: ${response.status}`);
                return null;
            }

            const result = await response.text();
            fs.writeFileSync(file, result);
            return result;
            
        } catch (error) {
            console.error(`Error fetching ${url.href}:`, error.message);
            return null;
        }
    } else {
        try {
            const data = fs.readFileSync(file, "utf8");
            return data;
        } catch (err) {
            console.error(`Error reading ${file}:`, err.message);
            return null;
        }
    }
}

function findNextPage(url, html) {
    const $ = cheerio.load(html);
    const link = $('li.next a').attr('href');
    if (!link) return null;
    return new URL(link, url);
}

function extractBookLinks(html, catalogUrl) {
    const $ = cheerio.load(html);
    const bookUrls = [];

    $('.product_pod h3 a').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
            const absoluteUrl = new URL(href, catalogUrl);
            bookUrls.push(absoluteUrl);
        }
    });

    return bookUrls;
}

function extractBookDetail(html, detailUrl, sourcePageUrl) {
    const $ = cheerio.load(html);
    const productMain = $('.product_main');

    const title = productMain.find('h1').text().trim();
    const priceText = productMain.find('.price_color').text().trim();
    const priceGbp = parseFloat(priceText.replace(/[^0-9.]/g, ""));
    const availabilityText = productMain.find('.availability').text().replace(/\s+/g, ' ').trim();
    const availableBooks = parseInt(availabilityText.replace(/[^0-9]/g, ""), 10);
    const ratingClass = productMain.find('.star-rating').attr('class') || "";
    const ratingText = ratingClass.replace('star-rating', '').trim();

    const descriptionEl = $('#product_description');
    let description = null;
    if (descriptionEl.length > 0) {
        const descText = descriptionEl.next('p').text().trim();
        if (descText.length > 0) {
            description = descText;
        }
    }

    return {
        title: title,
        product_url: detailUrl.href,
        price_text: priceText,
        price_gbp: priceGbp || 0,
        availability_text: availabilityText,
        available_books: availableBooks|| 0,
        rating_text: ratingText || null,
        description: description,
        source_page: sourcePageUrl.href,
        fetched_at: new Date().toISOString()
    };
}

async function main() {
    let pageUrl = new URL(process.env.URL);
    const ValidRecordsMap = new Map();
    const errorRecords = [];

    for (let i = 0; i < 3; i++) {
        if (!pageUrl) break;

        const currentCatalogUrl = pageUrl;
        const catalogHtml = await getHTML(currentCatalogUrl);
        if (!catalogHtml) continue;

        const bookUrls = extractBookLinks(catalogHtml, currentCatalogUrl);

        for (const bookUrl of bookUrls) {
            const detailHtml = await getHTML(bookUrl);
            if (detailHtml) {
                const record = extractBookDetail(detailHtml, bookUrl, currentCatalogUrl);
                const validation = schema.safeParse(record);

                if (validation.success){
                    ValidRecordsMap.set(validation.data.product_url, validation.data);
                }
                else{
                    errorRecords.push({
                        rawRecord: record,
                        errors: validation.error.issues
                    });
                }
            }
            else{
                continue;
            }
        }

        pageUrl = findNextPage(currentCatalogUrl, catalogHtml);
    }

    const finalBooks = Array.from(ValidRecordsMap.values());

    fs.writeFileSync("output/books.json", JSON.stringify(finalBooks, null, 2));
    fs.writeFileSync("output/errors.json", JSON.stringify(errorRecords, null, 2));

    if (finalBooks.length > 0) {
        console.log(JSON.stringify(finalBooks[0], null, 2));
    }
    console.log(`detail_pages=${finalBooks.length}`);
    console.log(`failed_pages=${errorRecords.length}`);

    metaData.push({
        "detail_pages": finalBooks.length,
        "failed_pages": errorRecords.length
    });

    fs.writeFileSync("output/report.json", JSON.stringify(metaData, null, 2));
}


main().catch(console.error);