require("dotenv").config();
const cheerio = require("cheerio");
const fs = require("fs");

async function getHTML(url) {
    const fileName = url.pathname.replace(/\//g, "_") || "index.html";
    const file = `cache_${fileName}`;

    if (!fs.existsSync(file)) {
        try {
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "FlyRankInternship-9/1.0 (+https://github.com/sabbasova10/web_scrapper_practice.git)"
                },
                signal: AbortSignal.timeout(5000)
            });
            if (!response.ok) {
                throw new Error(`Response status: ${response.status}`);
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
    const availabilityText = productMain.find('.availability').text().replace(/\s+/g, ' ').trim();
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
        title: title || null,
        product_url: detailUrl.href,
        price_text: priceText || null,
        availability_text: availabilityText || null,
        rating_text: ratingText || null,
        description: description,
        source_page: sourcePageUrl.href,
        fetched_at: new Date().toISOString()
    };
}

async function main() {
    let pageUrl = new URL(process.env.URL);
    const allRecords = [];

    for (let i = 0; i < 3; i++) {
        if (!pageUrl) break;

        const currentCatalogUrl = pageUrl;
        const catalogHtml = await getHTML(currentCatalogUrl);
        if (!catalogHtml) break;

        const bookUrls = extractBookLinks(catalogHtml, currentCatalogUrl);

        for (const bookUrl of bookUrls) {
            const detailHtml = await getHTML(bookUrl);
            if (detailHtml) {
                const record = extractBookDetail(detailHtml, bookUrl, currentCatalogUrl);
                allRecords.push(record);
            }
        }

        pageUrl = findNextPage(currentCatalogUrl, catalogHtml);
    }

    fs.writeFileSync("books.json", JSON.stringify(allRecords, null, 2));

    if (allRecords.length > 0) {
        console.log(JSON.stringify(allRecords[0], null, 2));
    }
    console.log(`detail_pages=${allRecords.length}`);
}

main().catch(console.error);