// ============================================================
// PATHS — one place that knows where the site is served from
// ============================================================
//
// The pages are hosted on GitHub Pages, under a repository path such as
// /leforem-scraper. An absolute "/js/..." would then look for the asset at
// the root of the domain and find nothing, so every URL is built here from
// the base declared in site.config.json.
//
// The data URL is read from the same file: the export can live in this
// repository or anywhere else on GitHub.
// ============================================================

import { byId } from "./dom.js";

/** Configured values, filled by loadConfig before the pages read anything. */
let settings = { dataUrl: "./raw.json", base: "" };

let loaded = null;

/**
 * Read site.config.json, once.
 *
 * Never rejects: a missing or broken config falls back to the defaults, so
 * the site still loads from the repository root.
 * @returns {Promise<{dataUrl: string, base: string}>}
 */
export function loadConfig() {
    if (loaded) return loaded;

    loaded = fetch(new URL("site.config.json", document.baseURI).href, {
        cache: "no-store",
    })
        .then(function (response) {
            return response.ok ? response.json() : null;
        })
        .then(function (payload) {
            if (!payload || typeof payload !== "object") return settings;
            settings = {
                dataUrl: typeof payload.dataUrl === "string" && payload.dataUrl
                    ? payload.dataUrl : settings.dataUrl,
                base: typeof payload.base === "string" ? payload.base : "",
            };
            // A base ending in "/" keeps the join below to a plain concat.
            if (settings.base && settings.base.slice(-1) !== "/") {
                settings.base += "/";
            }
            return settings;
        })
        .catch(function () {
            return settings;
        });

    return loaded;
}

/** The configured base, always ending in "/" unless empty. */
export function basePath() {
    return settings.base;
}

/**
 * Build the URL of a site file from its root-relative path.
 *
 * "/js/pages/index.js" becomes "<base>js/pages/index.js". An empty base
 * leaves the path alone, which is what the local server expects.
 * @param {string} rootPath starts with a slash, no query string
 * @returns {string}
 */
export function assetUrl(rootPath) {
    if (!settings.base) return rootPath;
    return settings.base + String(rootPath || "").replace(/^\/+/, "");
}

/**
 * The URL of the offers export.
 * @returns {string}
 */
export function dataUrl() {
    return settings.dataUrl;
}

export { byId };
