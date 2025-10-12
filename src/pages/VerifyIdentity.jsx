import { useEffect, useMemo, useRef, useState } from "react";
import "../styles/verify.css";

/* ===========================
   ENV & BASE URLS (robust)
=========================== */
const API_BASE_RAW =
  import.meta.env?.VITE_API_BASE ||
  window.location.origin ||
  "http://127.0.0.1:8001";

const API_BASE = API_BASE_RAW.replace(/\/+$/, "");

/* ===========================
   Endpoints (adjust if needed)
   Point this to your DocumentListCreate view.
=========================== */
const DOCUMENTS_URL = `${API_BASE}/api/verification/documents/`; // e.g. /api/kyc/documents/ (POST)

/* ===========================
   Auth helper (JWT first; optional Basic dev fallback)
=========================== */
const BASIC_USER = import.meta.env?.VITE_BASIC_USER || null;
const BASIC_PASS = import.meta.env?.VITE_BASIC_PASS || null;

function authHeaders() {
  const headers = {};
  const token = localStorage.getItem("access") || sessionStorage.getItem("access");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else if (BASIC_USER && BASIC_PASS) {
    const b64 = btoa(`${BASIC_USER}:${BASIC_PASS}`);
    headers["Authorization"] = `Basic ${b64}`;
  }
  return headers;
}

/* ===========================
   Allowed types & choices
=========================== */
const DOC_CHOICES = [
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "National ID" },
  { value: "driver_license", label: "Driver License" },
  { value: "other", label: "Other" },
];

const ACCEPT =
  "image/*,application/pdf"; // images or PDF
const MAX_FILE_MB = 15;

export default function VerifyIdentity() {
  const inputRef = useRef(null);

  const [docType, setDocType] = useState("");
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  const isPDF = file ? file.type === "application/pdf" || /\.pdf$/i.test(file.name) : false;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function onPick(e) {
    const f = e.target.files?.[0];
    if (f) validateAndSet(f);
  }

  function validateAndSet(f) {
    setError("");
    setSuccess("");

    if (!f) return;

    const mb = f.size / (1024 * 1024);
    if (mb > MAX_FILE_MB) {
      setError(`File too large. Max ${MAX_FILE_MB}MB.`);
      return;
    }
    if (!f.type?.startsWith("image/") && f.type !== "application/pdf") {
      // allow by extension fallback
      if (!/\.pdf$/i.test(f.name)) {
        setError("Only images or PDF are allowed.");
        return;
      }
    }
    setFile(f);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) validateAndSet(f);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!docType) {
      setError("Please select a document type.");
      return;
    }
    if (!file) {
      setError("Please choose a file.");
      return;
    }

    const fd = new FormData();
    fd.append("doc_type", docType);
    fd.append("doc_file", file);

    setLoading(true);
    try {
      const res = await fetch(DOCUMENTS_URL, {
        method: "POST",
        headers: {
          ...authHeaders(),
        },
        body: fd,
      });

      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data?.detail || "Failed to submit document.");
      }

      setSuccess("Document submitted for review.");
      setFile(null);
      setDocType("");
      // clear file input
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function safeJson(r) {
    return r
      .clone()
      .json()
      .catch(() => ({}));
  }

  return (
    <div className="verify-wrap">
      <div className="pane pane-form">
        <h2 className="pane-title">Verify Yourself</h2>

        <form onSubmit={onSubmit}>
          {/* Uploader */}
          <div
            className={`dropzone ${dragOver ? "drag" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <div className="drop-icon">⬆️</div>
            <div className="drop-text">
              <strong>Select</strong> document (image/PDF) <br />
              or drag and drop here
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              onChange={onPick}
              hidden
            />
            <button
              className="btn btn-ghost"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
            >
              Choose File
            </button>
          </div>

          {/* Meta */}
          <div className="field">
            <label className="label">Document Type</label>
            <select
              className="select"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
            >
              <option value="">Select type…</option>
              {DOC_CHOICES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          {error && <div className="alert error">{error}</div>}
          {success && <div className="alert success">{success}</div>}

          <div className="actions">
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Submitting…" : "Submit for review"}
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => {
                setDocType("");
                setFile(null);
                setError("");
                setSuccess("");
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              Discard
            </button>
          </div>
          <p className="hint">
            Accepted: images or PDF · Max {MAX_FILE_MB}MB
          </p>
        </form>
      </div>

      {/* Preview Pane */}
      <div className="pane pane-preview">
        <h3 className="pane-title">Preview</h3>
        <div className="phone-frame">
          {!file && <div className="placeholder">Preview will appear here</div>}

          {file && !isPDF && (
            <img
              src={previewUrl}
              alt="preview"
              className="preview-media"
            />
          )}

          {file && isPDF && (
            <div className="pdf-preview">
              <div className="pdf-badge">PDF</div>
              <div className="pdf-name" title={file.name}>
                {file.name}
              </div>
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost"
              >
                Open
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
