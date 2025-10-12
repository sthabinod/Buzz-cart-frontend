import { useCallback, useMemo, useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/upload.css";

/** Resolve API base */
const API_BASE =
  (import.meta.env?.VITE_API_BASE || window.location.origin || "http://127.0.0.1:8001")
    .replace(/\/+$/, "");

/** Optional: fallback Basic auth if you want (when no JWT available) */
const BASIC_USER = import.meta.env?.VITE_BASIC_USER || null;
const BASIC_PASS = import.meta.env?.VITE_BASIC_PASS || null;

function getJwt() {
  return localStorage.getItem("access") || "";
}

function getCsrfToken() {
  const m = document.cookie.match(/csrftoken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

// 🔒 Decode JWT safely to extract has_document
function decodeJwtPayload(token) {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const pad = "=".repeat((4 - (payload.length % 4)) % 4);
    const b64 = (payload + pad).replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

export default function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [desc, setDesc] = useState("");
  const [linkProduct, setLinkProduct] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [product, setProduct] = useState({
    name: "",
    price: "",
    qty: "",
    description: "",
    image: null,
    imageUrl: "",
  });

  // 🔒 Determine permission from JWT claim
  const claims = useMemo(() => decodeJwtPayload(getJwt()), []);
  const canLinkProduct = !!claims?.has_document;

  // Auto-disable toggle if not allowed
  useEffect(() => {
    if (!canLinkProduct && linkProduct) setLinkProduct(false);
  }, [canLinkProduct, linkProduct]);

  // --- File handling ---
  const onFile = useCallback((f) => {
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      const f = e.dataTransfer.files?.[0];
      if (f) onFile(f);
    },
    [onFile]
  );

  const onPick = (e) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  };

  const onProductImage = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setProduct((p) => ({ ...p, image: f, imageUrl: URL.createObjectURL(f) }));
  };

  const mediaType = useMemo(() => {
    if (!file) return "none";
    return file.type?.startsWith("video") ? "video" : "image";
  }, [file]);

  const reset = () => {
    setFile(null);
    setPreviewUrl("");
    setCaption("");
    setDesc("");
    setLinkProduct(false);
    setProduct({ name: "", price: "", qty: "", description: "", image: null, imageUrl: "" });
    setProgress(0);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      alert("Please select a video or image first.");
      return;
    }
    setBusy(true);
    setProgress(0);

    try {
      const fd = new FormData();

      fd.append("post_media", file);
      fd.append("caption", caption || "");
      fd.append("type", mediaType);
      fd.append("description", desc || "");

      // Only allow linking if verified
      const effectiveLinkProduct = canLinkProduct && !!linkProduct;
      fd.append("link_product", String(effectiveLinkProduct));

      if (effectiveLinkProduct) {
        if (product.name) fd.append("product_name", product.name);
        if (product.price !== "") fd.append("product_price", product.price);
        if (product.qty !== "") fd.append("product_qty", product.qty);
        if (product.image) fd.append("product_image", product.image);
      }

      const headers = { Accept: "application/json" };
      const jwt = getJwt();
      if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
      else if (BASIC_USER && BASIC_PASS) {
        const token = btoa(`${BASIC_USER}:${BASIC_PASS}`);
        headers["Authorization"] = `Basic ${token}`;
      }

      const csrf = getCsrfToken();
      if (csrf) headers["X-CSRFTOKEN"] = csrf;

      const url = `${API_BASE}/api/feed/posts/`;

      const res = await axios.post(url, fd, {
        headers,
        withCredentials: true,
        onUploadProgress: (evt) => {
          if (!evt.total) return;
          setProgress(Math.round((evt.loaded * 100) / evt.total));
        },
      });

      setProgress(100);
      alert("Uploaded successfully!");
      reset();
      navigate("/");
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        err?.message ||
        "Upload failed";
      alert(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="up-shell">
      <div className="up-wrap">
        <section className="up-left">
          <h1 className="up-title">Upload Video or Image</h1>

          {/* Dropzone */}
          <label
            className={`up-dropzone ${previewUrl ? "has-media" : ""}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
          >
            {!previewUrl ? (
              <div className="up-drop-inner">
                <div className="up-drop-icon">⤴️</div>
                <div className="up-drop-lines">
                  <div className="up-drop-line-1">
                    <span className="strong">Select</span> video/image
                  </div>
                  <div className="up-drop-line-2">or drag and drop here</div>
                </div>
                <input type="file" accept="video/*,image/*" onChange={onPick} hidden />
                <button
                  type="button"
                  className="up-btn up-btn-light"
                  onClick={() => {
                    const inp = document.querySelector(".up-dropzone input[type=file]");
                    inp && inp.click();
                  }}
                >
                  Choose File
                </button>
              </div>
            ) : (
              <div className="up-preview-media">
                {mediaType === "video" ? (
                  <video src={previewUrl} controls playsInline />
                ) : (
                  <img src={previewUrl} alt="preview" />
                )}
                <button
                  type="button"
                  className="up-clear"
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl("");
                  }}
                >
                  ✕
                </button>
              </div>
            )}
          </label>

          {/* Progress */}
          {busy && (
            <div className="up-progress">
              <div className="up-progress-bar" style={{ width: `${progress}%` }} />
              <span className="up-progress-text">{progress}%</span>
            </div>
          )}

          {/* Caption */}
          <div className="up-field">
            <label className="up-label">Caption</label>
            <input
              type="text"
              className="up-input"
              placeholder="How do you feel to wear it?"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={280}
            />
          </div>

          {/* Description */}
          <div className="up-field">
            <label className="up-label">Description</label>
            <textarea
              rows={3}
              className="up-textarea"
              placeholder="Share more about your video..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              maxLength={4000}
            />
            <div className="up-hint">{desc.length}/4000</div>
          </div>

          {/* Link product toggle */}
          <label className="up-check">
            <input
              type="checkbox"
              checked={linkProduct}
              onChange={(e) => setLinkProduct(e.target.checked)}
              disabled={!canLinkProduct}
            />
            {/* 🔒 has_document check */}
            <span>Link Product</span>
          </label>

          {/* Product form (only if allowed and toggled) */}
          {canLinkProduct && linkProduct && (
            <div className="up-product">
              <div className="up-grid">
                <div className="up-field">
                  <label className="up-label">Product Name</label>
                  <input
                    type="text"
                    className="up-input"
                    value={product.name}
                    onChange={(e) => setProduct((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Clothing Jacket"
                  />
                </div>
                <div className="up-field">
                  <label className="up-label">Price</label>
                  <input
                    type="number"
                    className="up-input"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={product.price}
                    onChange={(e) => setProduct((p) => ({ ...p, price: e.target.value }))}
                    placeholder="1000"
                  />
                </div>
                <div className="up-field">
                  <label className="up-label">Quantity</label>
                  <input
                    type="number"
                    className="up-input"
                    min="0"
                    value={product.qty}
                    onChange={(e) => setProduct((p) => ({ ...p, qty: e.target.value }))}
                    placeholder="10"
                  />
                </div>
              </div>

              <div className="up-field">
                <label className="up-label">Product Image</label>
                <div className="up-image-row">
                  <input type="file" accept="image/*" onChange={onProductImage} />
                  {product.imageUrl && (
                    <img src={product.imageUrl} className="up-thumb" alt="product" />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="up-actions">
            <button className="up-btn up-btn-primary" onClick={handleSubmit} disabled={busy}>
              {busy ? "Posting..." : "Post"}
            </button>
            <button className="up-btn up-btn-ghost" type="button" onClick={reset} disabled={busy}>
              Discard
            </button>
          </div>
        </section>

        <aside className="up-right">
          <h2 className="up-title">Preview</h2>
          <div className="up-phone">
            {!previewUrl ? (
              <div className="up-phone-empty">Preview will appear here</div>
            ) : mediaType === "video" ? (
              <video src={previewUrl} controls playsInline className="up-phone-media" />
            ) : (
              <img src={previewUrl} alt="preview" className="up-phone-media" />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
