// src/pages/Feed.jsx
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/globals.css";

/* ===========================
   ENV & BASE URLS (robust)
=========================== */
const API_BASE_RAW =
  import.meta.env?.VITE_API_BASE ||
  window.location.origin ||
  "http://127.0.0.1:8001";

const API_BASE = API_BASE_RAW.replace(/\/+$/, "");

// Prefer explicit media host (CDN). Fallback to API origin.
const MEDIA_BASE_RAW =
  import.meta.env?.VITE_MEDIA_BASE ||
  API_BASE;

const MEDIA_BASE = MEDIA_BASE_RAW.replace(/\/+$/, "");

// Optional Basic auth fallback if no JWT
const BASIC_USER = import.meta.env?.VITE_BASIC_USER || null;
const BASIC_PASS = import.meta.env?.VITE_BASIC_PASS || null;

/* ===========================
   Helpers
=========================== */
function absUrl(path) {
  if (!path) return "";
  if (/^(https?:|blob:|data:)/i.test(path)) return path;
  if (path.startsWith("//")) return `${window.location.protocol}${path}`;
  const clean = path.startsWith("/") ? path : `/${path}`;
  const url = `${MEDIA_BASE}${clean}`;
  if (!/^https?:\/\//i.test(url)) {
    console.warn("absUrl produced a non-absolute URL:", url, "from", path, "MEDIA_BASE:", MEDIA_BASE);
  }
  return url;
}

function getJwt() {
  return localStorage.getItem("access") || "";
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || "";
  return "";
}

function authHeaders(base = {}) {
  const headers = { Accept: "application/json", ...base };
  const jwt = getJwt();
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  else if (BASIC_USER && BASIC_PASS) headers.Authorization = `Basic ${btoa(`${BASIC_USER}:${BASIC_PASS}`)}`;
  const csrf = getCookie("csrftoken");
  if (csrf) headers["X-CSRFTOKEN"] = csrf;
  return headers;
}

function relativeTime(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(1, Math.round((now - then) / 1000));
  const units = [
    ["y", 31536000],
    ["mo", 2592000],
    ["d", 86400],
    ["h", 3600],
    ["m", 60],
    ["s", 1],
  ];
  for (const [label, sec] of units) if (s >= sec) return Math.floor(s / sec) + label;
  return "now";
}

function nfmt(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n ?? 0);
}

const VIDEO_EXT = [".mp4", ".webm", ".mov", ".m4v"];
const IMAGE_EXT = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"];

function extOf(url) {
  try {
    const u = new URL(url, window.location.origin).pathname.toLowerCase();
    const i = u.lastIndexOf(".");
    return i >= 0 ? u.slice(i) : "";
  } catch {
    const p = String(url).toLowerCase();
    const i = p.lastIndexOf(".");
    return i >= 0 ? p.slice(i) : "";
  }
}

function detectMediaKind(apiType, url) {
  const t = (apiType || "").toLowerCase();
  const e = extOf(url);
  if (VIDEO_EXT.includes(e)) return "video";
  if (IMAGE_EXT.includes(e)) return "image";
  if (e === ".m3u8") {
    console.warn("HLS source detected (.m3u8) — requires hls.js to play:", url);
    return "hls";
  }
  if (t === "clip" || t === "video") return "video";
  if (t === "image") return "image";
  return "image";
}

/* ===========================
   Feed Page
=========================== */
export default function Feed() {
  const containerRef = useRef(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [openComments, setOpenComments] = useState(null);

  // Fetch posts once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const res = await fetch(`${API_BASE}/api/feed/posts/`, {
          headers: authHeaders(),
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setPosts(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) setErr(e.message || "Failed to load posts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Auto-play per visible reel
  useEffect(() => {
    if (!containerRef.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target.querySelector("video");
          if (!video) return;
          if (entry.isIntersecting) video.play().catch(() => {});
          else video.pause();
        });
      },
      { root: null, threshold: 0.8 }
    );
    const reels = containerRef.current.querySelectorAll(".reel");
    reels.forEach((r) => io.observe(r));
    return () => io.disconnect();
  }, [posts.length]);

  // Update a single post's comments (append newly created)
  const appendCommentToPost = (postId, newComment) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comments: [...(p.comments || []), newComment] } : p
      )
    );
  };

  if (loading) return <div className="reel-container" style={{ padding: 24 }}>Loading…</div>;
  if (err) return <div className="reel-container" style={{ padding: 24, color: "tomato" }}>{err}</div>;

  const activePost = posts.find((p) => p.id === openComments);

  return (
    <div className="reel-container" ref={containerRef}>
      {posts.map((p) => (
        <Reel
          key={p.id}
          post={p}
          onOpenComments={() => setOpenComments(p.id)}
        />
      ))}

      {openComments && activePost && (
        <CommentsDrawer
          postId={activePost.id}
          initialComments={activePost.comments || []}   // use comments from feed payload
          onClose={() => setOpenComments(null)}
          onCreated={(c) => appendCommentToPost(activePost.id, c)}
        />
      )}
    </div>
  );
}

/* ===========================
   Reel (single post)
=========================== */
function Reel({ post, onOpenComments }) {
  const vidRef = useRef(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes ?? 0);
  const [forceImage, setForceImage] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  const mediaUrl = absUrl(post.post_media);
  const kind = detectMediaKind(post.type, post.post_media);
  const shouldRenderVideo = kind === "video" && !forceImage;
  const isHls = kind === "hls";

  const onPlay = () => setIsPlaying(true);
  const onPause = () => setIsPlaying(false);

  const onVideoClick = () => {
    const v = vidRef.current;
    if (!v) return;
    if (v.paused) v.play().then(() => setIsPlaying(true)).catch(() => {});
    else { v.pause(); setIsPlaying(false); }
  };

  const toggleMute = () => {
    const v = vidRef.current;
    if (!v) return;
    const next = !isMuted;
    v.muted = next;
    if (!next) v.volume = v.volume || 1.0;
    setIsMuted(next);
  };

  const SoundIcon = () => (
    <button className="reel-sound" onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"}>
      {isMuted ? "🔇" : "🔊"}
    </button>
  );

  return (
    <section className="reel">
      {isHls ? (
        <div className="reel-unsupported">
          <p>HLS (.m3u8) needs hls.js to play.</p>
          <a href={mediaUrl} target="_blank" rel="noreferrer">Open source</a>
        </div>
      ) : shouldRenderVideo ? (
        <>
          <video
            ref={vidRef}
            src={mediaUrl}
            autoPlay
            loop
            muted={isMuted}
            playsInline
            preload="metadata"
            controls={false}
            crossOrigin="anonymous"
            onError={() => setForceImage(true)}
            onClick={onVideoClick}
            onPlay={onPlay}
            onPause={onPause}
          />
          <SoundIcon />
        </>
      ) : (
        <img
          src={mediaUrl}
          alt={post.caption || "post"}
          crossOrigin="anonymous"
          onError={(e) => { e.currentTarget.style.opacity = 0.3; }}
        />
      )}

      <div className="reel-meta">
        <div className="reel-row">
          <span className="reel-chip">{(post.type || "post").toLowerCase()}</span>
        </div>
        <p className="reel-caption">{post.caption}</p>
        <span className="reel-time">{relativeTime(post.created_at)}</span>

        {post.link_product && post.product_linked && (
          <Link to={`/products/${post.product_linked}`} className="buy-btn">
            Buy Now
          </Link>
        )}
      </div>

      <aside className="reel-actions">
        <button
          className={`reel-action ${liked ? "liked" : ""}`}
          onClick={() => {
            setLiked((v) => !v);
            setLikeCount((c) => (liked ? c - 1 : c + 1));
          }}
          title="Like"
        >
          ❤️
        </button>
        <span className="reel-count">{nfmt(likeCount)}</span>

        <button className="reel-action" onClick={onOpenComments} title="Comments">
          💬
        </button>
        <span className="reel-count">{Array.isArray(post.comments) ? post.comments.length : 0}</span>
      </aside>
    </section>
  );
}

/* ===========================
   Comments Drawer (uses existing comments)
=========================== */
function CommentsDrawer({ postId, initialComments, onClose, onCreated }) {
  const [comments, setComments] = useState(initialComments || []);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState("");

  // keep in sync if parent passes a different array next time
  useEffect(() => { setComments(initialComments || []); }, [initialComments]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = newComment.trim();
    if (!text) return;
    setPosting(true);
    setErr("");

    try {
      const res = await fetch(
        `${API_BASE}/api/feed/posts/${postId}/comments/`,
        {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          credentials: "include",
          body: JSON.stringify({ text }),
        }
      );
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${t || ""}`.trim());
      }
      const created = await res.json();
      setComments((prev) => [...prev, created]);
      onCreated?.(created); // update parent post state
      setNewComment("");
    } catch (e) {
      setErr(e.message || "Failed to post comment");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="comments-drawer">
      <div className="comments-header">
        <h4>Comments ({comments.length})</h4>
        <button onClick={onClose}>✕</button>
      </div>

      {err && <div className="comment-error">{err}</div>}

      <div className="comments-list sleek">
        {comments.map((c) => (
          <div key={c.id} className="comment-item sleek">
            <img
              className="comment-avatar sleek"
              src={c?.user?.avatar ? absUrl(c.user.avatar) : "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="}
              alt={c?.user?.username || "user"}
            />
            <div className="comment-body sleek">
              <div className="comment-head sleek">
                <strong className="comment-username">{c?.user?.username || "user"}</strong>
                <span className="comment-dot">•</span>
                <span className="comment-time">{relativeTime(c.created_at)}</span>
              </div>
              <div className="comment-bubble">{c.text}</div>
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <div className="comment-empty">Be the first to comment.</div>
        )}
      </div>

      <form className="comment-form sleek" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Add a comment…"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          disabled={posting}
        />
        <button type="submit" disabled={posting || !newComment.trim()}>
          {posting ? "Posting…" : "Post"}
        </button>
      </form>
    </div>
  );
}
