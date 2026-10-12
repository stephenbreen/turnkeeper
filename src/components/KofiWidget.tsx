// Ko-fi "Buy me a coffee" button. A plain link to the Ko-fi page — no overlay
// iframe, so there's no embedded scrollbar. Styled with the shared burgundy
// button token (.btn-primary in index.css). Rendered in the DM-view footer
// only (never the player view).

const KOFI_USERNAME = 'stephen91117'

export default function KofiWidget() {
  return (
    <a
      href={`https://ko-fi.com/${KOFI_USERNAME}`}
      target="_blank"
      rel="noopener noreferrer"
      className="btn-primary inline-flex items-center gap-1.5"
      title="Support Turnkeeper on Ko-fi"
    >
      <span aria-hidden>☕</span> Buy me a coffee
    </a>
  )
}
