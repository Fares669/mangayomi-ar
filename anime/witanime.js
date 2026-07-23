// WitAnime extension for Mangayomi - configurable build 0.0.28
const mangayomiSources = [{
    "name": "WitAnime",
    "lang": "ar",
    "baseUrl": "https://witanime.you",
    "apiUrl": "",
    "iconUrl": "https://witanime.you/wp-content/uploads/2023/08/cropped-Logo-WITU-192x192.png",
    "typeSource": "single",
    "itemType": 1,
    "version": "0.0.28",
    "pkgPath": "",
    "notes": "Generate GoFile website tokens and sync guest accounts"
}];

class DefaultExtension extends MProvider {
    getPreferenceValue(key, fallback) {
        try {
            const value = new SharedPreferences().get(key);
            return value === null || value === undefined ? fallback : value;
        } catch (e) {
            return fallback;
        }
    }

    getBooleanPreference(key, fallback) {
        const value = this.getPreferenceValue(key, fallback);
        if (typeof value === "boolean") return value;
        const normalized = String(value).trim().toLowerCase();
        if (["true", "1", "yes", "on"].includes(normalized)) return true;
        if (["false", "0", "no", "off"].includes(normalized)) return false;
        return fallback;
    }

    normalizeBaseUrl(value) {
        const fallback = String(mangayomiSources[0].baseUrl || "https://witanime.you")
            .replace(/\/+$/, "");
        let url = String(value || "").trim();
        if (!url) return fallback;
        if (!/^https?:\/\//i.test(url)) url = "https://" + url;
        const origin = url.match(/^(https?:\/\/[^\/?#]+)/i);
        return origin ? origin[1].replace(/\/+$/, "") : fallback;
    }

    get baseUrl() {
        return this.normalizeBaseUrl(this.getPreferenceValue(
            "pref_base_url",
            mangayomiSources[0].baseUrl
        ));
    }

    getSourcePreferences() {
        return [
            {
                key: "pref_base_url",
                editTextPreference: {
                    title: "رابط موقع WitAnime",
                    summary: "غيّر الرابط عند انتقال الموقع إلى نطاق جديد",
                    value: mangayomiSources[0].baseUrl,
                    dialogTitle: "رابط WitAnime",
                    dialogMessage: "مثال: https://witanime.you",
                    text: mangayomiSources[0].baseUrl
                }
            },
            {
                key: "pref_quality",
                listPreference: {
                    title: "الجودة المفضلة",
                    summary: "تظهر الجودة المختارة أولًا عند توفرها",
                    valueIndex: 0,
                    entries: ["1080p", "720p", "480p", "360p", "Auto"],
                    entryValues: ["1080p", "720p", "480p", "360p", "Auto"]
                }
            },
            {
                key: "pref_server",
                listPreference: {
                    title: "السيرفر المفضل",
                    summary: "تظهر روابط السيرفر المختار أولًا",
                    valueIndex: 2,
                    entries: [
                        "Dailymotion",
                        "StreamWish",
                        "Mp4Upload",
                        "Mp4Upload (Download)",
                        "Yonaplay",
                        "Videa",
                        "Videas",
                        "DotPlay",
                        "GoFile (Download)",
                        "Any Server"
                    ],
                    entryValues: [
                        "Dailymotion",
                        "StreamWish",
                        "Mp4Upload",
                        "Mp4Upload (Download)",
                        "Yonaplay",
                        "Videa",
                        "Videas",
                        "DotPlay",
                        "GoFile (Download)",
                        "Any Server"
                    ]
                }
            },
            {
                key: "pref_fetch_dates",
                switchPreferenceCompat: {
                    title: "جلب تواريخ الحلقات",
                    summary: "قد يبطئ فتح صفحة الأنمي؛ عطّله لعرض الحلقات بسرعة أكبر",
                    value: false
                }
            }
        ];
    }

    getHeaders(url) {
        // Let Mangayomi attach the saved WebView User-Agent together with
        // first-party cookies when WitAnime enables a Cloudflare challenge.
        return {
            "Referer": this.baseUrl + "/",
            "Accept-Language": "ar,en-US;q=0.9,en;q=0.8"
        };
    }

    elementText(element) {
        try {
            return element && element.text ? String(element.text).trim() : "";
        } catch (e) {
            return "";
        }
    }

    elementAttr(element, name) {
        try {
            const value = element ? element.attr(name) : "";
            return value ? String(value).trim() : "";
        } catch (e) {
            return "";
        }
    }

    elementHref(element) {
        try {
            const href = element && element.getHref
                ? element.getHref
                : this.elementAttr(element, "href");
            return href ? this.absoluteUrl(String(href).trim(), this.baseUrl + "/") : "";
        } catch (e) {
            return "";
        }
    }

    elementImage(element) {
        if (!element) return "";

        const candidates = [
            this.elementAttr(element, "data-src"),
            this.elementAttr(element, "data-lazy-src"),
            this.elementAttr(element, "data-original")
        ];
        try {
            if (element.getSrc) candidates.push(String(element.getSrc).trim());
        } catch (e) {}
        candidates.push(this.elementAttr(element, "src"));

        for (const candidate of candidates) {
            if (candidate && !candidate.startsWith("data:")) {
                return this.absoluteUrl(candidate, this.baseUrl + "/");
            }
        }
        return "";
    }

    selectElements(root, selectors) {
        for (const selector of selectors) {
            try {
                const elements = root.select(selector);
                if (elements && elements.length > 0) return elements;
            } catch (e) {}
        }
        return [];
    }

    firstElement(root, selectors, valueGetter) {
        for (const selector of selectors) {
            try {
                const element = root.selectFirst(selector);
                if (valueGetter.call(this, element)) return element;
            } catch (e) {}
        }
        return null;
    }

    parseAnimeCard(card) {
        const titleEl = this.firstElement(card, [
            "div.anime-card-title h3 a",
            "div.anime-card-details h3 a",
            "h3.anime-card-title a"
        ], function (element) {
            return this.elementText(element) || this.elementHref(element);
        });
        const overlayEl = this.firstElement(card, [
            "div.anime-card-poster a.overlay",
            "a.overlay"
        ], this.elementHref);
        const imgEl = this.firstElement(card, [
            "div.anime-card-poster img",
            "img.img-responsive",
            "img"
        ], this.elementImage);

        const name = this.elementText(titleEl) || this.elementAttr(imgEl, "alt");
        const link = this.elementHref(titleEl) || this.elementHref(overlayEl);
        if (!name || !link) return null;

        return { name: name, link: link, imageUrl: this.elementImage(imgEl) };
    }

    parseEpisodeCard(card) {
        const animeEl = this.firstElement(card, [
            "div.ep-card-anime-title h3 a",
            "div.anime-card-title h3 a",
            "a[href*='/anime/']"
        ], function (element) {
            return this.elementText(element) || this.elementHref(element);
        });
        const episodeEl = this.firstElement(card, [
            "div.episodes-card-title h3 a",
            "a[href*='/episode/']"
        ], function (element) {
            return this.elementText(element) || this.elementHref(element);
        });
        const imgEl = this.firstElement(card, [
            "div.episodes-card img",
            "div.anime-card-poster img",
            "img.img-responsive",
            "img"
        ], this.elementImage);

        const animeName = this.elementText(animeEl);
        const episodeName = this.elementText(episodeEl);
        const imageAlt = this.elementAttr(imgEl, "alt");
        const name = animeName
            ? (episodeName ? animeName + " - " + episodeName : animeName)
            : (imageAlt || episodeName);
        const link = this.elementHref(animeEl) || this.elementHref(episodeEl);
        if (!name || !link) return null;

        return { name: name, link: link, imageUrl: this.elementImage(imgEl) };
    }

    parseCards(cards, parser) {
        const list = [];
        const seen = {};
        for (const card of cards) {
            const item = parser.call(this, card);
            if (!item || seen[item.link]) continue;
            seen[item.link] = true;
            list.push(item);
        }
        return list;
    }

    documentHasNextPage(doc) {
        const nextEl = this.firstElement(doc, [
            "a.next.page-numbers",
            "ul.pagination a.next",
            "a[rel='next']"
        ], this.elementHref);
        return this.elementHref(nextEl).length > 0;
    }
    
    get supportsLatest() {
        return true;
    }
    
    base64Decode(str) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let raw = str.replace(/=+$/, '');
        let decoded = '';
        let buffer = 0;
        let bits = 0;
        for (let i = 0; i < raw.length; i++) {
            const char = raw[i];
            const val = chars.indexOf(char);
            if (val === -1) continue;
            buffer = (buffer << 6) | val;
            bits += 6;
            if (bits >= 8) {
                bits -= 8;
                decoded += String.fromCharCode((buffer >> bits) & 0xff);
            }
        }
        return decoded;
    }

    base64Encode(str) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let encoded = '';
        let i = 0;
        while (i < str.length) {
            const byte1 = str.charCodeAt(i++);
            const byte2 = i < str.length ? str.charCodeAt(i++) : NaN;
            const byte3 = i < str.length ? str.charCodeAt(i++) : NaN;
            
            const enc1 = byte1 >> 2;
            const enc2 = ((byte1 & 3) << 4) | (isNaN(byte2) ? 0 : (byte2 >> 4));
            const enc3 = isNaN(byte2) ? 64 : (((byte2 & 15) << 2) | (isNaN(byte3) ? 0 : (byte3 >> 6)));
            const enc4 = isNaN(byte3) ? 64 : (byte3 & 63);
            
            encoded += chars.charAt(enc1) + chars.charAt(enc2) +
                       (enc3 === 64 ? '=' : chars.charAt(enc3)) +
                       (enc4 === 64 ? '=' : chars.charAt(enc4));
        }
        return encoded;
    }

    base64ToBytes(str) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let raw = str.replace(/=+$/, '');
        let bytes = [];
        let buffer = 0;
        let bits = 0;
        for (let i = 0; i < raw.length; i++) {
            const char = raw[i];
            const val = chars.indexOf(char);
            if (val === -1) continue;
            buffer = (buffer << 6) | val;
            bits += 6;
            if (bits >= 8) {
                bits -= 8;
                bytes.push((buffer >> bits) & 0xff);
            }
        }
        return bytes;
    }
    
    async getPopular(page) {
        const client = new Client();
        const url = page === 1 
            ? this.baseUrl + "/%D9%82%D8%A7%D8%A6%D9%85%D8%A9-%D8%A7%D9%84%D8%A7%D9%86%D9%85%D9%8a/"
            : `${this.baseUrl}/%D9%82%D8%A7%D8%A6%D9%85%D8%A9-%D8%A7%D9%84%D8%A7%D9%86%D9%85%D9%8a/page/${page}/`;
            
        const res = await client.get(url, this.getHeaders(url));
        if (res.statusCode !== 200) {
            throw new Error(`Failed to fetch popular list: ${res.statusCode}`);
        }
        
        const doc = new Document(res.body);
        const cards = this.selectElements(doc, [
            "div.anime-card-container",
            "div.anime-card-poster div.ehover6"
        ]);
        return {
            list: this.parseCards(cards, this.parseAnimeCard),
            hasNextPage: this.documentHasNextPage(doc)
        };
    }
    
    async getLatestUpdates(page) {
        const client = new Client();
        const url = page === 1 
            ? `${this.baseUrl}/episode/`
            : `${this.baseUrl}/episode/page/${page}/`;
            
        const res = await client.get(url, this.getHeaders(url));
        if (res.statusCode !== 200) {
            throw new Error(`Failed to fetch latest list: ${res.statusCode}`);
        }
        
        const doc = new Document(res.body);
        let cards = this.selectElements(doc, ["div.episodes-card-container"]);
        let list = this.parseCards(cards, this.parseEpisodeCard);
        if (list.length === 0) {
            cards = this.selectElements(doc, ["div.anime-card-container"]);
            list = this.parseCards(cards, this.parseEpisodeCard);
        }

        return {
            list: list,
            hasNextPage: this.documentHasNextPage(doc)
        };
    }
    
    async search(query, page, filters) {
        const client = new Client();
        let url = "";
        
        if (query && query.trim().length > 0) {
            url = page === 1
                ? `${this.baseUrl}/?s=${encodeURIComponent(query)}&search_param=animes`
                : `${this.baseUrl}/page/${page}/?s=${encodeURIComponent(query)}&search_param=animes`;
        } else {
            let filterPath = "";
            if (filters && filters.length > 0) {
                for (const filter of filters) {
                    if (filter.state > 0 && filter.values && filter.values[filter.state]) {
                        filterPath = filter.values[filter.state].value;
                        break;
                    }
                }
            }
            if (filterPath.length > 0) {
                url = page === 1
                    ? `${this.baseUrl}/${filterPath}`
                    : `${this.baseUrl}/${filterPath}page/${page}/`;
            } else {
                return await this.getPopular(page);
            }
        }
        
        const res = await client.get(url, this.getHeaders(url));
        if (res.statusCode !== 200) {
            return {
                list: [],
                hasNextPage: false
            };
        }
        
        const doc = new Document(res.body);
        const cards = this.selectElements(doc, [
            "div.anime-card-container",
            "div.anime-card-poster div.ehover6"
        ]);
        return {
            list: this.parseCards(cards, this.parseAnimeCard),
            hasNextPage: this.documentHasNextPage(doc)
        };
    }
    
    normalizeEpisodeDate(value, isGmt) {
        if (value === null || value === undefined || value === "") {
            return "0";
        }

        if (typeof value === "number") {
            const milliseconds = value < 100000000000 ? value * 1000 : value;
            return String(Math.floor(milliseconds));
        }

        const rawValue = String(value).trim();
        if (!rawValue) {
            return "0";
        }

        if (/^\d+$/.test(rawValue)) {
            const numericValue = parseInt(rawValue, 10);
            const milliseconds = numericValue < 100000000000 ? numericValue * 1000 : numericValue;
            return String(milliseconds);
        }

        let dateValue = rawValue;
        if (isGmt && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(dateValue)) {
            dateValue += "Z";
        }

        const timestamp = Date.parse(dateValue);
        return isNaN(timestamp) ? "0" : String(timestamp);
    }

    getEpisodeSlug(url) {
        if (!url) {
            return "";
        }

        try {
            const cleanUrl = String(url).split("?")[0].split("#")[0].replace(/\/+$/, "");
            const slug = cleanUrl.substring(cleanUrl.lastIndexOf("/") + 1);
            return decodeURIComponent(slug);
        } catch (e) {
            const cleanUrl = String(url).split("?")[0].split("#")[0].replace(/\/+$/, "");
            return cleanUrl.substring(cleanUrl.lastIndexOf("/") + 1);
        }
    }

    extractEpisodeUploadDate(html) {
        if (!html) {
            return "0";
        }

        let match = html.match(/"datePublished"\s*:\s*"([^"]+)"/i);
        if (match) {
            const dateUpload = this.normalizeEpisodeDate(match[1], false);
            if (dateUpload !== "0") {
                return dateUpload;
            }
        }

        match = html.match(/property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i);
        if (!match) {
            match = html.match(/content=["']([^"']+)["'][^>]*property=["']article:published_time["']/i);
        }
        if (match) {
            return this.normalizeEpisodeDate(match[1], false);
        }

        return "0";
    }

    async getEpisodeUploadDates(client, episodes) {
        const dates = new Array(episodes.length).fill("0");
        const slugToIndexes = {};
        const pendingSlugs = [];

        for (let i = 0; i < episodes.length; i++) {
            const ep = episodes[i];

            const embeddedDate =
                this.normalizeEpisodeDate(ep.dateUpload, false) !== "0"
                    ? this.normalizeEpisodeDate(ep.dateUpload, false)
                    : this.normalizeEpisodeDate(ep.datePublished || ep.date, false);

            if (embeddedDate !== "0") {
                dates[i] = embeddedDate;
                continue;
            }

            const slug = this.getEpisodeSlug(ep.url);
            if (!slug) {
                continue;
            }

            if (!slugToIndexes[slug]) {
                slugToIndexes[slug] = [];
                pendingSlugs.push(slug);
            }
            slugToIndexes[slug].push(i);
        }

        // WitAnime exposes episode dates through WordPress REST.
        // Fetch up to 50 episode records per request instead of opening every page.
        const restBatchSize = 50;
        for (let start = 0; start < pendingSlugs.length; start += restBatchSize) {
            const slugBatch = pendingSlugs.slice(start, start + restBatchSize);
            const slugQuery = slugBatch.map((slug) => encodeURIComponent(slug)).join(",");
            const apiUrl =
                `${this.baseUrl}/wp-json/wp/v2/episode` +
                `?slug=${slugQuery}&per_page=100&_fields=slug,link,date,date_gmt`;

            try {
                const response = await client.get(apiUrl, {
                    ...this.getHeaders(apiUrl),
                    "Accept": "application/json"
                });

                if (response.statusCode !== 200) {
                    continue;
                }

                const records = JSON.parse(response.body);
                if (!Array.isArray(records)) {
                    continue;
                }

                for (const record of records) {
                    const dateUpload =
                        this.normalizeEpisodeDate(record.date_gmt, true) !== "0"
                            ? this.normalizeEpisodeDate(record.date_gmt, true)
                            : this.normalizeEpisodeDate(record.date, false);

                    if (dateUpload === "0") {
                        continue;
                    }

                    const possibleSlugs = [
                        record.slug ? String(record.slug) : "",
                        this.getEpisodeSlug(record.link)
                    ];

                    for (const slug of possibleSlugs) {
                        if (!slug || !slugToIndexes[slug]) {
                            continue;
                        }

                        for (const index of slugToIndexes[slug]) {
                            dates[index] = dateUpload;
                        }
                    }
                }
            } catch (e) {
                console.log(`Failed to fetch episode dates batch: ${e}`);
            }
        }

        // Fallback for any episode not returned by the REST endpoint.
        const unresolvedIndexes = [];
        for (let i = 0; i < dates.length; i++) {
            if (dates[i] === "0") {
                unresolvedIndexes.push(i);
            }
        }

        // Never open hundreds of episode pages for a long-running title. If
        // REST misses dates, only check the newest unresolved episodes.
        const fallbackIndexes = unresolvedIndexes.slice(-12);
        const fallbackBatchSize = 4;
        for (let start = 0; start < fallbackIndexes.length; start += fallbackBatchSize) {
            const indexBatch = fallbackIndexes.slice(start, start + fallbackBatchSize);
            const results = await Promise.all(
                indexBatch.map(async (index) => {
                    try {
                        const episodeUrl = episodes[index].url;
                        const response = await client.get(episodeUrl, this.getHeaders(episodeUrl));
                        if (response.statusCode !== 200) {
                            return { index: index, dateUpload: "0" };
                        }

                        return {
                            index: index,
                            dateUpload: this.extractEpisodeUploadDate(response.body)
                        };
                    } catch (e) {
                        console.log(`Failed to fetch episode date: ${e}`);
                        return { index: index, dateUpload: "0" };
                    }
                })
            );

            for (const result of results) {
                dates[result.index] = result.dateUpload;
            }
        }

        return dates;
    }

    async getDetail(url) {
        const client = new Client();
        let detailUrl = this.absoluteUrl(url, this.baseUrl + "/");
        let res = await client.get(detailUrl, this.getHeaders(detailUrl));
        if (res.statusCode !== 200) {
            throw new Error(`Failed to fetch detail: ${res.statusCode}`);
        }

        let doc = new Document(res.body);
        if (detailUrl.includes("/episode/")) {
            const parentEl = this.firstElement(doc, [
                "div.anime-page-link a",
                "a[href*='/anime/']"
            ], this.elementHref);
            const parentUrl = this.elementHref(parentEl);
            if (parentUrl && parentUrl !== detailUrl) {
                const parentRes = await client.get(parentUrl, this.getHeaders(parentUrl));
                if (parentRes.statusCode === 200) {
                    detailUrl = parentUrl;
                    res = parentRes;
                    doc = new Document(res.body);
                }
            }
        }

        const titleEl = this.firstElement(doc, [
            "h1.anime-details-title",
            "h1.entry-title"
        ], this.elementText);
        const name = this.elementText(titleEl);

        const imgEl = this.firstElement(doc, [
            "img.thumbnail.img-responsive",
            "div.anime-thumbnail img",
            "img.thumbnail"
        ], this.elementImage);
        const imageUrl = this.elementImage(imgEl);

        const descEl = this.firstElement(doc, [
            "p.anime-story",
            "div.anime-story",
            "div.entry-content p"
        ], this.elementText);
        const description = this.elementText(descEl);

        const genres = [];
        const seenGenres = {};
        const genreElements = doc.select('a[href*="/anime-genre/"]');
        for (const element of genreElements) {
            const genre = this.elementText(element);
            if (genre && !seenGenres[genre]) {
                seenGenres[genre] = true;
                genres.push(genre);
            }
        }

        let status = 5;
        const statusElement = this.firstElement(doc, [
            "a[href*='/anime-status/']"
        ], this.elementText);
        const statusText = this.elementText(statusElement);
        if (statusText.includes("يعرض الان") || statusText.includes("يعرض الآن") || statusText.includes("مستمر")) {
            status = 0;
        } else if (statusText.includes("مكتمل") || statusText.includes("منتهي")) {
            status = 1;
        }

        const html = res.body;
        const match = html.match(/processedEpisodeData\s*=\s*(["'])([^"']+)\1/);
        const chapters = [];
        if (match) {
            try {
                const processedEpisodeData = match[2];
                const parts = processedEpisodeData.split('.');
                if (parts.length === 2) {
                    const key = this.base64Decode(parts[1]);
                    if (!key) throw new Error("Empty episode key");

                    const encryptedBytes = this.base64ToBytes(parts[0]);
                    let decryptedStr = "";
                    for (let i = 0; i < encryptedBytes.length; i++) {
                        decryptedStr += String.fromCharCode(
                            encryptedBytes[i] ^ key.charCodeAt(i % key.length)
                        );
                    }

                    const episodes = JSON.parse(decryptedStr);
                    if (!Array.isArray(episodes)) throw new Error("Invalid episode data");
                    const fetchEpisodeDates = this.getBooleanPreference(
                        "pref_fetch_dates",
                        false
                    );
                    const episodeDates = fetchEpisodeDates
                        ? await this.getEpisodeUploadDates(client, episodes)
                        : null;

                    for (let i = 0; i < episodes.length; i++) {
                        const ep = episodes[i] || {};
                        const episodeUrl = this.absoluteUrl(ep.url || "", detailUrl);
                        if (!episodeUrl) continue;

                        const type = ep.type ? String(ep.type).trim() : "الحلقة";
                        const number = ep.number !== null && ep.number !== undefined
                            ? String(ep.number).trim()
                            : "";
                        const chapter = {
                            name: (type + " " + number).trim(),
                            url: episodeUrl
                        };
                        if (episodeDates) chapter.dateUpload = episodeDates[i] || "0";
                        chapters.push(chapter);
                    }
                }
            } catch (e) {
                console.log(`Failed to decode WitAnime episodes: ${e}`);
            }
        }

        return {
            name: name,
            link: detailUrl,
            imageUrl: imageUrl,
            description: description,
            genre: genres,
            status: status,
            chapters: chapters
        };
    }
    
    async customStreamWishExtractor(url, prefix) {
        const client = new Client();
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": this.baseUrl + "/"
        };
        const res = await client.get(url, headers);
        if (res.statusCode !== 200) {
            return [];
        }
        
        const html = res.body;
        const match = html.match(/eval\(function\(p,a,c,k,e,d\).*?return p\}\('(.*?)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'(.*?)'\.split\('\|'\)/s);
        if (!match) {
            return [];
        }
        
        let p = match[1];
        const a = parseInt(match[2], 10);
        const c = parseInt(match[3], 10);
        const k = match[4].split('|');
        
        function baseN(num, b) {
            const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
            if (num < b) {
                return chars[num];
            }
            return baseN(Math.floor(num / b), b) + chars[num % b];
        }
        
        for (let i = c - 1; i >= 0; i--) {
            if (k[i]) {
                const baseValue = baseN(i, a);
                const regex = new RegExp('\\b' + baseValue + '\\b', 'g');
                p = p.replace(regex, () => k[i]);
            }
        }
        
        // The packed "links" object can contain nested braces (e.g. nested setup),
        // so match from "var links=" and balance braces instead of a naive .*? regex.
        const linksStart = p.indexOf("var links=");
        let linksObj = null;
        if (linksStart !== -1) {
            const braceStart = p.indexOf("{", linksStart);
            let depth = 0;
            let braceEnd = -1;
            for (let i = braceStart; i < p.length; i++) {
                if (p[i] === "{") depth++;
                else if (p[i] === "}") {
                    depth--;
                    if (depth === 0) { braceEnd = i; break; }
                }
            }
            if (braceEnd !== -1) {
                try {
                    linksObj = JSON.parse(p.substring(braceStart, braceEnd + 1));
                } catch (e) {
                    linksObj = null;
                }
            }
        }
        if (!linksObj) {
            return [];
        }

        // IMPORTANT: prefer the absolute CDN URLs (hls2/hls3) over hls4.
        // hls4 is a relative "/stream/..." path served from the player host
        // that currently returns FAKE anti-scrape segments (TikTok ad CDN URLs),
        // which causes a black screen. hls2 (.m3u8/.ts) and hls3 (.txt/.woff2)
        // are the real StreamWish CDN streams.
        let masterUrl = linksObj.hls2 || linksObj.hls3 || linksObj.hls4;
        if (!masterUrl) {
            return [];
        }
        
        function getHost(u) {
            const m = u.match(/https?:\/\/([^\/\?#]+)/);
            return m ? m[1] : "";
        }
        
        masterUrl = this.absoluteUrl(masterUrl, url);
        if (!masterUrl) return [];
        
        const playerHost = getHost(url);
        const playlistHeaders = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "*/*",
            "Origin": "https://" + playerHost,
            "Referer": "https://" + playerHost + "/"
        };
        
        const playlistRes = await client.get(masterUrl, playlistHeaders);
        if (playlistRes.statusCode !== 200) {
            return [];
        }
        
        const masterPlaylist = playlistRes.body;
        const separator = '#EXT-X-STREAM-INF:';
        const parts = masterPlaylist.split(separator);
        const videos = [];
        
        for (let i = 1; i < parts.length; i++) {
            const part = parts[i];
            let resolution = "";
            const resMatch = part.match(/RESOLUTION=\d+x(\d+)/);
            if (resMatch) {
                resolution = resMatch[1] + "p";
            } else {
                resolution = "Video";
            }
            
            const lines = part.split(/\r?\n/);
            let subPath = "";
            for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
                const line = lines[lineIndex].trim();
                if (line && !line.startsWith("#")) {
                    subPath = line;
                    break;
                }
            }

            const videoUrl = this.absoluteUrl(subPath, masterUrl);
            if (videoUrl) {
                videos.push({
                    url: videoUrl,
                    quality: `${prefix} - ${resolution}`,
                    originalUrl: videoUrl,
                    headers: playlistHeaders
                });
            }
        }

        if (videos.length === 0 && masterPlaylist.includes("#EXTM3U")) {
            videos.push({
                url: masterUrl,
                quality: `${prefix} - Auto`,
                originalUrl: masterUrl,
                headers: playlistHeaders
            });
        }

        return videos;
    }

    async customVideaExtractor(url, prefix) {
        const client = new Client();
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": this.baseUrl + "/"
        };
        const res = await client.get(url, headers);
        if (res.statusCode !== 200) {
            return [];
        }
        
        const html = res.body;
        const videoIdMatch = url.match(/(?:\?v=|player\/v\/|videok\/[^\-]+\-)([^?#&]+)/);
        if (!videoIdMatch) {
            return [];
        }
        const videoId = videoIdMatch[1];
        
        const xtMatch = html.match(/_xt\s*=\s*"([^"]+)"/);
        if (!xtMatch) {
            return [];
        }
        
        const nonce = xtMatch[1];
        const l = nonce.substring(0, 32);
        const s = nonce.substring(32);
        const staticSecret = 'xHb0ZvME5q8CBcoQi6AngerDu3FGO9fkUlwPmLVY_RTzj2hJIS4NasXWKy1td7p';
        let result = '';
        for (let i = 0; i < 32; i++) {
            const secretIdx = staticSecret.indexOf(l[i]);
            if (secretIdx === -1) continue;
            const idx = secretIdx - 31;
            result += s[i - idx];
        }
        
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let randomSeed = "";
        for (let i = 0; i < 8; i++) {
            randomSeed += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        const tVal = result.substring(0, 16);
        const xmlUrl = `https://videa.hu/player/xml?v=${videoId}&_s=${randomSeed}&_t=${tVal}`;
        const xmlRes = await client.get(xmlUrl, headers);
        if (xmlRes.statusCode !== 200) {
            return [];
        }
        
        let xmlText = xmlRes.body;
        if (!xmlText.startsWith('<?xml')) {
            const key = result.substring(16) + randomSeed + (xmlRes.headers['x-videa-xs'] || '');
            
            // Decrypt with RC4
            function rc4Decrypt(cipherBytes, keyStr) {
                let S = [];
                for (let i = 0; i < 256; i++) {
                    S[i] = i;
                }
                let j = 0;
                for (let i = 0; i < 256; i++) {
                    j = (j + S[i] + keyStr.charCodeAt(i % keyStr.length)) % 256;
                    let temp = S[i];
                    S[i] = S[j];
                    S[j] = temp;
                }
                let i = 0;
                j = 0;
                let decrypted = "";
                for (let m = 0; m < cipherBytes.length; m++) {
                    i = (i + 1) % 256;
                    j = (j + S[i]) % 256;
                    let temp = S[i];
                    S[i] = S[j];
                    S[j] = temp;
                    let k = S[(S[i] + S[j]) % 256];
                    decrypted += String.fromCharCode(k ^ cipherBytes[m]);
                }
                return decrypted;
            }
            
            const cipherBytes = this.base64ToBytes(xmlText);
            xmlText = rc4Decrypt(cipherBytes, key);
        }
        
        const videos = [];
        const sourceUrlMatches = xmlText.match(/<video_source[^>]*>([\s\S]*?)<\/video_source>/g);
        if (sourceUrlMatches) {
            for (const match of sourceUrlMatches) {
                const urlMatch = match.match(/<video_source[^>]*>([\s\S]*?)<\/video_source>/);
                let videoUrl = urlMatch[1].trim();
                
                const nameMatch = match.match(/name="([^"]+)"/);
                const expMatch = match.match(/exp="([^"]+)"/);
                
                if (videoUrl) {
                    if (videoUrl.startsWith('//')) {
                        videoUrl = 'https:' + videoUrl;
                    }
                    
                    const name = nameMatch ? nameMatch[1] : 'Video';
                    const exp = expMatch ? expMatch[1] : '';
                    
                    if (name && exp) {
                        const hashTag = `<hash_value_${name}>([^<]+)<\/hash_value_${name}>`;
                        const hashMatch = xmlText.match(new RegExp(hashTag));
                        if (hashMatch) {
                            const hashVal = hashMatch[1].trim();
                            videoUrl = videoUrl + (videoUrl.includes('?') ? '&' : '?') + `md5=${hashVal}&expires=${exp}`;
                        }
                    }
                    
                    videos.push({
                        url: videoUrl,
                        quality: `${prefix} Videa - ${name}`,
                        originalUrl: videoUrl,
                        headers: {
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                        }
                    });
                }
            }
        }
        
        return videos;
    }
    
    async customMp4UploadExtractor(url, prefix) {
        const client = new Client();
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://mp4upload.com/"
        };
        const res = await client.get(url, headers);
        if (res.statusCode !== 200 || res.body.includes("File was deleted") || res.body.includes("File Not Found")) {
            return [];
        }
        
        let html = res.body;
        let script = "";
        
        // Try packed first
        const match = html.match(/eval\(function\(p,a,c,k,e,d\).*?return p\}\('(.*?)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'(.*?)'\.split\('\|'\)/s);
        if (match) {
            let p = match[1];
            const a = parseInt(match[2], 10);
            const c = parseInt(match[3], 10);
            const k = match[4].split('|');
            
            function baseN(num, b) {
                const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
                if (num < b) {
                    return chars[num];
                }
                return baseN(Math.floor(num / b), b) + chars[num % b];
            }
            
            for (let i = c - 1; i >= 0; i--) {
                if (k[i]) {
                    const baseValue = baseN(i, a);
                    const regex = new RegExp('\\b' + baseValue + '\\b', 'g');
                    p = p.replace(regex, () => k[i]);
                }
            }
            script = p;
        } else {
            // Search individual script tags for player.src
            const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
            let m;
            while ((m = scriptRegex.exec(html)) !== null) {
                const content = m[1];
                if (content.includes("player.src(")) {
                    script = content;
                    break;
                }
            }
        }
        
        if (!script) {
            return [];
        }
        
        const srcMatch = script.match(/src\s*:\s*["']([^"']+)["']/);
        if (!srcMatch) {
            return [];
        }
        const videoUrl = srcMatch[1];
        
        let resolution = "Unknown resolution";
        const resMatch = script.match(/\bHEIGHT=(\d+)/i);
        if (resMatch) {
            resolution = resMatch[1] + "p";
        }
        
        const quality = `${prefix} Mp4Upload - ${resolution}`;
        
        return [{
            url: videoUrl,
            quality: quality,
            originalUrl: videoUrl,
            headers: headers
        }];
    }
    
    absoluteUrl(subPath, masterUrl) {
        let value = subPath === null || subPath === undefined
            ? ""
            : String(subPath).trim().replace(/&amp;/g, "&");
        if (!value) return "";
        if (/^https?:\/\//i.test(value)) return value;

        const base = masterUrl ? String(masterUrl) : this.baseUrl + "/";
        const schemeMatch = base.match(/^(https?):/i);
        if (value.startsWith("//")) {
            return (schemeMatch ? schemeMatch[1] : "https") + ":" + value;
        }

        const cleanUrl = base.split("#")[0].split("?")[0];
        if (value.startsWith("?")) return cleanUrl + value;

        const hostMatch = base.match(/^(https?:\/\/[^\/]+)/i);
        const host = hostMatch ? hostMatch[1] : "";
        if (value.startsWith("/")) return host + value;

        let masterBase = cleanUrl.substring(0, cleanUrl.lastIndexOf("/") + 1);
        while (value.startsWith("../")) {
            value = value.substring(3);
            masterBase = masterBase.replace(/[^\/]+\/$/, "");
        }
        if (value.startsWith("./")) value = value.substring(2);
        return masterBase + value;
    }

    async customDailymotionExtractor(url, prefix) {
        const client = new Client();
        
        // Support /embed/video/ID, /video/ID, dai.ly/ID
        let videoIdMatch = url.match(/(?:dailymotion\.com\/(?:embed\/)?video\/|dai\.ly\/)([a-zA-Z0-9]+)/);
        if (!videoIdMatch) {
            // Backup match for local relative URLs
            videoIdMatch = url.match(/(?:video|embed\/video)\/([a-zA-Z0-9]+)/);
        }
        if (!videoIdMatch) return [];
        const videoId = videoIdMatch[1];
        
        const dmHeaders = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://www.dailymotion.com/"
        };

        const normalizeUrl = (u) => {
            if (!u) return null;
            return u.replace(/\\\//g, '/').replace(/\\\\/g, '');
        };

        // Keep the complete master manifest so Dailymotion's separate audio
        // group remains available. Fake per-quality fragments do not select a
        // quality and only create duplicate entries in Mangayomi.
        const buildQualityEntries = (masterUrl) => [{
            url: masterUrl,
            quality: `${prefix} Dailymotion - Auto`,
            originalUrl: masterUrl,
            headers: dmHeaders
        }];

        // Use the Dailymotion metadata API (single request - fast)
        try {
            const metadataUrl = `https://www.dailymotion.com/player/metadata/video/${videoId}`;
            const metaRes = await client.get(metadataUrl, {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "application/json, text/plain, */*"
            });
            if (metaRes.statusCode === 200) {
                const metaData = JSON.parse(metaRes.body);
                const qualities = metaData && metaData.qualities;
                if (qualities && qualities.auto && qualities.auto.length > 0) {
                    const masterUrl = normalizeUrl(qualities.auto[0].url);
                    if (masterUrl) {
                        return buildQualityEntries(masterUrl);
                    }
                }
            }
        } catch (e) {
            console.log(`Dailymotion metadata API error: ${e}`);
        }
        
        // Fallback: embed page scraping
        try {
            const embedUrl = `https://www.dailymotion.com/embed/video/${videoId}`;
            const res = await client.get(embedUrl, {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": this.baseUrl + "/"
            });
            if (res.statusCode === 200) {
                const m3u8Match = res.body.match(/"manifestUrl"\s*:\s*"([^"]+)"/);
                if (m3u8Match) {
                    const masterUrl = normalizeUrl(m3u8Match[1]);
                    if (masterUrl) {
                        return buildQualityEntries(masterUrl);
                    }
                }
            }
        } catch (e) {
            console.log(`Dailymotion embed fallback error: ${e}`);
        }
        
        return [];
    }

    async customFourSharedExtractor(url, prefix) {
        const client = new Client();
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://yonaplay.net/"
        };
        const res = await client.get(url, headers);
        if (res.statusCode !== 200) return [];
        
        const html = res.body;
        let videoUrl = "";
        const doc = new Document(html);
        const sourceEl = doc.selectFirst('source');
        if (sourceEl) {
            videoUrl = sourceEl.attr('src');
        }
        if (!videoUrl) {
            const m = html.match(/<source[^>]*src="([^"]+)"/i);
            if (m) videoUrl = m[1];
        }
        
        if (!videoUrl) return [];
        return [{
            url: videoUrl,
            quality: `${prefix} 4Shared - Video`,
            originalUrl: videoUrl,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        }];
    }

    async customVideasExtractor(url, prefix) {
        const client = new Client();
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        };
        const res = await client.get(url, headers);
        if (res.statusCode !== 200) return [];
        
        const html = res.body;
        const scriptMatch = html.match(/<script[^>]*id="data-embed"[^>]*>([\s\S]*?)<\/script>/i);
        if (!scriptMatch) return [];
        
        try {
            const data = JSON.parse(scriptMatch[1]);
            const videos = [];
            if (data.medias && data.medias.length > 0) {
                for (const media of data.medias) {
                    if (media.src) {
                        videos.push({
                            url: media.src,
                            quality: `${prefix} Videas - Video`,
                            originalUrl: media.src,
                            headers: {
                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                            }
                        });
                    }
                }
            }
            return videos;
        } catch (e) {
            console.log(`Videas parse error: ${e}`);
            return [];
        }
    }

    async customDotPlayExtractor(url, prefix) {
        const codeMatch = url.match(/embed\/([a-zA-Z0-9]+)/);
        if (!codeMatch) return [];
        const code = codeMatch[1];
        
        const client = new Client();
        const apiUrl = `https://dotplay.net/api.php?code=${code}`;
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
            "Referer": `https://dotplay.net/embed/${code}`
        };
        
        const res = await client.get(apiUrl, headers);
        if (res.statusCode !== 200) return [];
        
        try {
            const data = JSON.parse(res.body);
            if (data.success && data.video_url) {
                const decoded = this.base64Decode(data.video_url);
                const parts = decoded.split('|');
                const videoUrl = parts[0];
                if (videoUrl) {
                    return [{
                        url: videoUrl,
                        quality: `${prefix} DotPlay - Video`,
                        originalUrl: videoUrl,
                        headers: {
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                        }
                    }];
                }
            }
        } catch (e) {
            console.log(`DotPlay parse error: ${e}`);
        }
        return [];
    }

    getGofileContentId(url) {
        let value = String(url || "").trim().replace(/&amp;/g, "&");
        const candidates = [value];
        for (let i = 0; i < 2; i++) {
            try {
                const decoded = decodeURIComponent(value);
                if (decoded === value) break;
                value = decoded;
                candidates.push(value);
            } catch (e) {
                break;
            }
        }

        for (const candidate of candidates) {
            let match = candidate.match(
                /https?:\/\/(?:www\.)?gofile\.io\/(?:d|download)\/([^\/?#&]+)/i
            );
            if (match) return match[1];

            match = candidate.match(
                /https?:\/\/(?:www\.)?gofile\.io\/[^#]*[?&](?:c|contentId)=([^&#]+)/i
            );
            if (match) return match[1];
        }
        return "";
    }

    normalizeGofileQuality(fileName, qualityHint) {
        const fileText = String(fileName || "").toLowerCase();
        const hintText = String(qualityHint || "").toLowerCase();

        // Prefer an explicit resolution in the actual filename. One GoFile
        // folder may contain all qualities even if the surrounding WitAnime
        // download group has a single label such as FHD.
        if (/(^|[^0-9])2160p?([^0-9]|$)|\b4k\b/i.test(fileText)) return "2160p";
        if (/(^|[^0-9])1080p?([^0-9]|$)|\bfhd\b/i.test(fileText)) return "1080p";
        if (/(^|[^0-9])720p?([^0-9]|$)/i.test(fileText)) return "720p";
        if (/(^|[^0-9])480p?([^0-9]|$)/i.test(fileText)) return "480p";
        if (/(^|[^0-9])360p?([^0-9]|$)/i.test(fileText)) return "360p";

        // WitAnime labels its download groups as FHD / HD / SD even when
        // the GoFile filename itself does not contain a resolution.
        if (hintText.includes("fhd")) return "1080p";
        if (hintText.includes("hd")) return "720p";
        if (hintText.includes("sd")) return "480p";
        return "Video";
    }

    getGofileUserAgent() {
        // GoFile includes the exact User-Agent in its generated website token,
        // so the value used for hashing and HTTP requests must stay identical.
        return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/131.0.0.0 Safari/537.36";
    }

    getGofileLanguage() {
        return "en-US";
    }

    sha256(value) {
        // Small dependency-free SHA-256 implementation for Mangayomi's JS
        // runtime. GoFile's website token is a SHA-256 digest.
        const rotateRight = (word, bits) =>
            (word >>> bits) | (word << (32 - bits));
        const bytes = [];
        const text = String(value || "");

        for (let i = 0; i < text.length; i++) {
            let code = text.charCodeAt(i);
            if (code < 0x80) {
                bytes.push(code);
            } else if (code < 0x800) {
                bytes.push(0xc0 | (code >>> 6));
                bytes.push(0x80 | (code & 0x3f));
            } else if (
                code >= 0xd800 && code <= 0xdbff &&
                i + 1 < text.length
            ) {
                const next = text.charCodeAt(i + 1);
                if (next >= 0xdc00 && next <= 0xdfff) {
                    code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
                    i++;
                    bytes.push(0xf0 | (code >>> 18));
                    bytes.push(0x80 | ((code >>> 12) & 0x3f));
                    bytes.push(0x80 | ((code >>> 6) & 0x3f));
                    bytes.push(0x80 | (code & 0x3f));
                } else {
                    bytes.push(0xef, 0xbf, 0xbd);
                }
            } else if (code >= 0xdc00 && code <= 0xdfff) {
                bytes.push(0xef, 0xbf, 0xbd);
            } else {
                bytes.push(0xe0 | (code >>> 12));
                bytes.push(0x80 | ((code >>> 6) & 0x3f));
                bytes.push(0x80 | (code & 0x3f));
            }
        }

        const bitLength = bytes.length * 8;
        bytes.push(0x80);
        while (bytes.length % 64 !== 56) bytes.push(0);

        const bitLengthHigh = Math.floor(bitLength / 0x100000000);
        const bitLengthLow = bitLength >>> 0;
        for (let shift = 24; shift >= 0; shift -= 8) {
            bytes.push((bitLengthHigh >>> shift) & 0xff);
        }
        for (let shift = 24; shift >= 0; shift -= 8) {
            bytes.push((bitLengthLow >>> shift) & 0xff);
        }

        const constants = [
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
            0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
            0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
            0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
            0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
            0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
            0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
            0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
            0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
        ];
        const hash = [
            0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
            0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
        ];
        const words = new Array(64);

        for (let offset = 0; offset < bytes.length; offset += 64) {
            for (let i = 0; i < 16; i++) {
                const index = offset + i * 4;
                words[i] = (
                    (bytes[index] << 24) |
                    (bytes[index + 1] << 16) |
                    (bytes[index + 2] << 8) |
                    bytes[index + 3]
                ) >>> 0;
            }
            for (let i = 16; i < 64; i++) {
                const s0 = rotateRight(words[i - 15], 7) ^
                    rotateRight(words[i - 15], 18) ^
                    (words[i - 15] >>> 3);
                const s1 = rotateRight(words[i - 2], 17) ^
                    rotateRight(words[i - 2], 19) ^
                    (words[i - 2] >>> 10);
                words[i] = (
                    words[i - 16] + s0 + words[i - 7] + s1
                ) >>> 0;
            }

            let a = hash[0];
            let b = hash[1];
            let c = hash[2];
            let d = hash[3];
            let e = hash[4];
            let f = hash[5];
            let g = hash[6];
            let h = hash[7];

            for (let i = 0; i < 64; i++) {
                const sum1 = rotateRight(e, 6) ^
                    rotateRight(e, 11) ^ rotateRight(e, 25);
                const choose = (e & f) ^ (~e & g);
                const temp1 = (h + sum1 + choose + constants[i] + words[i]) >>> 0;
                const sum0 = rotateRight(a, 2) ^
                    rotateRight(a, 13) ^ rotateRight(a, 22);
                const majority = (a & b) ^ (a & c) ^ (b & c);
                const temp2 = (sum0 + majority) >>> 0;

                h = g;
                g = f;
                f = e;
                e = (d + temp1) >>> 0;
                d = c;
                c = b;
                b = a;
                a = (temp1 + temp2) >>> 0;
            }

            hash[0] = (hash[0] + a) >>> 0;
            hash[1] = (hash[1] + b) >>> 0;
            hash[2] = (hash[2] + c) >>> 0;
            hash[3] = (hash[3] + d) >>> 0;
            hash[4] = (hash[4] + e) >>> 0;
            hash[5] = (hash[5] + f) >>> 0;
            hash[6] = (hash[6] + g) >>> 0;
            hash[7] = (hash[7] + h) >>> 0;
        }

        return hash.map((word) =>
            (word >>> 0).toString(16).padStart(8, "0")
        ).join("");
    }

    getGofileWebsiteToken(guestToken) {
        // Mirrors GoFile's current generateWT() logic. The digest rotates every
        // four hours and is bound to the guest token, User-Agent and language.
        const timeBucket = Math.floor(Date.now() / 1000 / 14400);
        const tokenInput = [
            this.getGofileUserAgent(),
            this.getGofileLanguage(),
            String(guestToken || ""),
            String(timeBucket),
            "9844d94d963d30"
        ].join("::");
        return this.sha256(tokenInput);
    }

    async getGofileGuestToken(client, forceRefresh) {
        if (forceRefresh) {
            this._gofileGuestToken = "";
        }
        if (this._gofileGuestToken) {
            return this._gofileGuestToken;
        }
        if (this._gofileGuestTokenPromise) {
            return await this._gofileGuestTokenPromise;
        }

        const tokenPromise = (async () => {
            try {
                const response = await client.post(
                    "https://api.gofile.io/accounts",
                    {
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "X-BL": this.getGofileLanguage(),
                        "Origin": "https://gofile.io",
                        "Referer": "https://gofile.io/",
                        "User-Agent": this.getGofileUserAgent()
                    },
                    {}
                );
                if (response.statusCode < 200 || response.statusCode >= 300) {
                    return "";
                }

                const payload = JSON.parse(response.body || "{}");
                const token = payload && payload.data ? payload.data.token : "";
                if (token) {
                    this._gofileGuestToken = String(token);

                    // GoFile's web client activates/synchronizes a new guest
                    // account before requesting folder contents. Do the same,
                    // but keep the token if this optional sync is rate-limited.
                    try {
                        await client.get(
                            "https://api.gofile.io/accounts/website",
                            {
                                "Accept": "application/json",
                                "Authorization": `Bearer ${this._gofileGuestToken}`,
                                "X-BL": this.getGofileLanguage(),
                                "Origin": "https://gofile.io",
                                "Referer": "https://gofile.io/",
                                "Cookie": `accountToken=${this._gofileGuestToken}`,
                                "User-Agent": this.getGofileUserAgent()
                            }
                        );
                    } catch (syncError) {
                        console.log(`GoFile guest sync error: ${syncError}`);
                    }
                    return this._gofileGuestToken;
                }
            } catch (e) {
                console.log(`GoFile guest-token error: ${e}`);
            }
            return "";
        })();

        this._gofileGuestTokenPromise = tokenPromise;
        try {
            return await tokenPromise;
        } finally {
            if (this._gofileGuestTokenPromise === tokenPromise) {
                this._gofileGuestTokenPromise = null;
            }
        }
    }

    async requestGofileContent(client, contentId, forceRefresh) {
        const guestToken = await this.getGofileGuestToken(client, forceRefresh);
        if (!guestToken) return null;

        const websiteToken = this.getGofileWebsiteToken(guestToken);
        const apiUrl =
            `https://api.gofile.io/contents/${encodeURIComponent(contentId)}` +
            "?contentFilter=&page=1&pageSize=1000&sortField=name&sortDirection=1";
        try {
            const response = await client.get(apiUrl, {
                "Accept": "application/json",
                "Authorization": `Bearer ${guestToken}`,
                "X-Website-Token": websiteToken,
                "X-BL": this.getGofileLanguage(),
                "Origin": "https://gofile.io",
                "Referer": "https://gofile.io/",
                "Cookie": `accountToken=${guestToken}`,
                "User-Agent": this.getGofileUserAgent()
            });
            if (response.statusCode < 200 || response.statusCode >= 300) {
                return null;
            }

            const payload = JSON.parse(response.body || "{}");
            if (!payload || payload.status !== "ok" || !payload.data) {
                return null;
            }
            return { data: payload.data, guestToken: guestToken };
        } catch (e) {
            console.log(`GoFile content request error: ${e}`);
            return null;
        }
    }

    async customGofileExtractor(url, prefix, qualityHint) {
        const contentId = this.getGofileContentId(url);
        if (!contentId) return [];

        const client = new Client();
        let content = await this.requestGofileContent(client, contentId, false);
        if (!content) {
            // The guest account may have expired or its sync may have failed.
            this._gofileGuestToken = "";
            content = await this.requestGofileContent(client, contentId, true);
        }
        if (!content) return [];

        const files = [];
        const collectFiles = (node) => {
            if (!node) return;
            if (Array.isArray(node)) {
                for (const item of node) collectFiles(item);
                return;
            }
            if (typeof node !== "object") return;

            const name = String(node.name || "");
            const mimeType = String(node.mimetype || node.mimeType || "").toLowerCase();
            const directUrl = String(node.link || node.directLink || "");
            const looksLikeVideo =
                mimeType.startsWith("video/") ||
                /\.(?:mp4|mkv|webm|m4v|mov|ts)(?:$|[?#])/i.test(name) ||
                /\.(?:mp4|mkv|webm|m4v|mov|ts)(?:$|[?#])/i.test(directUrl);
            if (directUrl && looksLikeVideo) {
                files.push(node);
            }

            const children = node.children || node.contents || node.childs;
            if (children) {
                if (Array.isArray(children)) {
                    for (const child of children) collectFiles(child);
                } else if (typeof children === "object") {
                    for (const key in children) {
                        if (Object.prototype.hasOwnProperty.call(children, key)) {
                            collectFiles(children[key]);
                        }
                    }
                }
            }
        };
        collectFiles(content.data);

        const videos = [];
        const seenUrls = {};
        const playbackHeaders = {
            "Accept": "*/*",
            "Referer": "https://gofile.io/",
            "Origin": "https://gofile.io",
            "Cookie": `accountToken=${content.guestToken}`,
            "User-Agent": this.getGofileUserAgent()
        };

        for (const file of files) {
            const directUrl = String(file.link || file.directLink || "");
            if (!directUrl || seenUrls[directUrl]) continue;
            seenUrls[directUrl] = true;

            videos.push({
                url: directUrl,
                quality: `${prefix} - ${this.normalizeGofileQuality(file.name, qualityHint)}`,
                originalUrl: directUrl,
                headers: playbackHeaders
            });
        }
        return videos;
    }
    
    async getVideoList(url) {
        const client = new Client();
        const res = await client.get(url, this.getHeaders(url));
        if (res.statusCode !== 200) {
            throw new Error(`Failed to fetch episode page: ${res.statusCode}`);
        }
        
        const html = res.body;
        // The site rotates variable names (was _zG/_zH, now _zX/_zK).
        // Try known names first, then fall back to extracting them
        // from the _initializeResources function.
        let zgVal = null;
        let zhVal = null;
        
        // Try current names first
        let zgMatch = html.match(/_zX\s*=\s*["']([^"']+)["']/);
        let zhMatch = html.match(/_zK\s*=\s*["']([^"']+)["']/);
        if (zgMatch && zhMatch) {
            zgVal = zgMatch[1];
            zhVal = zhMatch[1];
        }
        
        // Fallback: try old names
        if (!zgVal || !zhVal) {
            zgMatch = html.match(/_zG\s*=\s*["']([^"']+)["']/);
            zhMatch = html.match(/_zH\s*=\s*["']([^"']+)["']/);
            if (zgMatch && zhMatch) {
                zgVal = zgMatch[1];
                zhVal = zhMatch[1];
            }
        }
        
        // Last fallback: detect variable names from the init function
        if (!zgVal || !zhVal) {
            const resVarMatch = html.match(/resourceRegistry\s*=\s*JSON\.parse\(atob\(([a-zA-Z_$][a-zA-Z0-9_$]*)\)\)/);
            const cfgVarMatch = html.match(/configRegistry\s*=\s*JSON\.parse\(atob\(([a-zA-Z_$][a-zA-Z0-9_$]*)\)\)/);
            if (resVarMatch && cfgVarMatch) {
                const resVarName = resVarMatch[1];
                const cfgVarName = cfgVarMatch[1];
                const resRegex = new RegExp(resVarName + '\\s*=\\s*["\']([^"\']+)["\']');
                const cfgRegex = new RegExp(cfgVarName + '\\s*=\\s*["\']([^"\']+)["\']');
                const rm = html.match(resRegex);
                const cm = html.match(cfgRegex);
                if (rm && cm) {
                    zgVal = rm[1];
                    zhVal = cm[1];
                }
            }
        }
        
        // Download hosts such as GoFile use a separate encrypted registry.
        // Keep parsing them even if the streaming-server registry is absent.
        let resourceRegistry = {};
        let configRegistry = {};
        if (zgVal && zhVal) {
            try {
                resourceRegistry = JSON.parse(this.base64Decode(zgVal));
                configRegistry = JSON.parse(this.base64Decode(zhVal));
            } catch (e) {
                console.log(`Failed to decode video registries: ${e}`);
            }
        }

        const registryValue = (registry, serverId) => {
            if (!registry || serverId === null || serverId === undefined) return null;
            if (Array.isArray(registry)) {
                const index = parseInt(serverId, 10);
                return isNaN(index) || index < 0 || index >= registry.length
                    ? null
                    : registry[index];
            }
            return registry[String(serverId)] !== undefined
                ? registry[String(serverId)]
                : null;
        };
        
        const doc = new Document(html);
        const serverElements = doc.select('a.server-link');
        const videos = [];
        const preferredQuality = String(
            this.getPreferenceValue("pref_quality", "1080p") || "1080p"
        );
        const preferredServer = String(
            this.getPreferenceValue("pref_server", "Mp4Upload") || "Mp4Upload"
        );
        const apiKey = "23a97133-caf3-4eb4-9466-93d0a4ff8198";
        const wishDomains = ["streamwish", "strwish", "wishfast", "hglink.to", "hgcloud.to", "hgplaycdn.com", "hglamioz.com", "niramirus.com", "playnixes.com", "medixiru.com", "hanerix.com", "audinifer.com", "vibuxer.com", "masukestin.com", "lulustream", "lulu"];

        const getServerKey = (serverUrl, serverName) => {
            const value = (String(serverUrl || "") + " " + String(serverName || "")).toLowerCase();
            if (value.includes("any server") || value.trim() === "any") return "any server";
            if (value.includes("gofile")) return "gofile (download)";
            if (value.includes("mp4upload") && value.includes("download")) return "mp4upload (download)";
            if (value.includes("yonaplay")) return "yonaplay";
            if (wishDomains.some((domain) => value.includes(domain))) return "streamwish";
            if (value.includes("mp4upload")) return "mp4upload";
            if (value.includes("dailymotion") || value.includes("dai.ly")) return "dailymotion";
            if (value.includes("videas.fr") || value.includes("videas")) return "videas";
            if (value.includes("videa.hu") || value.includes("videakid.hu") || value.includes("videa")) return "videa";
            if (value.includes("dotplay")) return "dotplay";
            if (value.includes("4shared")) return "4shared";
            return String(serverName || "").trim().toLowerCase();
        };
        const preferredServerKey = getServerKey("", preferredServer);
        
        // When multiple hosts are needed, run them concurrently so a slow/dead
        // host cannot turn the total wait into the sum of every server timeout.
        const extractFromServer = async (decoded, serverName) => {
            const results = [];
            try {
                let streamwishUrl = decoded;
                let isStreamWish = false;
                for (const domain of wishDomains) {
                    if (streamwishUrl.includes(domain)) {
                        isStreamWish = true;
                        break;
                    }
                }

                if (isStreamWish) {
                    streamwishUrl = streamwishUrl.replace("hgcloud.to", "hgplaycdn.com")
                                                 .replace("hglink.to", "hgplaycdn.com")
                                                 .replace("streamwish.to", "hgplaycdn.com")
                                                 .replace("streamwish.com", "hgplaycdn.com")
                                                 .replace("lulustream.com", "hgplaycdn.com");
                    const wishVideos = await this.customStreamWishExtractor(streamwishUrl, serverName);
                    if (wishVideos) results.push(...wishVideos);
                } else if (decoded.includes("mp4upload.com")) {
                    const mp4Videos = await this.customMp4UploadExtractor(decoded, serverName);
                    if (mp4Videos) results.push(...mp4Videos);
                } else if (decoded.includes("videa.hu") || decoded.includes("videakid.hu")) {
                    const videaVideos = await this.customVideaExtractor(decoded, serverName);
                    if (videaVideos) results.push(...videaVideos);
                } else if (decoded.includes("dailymotion.com")) {
                    const dmVideos = await this.customDailymotionExtractor(decoded, serverName);
                    if (dmVideos) results.push(...dmVideos);
                } else if (decoded.includes("4shared.com")) {
                    const fsVideos = await this.customFourSharedExtractor(decoded, serverName);
                    if (fsVideos) results.push(...fsVideos);
                } else if (decoded.includes("videas.fr")) {
                    const vdVideos = await this.customVideasExtractor(decoded, serverName);
                    if (vdVideos) results.push(...vdVideos);
                } else if (decoded.includes("dotplay.net")) {
                    const dpVideos = await this.customDotPlayExtractor(decoded, serverName);
                    if (dpVideos) results.push(...dpVideos);
                } else if (decoded.includes("gofile.io/d/")) {
                    const gofileVideos = await this.customGofileExtractor(
                        decoded,
                        "GoFile (Download)",
                        ""
                    );
                    if (gofileVideos) results.push(...gofileVideos);
                } else if (decoded.startsWith("https://yonaplay.net/embed.php?id=")) {
                    const yonaHeaders = {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                        "Referer": this.baseUrl + "/"
                    };
                    const yonaRes = await client.get(decoded, yonaHeaders);
                    if (yonaRes.statusCode === 200) {
                        const yonaHtml = yonaRes.body;
                        const playerMatches = yonaHtml.match(/go_to_player\('([^']+)'\)/g);
                        if (playerMatches) {
                            for (const matchText of playerMatches) {
                                const b64Text = matchText.match(/go_to_player\('([^']+)'\)/)[1];
                                let subUrl = this.base64Decode(b64Text);

                                let isSubStreamWish = false;
                                for (const domain of wishDomains) {
                                    if (subUrl.includes(domain)) {
                                        isSubStreamWish = true;
                                        break;
                                    }
                                }

                                if (isSubStreamWish) {
                                    subUrl = subUrl.replace("hgcloud.to", "hgplaycdn.com")
                                                   .replace("hglink.to", "hgplaycdn.com")
                                                   .replace("streamwish.to", "hgplaycdn.com")
                                                   .replace("streamwish.com", "hgplaycdn.com")
                                                   .replace("lulustream.com", "hgplaycdn.com");
                                    const wishVideos = await this.customStreamWishExtractor(subUrl, `${serverName} (Yona)`);
                                    if (wishVideos) results.push(...wishVideos);
                                } else if (subUrl.includes("mp4upload.com")) {
                                    const mp4Videos = await this.customMp4UploadExtractor(subUrl, `${serverName} (Yona)`);
                                    if (mp4Videos) results.push(...mp4Videos);
                                } else if (subUrl.includes("videa.hu") || subUrl.includes("videakid.hu")) {
                                    const videaVideos = await this.customVideaExtractor(subUrl, `${serverName} (Yona)`);
                                    if (videaVideos) results.push(...videaVideos);
                                } else if (subUrl.includes("dailymotion.com")) {
                                    const dmVideos = await this.customDailymotionExtractor(subUrl, `${serverName} (Yona)`);
                                    if (dmVideos) results.push(...dmVideos);
                                } else if (subUrl.includes("4shared.com")) {
                                    const fsVideos = await this.customFourSharedExtractor(subUrl, `${serverName} (Yona)`);
                                    if (fsVideos) results.push(...fsVideos);
                                } else if (subUrl.includes("videas.fr")) {
                                    const vdVideos = await this.customVideasExtractor(subUrl, `${serverName} (Yona)`);
                                    if (vdVideos) results.push(...vdVideos);
                                } else if (subUrl.includes("dotplay.net")) {
                                    const dpVideos = await this.customDotPlayExtractor(subUrl, `${serverName} (Yona)`);
                                    if (dpVideos) results.push(...dpVideos);
                                } else if (subUrl.includes("gofile.io/d/")) {
                                    const gofileVideos = await this.customGofileExtractor(
                                        subUrl,
                                        "GoFile (Download)",
                                        ""
                                    );
                                    if (gofileVideos) results.push(...gofileVideos);
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                console.log(`Server ${serverName} extraction error: ${e}`);
            }
            return results;
        };

        const extractFromMp4UploadDownload = async (mp4Url, qualityLabel) => {
            try {
                let embedUrl = mp4Url;
                const mp4match = mp4Url.match(/mp4upload\.com\/(?:embed-)?([a-zA-Z0-9]+)(?:\.html)?/);
                if (mp4match) {
                    embedUrl = `https://www.mp4upload.com/embed-${mp4match[1]}.html`;
                }
                const prefixName = `Mp4Upload (Download) - ${qualityLabel}`;
                return await this.customMp4UploadExtractor(embedUrl, prefixName);
            } catch (e) {
                console.log(`Mp4Upload download extraction error: ${e}`);
            }
            return [];
        };

        const withTimeout = async (promise, label) => {
            let timerId = null;
            const timeoutGuard = new Promise((resolve) => {
                timerId = setTimeout(() => {
                    console.log(`${label} timed out`);
                    resolve([]);
                }, 15000);
            });
            try {
                return await Promise.race([promise, timeoutGuard]);
            } finally {
                if (timerId !== null && typeof clearTimeout === "function") {
                    clearTimeout(timerId);
                }
            }
        };

        // Store lazy extraction tasks. This lets a selected server run alone;
        // the other hosts are contacted only if the preferred one fails.
        const serverTasks = [];
        for (const element of serverElements) {
            const serverIdStr = element.attr('data-server-id');
            if (!serverIdStr) continue;

            const serverId = parseInt(serverIdStr, 10);
            if (isNaN(serverId)) continue;

            const serverNameSpan = element.selectFirst('span.ser');
            const serverName = this.elementText(serverNameSpan) || `Server ${serverId}`;

            const resData = registryValue(resourceRegistry, serverIdStr);
            const confData = registryValue(configRegistry, serverIdStr);
            if (typeof resData !== "string" || !confData || !Array.isArray(confData.d) || !confData.k) {
                continue;
            }

            const resCleaned = resData.split('').reverse().join('').replace(/[^A-Za-z0-9\+\/\=]/g, '');

            const k_b64 = confData.k;
            const indexVal = parseInt(this.base64Decode(k_b64), 10);
            if (isNaN(indexVal) || indexVal < 0 || indexVal >= confData.d.length) continue;
            const offset = confData.d[indexVal];

            let decoded = this.base64Decode(resCleaned);
            if (typeof offset === "number" && offset > 0) {
                decoded = decoded.slice(0, -offset);
            }

            decoded = decoded.trim();
            if (!/^https?:\/\//i.test(decoded)) continue;

            if (decoded.startsWith("https://yonaplay.net/embed.php?id=")) {
                decoded += "&apiKey=" + apiKey;
            }

            // Cap each server at 15s so a hanging/dead host (e.g. geoblocked
            // videa.hu) can never block the whole isolate. Loser servers simply
            // contribute nothing while the rest resolve.
            serverTasks.push({
                key: getServerKey(decoded, serverName),
                label: `Server ${serverName}`,
                run: () => withTimeout(
                    extractFromServer(decoded, serverName),
                    `Server ${serverName}`
                )
            });
        }

        // Parse encrypted download qualities for Mp4Upload and GoFile.
        try {
            const mrMatch = html.match(/_m\s*=\s*\{"r"\s*:\s*"([^"]+)"\}/);
            const tlMatch = html.match(/_t\s*=\s*\{"l"\s*:\s*"([^"]+)"\}/);
            const sMatch = html.match(/_s\s*=\s*(\[[^\]]+\]);/);
            
            if (mrMatch && tlMatch && sMatch) {
                const secret = this.base64Decode(mrMatch[1]);
                const sList = JSON.parse(sMatch[1]);
                const declaredCount = parseInt(tlMatch[1], 10);
                const count = Math.max(
                    isNaN(declaredCount) ? 0 : declaredCount,
                    Array.isArray(sList) ? sList.length : 0
                );
                
                const pVars = {};
                for (let i = 0; i < count; i++) {
                    const pMatch = html.match(new RegExp(`_p${i}\\s*=\\s*(\\[[^\\]]*\\]);`));
                    if (pMatch) {
                        pVars[i] = JSON.parse(pMatch[1]);
                    }
                }
                
                const decryptWitUrl = (rawHex, secretKey) => {
                    let out = "";
                    const bytes = [];
                    for (let k = 0; k < rawHex.length; k += 2) {
                        bytes.push(parseInt(rawHex.substr(k, 2), 16));
                    }
                    const keylen = secretKey.length;
                    for (let k = 0; k < bytes.length; k++) {
                        out += String.fromCharCode(bytes[k] ^ secretKey.charCodeAt(k % keylen));
                    }
                    return out;
                };

                const normalizeDownloadQuality = (labelText) => {
                    const label = String(labelText || "").trim();
                    const lower = label.toLowerCase();
                    if (lower.includes("1080") || lower.includes("fhd")) return "FHD";
                    if (lower.includes("720") || /(^|[^a-z])hd([^a-z]|$)/i.test(lower)) return "HD";
                    if (lower.includes("480") || lower.includes("sd")) return "SD";
                    if (lower.includes("360")) return "360p";
                    return label;
                };

                // Labels improve display names, but they are deliberately not
                // required for extraction. WitAnime changes its download HTML
                // more often than the encrypted _s/_p URL registry.
                const qualityByIndex = {};
                const qualityLists = doc.select('ul.quality-list') || [];
                for (const ul of qualityLists) {
                    const firstLi = ul.selectFirst('li');
                    const qualityLabel = normalizeDownloadQuality(
                        firstLi ? firstLi.text : ""
                    );

                    const downloadLinks = ul.select('a.download-link');
                    for (const link of downloadLinks) {
                        const dataIndexStr = link.attr('data-index');
                        if (!dataIndexStr) continue;

                        const dataIndex = parseInt(dataIndexStr, 10);
                        if (!isNaN(dataIndex) && dataIndex >= 0 && dataIndex < count) {
                            qualityByIndex[dataIndex] = qualityLabel;
                        }
                    }
                }

                // Some templates place links outside ul.quality-list. Preserve
                // any quality exposed directly on those anchors when present.
                const looseDownloadLinks = doc.select('a.download-link') || [];
                for (const link of looseDownloadLinks) {
                    const dataIndex = parseInt(link.attr('data-index'), 10);
                    if (isNaN(dataIndex) || dataIndex < 0 || dataIndex >= count || qualityByIndex[dataIndex]) {
                        continue;
                    }
                    qualityByIndex[dataIndex] = normalizeDownloadQuality(
                        link.attr('data-quality') ||
                        link.attr('data-resolution') ||
                        link.attr('title') ||
                        ""
                    );
                }

                const decodeForInspection = (rawUrl) => {
                    let value = String(rawUrl || "").trim().replace(/&amp;/g, "&");
                    for (let attempt = 0; attempt < 2; attempt++) {
                        try {
                            const decoded = decodeURIComponent(value);
                            if (decoded === value) break;
                            value = decoded;
                        } catch (e) {
                            break;
                        }
                    }
                    return value;
                };

                // Decrypt every registered URL. Provider-name selectors are
                // intentionally avoided, so GoFile is found even if WitAnime
                // renames the button or moves it to another HTML container.
                for (let dataIndex = 0; dataIndex < count; dataIndex++) {
                    if (!sList[dataIndex] || !pVars[dataIndex]) continue;

                    try {
                        const seqDecrypted = decryptWitUrl(sList[dataIndex], secret);
                        const seq = JSON.parse(seqDecrypted);
                        const chunks = pVars[dataIndex];
                        const decryptedChunks = chunks.map((chunk) => decryptWitUrl(chunk, secret));

                        const arranged = new Array(seq.length);
                        for (let j = 0; j < seq.length; j++) {
                            arranged[seq[j]] = decryptedChunks[j];
                        }

                        const finalUrl = arranged.join("").trim();
                        const inspectedUrl = decodeForInspection(finalUrl);
                        const inspectedUrlLower = inspectedUrl.toLowerCase();
                        const qualityLabel = qualityByIndex[dataIndex] || "";

                        if (inspectedUrlLower.includes("mp4upload.com")) {
                            const mp4Match = inspectedUrl.match(
                                /https?:\/\/(?:www\.)?mp4upload\.com\/[^\s"'<>]+/i
                            );
                            const mp4Url = mp4Match ? mp4Match[0] : finalUrl;
                            serverTasks.push({
                                key: "mp4upload (download)",
                                label: `Mp4Upload download ${qualityLabel || dataIndex}`,
                                run: () => withTimeout(
                                    extractFromMp4UploadDownload(mp4Url, qualityLabel),
                                    `Mp4Upload download ${qualityLabel || dataIndex}`
                                )
                            });
                            continue;
                        }

                        const gofileContentId = this.getGofileContentId(inspectedUrl);
                        if (gofileContentId) {
                            const gofileUrl = `https://gofile.io/d/${encodeURIComponent(gofileContentId)}`;
                            serverTasks.push({
                                key: "gofile (download)",
                                label: `GoFile download ${qualityLabel || dataIndex}`,
                                run: () => withTimeout(
                                    this.customGofileExtractor(
                                        gofileUrl,
                                        "GoFile (Download)",
                                        qualityLabel
                                    ),
                                    `GoFile download ${qualityLabel || dataIndex}`
                                )
                            });
                        }
                    } catch (err) {
                        console.log(`Decrypt error for index ${dataIndex}: ${err}`);
                    }
                }
            }
        } catch (e) {
            console.log(`Error parsing download section: ${e}`);
        }

        const runTasks = async (tasks) => {
            const results = await Promise.all(tasks.map(async (task) => {
                try {
                    return await task.run();
                } catch (e) {
                    console.log(`${task.label} extraction failed: ${e}`);
                    return [];
                }
            }));
            const flattened = [];
            for (const taskVideos of results) {
                if (taskVideos && taskVideos.length) flattened.push(...taskVideos);
            }
            return flattened;
        };

        if (preferredServerKey === "any server") {
            videos.push(...await runTasks(serverTasks));
        } else {
            const preferredTasks = serverTasks.filter((task) => task.key === preferredServerKey);
            if (preferredTasks.length > 0) {
                const preferredVideos = await runTasks(preferredTasks);
                videos.push(...preferredVideos);

                // A specific server is a fast path, not a hard failure mode.
                // Fall back to every untried host only when it produced nothing.
                if (preferredVideos.length === 0) {
                    const fallbackTasks = serverTasks.filter((task) => task.key !== preferredServerKey);
                    videos.push(...await runTasks(fallbackTasks));
                }
            } else {
                videos.push(...await runTasks(serverTasks));
            }
        }

        const getQualityRank = (qualityStr) => {
            const q = String(qualityStr || "").toLowerCase();
            if (q.includes("1080") || q.includes("fhd")) return 1080;
            if (q.includes("720") || q.includes("hd")) return 720;
            if (q.includes("480") || q.includes("sd")) return 480;
            if (q.includes("360")) return 360;
            if (q.includes("auto") || q.includes("multi")) return 1;
            return 0;
        };

        const scoreVideo = (video) => {
            let score = 0;
            const qualityStr = String(video.quality || "");
            const qLower = qualityStr.toLowerCase();
            const prefQualityLow = preferredQuality.toLowerCase();
            const prefServerLow = preferredServer.toLowerCase();

            // 1. Check preferred quality match
            if (prefQualityLow !== "auto") {
                if (qLower.includes(prefQualityLow)) {
                    score += 10000;
                }
            } else {
                if (qLower.includes("auto") || qLower.includes("multi")) {
                    score += 10000;
                }
            }

            // 2. Check preferred server match
            if (prefServerLow !== "any" && prefServerLow !== "any server") {
                if (qLower.includes(prefServerLow)) {
                    score += 5000;
                }
            }

            // 3. Quality rank bonus (to prefer higher qualities)
            score += getQualityRank(qualityStr);
            return score;
        };

        const uniqueVideos = [];
        const seenVideos = {};
        for (const video of videos) {
            if (!video || !video.url) continue;
            const key = String(video.url) + "|" + String(video.originalUrl || "");
            if (seenVideos[key]) continue;
            seenVideos[key] = true;
            uniqueVideos.push(video);
        }

        uniqueVideos.sort((a, b) => scoreVideo(b) - scoreVideo(a));
        return uniqueVideos;
    }
    
    getFilterList() {
        return [
            {
                type_name: 'SelectFilter',
                name: 'تصنيف الأنمي',
                type: 'genre',
                state: 0,
                values: [
    { type_name: 'SelectOption', name: 'الكل', value: '' },

    { type_name: 'SelectOption', name: 'أطفال', value: 'anime-genre/%d8%a3%d8%b7%d9%81%d8%a7%d9%84/' },
    { type_name: 'SelectOption', name: 'أكشن', value: 'anime-genre/%d8%a3%d9%83%d8%b4%d9%86/' },
    { type_name: 'SelectOption', name: 'إثارة', value: 'anime-genre/%d8%a5%d8%ab%d8%a7%d8%b1%d8%a9/' },
    { type_name: 'SelectOption', name: 'ايتشي', value: 'anime-genre/%d8%a7%d9%8a%d8%aa%d8%b4%d9%8a/' },
    { type_name: 'SelectOption', name: 'ايسيكاي', value: 'anime-genre/%d8%a7%d9%8a%d8%b3%d9%8a%d9%83%d8%a7%d9%8a/' },
    { type_name: 'SelectOption', name: 'بوليسي', value: 'anime-genre/%d8%a8%d9%88%d9%84%d9%8a%d8%b3%d9%8a/' },
    { type_name: 'SelectOption', name: 'تاريخي', value: 'anime-genre/%d8%aa%d8%a7%d8%b1%d9%8a%d8%ae%d9%8a/' },
    { type_name: 'SelectOption', name: 'تحقيق', value: 'anime-genre/%d8%aa%d8%ad%d9%82%d9%8a%d9%82/' },
    { type_name: 'SelectOption', name: 'تشويق', value: 'anime-genre/%d8%aa%d8%b4%d9%88%d9%8a%d9%82/' },
    { type_name: 'SelectOption', name: 'جوسي', value: 'anime-genre/%d8%ac%d9%88%d8%b3%d9%8a/' },
    { type_name: 'SelectOption', name: 'حريم', value: 'anime-genre/%d8%ad%d8%b1%d9%8a%d9%85/' },
    { type_name: 'SelectOption', name: 'خارق للطبيعة', value: 'anime-genre/%d8%ae%d8%a7%d8%b1%d9%82-%d9%84%d9%84%d8%b7%d8%a8%d9%8a%d8%b9%d8%a9/' },
    { type_name: 'SelectOption', name: 'خيال', value: 'anime-genre/%d8%ae%d9%8a%d8%a7%d9%84/' },
    { type_name: 'SelectOption', name: 'خيال علمي', value: 'anime-genre/%d8%ae%d9%8a%d8%a7%d9%84-%d8%b9%d9%84%d9%85%d9%8a/' },
    { type_name: 'SelectOption', name: 'دراما', value: 'anime-genre/%d8%af%d8%b1%d8%a7%d9%85%d8%a7/' },
    { type_name: 'SelectOption', name: 'رعب', value: 'anime-genre/%d8%b1%d8%b9%d8%a8/' },
    { type_name: 'SelectOption', name: 'رومانسي', value: 'anime-genre/%d8%b1%d9%88%d9%85%d8%a7%d9%86%d8%b3%d9%8a/' },
    { type_name: 'SelectOption', name: 'رياضي', value: 'anime-genre/%d8%b1%d9%8a%d8%a7%d8%b6%d9%8a/' },
    { type_name: 'SelectOption', name: 'ساخر', value: 'anime-genre/%d8%b3%d8%a7%d8%ae%d8%b1/' },
    { type_name: 'SelectOption', name: 'ساموراي', value: 'anime-genre/%d8%b3%d8%a7%d9%85%d9%88%d8%b1%d8%a7%d9%8a/' },
    { type_name: 'SelectOption', name: 'سحر', value: 'anime-genre/%d8%b3%d8%ad%d8%b1/' },
    { type_name: 'SelectOption', name: 'سينين', value: 'anime-genre/%d8%b3%d9%8a%d9%86%d9%8a%d9%86/' },
    { type_name: 'SelectOption', name: 'شريحة من الحياة', value: 'anime-genre/%d8%b4%d8%b1%d9%8a%d8%ad%d8%a9-%d9%85%d9%86-%d8%a7%d9%84%d8%ad%d9%8a%d8%a7%d8%a9/' },
    { type_name: 'SelectOption', name: 'شوجو', value: 'anime-genre/%d8%b4%d9%88%d8%ac%d9%88/' },
    { type_name: 'SelectOption', name: 'شوجو آي', value: 'anime-genre/%d8%b4%d9%88%d8%ac%d9%88-%d8%a2%d9%8a/' },
    { type_name: 'SelectOption', name: 'شونين', value: 'anime-genre/%d8%b4%d9%88%d9%86%d9%8a%d9%86/' },
    { type_name: 'SelectOption', name: 'شياطين', value: 'anime-genre/%d8%b4%d9%8a%d8%a7%d8%b7%d9%8a%d9%86/' },
    { type_name: 'SelectOption', name: 'عسكري', value: 'anime-genre/%d8%b9%d8%b3%d9%83%d8%b1%d9%8a/' },
    { type_name: 'SelectOption', name: 'غموض', value: 'anime-genre/%d8%ba%d9%85%d9%88%d8%b6/' },
    { type_name: 'SelectOption', name: 'فضاء', value: 'anime-genre/%d9%81%d8%b6%d8%a7%d8%a1/' },
    { type_name: 'SelectOption', name: 'فنون قتالية', value: 'anime-genre/%d9%81%d9%86%d9%88%d9%86-%d9%82%d8%aa%d8%a7%d9%84%d9%8a%d8%a9/' },
    { type_name: 'SelectOption', name: 'قوة خارقة', value: 'anime-genre/%d9%82%d9%88%d8%a9-%d8%ae%d8%a7%d8%b1%d9%82%d8%a9/' },
    { type_name: 'SelectOption', name: 'كوميدي', value: 'anime-genre/%d9%83%d9%88%d9%85%d9%8a%d8%af%d9%8a/' },
    { type_name: 'SelectOption', name: 'لعبة', value: 'anime-genre/%d9%84%d8%b9%d8%a8%d8%a9/' },
    { type_name: 'SelectOption', name: 'مدرسي', value: 'anime-genre/%d9%85%d8%af%d8%b1%d8%b3%d9%8a/' },
    { type_name: 'SelectOption', name: 'مصاصي دماء', value: 'anime-genre/%d9%85%d8%b5%d8%a7%d8%b5%d9%8a-%d8%af%d9%85%d8%a7%d8%a1/' },
    { type_name: 'SelectOption', name: 'مغامرات', value: 'anime-genre/%d9%85%d8%ba%d8%a7%d9%85%d8%b1%d8%a7%d8%aa/' },
    { type_name: 'SelectOption', name: 'موسيقى', value: 'anime-genre/%d9%85%d9%88%d8%b3%d9%8a%d9%82%d9%89/' },
    { type_name: 'SelectOption', name: 'ميكا', value: 'anime-genre/%d9%85%d9%8a%d9%83%d8%a7/' },
    { type_name: 'SelectOption', name: 'نفسي', value: 'anime-genre/%d9%86%d9%81%d8%b3%d9%8a/' }
]
            },
            {
                type_name: 'SelectFilter',
                name: 'حالة الأنمي',
                type: 'status',
                state: 0,
                values: [
                    { type_name: 'SelectOption', name: 'الكل', value: '' },
                    { type_name: 'SelectOption', name: 'مكتمل', value: 'anime-status/%d9%85%d9%83%d8%aa%d9%85%d9%84/' },
                    { type_name: 'SelectOption', name: 'يعرض الان', value: 'anime-status/%d9%8a%d8%b9%d8%b1%d8%b6-%d8%a7%d9%84%d8%a7%d9%86/' }
                ]
            },
            {
                type_name: 'SelectFilter',
                name: 'النوع',
                type: 'type',
                state: 0,
                values: [
                    { type_name: 'SelectOption', name: 'الكل', value: '' },
                    { type_name: 'SelectOption', name: 'TV', value: 'anime-type/tv/' },
                    { type_name: 'SelectOption', name: 'Movie', value: 'anime-type/movie/' },
                    { type_name: 'SelectOption', name: 'OVA', value: 'anime-type/ova/' },
                    { type_name: 'SelectOption', name: 'ONA', value: 'anime-type/ona/' },
                    { type_name: 'SelectOption', name: 'Special', value: 'anime-type/special/' }
                ]
            }
        ];
    }
}
