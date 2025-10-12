import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/products.css";

const API_BASE =
  import.meta.env?.VITE_API_BASE?.replace(/\/+$/, "") || "http://127.0.0.1:8001";
const MEDIA_BASE =
  import.meta.env?.VITE_MEDIA_BASE?.replace(/\/+$/, "") || API_BASE;

const BASIC_USER = import.meta.env?.VITE_BASIC_USER || null;
const BASIC_PASS = import.meta.env?.VITE_BASIC_PASS || null;

function joinUrl(base, path) {
  if (!path) return "";
  if (/^(https?:|blob:|data:)/i.test(path)) return path;
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
function formatPrice(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n.toLocaleString("ne-NP") : x;
}
function localTime(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso || "";
  }
}
function authHeaders() {
  const h = { Accept: "application/json" };
  const token = localStorage.getItem("access") || localStorage.getItem("token");
  if (token) h.Authorization = `Bearer ${token}`;
  else if (BASIC_USER && BASIC_PASS)
    h.Authorization = `Basic ${btoa(`${BASIC_USER}:${BASIC_PASS}`)}`;
  return h;
}

export default function Products() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState("default");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/commerce/products/`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const products = useMemo(() => {
    const a = [...items];
    if (sort === "price_asc")
      a.sort((x, y) => Number(x.price) - Number(y.price));
    if (sort === "price_desc")
      a.sort((x, y) => Number(y.price) - Number(x.price));
    if (sort === "newest")
      a.sort((x, y) => new Date(y.created_at) - new Date(x.created_at));
    return a;
  }, [items, sort]);

  return (
    <section className="container">
      <div className="products-header">
        <div>
          <h1 className="text-2xl">Products</h1>
          <p className="lead">
            {loading ? "Loading..." : `${products.length} items`}
          </p>
        </div>
        <select
          className="select"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="default">Default sorting</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="product-grid">
        {!loading && !error && products.length === 0 && (
          <div className="empty">No products found</div>
        )}

        {products.map((p) => {
          const img = joinUrl(MEDIA_BASE, p.image);
          return (
            <article
              key={p.id}
              className={`product-card ${!p.in_stock ? "is-out" : ""}`}
            >
              <Link to={`/products/${p.id}`} className="product-thumb">
                <img src={img} alt={p.name} />
                {!p.in_stock && <span className="pill">Out of stock</span>}
              </Link>

              <div className="product-body">
                <h3 className="product-title">
                  <Link to={`/products/${p.id}`}>{p.name}</Link>
                </h3>

                <div className="price">AUD {formatPrice(p.price)}</div>

                <div className="meta-line">
                  <span>Seller:</span> {p.seller}
                </div>
                <div className="meta-line">
                  <span>ID:</span> {String(p.id).slice(0, 8)}
                </div>
                <div className="meta-line">
                  <span>Qty:</span> {p.quantity}
                </div>
                <div className="meta-line">
                  <span>Added:</span> {localTime(p.created_at)}
                </div>

                {p.description && (
                  <p className="desc" title={p.description}>
                    {p.description}
                  </p>
                )}

                <div className="product-actions">
                  <Link to={`/products/${p.id}`} className="btn btn-view">
                    View
                  </Link>
                  {p.in_stock ? (
                    <button className="btn btn-cart">Add to Cart</button>
                  ) : (
                    <button className="btn btn-disabled" disabled>
                      Out of Stock
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
