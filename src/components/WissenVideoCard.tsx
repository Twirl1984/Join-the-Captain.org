import type { WissenVideo } from "@/lib/data";

// Embed-only (kein Download): eingebettetes YouTube-Video + Meta.
function formatViews(n: number | null): string {
  if (!n) return "";
  if (n >= 1000) {
    const k = n / 1000;
    return `${k.toFixed(k >= 10 ? 0 : 1).replace(".", ",")}k Views`;
  }
  return `${n} Views`;
}

export function WissenVideoCard({ video }: { video: WissenVideo }) {
  return (
    <article className="card stack" style={{ gap: 10, padding: 14, overflow: "hidden" }}>
      <div
        style={{
          position: "relative",
          paddingBottom: "56.25%",
          height: 0,
          borderRadius: 10,
          overflow: "hidden",
          background: "#000",
        }}
      >
        {video.video_id ? (
          <iframe
            src={`https://www.youtube.com/embed/${video.video_id}`}
            title={video.video_title}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <a
            href={video.video_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff" }}
          >
            Video ansehen ↗
          </a>
        )}
      </div>

      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: "var(--fg)", lineHeight: 1.35 }}>
        {video.video_title}
      </h3>

      <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
        {video.creator_handle && (
          <a
            href={video.creator_url || video.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="caption"
            style={{ color: "var(--accent)" }}
          >
            {video.creator_handle}
          </a>
        )}
        {video.view_count ? <span className="caption">· {formatViews(video.view_count)}</span> : null}
      </div>

      {video.ai_summary && (
        <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
          {video.ai_summary}
        </p>
      )}
    </article>
  );
}
