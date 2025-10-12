import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/orders.css";

/* ===========================
   ENV & BASE URLS (robust)
=========================== */
const API_BASE_RAW =
  import.meta.env?.VITE_API_BASE ||
  window.location.origin ||
  "http://127.0.0.1:8001";

const API_BASE = API_BASE_RAW.replace(/\/+$/, "");

// Prefer explicit media host (CDN). Fallback to API origin.
const MEDIA_BASE_RAW = import.meta.env?.VITE_MEDIA_BASE || API_BASE;
const MEDIA_BASE = MEDIA_BASE_RAW.replace(/\/+$/, "");

// Optional Basic auth fallback if no JWT (dev only)
const BASIC_USER = import.meta.env?.VITE_BASIC_USER || null;
const BASIC_PASS = import.meta.env?.VITE_BASIC_PASS || null;

// Currency (defaults)
const CURRENCY_CODE = import.meta.env?.VITE_CURRENCY_CODE || "NPR";
const LOCALE = import.meta.env?.VITE_LOCALE || "en-NP";

/* ===========================
   Helpers
=========================== */
function absUrl(path) {
  if (!path) return "";
  if (/^(https?:|blob:|data:)/i.test(path)) return path;
  return `${MEDIA_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

function currency(n) {
  const num = Number(n || 0);
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency: CURRENCY_CODE,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${CURRENCY_CODE} ${num.toLocaleString()}`;
  }
}

function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(LOCALE, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function yyyymmdd(iso) {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  } catch {
    return "00000000";
  }
}

// Display-friendly Order ID: ORD-YYYYMMDD-<first 8 of UUID uppercased>
function friendlyOrderId(id, createdAt) {
  const short = (id || "").slice(0, 8).toUpperCase();
  return `ORD-${yyyymmdd(createdAt)}-${short}`;
}

function getAuthHeaders() {
  const token =
    localStorage.getItem("access") ||
    localStorage.getItem("jwt") ||
    localStorage.getItem("token") ||
    "";

  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  if (BASIC_USER && BASIC_PASS) {
    const b64 = btoa(`${BASIC_USER}:${BASIC_PASS}`);
    return { Authorization: `Basic ${b64}` };
  }
  return {};
}

/* ===========================
   Component
=========================== */
export default function Orders() {
  const navigate = useNavigate();
  const [ordersRaw, setOrdersRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr("");

      try {
        const url = `${API_BASE}/api/commerce/orders/`;
        const res = await fetch(url, {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
        }

        const data = await res.json();
        if (!cancelled) setOrdersRaw(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) setErr(e.message || "Failed to load orders.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const orders = useMemo(() => {
    return (ordersRaw || []).map((o) => {
      const items = (o.items || []).map((it) => ({
        name: it?.product_details?.name || "Product",
        qty: Number(it?.quantity || 0),
        unit_price: Number(it?.unit_price || 0),
        line_total: Number(it?.line_total || (Number(it?.unit_price || 0) * Number(it?.quantity || 0))),
        img: absUrl(it?.product_details?.image || ""),
      }));

      return {
        id: o.id,
        friendlyId: friendlyOrderId(o.id, o.created_at),
        date: fmtDate(o.created_at),
        status: (o.status || "pending").toString(),
        // Customer & delivery
        full_name: o.full_name || "",
        phone: o.phone || "",
        street: o.street || "",
        city: o.city || "",
        zip_code: o.zip_code || "",
        // Payment & amounts
        payment_method: (o.payment_method || "").toUpperCase(), // COD, PAYPAL, etc.
        subtotal: Number(o.subtotal || 0),
        shipping: Number(o.shipping || 0),
        discount: Number(o.discount || 0),
        total: Number(o.total || 0),
        note: o.note || "",
        items,
      };
    });
  }, [ordersRaw]);

  if (loading) {
    return (
      <section className="container">
        <div className="orders-header">
          <h1 className="text-2xl">My Orders</h1>
          <p className="lead">Loading…</p>
        </div>
        <div className="orders-list">
          {[...Array(3)].map((_, i) => (
            <article key={i} className="order-card surface skeleton">
              <div className="order-head">
                <div className="skeleton-line w-40" />
                <div className="skeleton-line w-24" />
              </div>
              <div className="order-items">
                {[...Array(2)].map((__, j) => (
                  <div key={j} className="order-item">
                    <div className="order-img skeleton-block" />
                    <div className="order-item-info">
                      <div className="skeleton-line w-64" />
                      <div className="skeleton-line w-32" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="order-foot">
                <div className="skeleton-line w-28" />
                <div className="order-actions">
                  <div className="skeleton-btn" />
                  <div className="skeleton-btn" />
                  <div className="skeleton-btn" />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (err) {
    return (
      <section className="container">
        <div className="orders-header">
          <h1 className="text-2xl">My Orders</h1>
          <p className="lead error">Error: {err}</p>
        </div>
        <div className="empty-state surface">
          <p>We couldn’t load your orders. Please try again.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="container">
      <div className="orders-header">
        <h1 className="text-2xl">My Orders</h1>
        <p className="lead">{orders.length} total orders</p>
      </div>

      {orders.length === 0 ? (
        <div className="empty-state surface">
          <p>No orders yet.</p>
          <button className="btn btn-primary" onClick={() => navigate("/products")}>
            Start Shopping
          </button>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((order) => (
            <article key={order.id} className="order-card surface">
              {/* Header with Friendly ID then UUID */}
              <div className="order-head">
                <div>
                  <h3 className="order-id">
                    {order.friendlyId} <span className="uuid">({order.id})</span>
                  </h3>
                  <p className="order-date">{order.date}</p>
                </div>
                <span className={`status-badge ${order.status.toLowerCase()}`}>
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </span>
              </div>

              {/* Order Meta (All details) */}
              <div className="order-meta">
                <div className="meta-col">
                  <div className="kv">
                    <span className="k">Customer</span>
                    <span className="v">{order.full_name || "—"}</span>
                  </div>
                  <div className="kv">
                    <span className="k">Phone</span>
                    <span className="v">{order.phone || "—"}</span>
                  </div>
                </div>

                <div className="meta-col">
                  <div className="kv">
                    <span className="k">Address</span>
                    <span className="v">
                      {order.street ? `${order.street}, ` : ""}
                      {order.city || ""}
                      {order.zip_code ? ` ${order.zip_code}` : ""}
                    </span>
                  </div>
                  <div className="kv">
                    <span className="k">Payment</span>
                    <span className="v">{order.payment_method || "—"}</span>
                  </div>
                </div>

                <div className="meta-col amounts">
                  <div className="kv">
                    <span className="k">Subtotal</span>
                    <span className="v">{currency(order.subtotal)}</span>
                  </div>
                  <div className="kv">
                    <span className="k">Shipping</span>
                    <span className="v">{currency(order.shipping)}</span>
                  </div>
                  <div className="kv">
                    <span className="k">Discount</span>
                    <span className="v">− {currency(order.discount)}</span>
                  </div>
                  <div className="kv total">
                    <span className="k">Total</span>
                    <span className="v">{currency(order.total)}</span>
                  </div>
                </div>
              </div>

              {order.note ? (
                <div className="order-note">
                  <span className="k">Note</span>
                  <p className="v">{order.note}</p>
                </div>
              ) : null}

              {/* Items */}
              <div className="order-items">
                {order.items.map((item, i) => (
                  <div key={i} className="order-item">
                    <img
                      src={item.img || "/placeholder.png"}
                      alt={item.name}
                      className="order-img"
                      loading="lazy"
                      onError={(e) => { e.currentTarget.src = "/placeholder.png"; }}
                    />
                    <div className="order-item-info">
                      <h4>{item.name}</h4>
                      <p className="muted">
                        {currency(item.unit_price)} × {item.qty} = <strong>{currency(item.line_total)}</strong>
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="order-foot">
                <div className="order-total">
                  Total: <strong>{currency(order.total)}</strong>
                </div>
                <div className="order-actions">
                  <button className="btn btn-outline" onClick={() => navigate(`/orders/${order.id}`)}>
                    View
                  </button>
                  <button className="btn btn-primary" onClick={() => navigate(`/orders/${order.id}/track`)}>
                    Track
                  </button>
                  <button className="btn btn-muted" onClick={() => navigate(`/orders/${order.id}/invoice`)}>
                    Invoice
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
