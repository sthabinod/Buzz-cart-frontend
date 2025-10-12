// src/pages/ProductDetail.jsx
import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/product-detail.css";

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

/* ===========================
   Auth & Helpers
=========================== */
function getJwt() {
  // Try common keys
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("access") ||
    null
  );
}
function isAuthed() {
  const t = getJwt();
  return !!t && t.length > 10;
}

function absUrl(path) {
  if (!path) return "";
  if (/^(https?:|blob:|data:)/i.test(path)) return path;
  return `${MEDIA_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

function formatAud(amount) {
  const num = typeof amount === "string" ? Number(amount) : amount;
  if (!isFinite(num)) return amount ?? "";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(num);
}

function getCsrfToken() {
  const m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function fetchJson(url, opts = {}) {
  const headers = new Headers(opts.headers || {});
  headers.set("accept", "application/json");

  // 🔐 Always send JWT if present (required for non-anonymous)
  const token = getJwt();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(url, { ...opts, headers, credentials: "include" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

async function apiPost(path, body) {
  const headers = new Headers({
    accept: "application/json",
    "content-type": "application/json",
  });

  // 🔐 Bearer required (don’t fall back to Basic)
  const token = getJwt();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  // CSRF (harmless for JWT; useful if you ever fall back to session)
  const csrf = getCsrfToken();
  if (csrf) headers.set("X-CSRFTOKEN", csrf);

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    credentials: "include",
  });

  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch {}

  if (!res.ok) {
    const msg =
      data?.detail || data?.message || data?.error || "Unable to add to cart.";
    const err = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    err.payload = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ===========================
   Component
=========================== */
export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // add-to-cart states
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState({ open: false, text: "" });

  const apiUrl = useMemo(
    () => `${API_BASE}/api/commerce/products/${id}/`,
    [id]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr("");

    fetchJson(apiUrl)
      .then((data) => {
        if (!cancelled) {
          setProduct(data);
          const avail = Number.isFinite(Number(data?.quantity)) ? Number(data.quantity) : 0;
          setQty(avail > 0 ? 1 : 0);
        }
      })
      .catch((e) => {
        if (!cancelled) setErr(e.message || "Failed to load product");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [apiUrl]);

  const onDec = () => setQty((q) => Math.max(1, Number(q) - 1));
  const onInc = () => setQty((q) => Math.max(1, Number(q) + 1));

  const heroImg = absUrl(product?.image || "");
  const inStock = !!product?.in_stock;

  // 🔐 Add to cart requires auth; send user identity via Bearer
  async function handleAddToCart() {
    if (!product) return;

    if (!isAuthed()) {
      setToast({ open: true, text: "Please log in to add items to your cart." });
      // auto-hide and push to login
      setTimeout(() => {
        setToast({ open: false, text: "" });
        navigate("/login"); // adjust route if different
      }, 1200);
      return;
    }

    if (!inStock) {
      setToast({ open: true, text: "Out of stock" });
      setTimeout(() => setToast({ open: false, text: "" }), 1500);
      return;
    }

    const max = Number.isFinite(Number(product?.quantity)) ? Number(product.quantity) : Infinity;
    const safeQty = Math.max(1, Math.min(Number(qty) || 1, max));

    setAdding(true);
    try {
      await apiPost(`/api/commerce/carts/active/`, {
        product: product.id, // product id from detail
        quantity: safeQty,
      });

      setToast({ open: true, text: "Added to cart ✅" });
      setQty(1);
    } catch (e) {
      const msg =
        e?.payload?.quantity ||
        e?.payload?.detail ||
        e?.message ||
        "Failed to add to cart.";
      setToast({ open: true, text: String(msg) });
    } finally {
      setAdding(false);
      setTimeout(() => setToast((t) => ({ ...t, open: false })), 1800);
    }
  }

  return (
    <section className="container">
      <button onClick={() => navigate(-1)} className="btn btn-outline mb-2">
        ← Back
      </button>

      <div className="pd-wrap">
        {/* Media column */}
        <div className="pd-media">
          <div className="pd-hero surface">
            {loading ? (
              <div className="skeleton hero-skeleton" />
            ) : heroImg ? (
              <img src={heroImg} alt={product?.name || "Product"} />
            ) : (
              <div className="empty-media">No image</div>
            )}
          </div>
        </div>

        {/* Info column */}
        <div className="pd-info surface">
          {loading ? (
            <>
              <div className="skeleton title-skeleton" />
              <div className="skeleton line-skeleton" />
              <div className="skeleton line-skeleton" />
            </>
          ) : err ? (
            <>
              <h1 className="pd-title">Unable to load product</h1>
              <p className="error">{err}</p>
            </>
          ) : (
            <>
              <h1 className="pd-title">{product?.name}</h1>

              <div className="pd-meta">
                <span className="pd-price">{formatAud(product?.price)}</span>
                <span className={`pd-stock ${inStock ? "ok" : "out"}`}>
                  {inStock ? "In stock" : "Out of stock"}
                </span>
                {typeof product?.quantity === "number" && (
                  <span className="pd-qty-available">
                    {product.quantity} available
                  </span>
                )}
              </div>

              {product?.description && (
                <p className="pd-desc">{product.description}</p>
              )}

              <div className="pd-section">
                <div className="label">Quantity</div>
                <div className="pd-qty">
                  <button className="qty-btn" onClick={onDec} aria-label="decrease">−</button>
                  <input
                    className="qty-input"
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                    type="number"
                    min={1}
                  />
                  <button className="qty-btn" onClick={onInc} aria-label="increase">＋</button>
                </div>
              </div>

              <div className="pd-actions">
                <button
                  className="btn btn-primary"
                  disabled={!inStock || adding}
                  onClick={handleAddToCart}
                  title={!inStock ? "Out of stock" : "Add to Cart"}
                >
                  {adding ? "Adding…" : "Add to Cart"}
                </button>
                <button className="btn btn-outline" disabled={!inStock}>
                  Buy Now
                </button>
              </div>

              <hr className="pd-divider" />

              <div className="pd-specs">
                <div>
                  <div className="label">Highlights</div>
                  <ul>
                    <li>Quality you can rely on</li>
                    <li>Seller: {product?.seller || "—"}</li>
                    <li>Created: {new Date(product?.created_at).toLocaleString()}</li>
                  </ul>
                </div>
                <div>
                  <div className="label">Shipping</div>
                  <p className="muted">Free delivery over AUD {product?.price} · 7-day returns</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Toast popup */}
      {toast.open && (
        <div className="pd-toast" role="alert" aria-live="polite">
          {toast.text}
        </div>
      )}

      {/* Minimal scoped styles for the toast only (does not touch your CSS) */}
      <style>{`
        .pd-toast{
          position: fixed;
          left: 50%;
          bottom: 24px;
          transform: translateX(-50%);
          background: rgba(20,20,20,.95);
          border: 1px solid #333;
          padding: .75rem 1rem;
          border-radius: 12px;
          backdrop-filter: blur(6px);
          font-weight: 700;
          z-index: 60;
          box-shadow: 0 6px 20px rgba(0,0,0,.35);
        }
      `}</style>
    </section>
  );
}
