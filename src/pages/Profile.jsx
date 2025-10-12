// src/pages/Profile.jsx
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/profile.css";

/* ===========================
   ENV & BASE URLS
=========================== */
const API_BASE_RAW =
  import.meta.env?.VITE_API_BASE ||
  window.location.origin ||
  "http://127.0.0.1:8001";
const API_BASE = API_BASE_RAW.replace(/\/+$/, "");
const MEDIA_BASE_RAW = import.meta.env?.VITE_MEDIA_BASE || API_BASE;
const MEDIA_BASE = MEDIA_BASE_RAW.replace(/\/+$/, "");

// Optional Basic auth fallback if no JWT (dev only)
const BASIC_USER = import.meta.env?.VITE_BASIC_USER || null;
const BASIC_PASS = import.meta.env?.VITE_BASIC_PASS || null;

/* ===========================
   Helpers
=========================== */
function absUrl(path) {
  if (!path) return "";
  if (/^(https?:|blob:|data:)/i.test(path)) return path;
  return `${MEDIA_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}
function getAccessToken() {
  return (
    localStorage.getItem("access") ||
    localStorage.getItem("ACCESS_TOKEN") ||
    sessionStorage.getItem("access") ||
    ""
  );
}
function authHeaders(extra = {}) {
  const token = getAccessToken();
  if (token) return { Authorization: `Bearer ${token}`, ...extra };
  if (BASIC_USER && BASIC_PASS) {
    const basic = btoa(`${BASIC_USER}:${BASIC_PASS}`);
    return { Authorization: `Basic ${basic}`, ...extra };
  }
  return { ...extra };
}
function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* ===========================
   Component
=========================== */
export default function Profile() {
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);

  // User/Profile fields
  const [username, setUsername] = useState("");
  const [joinedISO, setJoinedISO] = useState(null); // profile.created_at
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);

  // Stats
  const [ordersCount, setOrdersCount] = useState(0);
  const [totalSpent, setTotalSpent] = useState("0");
  const [currency, setCurrency] = useState("NPR");

  // Security (change password)
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // 🔹 Single document
  const [document, setDocument] = useState(null);

  const fullName = `${firstName || ""} ${lastName || ""}`.trim();
  const joinedText = formatDate(joinedISO);

  /* ===========================
     Load profile: GET /api/auths/me/
  ============================ */
  useEffect(() => {
    async function loadMe() {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/auths/me/`, {
          headers: { Accept: "application/json", ...authHeaders() },
        });
        if (res.status === 401) return navigate("/login");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        setUsername(data.username || "");
        setFirstName(data.first_name || "");
        setLastName(data.last_name || "");
        setEmail(data.email || "");

        const p = data.profile || {};
        setPhone(p.phone || "");
        setAddress(p.address || "");
        setCity(p.city || "");
        setZip(p.zip || "");
        setAvatarUrl(absUrl(p.avatar));
        setJoinedISO(p.created_at || null);

        const s = data.stats || {};
        setOrdersCount(s.orders_count || 0);
        setTotalSpent(s.total_spent ?? "0");
        setCurrency(s.currency || "NPR");

        // Single document object
        setDocument(data.document || null);
      } catch (e) {
        console.error(e);
        alert("Failed to load profile.");
      } finally {
        setLoading(false);
      }
    }
    loadMe();
  }, [navigate]);

  /* ===========================
     Handlers
  ============================ */
  const onAvatarClick = () => fileRef.current?.click();
  const onAvatarChange = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setAvatarFile(f);
      setAvatarUrl(URL.createObjectURL(f));
    }
  };

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("first_name", firstName);
      fd.append("last_name", lastName);
      fd.append("email", email);
      fd.append("phone", phone);
      fd.append("address", address);
      fd.append("city", city);
      fd.append("zip", zip);
      if (avatarFile) fd.append("avatar", avatarFile, avatarFile.name);

      const res = await fetch(`${API_BASE}/api/auths/profile-update/`, {
        method: "PATCH",
        headers: { ...authHeaders() }, // let browser set multipart boundary
        body: fd,
      });
      if (res.status === 401) return navigate("/login");
      if (!res.ok) throw new Error("Profile update failed");
      alert("Profile updated successfully!");
    } catch (e) {
      console.error(e);
      alert("Error updating profile.");
    } finally {
      setSaving(false);
    }
  };

  const onChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword)
      return alert("Please fill all password fields.");
    if (newPassword !== confirmPassword)
      return alert("New password and confirm password do not match.");
    setPwdSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/auths/change-password/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      if (res.status === 401) return navigate("/login");
      if (!res.ok) throw new Error("Failed");
      alert("Password changed successfully.");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      console.error(e);
      alert("Error changing password.");
    } finally {
      setPwdSaving(false);
    }
  };

  const onLogout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("ACCESS_TOKEN");
    sessionStorage.removeItem("access");
    navigate("/login");
  };

  /* ===========================
     UI
  ============================ */
  return (
    <section className="container">
      {/* Header */}
      <div className="profile-header surface">
        <div className="pf-avatar-wrap" onClick={onAvatarClick} title="Change avatar">
          <img
            className="pf-avatar"
            src={
              avatarUrl ||
              "https://api.dicebear.com/7.x/thumbs/svg?seed=BuzCart&backgroundType=gradientLinear"
            }
            alt="avatar"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={onAvatarChange}
          />
        </div>

        <div className="pf-head-info">
          {/* name left, verify button right */}
          <div className="pf-head-top">
            <h1 className="pf-name">{fullName || username || "—"}</h1>
            <div className="pf-header-actions">
              <Link to="/verify" className="btn btn-primary-tk">
                Verify Account
              </Link>
            </div>
          </div>

          <p className="pf-meta">
            <span>{email || "—"}</span> • <span>Joined {joinedText}</span>
          </p>

          <div className="pf-quick">
            <Link to="/orders" className="btn btn-outline-tk">View Orders</Link>
            <Link to="/cart" className="btn btn-primary-tk">Go to Cart</Link>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="pf-grid">
        {/* Left: Account */}
        <div className="surface pf-card">
          <h2 className="pf-section-title">Account</h2>
          <form className="pf-form" onSubmit={onSave}>
            <div className="pf-row">
              <label>First name</label>
              <input className="input" value={firstName}
                     onChange={(e)=>setFirstName(e.target.value)} disabled={loading||saving}/>
            </div>
            <div className="pf-row">
              <label>Last name</label>
              <input className="input" value={lastName}
                     onChange={(e)=>setLastName(e.target.value)} disabled={loading||saving}/>
            </div>
            <div className="pf-row">
              <label>Email</label>
              <input className="input" type="email" value={email}
                     onChange={(e)=>setEmail(e.target.value)} disabled={loading||saving}/>
            </div>
            <div className="pf-row">
              <label>Phone</label>
              <input className="input" value={phone}
                     onChange={(e)=>setPhone(e.target.value)} disabled={loading||saving}/>
            </div>

            <h3 className="pf-subtitle">Address</h3>
            <div className="pf-row"><label>Address line</label>
              <input className="input" value={address} onChange={(e)=>setAddress(e.target.value)} disabled={loading||saving}/></div>
            <div className="pf-row"><label>City / Province</label>
              <input className="input" value={city} onChange={(e)=>setCity(e.target.value)} disabled={loading||saving}/></div>
            <div className="pf-row"><label>ZIP</label>
              <input className="input" value={zip} onChange={(e)=>setZip(e.target.value)} disabled={loading||saving}/></div>

            <div className="pf-actions">
              <button className="btn btn-primary-tk" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </button>
              <button className="btn btn-outline-tk" type="button"
                      onClick={()=>window.location.reload()} disabled={saving}>
                Cancel
              </button>
            </div>
          </form>
        </div>

        {/* Right: Security + Single Document + Stats */}
        <div className="pf-col-right">
          {/* Security */}
          <div className="surface pf-card">
            <h2 className="pf-section-title">Security</h2>
            <div className="pf-row">
              <label>Old password</label>
              <input className="input" type="password" value={oldPassword}
                     onChange={(e)=>setOldPassword(e.target.value)} disabled={pwdSaving}/>
            </div>
            <div className="pf-row">
              <label>New password</label>
              <input className="input" type="password" value={newPassword}
                     onChange={(e)=>setNewPassword(e.target.value)} disabled={pwdSaving}/>
            </div>
            <div className="pf-row">
              <label>Confirm new password</label>
              <div className="pf-inline">
                <input className="input" type="password" value={confirmPassword}
                       onChange={(e)=>setConfirmPassword(e.target.value)} disabled={pwdSaving}/>
                <button className="btn btn-outline-tk" type="button"
                        onClick={onChangePassword} disabled={pwdSaving}>
                  {pwdSaving ? "Updating..." : "Update"}
                </button>
              </div>
            </div>
            <hr className="pf-divider"/>
            <button className="btn btn-muted-tk w-full" type="button" onClick={onLogout}>
              Log out
            </button>
          </div>

          {/* Single Verification Document */}
          <div className="surface pf-card">
            <h2 className="pf-section-title">Verification Document</h2>
            {!document ? (
              <p className="text-muted">No document uploaded yet.</p>
            ) : (
              <div className="doc-card">
                <a
                  className="doc-media"
                  href={absUrl(document.doc_file)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open document"
                >
                  <img
                    src={absUrl(document.doc_file)}
                    alt={document.doc_type || "document"}
                    loading="lazy"
                  />
                </a>
                <div className="doc-meta">
                  <div className="doc-row">
                    <span className="doc-label">Type</span>
                    <span className="doc-value">{document.doc_type}</span>
                  </div>
                  <div className="doc-row">
                    <span className="doc-label">Status</span>
                    <span className={`doc-status badge-${document.status}`}>{document.status}</span>
                  </div>
                  {document.status === "approved" && (
                    <div className="doc-row">
                      <span className="doc-label">Reviewed</span>
                      <span className="doc-value">{formatDate(document.reviewed_at)}</span>
                    </div>
                  )}
                  <div className="doc-row">
                    <span className="doc-label">Uploaded</span>
                    <span className="doc-value">{formatDate(document.created_at)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="pf-stats">
            <div className="surface pf-stat">
              <span className="pf-stat-num">{ordersCount}</span>
              <span className="pf-stat-label">Orders</span>
            </div>
            <div className="surface pf-stat">
              <span className="pf-stat-num">
                {currency}{" "}
                {(() => {
                  const n = Number(totalSpent);
                  return Number.isFinite(n) ? n.toLocaleString() : totalSpent;
                })()}
              </span>
              <span className="pf-stat-label">Total Spent</span>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="surface" style={{ marginTop: "1rem", padding: "0.75rem" }}>
          Loading profile…
        </div>
      )}
    </section>
  );
}
