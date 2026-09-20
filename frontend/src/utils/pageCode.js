import { schemaToSingleHtml } from './schemaToFiles.js'
import { schemaToResponsiveHtml } from './responsiveHtml.js'

// One page rendered on its own, through whichever writer that page's layout
// mode uses. Shared by the Source panel and the live code ticker, so what the
// editor shows is the same document the export writes.
export function pageToResponsiveHtml(page, title, schema = {}) {
  const pageSchema = { ...schema, pages: [page] }
  return page?.flowMode
    ? schemaToSingleHtml(pageSchema, title)
    : schemaToResponsiveHtml(pageSchema, title)
}
