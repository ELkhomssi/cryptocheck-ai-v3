import { serializeJsonLd, type JsonLd } from '@/lib/seo/json-ld'

/** Server-safe JSON-LD script injection for Google Rich Results. */
export function JsonLdScript({ data }: { data: JsonLd }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  )
}
