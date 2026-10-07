/* ============================================================
   DATASET SELECTOR — shared component for the offers table and
   the dashboard
   ============================================================

   One entry per set of offers published in the JSON export. A
   search cannot be created here: the scraper produces them.
   ============================================================ */

import { fetchScrapings } from "./api.js";

export const STORAGE_KEY = "forem_scraping_select";

// Un contexte par <select>, so the list can be rebuilt without attaching a
// second listener.
const contexts = {};

/**
 * @param {HTMLElement} select
 * @param {Array} scrapings
 * @param {boolean} allowAll
 */
function buildOptions(select, scrapings, allowAll) {
    select.innerHTML = "";

    if (allowAll) {
        const allOpt = document.createElement("option");
        allOpt.value = "all";
        allOpt.textContent = "Toutes les recherches";
        select.appendChild(allOpt);
    }

    scrapings.forEach(function (item) {
        const option = document.createElement("option");
        option.value = item.file;
        option.dataset.base = item.name;
        option.dataset.label = item.label || "";
        option.dataset.occupationGuid = item.occupationGuid || "";
        option.dataset.locationGuid = item.locationGuid || "";
        option.textContent = item.label || item.name || "Recherche principale";
        select.appendChild(option);
    });

}

/**
 * Create the dataset selector.
 * @param {Object} options
 *   - selectId: ID of the <select> element
 *   - allowAll: whether to show "Toutes les recherches" (default: true)
 *   - onChange: callback(selectedDataset, allDatasets)
 * @returns {Promise<Object>} { select, scrapings, current }
 */
export async function createScrapingSelector(options) {
    const {
        selectId,
        allowAll = true,
        onChange = function () {}
    } = options;

    const select = document.getElementById(selectId);
    if (!select) return { select: null, scrapings: [], current: null };

    const scrapings = await fetchScrapings();
    const context = { select, allowAll, onChange, scrapings, current: "all" };
    contexts[selectId] = context;

    buildOptions(select, scrapings, allowAll);

    // Restore selection
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && scrapings.some(function (s) { return s.file === stored; })) {
        select.value = stored;
        context.current = stored;
    } else if (allowAll) {
        select.value = "all";
    } else if (scrapings.length) {
        select.value = scrapings[0].file;
        context.current = scrapings[0].file;
    }

    select.addEventListener("change", function () {
        const option = select.selectedOptions[0];
        if (!option || !option.value) return;

        context.current = option.value;
        localStorage.setItem(STORAGE_KEY, context.current);
        context.onChange(context.current, context.scrapings);
    });

    return { select, scrapings, current: context.current };
}

/**
 * Re-read the list, for instance after a new export was published, and apply
 * the stored selection. onChange is called so the page can reload its data.
 * @param {string} selectId
 * @returns {Promise<Object|null>} { select, scrapings, current }
 */
export async function refreshScrapingSelector(selectId) {
    const context = contexts[selectId];
    if (!context) return null;

    const { select, allowAll } = context;
    context.scrapings = await fetchScrapings();
    buildOptions(select, context.scrapings, allowAll);

    const stored = localStorage.getItem(STORAGE_KEY);
    const previous = context.current;
    let next = "all";
    if (stored && context.scrapings.some(function (s) { return s.file === stored; })) {
        next = stored;
    } else if (!allowAll && context.scrapings.length) {
        next = context.scrapings[0].file;
    }
    select.value = next;
    context.current = next;

    if (next !== previous || stored === next) {
        context.onChange(next, context.scrapings);
    }
    return { select, scrapings: context.scrapings, current: next };
}

/**
 * Get the current scrape data for a given key.
 * @param {Array} scrapings
 * @param {string} key -- "all", or a dataset name
 * @returns {Object|null}
 */
export function getScrapingByKey(scrapings, key) {
    if (key === "all") return null;
    return scrapings.find(function (s) { return s.file === key; }) || null;
}

/**
 * Filter an array of scrapings by the current scope.
 * @param {Array} scrapings
 * @param {string} scope -- "all" or a file name
 * @returns {Array}
 */
export function filterScrapings(scrapings, scope) {
    if (scope === "all") return scrapings;
    return scrapings.filter(function (s) { return s.file === scope; });
}