// src/pages/Cart.jsx
import { useEffect, useMemo, useState } from "react";
import "../styles/cart.css";

/* ===========================
   ENV & BASE URLS
=========================== */
const API_BASE_RAW =
  import.meta.env?.VITE_API_BASE ||
  window.location.origin ||
  "http://127.0.0.1:8001";

const API_BASE = API_BASE_RAW.replace(/\/+$/, "");

// Prefer explicit media host (CDN). Fallback to API origin.
const MEDIA_BASE_RAW = import.meta.env?.VITE_MEDIA_BASE || API_BASE;
const MEDIA_BASE = MEDIA_BASE_RAW.replace(/\/+$/, "");

/* ===========================
   API endpoints
=========================== */
const CART_ACTIVE_URL = `${API_BASE}/api/commerce/carts/active/`;

/* ===========================
   Helpers
=========================== */
function absUrl(path) {
  if (!path) return "";
  if (/^(https?:|blob:|data:)/i.test(path)) return path;
  return `${MEDIA_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

function getJwt() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("access") ||
    sessionStorage.getItem("access_token") ||
    sessionStorage.getItem("access") ||
    null
  );
}

function getCsrfToken() {
  const m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function authHeaders({ json = true } = {}) {
  const headers = {};
  if (json) {
    headers["Content-Type"] = "application/json";
    headers["Accept"] = "application/json";
  } else {
    headers["Accept"] = "application/json";
  }

  const jwt = getJwt();
  if (jwt) headers["Authorization"] = `Bearer ${jwt}`;

  const csrf = getCsrfToken();
  if (csrf) headers["X-CSRFTOKEN"] = csrf;

  return headers;
}

function formatMoney(n, currency = "AUD") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${Number(n || 0).toLocaleString()}`;
  }
}

async function safeJson(res) {
  try {
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  } catch {
    return null;
  }
}

/* ===========================
   Component
=========================== */
export default function Cart() {
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState(null);
  const [promo, setPromo] = useState("");
  const [error, setError] = useState("");

  // ---- Derived values ----
  const items = useMemo(() => {
    if (!cart?.items) return [];
    return cart.items.map((it) => {
      const pd = it.product_details || {};
      return {
        id: it.id,
        productId: it.product,
        name: pd.name || "Product",
        price: Number(pd.price || 0),
        qty: Number(it.quantity || 1),
        maxQty: Number(pd.quantity ?? 0),
        img: absUrl(pd.image),
        seller: pd.seller || "",
      };
    });
  }, [cart]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
    const discount = promo.trim().toUpperCase() === "BUZ10" ? Math.round(subtotal * 0.1) : 0;
    const shipping = subtotal > 1500 ? 0 : 150;
    const total = Math.max(subtotal - discount + shipping, 0);
    return { subtotal, discount, shipping, total };
  }, [items, promo]);

  // ---- Fetch active cart ----
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(CART_ACTIVE_URL, {
          headers: authHeaders({ json: false }),
          credentials: "include",
        });
        if (!res.ok) throw new Error(`Failed to load cart (${res.status})`);
        const data = await safeJson(res);
        if (alive) setCart(data);
      } catch (e) {
        if (alive) setError(e.message || "Failed to load cart");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ---- Mutations ----
  async function patchItemQuantity(productId, newQty) {
    // PATCH /api/commerce/carts/active/  { product, quantity }
    const res = await fetch(CART_ACTIVE_URL, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ product: productId, quantity: newQty }),
      credentials: "include",
    });
    if (!res.ok) {
      const data = await safeJson(res);
      const msg =
        data?.quantity ||
        data?.detail ||
        `Failed to update (HTTP ${res.status})`;
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
    const data = await safeJson(res);
    if (data?.items) return data;
    return null;
  }

  async function deleteItem(itemId) {
    // DELETE /api/commerce/carts/active/?cart_id=<cart_item_id>
    const url = `${CART_ACTIVE_URL}?cart_id=${encodeURIComponent(itemId)}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: authHeaders({ json: false }),
      credentials: "include",
    });
    if (!res.ok && res.status !== 200 && res.status !== 204) {
      const data = await safeJson(res);
      const msg = data?.detail || `Failed to remove (HTTP ${res.status})`;
      throw new Error(msg);
    }
    const data = await safeJson(res);
    if (data?.items) return data;
    return null;
  }

  // ---- UI state updates ----
  function optimisticUpdate(itemId, transform) {
    setCart((prev) => {
      if (!prev) return prev;
      const nextItems = prev.items.map((it) =>
        it.id === itemId ? transform(it) : it
      );
      return { ...prev, items: nextItems };
    });
  }

  function optimisticRemove(itemId) {
    setCart((prev) => {
      if (!prev) return prev;
      const nextItems = prev.items.filter((it) => it.id !== itemId);
      return { ...prev, items: nextItems };
    });
  }

  async function onQtyChange(item, nextQty) {
    setError("");
    let desired = Math.max(1, Number(nextQty) || 1);
    if (item.maxQty > 0) desired = Math.min(desired, item.maxQty);

    const prevQty = item.qty;
    optimisticUpdate(item.id, (raw) => ({ ...raw, quantity: desired }));

    try {
      const updated = await patchItemQuantity(item.productId, desired);
      if (updated?.items) setCart(updated);
    } catch (e) {
      optimisticUpdate(item.id, (raw) => ({ ...raw, quantity: prevQty }));
      setError(
        String(e?.message || e) ||
          "Could not update quantity. Please try again."
      );
    }
  }

  async function onRemove(itemId) {
    setError("");
    const prevCart = cart;
    optimisticRemove(itemId);
    try {
      const updated = await deleteItem(itemId);
      if (updated?.items) setCart(updated);
    } catch (e) {
      setCart(prevCart);
      setError(String(e?.message || e) || "Could not remove item.");
    }
  }

  /* ===========================
     RENDER
  ============================ */
  if (loading) {
    return (
      <section className="container">
        <div className="surface" style={{ padding: "2rem" }}>
          <h1 className="text-2xl">Your Cart</h1>
          <p className="muted">Loading your items…</p>
        </div>
      </section>
    );
  }

  if (!items.length) {
    return (
      <section className="container">
        <div className="cart-empty surface">
          <h1 className="text-2xl">Your Cart</h1>
          <p className="lead">No items yet. Start exploring products!</p>
          <a className="btn btn-primary" href="/products">Browse Products</a>
        </div>
      </section>
    );
  }

  return (
    <section className="container">
      <h1 className="text-2xl mb-2">Your Cart</h1>

      {error && (
        <div className="alert-error" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="cart-wrap">
        {/* Items */}
        <div className="cart-items surface">
          {items.map((it) => (
            <div key={it.id} className="cart-row">
              <img className="cart-img" src={it.img} alt={it.name} />
              <div className="cart-info">
                <h3 className="cart-title">{it.name}</h3>
                {it.seller ? <div className="cart-seller muted">Seller: {it.seller}</div> : null}
                <div className="cart-price">{formatMoney(it.price)}</div>
                {it.maxQty > 0 && (
                  <div className="stock-note muted">In stock: {it.maxQty}</div>
                )}
                <button className="link-remove" onClick={() => onRemove(it.id)}>
                  Remove
                </button>
              </div>

              <div className="cart-qty">
                <button
                  className="qty-btn"
                  onClick={() => onQtyChange(it, it.qty - 1)}
                  aria-label="decrease"
                >
                  −
                </button>
                <input
                  className="qty-input"
                  type="number"
                  min={1}
                  max={it.maxQty || undefined}
                  value={it.qty}
                  onChange={(e) => onQtyChange(it, e.target.value)}
                />
                <button
                  className="qty-btn"
                  onClick={() => onQtyChange(it, it.qty + 1)}
                  aria-label="increase"
                >
                  ＋
                </button>
              </div>

              <div className="cart-line-total">
                {formatMoney(it.price * it.qty)}
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <aside className="cart-summary surface">
          <h2 className="summary-title">Order Summary</h2>

          <div className="summary-row">
            <span>Subtotal</span>
            <strong>{formatMoney(totals.subtotal)}</strong>
          </div>
          <div className="summary-row">
            <span>Shipping</span>
            <strong>
              {totals.shipping === 0 ? "Free" : formatMoney(totals.shipping)}
            </strong>
          </div>
          <div className="summary-row">
            <span>Discount</span>
            <strong className={totals.discount ? "text-green" : "muted"}>
              {totals.discount ? `− ${formatMoney(totals.discount)}` : "—"}
            </strong>
          </div>

          <div className="summary-divider" />

          <div className="summary-row total">
            <span>Total</span>
            <strong>{formatMoney(totals.total)}</strong>
          </div>

          <form
            className="promo"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <input
              className="input"
              placeholder="Promo code (try BUZ10)"
              value={promo}
              onChange={(e) => setPromo(e.target.value)}
            />
            <button className="btn btn-outline" type="submit">
              Apply
            </button>
          </form>

          <a href="/checkout" className="btn btn-primary w-full" style={{ textAlign: "center" }}>
            Proceed to Checkout
          </a>
          <a href="/products" className="btn btn-muted w-full" style={{ textAlign: "center" }}>
            Continue Shopping
          </a>
        </aside>
      </div>
    </section>
  );
}
