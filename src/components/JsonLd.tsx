// Rendert JSON-LD strukturierte Daten (SEO).
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify ist sicher; Daten stammen aus der eigenen DB.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
