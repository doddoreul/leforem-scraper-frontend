// ============================================================
// TRACKING STORAGE — localStorage is the source of truth
//
// The follow-up (statuses, remarks, favourites, priorities, status
// dates) belongs to the person browsing, so it stays in their browser.
// The site is static: there is no API to push to and nothing leaves the
// machine.
//
// The pages call readTrackedMap synchronously while rendering, so
// reads come from an in-memory cache loaded at startup and refreshed
// after every write. Writes go to localStorage, then to the cache.
//
// A follow-up therefore belongs to one browser: it is no longer shared
// between computers.
//
//     forem_<search>_statuts       { offerId: "postule" }
//     forem_<search>_statut_dates  { offerId: "2026-01-01T..." }
//     forem_<search>_remarques     { offerId: "text" }
//     forem_<search>_favoris       { offerId: true }
//     forem_<search>_priorites     { offerId: 2 }
// ============================================================

export const LEGACY_STORAGE_PREFIX = "forem_electromecanicien_";
export const DEFAULT_SCRAPING_PREFIX = "forem_fb3c1045-38215355_";

/** The suffixes that make up a follow-up, in the order they are read. */
export const TRACKED_SUFFIXES = [
    "statuts",
    "statut_dates",
    "remarques",
    "favoris",
    "priorites",
];

/** Dispatched once the follow-up has been read from localStorage. */
export const TRACKING_LOADED_EVENT = "foremtrackingloaded";

/** localStorage suffix -> field name used by the tracking API. */
export const SUFFIX_FIELD = {
    statuts: "statut",
    statut_dates: "statut_date",
    remarques: "remarque",
    favoris: "favori",
    priorites: "priorite",
};

// forem_profil is the candidate profile: it is one whole document rather than
// a map of offers, so it travels with the tracking export.
const TRACKED_PLAIN_KEYS = ["forem_scraping_select", "forem_profil"];
const TRACKED_KEY_PATTERN = /^forem_.+_(statuts|remarques|favoris|statut_dates|priorites)$/;
const MIGRATION_FLAG = "forem_migration_v2_done";

/**
 * The localStorage prefix of a search.
 * @param {string} baseName "" for the default search
 * @returns {string}
 */
export function storagePrefixFor(baseName) {
    return baseName ? "forem_" + baseName + "_" : LEGACY_STORAGE_PREFIX;
}

/**
 * The search name a localStorage prefix belongs to.
 * @param {string} prefix
 * @returns {string}
 */
export function baseNameForPrefix(prefix) {
    if (!prefix || prefix.length < 7) return "";
    return prefix.slice("forem_".length, -1);
}

/**
 * Is this key part of a follow-up (and therefore worth exporting)?
 * @param {string} key
 * @returns {boolean}
 */
export function isTrackedStorageKey(key) {
    return TRACKED_KEY_PATTERN.test(key) ||
        TRACKED_PLAIN_KEYS.indexOf(key) !== -1;
}

/** Searches whose data is already cached: { baseName: { offerId: fields } } */
const _cache = {};

/**
 * Read a JSON map stored under <prefix><suffix>.
 *
 * Serves from the cache once that search is loaded, and from
 * localStorage otherwise (before startup, or when the server is down).
 * @param {string} prefix
 * @param {string} suffix
 * @returns {Object}
 */
export function readTrackedMap(prefix, suffix) {
    const baseName = baseNameForPrefix(prefix);
    if (baseName && Object.prototype.hasOwnProperty.call(_cache, baseName)) {
        return suffixFromCache(_cache[baseName], suffix);
    }
    try {
        const raw = localStorage.getItem(prefix + suffix);
        return raw ? JSON.parse(raw) : {};
    } catch (error) {
        return {};
    }
}

/**
 * Build the cached fields of one <suffix> map.
 *
 * The inverse of suffixFromCache: { "1234": "postule" } becomes
 * { "1234": { statut: "postule" } }, which is how one offer holds several
 * fields at once.
 * @param {string} suffix
 * @param {Object} map { offerId: value }
 * @returns {Object} { offerId: fields }
 */
function suffixToEntries(suffix, map) {
    const field = SUFFIX_FIELD[suffix];
    const out = {};
    if (!field) return out;
    Object.keys(map || {}).forEach(function (offerId) {
        const value = map[offerId];
        if (value === null || value === undefined || value === "") return;
        const entry = {};
        entry[field] = value;
        out[offerId] = entry;
    });
    return out;
}

/**
 * Build one <suffix> map out of the cached fields.
 * @param {Object} entries { offerId: fields }
 * @param {string} suffix
 * @returns {Object}
 */
function suffixFromCache(entries, suffix) {
    const field = SUFFIX_FIELD[suffix];
    const out = {};
    if (!field) return out;
    Object.keys(entries).forEach(function (offerId) {
        const value = (entries[offerId] || {})[field];
        if (value === null || value === undefined || value === "") return;
        out[offerId] = suffix === "favoris" ? !!value : value;
    });
    return out;
}

// -- loading -------------------------------------------------------

/**
 * Read one search's follow-up out of localStorage and into the cache.
 * @param {string} baseName
 * @returns {Object}
 */
export function loadTracking(baseName) {
    const entries = {};
    const prefix = storagePrefixFor(baseName);
    TRACKED_SUFFIXES.forEach(function (suffix) {
        const fields = suffixToEntries(
            suffix, readTrackedMap(prefix, suffix));
        // One offer can hold several fields, so the maps merge per offer
        // rather than replacing each other.
        Object.keys(fields).forEach(function (offerId) {
            if (!entries[offerId]) entries[offerId] = {};
            Object.assign(entries[offerId], fields[offerId]);
        });
    });
    _cache[baseName] = entries;
    return entries;
}

/**
 * Load every search found in localStorage into the cache.
 * @returns {Promise<void>}
 */
export async function loadAllTracking() {
    const bases = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        const match = key.match(
            /^forem_(.+)_(statuts|remarques|favoris|statut_dates|priorites)$/
        );
        if (match) bases[match[1]] = true;
    }
    Object.keys(bases).forEach(loadTracking);
}

/**
 * Copy the cached fields back into the localStorage mirror.
 * @param {string} baseName
 * @param {Object} entries
 */
function mirrorToLocalStorage(baseName, entries) {
    const prefix = storagePrefixFor(baseName);
    TRACKED_SUFFIXES.forEach(function (suffix) {
        const map = suffixFromCache(entries, suffix);
        try {
            localStorage.setItem(prefix + suffix, JSON.stringify(map));
        } catch (error) {
            console.error("Unable to mirror tracking", error);
        }
    });
}

// -- writes -------------------------------------------------------

/**
 * Write one field of one offer, to localStorage then to the cache.
 * @param {string} baseName
 * @param {string} offerId
 * @param {string} field
 * @param {*} value
 * @returns {Promise<void>}
 */
export async function writeOfferField(baseName, offerId, field, value) {
    // The mirror is written before the cache: the callers render right after,
    // so a deferred update would show the previous value.
    if (!Object.prototype.hasOwnProperty.call(_cache, baseName)) {
        _cache[baseName] = {};
    }
    const entry = _cache[baseName][offerId] || {};
    if (value === null || value === undefined) {
        delete entry[field];
    } else {
        entry[field] = value;
    }
    _cache[baseName][offerId] = entry;
    mirrorToLocalStorage(baseName, _cache[baseName]);
}

/**
 * Write a JSON map under <prefix><suffix>.
 * @param {string} prefix
 * @param {string} suffix
 * @param {*} value
 * @returns {Promise<void>}
 */
export async function writeTrackedMap(prefix, suffix, value) {
    const baseName = baseNameForPrefix(prefix);
    const field = SUFFIX_FIELD[suffix];
    const map = value && typeof value === "object" ? value : {};

    try {
        localStorage.setItem(prefix + suffix, JSON.stringify(map));
    } catch (error) {
        console.error("Unable to write localStorage", error);
    }

    if (!baseName || !field) return;

    const known = Object.prototype.hasOwnProperty.call(_cache, baseName)
        ? suffixFromCache(_cache[baseName], suffix)
        : {};

    // Only the offers that actually changed are sent: the callers pass the
    // whole map after editing a single entry.
    const ids = Object.keys(map);
    for (const offerId of ids) {
        if (map[offerId] !== known[offerId]) {
            await writeOfferField(baseName, offerId, field, map[offerId]);
        }
    }
    for (const offerId of Object.keys(known)) {
        if (!(offerId in map)) {
            await writeOfferField(baseName, offerId, field, null);
        }
    }
}

/**
 * Import an exported follow-up into localStorage.
 *
 * The import goes through writeTrackedMap, which owns both the storage key
 * and the cache, so nothing has to be pushed or reloaded afterwards.
 * @param {Object} data { "forem_<base>_<suffix>": { offerId: value } }
 * @returns {Promise<number>} the number of offers imported
 */
export async function importTrackedData(data) {
    if (!data || typeof data !== "object") return 0;

    const keys = Object.keys(data).filter(isTrackedStorageKey);
    for (const key of keys) {
        await writeTrackedMap(key.slice(0, key.lastIndexOf("_") + 1),
            key.slice(key.lastIndexOf("_") + 1), data[key]);
    }

    await loadAllTracking();
    return keys.length;
}


/**
 * Startup path: move the legacy keys, then load the cache from
 * localStorage. Safe to call on every page load.
 * @returns {Promise<void>}
 */
export async function migrateLegacyStorage() {
    try {
        if (!localStorage.getItem(MIGRATION_FLAG)) {
            TRACKED_SUFFIXES.forEach(function (suffix) {
                const oldKey = LEGACY_STORAGE_PREFIX + suffix;
                const newKey = DEFAULT_SCRAPING_PREFIX + suffix;
                const oldValue = localStorage.getItem(oldKey);
                if (oldValue && !localStorage.getItem(newKey)) {
                    localStorage.setItem(newKey, oldValue);
                }
            });
            localStorage.setItem(MIGRATION_FLAG, "1");
        }
    } catch (error) {
        // Storage unavailable (private mode).
    }

    await loadAllTracking();

    // The pages render before this resolves, so tell them the follow-up is
    // loaded: the renders that happened before it are refreshed.
    document.dispatchEvent(
        new CustomEvent(TRACKING_LOADED_EVENT, { detail: { base: "" } })
    );
}

/**
 * Load one search's follow-up into the cache.
 * Called when the user switches search.
 * @param {string} baseName
 * @returns {Promise<void>}
 */
export async function refreshTracking(baseName) {
    await loadTracking(baseName);
}
