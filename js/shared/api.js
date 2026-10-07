// ============================================================
// HTTP — reading the files the site is made of
// ============================================================
//
// The frontend is static: it reads the offers from the JSON export and keeps
// the user's own settings in the browser. There is no write route and no API
// to call, so the two POST helpers that used to drive the local scraper are
// gone with it.

import { assetUrl, dataUrl } from "./paths.js";

/** The export, read once and kept: it holds every search. */
let exportPromise = null;

/**
 * Read the offers export.
 *
 * "no-store" keeps the browser from serving a stale file after a new export
 * has been published. A cache-busting query parameter is added so the browser
 * and any CDN never serve a stale version of raw.json.
 * @returns {Promise<Object>} the export, or an empty one when unreachable
 */
export function fetchExport() {
    if (exportPromise) return exportPromise;

    const url = dataUrl() + (dataUrl().indexOf("?") === -1 ? "?" : "&") + "v=" + Date.now();
    exportPromise = fetch(url, { cache: "no-store" })
        .then(function (response) {
            if (!response.ok) {
                throw new Error("HTTP " + response.status);
            }
            return response.json();
        })
        .catch(function (error) {
            console.error("Unable to read the offers export", error);
            return { version: 0, offerCount: 0, deletedCount: 0, searches: [] };
        });

    return exportPromise;
}

/** Forget the cached export, so the next read hits the network again. */
export function forgetExport() {
    exportPromise = null;
}

/**
 * One search of the export, in the shape the pages already read.
 * @param {Object} payload the export
 * @param {string} name the search name
 * @returns {Object|null} { offers, label, ... } or null
 */
export function searchOf(payload, name) {
    const searches = searchesOf(payload);
    for (const entry of searches) {
        if (entry && entry.name === name) {
            return {
                version: payload.version,
                scrape_timestamp: entry.scrape_timestamp || "",
                name: entry.name,
                label: entry.label || "",
                occupation_guid: entry.occupationGuid || "",
                location_guid: entry.locationGuid || "",
                offers: Array.isArray(entry.offers) ? entry.offers : [],
            };
        }
    }
    return null;
}

/**
 * The searches the export carries, in the shape the selector expects.
 * @param {Object} payload the export
 * @returns {Array<Object>}
 */
export function searchesOf(payload) {
    return payload && Array.isArray(payload.searches) ? payload.searches : [];
}

/**
 * The searches, ready for the selector.
 *
 * "file" carries the search name: the selector keys on it, and it is what
 * searchOf() reads the offers back with.
 * @returns {Promise<Array<Object>>}
 */
export async function fetchScrapings() {
    const payload = await fetchExport();
    return searchesOf(payload).map(function (entry) {
        return {
            name: entry.name,
            file: entry.name,
            label: entry.label || "",
            scrape_timestamp: entry.scrape_timestamp || "",
            occupationGuid: entry.occupationGuid || "",
            locationGuid: entry.locationGuid || "",
            offerCount: Array.isArray(entry.offers) ? entry.offers.length : 0,
        };
    });
}

/**
 * Read a JSON file of the site, resolved against the configured base.
 *
 * The offers no longer come through here: they are read from the export with
 * searchOf().
 * @param {string} url a site path
 * @returns {Promise<*>} rejects when the answer is an error
 */
export async function fetchJson(url) {
    const response = await fetch(assetUrl(url), { cache: "no-store" });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${url}`);
    }
    return response.json();
}
