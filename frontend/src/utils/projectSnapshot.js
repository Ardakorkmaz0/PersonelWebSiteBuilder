// One definition of "the project" for everything that writes it out or reads
// it back in: load, restore, import, save and export.
//
// The editor keeps a page's HTML document in its own map (EditorPage's
// pageHtmlMap), outside the component schema in the store. Each path used to
// translate between the two on its own, and they disagreed:
//   - importing a project .json read pages[].html into the store and then
//     cleared the map, so every HTML page opened blank and the next save sent
//     an empty document over the real one;
//   - exporting wrote the store's pages[].html, which is only filled at load
//     time and never follows an edit, so the backup held the page as it was
//     when the editor opened.
// Now the map is the only home of page HTML while the editor runs. Coming in,
// splitPageHtml lifts pages[].html out of the schema into a map (the store keeps
// no stale copy); going out, projectSnapshot folds the map back into pages[].

/** Take pages[].html out of a schema. Returns the schema without it and the
 *  html keyed by page id. `legacySiteHtml` is the site-level document of sites
 *  made before per-page HTML — it belongs to the first page when that page has
 *  none of its own. */
export function splitPageHtml(schema, legacySiteHtml = '') {
  const pages = Array.isArray(schema?.pages) ? schema.pages : []
  const htmlMap = {}
  const clean = pages.map((page) => {
    if (!page || typeof page !== 'object') return page
    const { html, ...rest } = page
    if (typeof html === 'string' && html.trim()) htmlMap[page.id] = html
    return rest
  })
  const firstId = pages[0]?.id
  if (firstId && !htmlMap[firstId] && typeof legacySiteHtml === 'string' && legacySiteHtml.trim()) {
    htmlMap[firstId] = legacySiteHtml
  }
  return { schema: { ...schema, pages: clean }, htmlMap }
}

/** The project as it is saved and exported: the component schema with each
 *  page's current document folded back in, plus the home page's document
 *  (mirrored to site.html so single-page flows and old data keep working). */
export function projectSnapshot(schema, htmlMap = {}) {
  const pages = (Array.isArray(schema?.pages) ? schema.pages : []).map((page) => ({
    ...page,
    html: htmlMap[page.id] || '',
  }))
  return {
    schema: { ...schema, pages },
    homeHtml: htmlMap[pages[0]?.id] || '',
  }
}
