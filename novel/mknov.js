// prettier-ignore
const mangayomiSources = [{
    "name": "مملكة الروايات",
    "lang": "ar",
    "baseUrl": "https://www.mknov.com",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://www.mknov.com",
    "typeSource": "single",
    "itemType": 2,
    "version": "0.0.1",
    "pkgPath": "novel/src/ar/mknov.js",
    "notes": ""
}];

class DefaultExtension extends MProvider {
  headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
  };

  getHeaders(url) {
    return this.headers;
  }

  extractRscPayload(html) {
    const pattern = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
    let m;
    let combined = "";
    while ((m = pattern.exec(html)) !== null) {
      combined += m[1].replace(/\\(["\\/bfnrt])/g, "$1").replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    }
    return combined;
  }

  extractJsonValue(str, key) {
    const searchKey = `"${key}":`;
    const idx = str.indexOf(searchKey);
    if (idx === -1) return null;
    let i = idx + searchKey.length;
    while (i < str.length && (str[i] === " " || str[i] === "\t" || str[i] === "\n" || str[i] === "\r")) i++;
    if (i >= str.length) return null;
    const first = str[i];
    if (first !== "{" && first !== "[" && first !== '"' && first !== 't' && first !== 'f' && first !== 'n' && (first < '0' || first > '9') && first !== '-') return null;
    if (first === "{" || first === "[") {
      const open = first;
      const close = open === "{" ? "}" : "]";
      let depth = 0;
      let inStr = false;
      let escape = false;
      let start = i;
      for (; i < str.length; i++) {
        if (escape) { escape = false; continue; }
        if (str[i] === "\\") { escape = true; continue; }
        if (str[i] === '"') { inStr = !inStr; continue; }
        if (!inStr) {
          if (str[i] === open) depth++;
          else if (str[i] === close) {
            depth--;
            if (depth === 0) return JSON.parse(str.substring(start, i + 1));
          }
        }
      }
    }
    return null;
  }

  parseSearchResults(html) {
    const rsc = this.extractRscPayload(html);
    const data = this.extractJsonValue(rsc, "searchResults");
    if (!data) return { list: [], hasNextPage: false };
    const works = Array.isArray(data.works) ? data.works : [];
    const list = works.map((w) => ({
      name: w.name || "",
      imageUrl: w.image_url || "",
      link: `/novel/${w.id}`,
    }));
    const hasNextPage = data.pagination ? data.pagination.hasMore === true : false;
    return { list, hasNextPage };
  }

  async getPopular(page) {
    const res = await new Client().get(`${this.getBaseUrl()}/search?sort=popular&page=${page}`, this.headers);
    if (res.statusCode !== 200) throw new Error(`Failed to fetch popular page: ${res.statusCode}`);
    return this.parseSearchResults(res.body);
  }

  async getLatestUpdates(page) {
    const res = await new Client().get(`${this.getBaseUrl()}/search?sort=latest&page=${page}`, this.headers);
    if (res.statusCode !== 200) throw new Error(`Failed to fetch latest page: ${res.statusCode}`);
    return this.parseSearchResults(res.body);
  }

  async search(query, page, filters) {
    const keyword = query.trim();
    let url;
    if (keyword) {
      url = `${this.getBaseUrl()}/search?q=${encodeURIComponent(keyword)}&page=${page}`;
    } else {
      url = `${this.getBaseUrl()}/search?page=${page}`;
    }
    const res = await new Client().get(url, this.headers);
    if (res.statusCode !== 200) throw new Error(`Failed to fetch search page: ${res.statusCode}`);
    return this.parseSearchResults(res.body);
  }

  toStatus(status) {
    if (status === "completed") return 1;
    if (status === "ongoing") return 0;
    if (status === "hiatus" || status === "onhold") return 2;
    return 5;
  }

  async getDetail(url) {
    const res = await new Client().get(url, this.headers);
    if (res.statusCode !== 200) throw new Error(`Failed to fetch detail page: ${res.statusCode}`);
    const rsc = this.extractRscPayload(res.body);

    const novel = this.extractJsonValue(rsc, "novel");
    if (!novel) throw new Error("Could not find novel data in page");

    const name = novel.name || "";
    const imageUrl = novel.image_url || "";
    const description = (novel.story || "") + "\n\n";
    const genre = Array.isArray(novel.tags) ? novel.tags : [];
    const author = novel.author || "";
    const status = this.toStatus(novel.status);

    const chaptersData = this.extractJsonValue(rsc, "chapters");
    const chapters = [];
    if (Array.isArray(chaptersData)) {
      for (const ch of chaptersData) {
        const chNum = ch.chapter_number || "";
        const chTitle = ch.chapter_title || "";
        const chName = chNum ? `${chNum}${chTitle ? `: ${chTitle}` : ""}` : chTitle || "?";
        const url = `/novel/${ch.work_id}/chapter/${ch.id}`;
        const dateUpload = ch.publish_datetime ? new Date(ch.publish_datetime).getTime().toString() : "";
        chapters.push({ name: chName, url, dateUpload, scanlator: "" });
      }
    }

    return { name, imageUrl, description, genre, author, status, chapters };
  }

  async getHtmlContent(name, url) {
    const res = await new Client().get(url, this.headers);
    if (res.statusCode !== 200) throw new Error(`Failed to fetch chapter content: ${res.statusCode}`);

    const doc = new Document(res.body);
    let title = name;

    const titleEl = doc.selectFirst("h1");
    if (titleEl && titleEl.text.trim().length > 0) {
      title = titleEl.text.trim();
    }

    let contentEl = doc.selectFirst("div.prose");
    if (!contentEl || contentEl.text.trim().length === 0) {
      contentEl = doc.selectFirst("div.reading-content");
    }
    if (!contentEl || contentEl.text.trim().length === 0) {
      contentEl = doc.selectFirst("main div.container");
    }

    let html = "";
    if (contentEl) {
      html = contentEl.outerHtml;
    } else {
      const markers = ["prose prose-lg", "reading-content", "chapter-content"];
      for (const marker of markers) {
        const startIdx = res.body.indexOf(marker);
        if (startIdx !== -1) {
          const tagStart = res.body.lastIndexOf("<div", startIdx);
          if (tagStart !== -1) {
            let depth = 0;
            let j = tagStart;
            for (; j < res.body.length; j++) {
              if (res.body[j] === "<") {
                if (res.body.substring(j, j + 4) === "<div") {
                  depth++;
                  j += 3;
                } else if (res.body.substring(j, j + 6) === "</div>") {
                  depth--;
                  j += 5;
                  if (depth === 0) {
                    html = res.body.substring(tagStart, j + 1);
                    break;
                  }
                }
              }
            }
          }
          if (html) break;
        }
      }
    }

    if (!html || html.trim().length === 0) {
      throw new Error("Could not find chapter content in HTML");
    }

    return `<h2 style="text-align: center;">${title}</h2><hr><br>${html}`;
  }

  getFilterList() {
    return [];
  }

  getBaseUrl() {
    const preference = new SharedPreferences();
    var base_url = preference.get("base_url");
    if (base_url.length == 0) {
      return this.source.baseUrl;
    }
    if (base_url.endsWith("/")) {
      return base_url.slice(0, -1);
    }
    return base_url;
  }

  getSourcePreferences() {
    return [
      {
        key: "base_url",
        editTextPreference: {
          title: "تعديل الرابط",
          summary: "",
          value: this.source.baseUrl,
          dialogTitle: "تعديل",
          dialogMessage: `Default URL ${this.source.baseUrl}`,
        },
      },
    ];
  }
}
