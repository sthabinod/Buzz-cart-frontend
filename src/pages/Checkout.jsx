// src/pages/Checkout.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/checkout.css";

/* ===========================
   ENV & BASE URLS (robust)
=========================== */
const API_BASE_RAW =
  import.meta.env?.VITE_API_BASE ||
  window.location.origin ||
  "http://127.0.0.1:8001";
const API_BASE = API_BASE_RAW.replace(/\/+$/, "");

// Optional Basic auth fallback if no JWT (dev only)
const BASIC_USER = import.meta.env?.VITE_BASIC_USER || null;
const BASIC_PASS = import.meta.env?.VITE_BASIC_PASS || null;

// PayPal (Sandbox) – client-side only
const PAYPAL_CLIENT_ID = import.meta.env?.VITE_PAYPAL_CLIENT_ID || "";
const PAYPAL_CURRENCY = import.meta.env?.VITE_PAYPAL_CURRENCY || "USD";
const FX_NPR_TO_USD = Number(import.meta.env?.VITE_FX_NPR_TO_USD || 0.0077);

// Endpoints
// NOTE: singular "cart" (not "carts") to avoid 404
const CART_URL = `${API_BASE}/api/commerce/carts/active/`;
const ORDER_URL = `${API_BASE}/api/commerce/orders/`;

/* ===========================
   Helpers
=========================== */
function authHeaders() {
  const token = localStorage.getItem("access");
  const h = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  else if (BASIC_USER && BASIC_PASS) {
    const b64 = btoa(`${BASIC_USER}:${BASIC_PASS}`);
    h.Authorization = `Basic ${b64}`;
  }
  return h;
}

async function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) return resolve(true);
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = reject;
    document.body.appendChild(s);
  });
}

function toPaypalAmount(nprTotal) {
  if (PAYPAL_CURRENCY === "USD") {
    return (nprTotal * FX_NPR_TO_USD).toFixed(2);
  }
  return (nprTotal * FX_NPR_TO_USD).toFixed(2);
}

/* ===========================
   Tiny Toast component
=========================== */
function Toast({ kind = "error", message, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose?.(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const t = setTimeout(() => onClose?.(), 6000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div role="alert" aria-live="assertive" className={`toast ${kind}`}>
      <div className="toast-dot" />
      <div className="toast-body">
        <strong className="toast-title">
          {kind === "error" ? "Something went wrong" : "Notice"}
        </strong>
        <div className="toast-msg">{message}</div>
      </div>
      <button className="toast-close" onClick={onClose} aria-label="Close">✕</button>
    </div>
  );
}

/* ===========================
   Component
=========================== */
export default function Checkout() {
  const navigate = useNavigate();

  // Address fields
  const [fullName, setFullName] = useState("Binod Shrestha");
  const [phone, setPhone] = useState("+977-9800000000");
  const [street, setStreet] = useState("Satdobato, Lalitpur");
  const [city, setCity] = useState("Kathmandu");
  const [zip, setZip] = useState("44700");

  // Cart & totals
  const [cart, setCart] = useState(null);
  const [loadingCart, setLoadingCart] = useState(true);

  // Payment flow
  const [method, setMethod] = useState("cod"); // 'cod' | 'paypal' | 'card' | 'esewa'
  const [paid, setPaid] = useState(false);
  const [paypalOrderId, setPaypalOrderId] = useState("");
  const [paypalCaptureId, setPaypalCaptureId] = useState("");
  const [placing, setPlacing] = useState(false);

  // Errors (for toast)
  const [error, setError] = useState("");
  const closeError = useCallback(() => setError(""), []);

  // ---- Load Active Cart ----
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingCart(true);
        const res = await fetch(CART_URL, { headers: authHeaders() });
        if (!res.ok) throw new Error("Failed to load cart");
        const j = await res.json();
        if (alive) setCart(j);
      } catch (e) {
        setError(e.message || "Could not load cart");
      } finally {
        if (alive) setLoadingCart(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Compute totals from cart
  const subtotal = useMemo(() => {
    if (!cart?.items?.length) return 0;
    return cart.items.reduce((sum, it) => {
      const price = Number(it?.product_details?.price || 0);
      return sum + price * Number(it.quantity || 0);
    }, 0);
  }, [cart]);

  const shipping = 0;
  const discount = 0;
  const total = useMemo(() => subtotal + shipping - discount, [subtotal]);

  // Items payload for the order
  const orderItems = useMemo(() => {
    if (!cart?.items?.length) return [];
    return cart.items.map((it) => ({
      product: it.product || it?.product_details?.id,
      quantity: it.quantity,
    }));
  }, [cart]);

  // ---- PayPal (Sandbox) setup – client side only ----
  useEffect(() => {
    let cancelled = false;

    async function ensurePayPal() {
      if (method !== "paypal") return;
      setPaid(false);
      setPaypalOrderId("");
      setPaypalCaptureId("");

      if (!PAYPAL_CLIENT_ID) {
        setError("Missing PayPal sandbox client id (VITE_PAYPAL_CLIENT_ID).");
        return;
      }

      const qs = new URLSearchParams({
        "client-id": PAYPAL_CLIENT_ID,
        currency: PAYPAL_CURRENCY,
        intent: "capture",
        components: "buttons",
        commit: "true",
      }).toString();

      try {
        await loadScript(`https://www.paypal.com/sdk/js?${qs}`);
      } catch {
        if (!cancelled) setError("Could not load PayPal SDK.");
        return;
      }
      if (cancelled) return;

      const containerId = "paypal-buttons-container";
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = "";

      // eslint-disable-next-line no-undef
      window.paypal
        .Buttons({
          style: { layout: "vertical", shape: "rect", label: "paypal" },

          // Client-side create order (sandbox)
          createOrder: (data, actions) => {
            const value = toPaypalAmount(total);
            return actions.order.create({
              intent: "CAPTURE",
              purchase_units: [
                {
                  reference_id: "buzcart-checkout",
                  amount: { currency_code: PAYPAL_CURRENCY, value },
                },
              ],
              application_context: {
                shipping_preference: "NO_SHIPPING",
                user_action: "PAY_NOW",
              },
            });
          },

          // Capture on PayPal (no server), then unlock "Place Order"
          onApprove: async (data, actions) => {
            try {
              const details = await actions.order.capture(); // sandbox capture
              const cap = details?.purchase_units?.[0]?.payments?.captures?.[0] || {};
              setPaypalOrderId(data.orderID || details?.id || "");
              setPaypalCaptureId(cap?.id || "");
              setPaid(true);
            } catch (e) {
              setError("Failed to capture payment in PayPal.");
              setPaid(false);
            }
          },

          onError: (err) => {
            console.error(err);
            setError("PayPal error (sandbox). Please try again.");
            setPaid(false);
          },

          onCancel: () => setPaid(false),
        })
        .render(`#${containerId}`);
    }

    ensurePayPal();
    return () => { cancelled = true; };
  }, [method, total]);

  // ---- Validation & gating ----
  const addrOk = fullName && phone && street && city && zip;
  const canPlace =
    !!addrOk &&
    !!orderItems.length &&
    ((method === "cod") || (method === "paypal" && paid));

  // ---- Place Order ----
  async function placeOrder() {
    if (!canPlace || placing) return;
    setPlacing(true);
    setError("");

    try {
      const res = await fetch(ORDER_URL, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          full_name: fullName,
          phone,
          street,
          city,
          zip_code: zip,
          payment_method: method === "cod" ? "cod" : "paypal",
          shipping: shipping.toFixed(2),
          discount: discount.toFixed(2),
          paid: method === "paypal" ? true : false,
          payment_ref: method === "paypal" ? (paypalCaptureId || paypalOrderId) : null,
          items: orderItems,
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.detail || "Order failed");
      }

      const j = await res.json();
      navigate("/orders", { replace: true, state: { placed: true, order: j } });
    } catch (e) {
      setError(e.message || "Could not place order");
    } finally {
      setPlacing(false);
    }
  }

  /* ===========================
     UI
  ========================== */
  return (
    <div className="checkout-page">
      {/* Error Toast (overlays above content) */}
      {!!error && <Toast kind="error" message={error} onClose={closeError} />}

      <div className="grid">
        {/* Left: Address + Payment */}
        <div className="card p-4">
          <h2 className="text-xl mb-4">Shipping Address</h2>

          <div className="grid" style={{ gap: 12 }}>
            <input value={fullName} onChange={(e)=>setFullName(e.target.value)} placeholder="Full name" />
            <input value={phone} onChange={(e)=>setPhone(e.target.value)} placeholder="Phone number" />
            <input value={street} onChange={(e)=>setStreet(e.target.value)} placeholder="Street" />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 160px", gap:12 }}>
              <input value={city} onChange={(e)=>setCity(e.target.value)} placeholder="City" />
              <input value={zip} onChange={(e)=>setZip(e.target.value)} placeholder="ZIP Code" />
            </div>
            {!addrOk && <span className="hint">Please fill all address fields.</span>}
          </div>

          <h3 className="text-lg mt-6 mb-2">Payment Method</h3>
          <div className="stack">
            <label className={`pay-opt ${method==="cod"?"active":""}`}>
              <input type="radio" name="pay" checked={method==="cod"} onChange={()=>setMethod("cod")} />
              Cash on Delivery
            </label>

            <label className={`pay-opt ${method==="paypal"?"active":""}`}>
              <input type="radio" name="pay" checked={method==="paypal"} onChange={()=>setMethod("paypal")} />
              PayPal
            </label>

            <label className={`pay-opt ${method==="card"?"active":""}`}>
              <input type="radio" name="pay" checked={method==="card"} onChange={()=>setMethod("card")} />
              Credit / Debit Card <span className="hint">(coming soon)</span>
            </label>

            <label className={`pay-opt ${method==="esewa"?"active":""}`}>
              <input type="radio" name="pay" checked={method==="esewa"} onChange={()=>setMethod("esewa")} />
              eSewa / Khalti <span className="hint">(coming soon)</span>
            </label>
          </div>

          {/* PayPal Buttons mount point + helper text */}
          {method === "paypal" && (
            <div className="mt-3">
              <div id="paypal-buttons-container" />
              <div className="hint" style={{ marginTop: 8 }}>
                PayPal amount: {PAYPAL_CURRENCY} {toPaypalAmount(total)} (Your total is NPR {total.toLocaleString()})
              </div>
              {paid ? (
                <p style={{ marginTop: 8 }}>✅ Payment captured. You can place the order now.</p>
              ) : (
                <p style={{ marginTop: 8 }}>Complete PayPal payment to enable “Place Order”.</p>
              )}
            </div>
          )}
        </div>

        {/* Right: Summary */}
        <div className="card p-4">
          <h3 className="text-lg mb-3">Order Summary</h3>

          {loadingCart ? (
            <div className="row"><span>Loading cart…</span></div>
          ) : !orderItems.length ? (
            <div className="row"><span>Your cart is empty.</span></div>
          ) : (
            <>
              <div className="row"><span>Subtotal</span><span>NPR {subtotal.toLocaleString()}</span></div>
              <div className="row"><span>Shipping</span><span>{shipping ? `NPR ${shipping}` : "Free"}</span></div>
              <div className="row"><span>Discount</span><span>{discount ? `NPR ${discount}` : "—"}</span></div>
              <hr />
              <div className="row"><strong>Total</strong><strong>NPR {total.toLocaleString()}</strong></div>

              <button
                className="place-order-btn"
                disabled={!canPlace || placing}
                onClick={placeOrder}
                style={{ marginTop: 16, width: "100%" }}
                title={
                  !addrOk ? "Fill address first"
                  : (method === "paypal" && !paid) ? "Complete PayPal payment first"
                  : (!orderItems.length ? "Cart is empty" : "Place Order")
                }
              >
                {placing ? "Placing..." : "Place Order"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
