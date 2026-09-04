import { PlaywrightCrawler, Sitemap } from 'crawlee';
import { URL } from 'url';
import { pathToFileURL } from 'url';
import { generateICPFromScrapedData } from './icpGenerator.js';

/**
 * Enterprise multi-framework website crawler.
 *
 * Goal: given a single start URL, discover and scrape as many *content* pages as
 * possible regardless of how the site is built - Next.js (App/Pages router),
 * Nuxt/Vue, React SPAs, Remix, Gatsby, SvelteKit, Laravel, WordPress, or plain
 * server-rendered HTML.
 *
 * Discovery strategies (run in order, results merged):
 *   1. robots.txt  -> Sitemap: directives
 *   2. Common sitemap locations + WordPress/Yoast/Nuxt sitemap variants
 *      (Sitemap.load follows nested <sitemapindex> files automatically)
 *   3. WordPress REST API (/wp-json/wp/v2/pages|posts) when present
 *   4. Per-page, in-browser extraction of:
 *        - every <a href> / <area> / [data-href] / [to] (BEFORE the DOM is
 *          cleaned - this is where nav/header/footer links live)
 *        - framework route blobs: __NEXT_DATA__, __BUILD_MANIFEST,
 *          __NUXT__, __remixContext, ___gatsby, JSON-LD url/@id
 *        - path-like string literals inside inline <script> route tables
 *   5. Fallback probe of common marketing paths (/about, /services, ...) that
 *      return 200 + text/html
 */

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// File extensions that are never a content page.
const ASSET_EXT_RE =
  /\.(pdf|docx?|xlsx?|pptx?|csv|jpg|jpeg|png|gif|webp|avif|svg|ico|bmp|tiff?|mp4|webm|mov|avi|mkv|mp3|wav|ogg|flac|zip|rar|tar|gz|tgz|7z|css|js|mjs|cjs|map|woff2?|ttf|otf|eot|rss|atom|json|xml|txt|yaml|yml)$/i;

// Path prefixes that are framework/CDN/admin plumbing, not content.
const SKIP_PATH_RE =
  /^\/(?:_next|_nuxt|_app|_astro|__|static|assets?|dist|build|images?|img|media|fonts?|css|js|scripts?|styles?|api|graphql|gql|cdn-cgi|wp-admin|wp-login|wp-includes|wp-content\/(?:uploads|plugins|themes)|xmlrpc|feed|comments\/feed|author|tag|category\/feed|\?)/i;

// Sitemap locations to probe beyond robots.txt.
const SITEMAP_CANDIDATE_PATHS = [
  '/sitemap.xml',
  '/sitemap_index.xml',
  '/sitemap-index.xml',
  '/sitemapindex.xml',
  '/sitemap/sitemap.xml',
  '/sitemap/index.xml',
  '/sitemap/',
  '/sitemap1.xml',
  '/sitemap-0.xml',
  '/wp-sitemap.xml',            // WordPress core 5.5+
  '/sitemap_index.xml.gz',
  '/page-sitemap.xml',          // Yoast
  '/post-sitemap.xml',          // Yoast
  '/pages-sitemap.xml',
  '/server-sitemap.xml',        // next-sitemap dynamic
  '/sitemap-pages.xml',
  '/sitemap.txt'
];

// Marketing/content paths worth probing when discovery comes up short.
const COMMON_CONTENT_PATHS = [
  '/about', '/about-us', '/company', '/who-we-are', '/our-story',
  '/team', '/our-team', '/leadership', '/people',
  '/services', '/service', '/what-we-do', '/solutions', '/capabilities',
  '/products', '/product', '/features', '/platform',
  '/pricing', '/plans', '/packages',
  '/work', '/portfolio', '/projects', '/case-studies', '/case-study', '/showcase',
  '/clients', '/customers', '/partners',
  '/industries', '/sectors', '/verticals',
  '/blog', '/news', '/insights', '/articles', '/resources', '/knowledge-hub',
  '/contact', '/contact-us', '/get-in-touch', '/get-a-quote', '/quote',
  '/careers', '/jobs', '/join-us',
  '/faq', '/faqs', '/help',
  '/testimonials', '/reviews',
  '/process', '/how-it-works', '/approach', '/methodology',
  '/technology', '/tech-stack', '/technologies'
];

const stripWww = (host) => host.replace(/^www\./i, '').toLowerCase();

// Text that signals a soft-404 / error page rendered with a 200 status
// (common in Next.js App Router, Nuxt, SPAs) - not real content.
const NOT_FOUND_RE =
  /(this page could ?n[o'’]?t be found|404[\s:-]*(page\s+)?not found|page not found|error 404|the page you (are|were) looking for|application error:\s*a (client|server)-side exception has occurred|a server-side exception has occurred while loading)/i;

/**
 * Canonical form used for de-duplication: no hash, no query, no trailing slash,
 * and the host folded to the site's canonical host so www / non-www collapse.
 */
function normalizeUrl(raw, canonicalHost) {
  const u = new URL(raw);
  u.hash = '';
  u.search = '';
  let path = u.pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  if (path === '') path = '/';
  const host = canonicalHost && stripWww(u.hostname) === stripWww(canonicalHost) ? canonicalHost : u.host;
  return `${u.protocol}//${host}${path}`;
}

/** Follow redirects from the start URL to learn the site's real host (www vs not). */
async function resolveCanonicalHost(startUrl) {
  try {
    const res = await fetchWithTimeout(startUrl, { timeoutMs: 12000, accept: 'text/html' });
    if (res && res.url) return new URL(res.url).host;
  } catch {
    /* fall through */
  }
  return new URL(startUrl).host;
}

/** True when `raw` is an on-site, crawlable content URL. */
function isContentUrl(raw, targetHost) {
  try {
    const u = new URL(raw);
    if (!/^https?:$/.test(u.protocol)) return false;
    if (stripWww(u.hostname) !== targetHost) return false;
    if (ASSET_EXT_RE.test(u.pathname)) return false;
    if (SKIP_PATH_RE.test(u.pathname)) return false;
    if (u.pathname.length > 160) return false;
    return true;
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url, { timeoutMs = 9000, accept } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        ...(accept ? { Accept: accept } : {})
      }
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url) {
  const res = await fetchWithTimeout(url, { accept: 'text/plain,*/*' });
  if (!res || !res.ok) return null;
  try {
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchJson(url) {
  const res = await fetchWithTimeout(url, { accept: 'application/json' });
  if (!res || !res.ok) return null;
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('json')) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------
// Strategy 1: robots.txt -> Sitemap directives
// ------------------------------------------------------------------
async function discoverSitemapsFromRobots(origin) {
  const txt = await fetchText(`${origin}/robots.txt`);
  if (!txt) return [];
  const out = [];
  const re = /^\s*sitemap:\s*(\S+)/gim;
  let m;
  while ((m = re.exec(txt))) out.push(m[1].trim());
  return out;
}

// ------------------------------------------------------------------
// Strategy 2: load sitemaps (Sitemap.load follows <sitemapindex> trees)
// ------------------------------------------------------------------
async function discoverFromSitemaps(origin, extraSitemapUrls, targetHost) {
  const candidates = [
    ...new Set([
      ...extraSitemapUrls,
      ...SITEMAP_CANDIDATE_PATHS.map((p) => `${origin}${p}`)
    ])
  ];

  const found = new Set();
  await Promise.allSettled(
    candidates.map(async (sitemapUrl) => {
      try {
        // Cheap existence check first so we don't spam retry/404 warnings.
        const head = await fetchWithTimeout(sitemapUrl, { timeoutMs: 7000, accept: 'application/xml,text/xml,*/*' });
        if (!head || !head.ok) return;
        const sitemap = await Sitemap.load(sitemapUrl, undefined, {
          sitemapRetries: 1,
          reportNetworkErrors: false
        });
        for (const u of sitemap.urls || []) {
          try {
            if (stripWww(new URL(u).hostname) === targetHost) found.add(u);
          } catch {
            /* skip malformed sitemap entry */
          }
        }
      } catch {
        /* sitemap missing or unparseable */
      }
    })
  );

  if (found.size > 0) {
    console.log(`[Sitemap] discovered ${found.size} URLs`);
  }
  return [...found];
}

// ------------------------------------------------------------------
// Strategy 3: WordPress REST API
// ------------------------------------------------------------------
async function discoverFromWordPress(origin, targetHost) {
  const endpoints = [
    `${origin}/wp-json/wp/v2/pages?per_page=100&_fields=link`,
    `${origin}/wp-json/wp/v2/posts?per_page=100&_fields=link`,
    `${origin}/?rest_route=/wp/v2/pages&per_page=100&_fields=link`,
    `${origin}/?rest_route=/wp/v2/posts&per_page=100&_fields=link`
  ];

  const found = new Set();
  for (const ep of endpoints) {
    const data = await fetchJson(ep);
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item && typeof item.link === 'string' && isContentUrl(item.link, targetHost)) {
          found.add(item.link);
        }
      }
    }
  }
  if (found.size > 0) {
    console.log(`[WordPress API] discovered ${found.size} URLs`);
  }
  return [...found];
}

// ------------------------------------------------------------------
// Strategy 5: probe common marketing paths.
// Only used when sitemap/API discovery is thin. Filters out soft-404s
// (200 status + "page not found" body) that SPAs/Next.js love to serve.
// ------------------------------------------------------------------
async function probeCommonPaths(origin) {
  const results = await Promise.allSettled(
    COMMON_CONTENT_PATHS.map(async (path) => {
      const res = await fetchWithTimeout(`${origin}${path}`, { timeoutMs: 8000, accept: 'text/html' });
      if (!res || !res.ok) return null;
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('html')) return null;
      let html = '';
      try {
        html = await res.text();
      } catch {
        return null;
      }
      if (NOT_FOUND_RE.test(html)) return null;
      return `${origin}${path}`;
    })
  );
  const hits = results
    .filter((r) => r.status === 'fulfilled' && r.value)
    .map((r) => r.value);
  if (hits.length > 0) {
    console.log(`[Common paths] ${hits.length} candidate URLs`);
  }
  return hits;
}

// ------------------------------------------------------------------
// Strategy 4: in-browser link + framework-route extraction.
// Runs inside page.evaluate; must be self-contained.
// ------------------------------------------------------------------
/* eslint-disable */
function extractInPageUrls() {
  const paths = new Set();

  const add = (v) => {
    if (typeof v !== 'string') return;
    v = v.trim();
    if (!v || v.length > 300) return;
    if (v.startsWith('//')) return;
    if (/^(mailto:|tel:|javascript:|data:|blob:|#)/i.test(v)) return;
    if (v.startsWith('/') || /^https?:\/\//i.test(v)) paths.add(v);
  };

  // 1. Every link-ish element (nav/header/footer still present here).
  document
    .querySelectorAll(
      'a[href], area[href], [data-href], [data-url], [to], link[rel="canonical"][href], link[rel="alternate"][href], link[rel="next"][href], link[rel="prev"][href]'
    )
    .forEach((el) => {
      add(el.getAttribute('href'));
      add(el.getAttribute('data-href'));
      add(el.getAttribute('data-url'));
      add(el.getAttribute('to'));
    });

  // 2. Next.js
  try {
    if (window.__NEXT_DATA__ && window.__NEXT_DATA__.page) add(window.__NEXT_DATA__.page);
  } catch {}
  try {
    const bm = window.__BUILD_MANIFEST;
    if (bm) {
      if (Array.isArray(bm.sortedPages)) bm.sortedPages.forEach(add);
      Object.keys(bm).forEach((k) => {
        if (k.startsWith('/')) add(k);
      });
    }
  } catch {}

  // 3. Nuxt / Vue
  try {
    const n = window.__NUXT__;
    if (n) {
      if (n.routePath) add(n.routePath);
      if (n.route && n.route.path) add(n.route.path);
    }
  } catch {}

  // 4. Remix
  try {
    const rc = window.__remixContext;
    if (rc && rc.state && rc.state.loaderData) {
      Object.keys(rc.state.loaderData).forEach((k) => {
        if (k.startsWith('routes/')) add('/' + k.replace(/^routes\//, '').replace(/\._index$/, '').replace(/\./g, '/'));
      });
    }
  } catch {}

  // 5. Gatsby page-data references in inline scripts (handled in step 7 too)
  try {
    if (window.___gatsby || window.___loader) {
      document.querySelectorAll('link[as="fetch"][href*="/page-data/"]').forEach((el) => {
        const m = /\/page-data(\/.*?)\/page-data\.json/.exec(el.getAttribute('href') || '');
        if (m) add(m[1] === '/index' ? '/' : m[1]);
      });
    }
  } catch {}

  // 6. JSON-LD: url / @id / item
  document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
    try {
      const walk = (o, depth) => {
        if (!o || depth > 8) return;
        if (typeof o === 'string') return;
        if (Array.isArray(o)) return o.forEach((x) => walk(x, depth + 1));
        if (typeof o === 'object') {
          for (const k of Object.keys(o)) {
            if ((k === 'url' || k === '@id' || k === 'item' || k === 'sameAs') && typeof o[k] === 'string') add(o[k]);
            else walk(o[k], depth + 1);
          }
        }
      };
      walk(JSON.parse(s.textContent), 0);
    } catch {}
  });

  // 7. Deep-scan framework state blobs + inline route tables for path literals.
  const deepScan = (obj, depth) => {
    if (obj == null || depth > 6) return;
    if (typeof obj === 'string') {
      if (/^\/[a-z0-9][a-z0-9\-_/]{0,110}$/i.test(obj)) paths.add(obj);
      return;
    }
    if (typeof obj !== 'object') return;
    const vals = Array.isArray(obj) ? obj : Object.values(obj);
    for (let i = 0; i < vals.length && i < 4000; i++) deepScan(vals[i], depth + 1);
  };
  try { deepScan(window.__NEXT_DATA__, 0); } catch {}
  try { deepScan(window.__NUXT__, 0); } catch {}
  try { deepScan(window.__remixContext, 0); } catch {}
  try { deepScan(window.__INITIAL_STATE__, 0); } catch {}

  Array.from(document.scripts).forEach((sc) => {
    if (sc.src) return; // inline only
    const txt = sc.textContent || '';
    if (!txt || txt.length > 300000) return;
    // Quoted root-relative paths that look like clean route slugs.
    const re = /["'`](\/[a-z0-9][a-z0-9\-_/]{1,90})["'`]/gi;
    let m;
    let count = 0;
    while ((m = re.exec(txt)) && count < 600) {
      paths.add(m[1]);
      count++;
    }
  });

  return Array.from(paths);
}
/* eslint-enable */

export async function crawlEntireWebsite(startUrl, options = {}) {
  const {
    maxPages = 40,
    maxConcurrency = 4,
    maxTokensTotal = 25000,
    probeCommon = true
  } = options;

  const parsedStart = new URL(startUrl);
  const origin = parsedStart.origin;
  const targetHost = stripWww(parsedStart.hostname);

  const scrapedPages = [];
  const seenContent = new Set(); // normalized URLs already stored

  // ---- Pre-crawl discovery -----------------------------------------
  const [canonicalHost, robotsSitemaps] = await Promise.all([
    resolveCanonicalHost(startUrl),
    discoverSitemapsFromRobots(origin)
  ]);
  const norm = (u) => normalizeUrl(u, canonicalHost);

  const [sitemapUrls, wpUrls] = await Promise.all([
    discoverFromSitemaps(origin, robotsSitemaps, targetHost),
    discoverFromWordPress(origin, targetHost)
  ]);

  // Guessed marketing paths are noisy - only fall back to them when the
  // authoritative sources (sitemap + CMS API) barely returned anything.
  const commonUrls =
    probeCommon && sitemapUrls.length + wpUrls.length < 5 ? await probeCommonPaths(origin) : [];

  const startNorm = norm(startUrl);
  const seedSet = new Set([startNorm]);
  for (const u of [...sitemapUrls, ...wpUrls, ...commonUrls]) {
    if (isContentUrl(u, targetHost)) seedSet.add(norm(u));
  }
  // Keep the start URL first, then cap the seed list so we don't massively
  // overshoot maxPages before the crawler even starts pruning.
  const seedUrls = [startNorm, ...[...seedSet].filter((u) => u !== startNorm)].slice(
    0,
    Math.max(maxPages * 3, 60)
  );

  console.log(
    `[Discovery] host=${canonicalHost} ${seedUrls.length} seed URLs (sitemap:${sitemapUrls.length} wp:${wpUrls.length} common:${commonUrls.length})`
  );

  // ---- Playwright crawler -----------------------------------------
  const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: maxPages,
    maxConcurrency,
    headless: true,
    navigationTimeoutSecs: 45,
    requestHandlerTimeoutSecs: 70,
    launchContext: { userAgent: DEFAULT_USER_AGENT },

    // Skip heavy assets - we only need text + hydrated DOM.
    preNavigationHooks: [
      async ({ page }) => {
        await page.route('**/*', (route) => {
          const type = route.request().resourceType();
          if (type === 'image' || type === 'media' || type === 'font') return route.abort();
          return route.continue();
        });
      }
    ],

    async requestHandler({ page, request, log, enqueueLinks }) {
      log.info(`Scraping: ${request.url}`);

      // A. Wait for hydration across frameworks.
      try {
        await page.waitForLoadState('domcontentloaded');
        await page
          .waitForFunction(
            () =>
              document.readyState === 'complete' &&
              (Boolean(window.__NEXT_DATA__) ||
                Boolean(window.__NUXT__) ||
                Boolean(window.__remixContext) ||
                Boolean(window.___gatsby) ||
                document.querySelector('main, [role="main"], #__next, #__nuxt, #app, #root') ||
                document.body.innerText.trim().length > 200),
            { timeout: 8000 }
          )
          .catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
      } catch {
        await page.waitForTimeout(1500);
      }

      // B. Scroll + hover to trigger lazy content and router prefetch.
      await page
        .evaluate(async () => {
          await new Promise((resolve) => {
            let total = 0;
            const step = 400;
            const timer = setInterval(() => {
              window.scrollBy(0, step);
              total += step;
              if (total >= document.body.scrollHeight || total > 6000) {
                clearInterval(timer);
                resolve();
              }
            }, 60);
          });
          window.scrollTo(0, 0);
          document.querySelectorAll('a, button, [role="button"], [role="link"]').forEach((el) => {
            try {
              el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            } catch {}
          });
        })
        .catch(() => {});

      // C. Extract links + framework routes BEFORE cleaning the DOM.
      const inPageUrls = await page.evaluate(extractInPageUrls).catch(() => []);

      // D. Clean DOM noise, then capture text.
      await page
        .evaluate(() => {
          const kill = [
            'script', 'style', 'noscript', 'template', 'iframe', 'svg', 'canvas',
            'nav', 'footer', 'header', '[role="navigation"]', '[role="banner"]',
            '[role="contentinfo"]', '.cookie-consent', '#cookie-banner', '[aria-hidden="true"]'
          ];
          kill.forEach((sel) => document.querySelectorAll(sel).forEach((el) => el.remove()));
        })
        .catch(() => {});

      // Pick the richest content root rather than the first match - `article`
      // and friends often wrap teaser cards, not the page body.
      const readContent = () =>
        page
          .evaluate(() => {
            const sels = ['main', '[role="main"]', '#__next', '#__nuxt', '#app', '#root', 'article'];
            let best = document.body ? document.body.innerText || '' : '';
            for (const sel of sels) {
              for (const el of document.querySelectorAll(sel)) {
                const t = el.innerText || '';
                if (t.length > best.length) best = t;
              }
            }
            return best;
          })
          .catch(() => '');

      const tidy = (s) => s.replace(/[^\S\n]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();

      const title = (await page.title().catch(() => '')) || '';
      let bodyText = tidy(await readContent());

      // Thin result -> give slow client-rendered pages one more chance.
      if (bodyText.length < 300) {
        await page.waitForTimeout(3500);
        const retry = tidy(await readContent());
        if (retry.length > bodyText.length) bodyText = retry;
      }

      const normUrl = norm(request.loadedUrl || request.url);
      const isNotFound = bodyText.length < 700 && NOT_FOUND_RE.test(bodyText);

      if (bodyText.length > 80 && !isNotFound && !seenContent.has(normUrl)) {
        seenContent.add(normUrl);
        scrapedPages.push({ url: normUrl, title: title.trim(), content: bodyText });
      } else if (isNotFound) {
        log.info(`Skipping soft-404: ${normUrl}`);
      }

      // E. Queue same-site content links discovered on this page.
      const absoluteFromInPage = inPageUrls
        .map((v) => {
          try {
            return new URL(v, request.loadedUrl || request.url).toString();
          } catch {
            return null;
          }
        })
        .filter((v) => v && isContentUrl(v, targetHost))
        .map(norm);

      await enqueueLinks({
        urls: [...new Set(absoluteFromInPage)],
        selector: 'a[href], [data-href], [role="link"]',
        baseUrl: request.loadedUrl || request.url,
        transformRequestFunction(req) {
          if (!isContentUrl(req.url, targetHost)) return false;
          req.url = norm(req.url);
          return req;
        }
      });
    },

    failedRequestHandler({ request, log }, error) {
      log.warning(`Request ${request.url} failed: ${error?.message || error}`);
    }
  });

  await crawler.run(seedUrls);

  // ---- Aggregate for downstream LLM ------------------------------
  let aggregatedContent = scrapedPages
    .map((p) => `=== PAGE URL: ${p.url} ===\nPAGE TITLE: ${p.title}\n\n${p.content}`)
    .join('\n\n-----------------------------------\n\n');

  if (aggregatedContent.length > maxTokensTotal * 4) {
    aggregatedContent = aggregatedContent.substring(0, maxTokensTotal * 4) + '\n\n[TRUNCATED DUE TO SIZE LIMIT]';
  }

  return {
    pageCount: scrapedPages.length,
    scrapedPages,
    aggregatedContent
  };
}

// ------------------------------------------------------------------
// Manual test runner: `node src/utils/scraper.js [url]`
// Guarded so importing this module (e.g. from the controller) is side-effect free.
// ------------------------------------------------------------------
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const target = process.argv[2] || 'https://techmorphers.com';
  const res = await crawlEntireWebsite(target);
  console.log(JSON.stringify({ pageCount: res.pageCount, urls: res.scrapedPages.map((p) => p.url) }, null, 2));
  const icp = await generateICPFromScrapedData(res.aggregatedContent, target);
  console.log(icp);
}
