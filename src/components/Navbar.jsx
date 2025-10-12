import { Link, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

const linkClass = ({ isActive }) => `nav-link ${isActive ? "active" : ""}`;

// --------- ENV & defaults ---------
const MEDIA_BASE =
  (import.meta.env?.VITE_MEDIA_BASE ||
    import.meta.env?.VITE_API_BASE ||
    window.location.origin || "http://localhost:8001").replace(/\/+$/, "");

const DEFAULT_AVATAR = "/images/default-avatar.png"; // put a file in /public/images/default-avatar.png

// ---------- helpers ----------
function safeB64UrlToJson(b64url) {
  try {
    const padLen = (4 - (b64url.length % 4)) % 4;
    const b64 = (b64url + "=".repeat(padLen)).replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

function decodeJwt(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  return safeB64UrlToJson(parts[1]);
}

function getUsername(claims) {
  if (!claims) return "";
  return (
    claims?.username ||
    claims?.preferred_username ||
    claims?.email ||
    claims?.name ||
    claims?.sub ||
    ""
  );
}

function getRawAvatar(claims) {
  if (!claims) return "";
  return claims.avatar || claims.avatar_url || claims.picture || claims.image || "";
}

// Prefix domain/base path when token only provides a relative path
function normalizeAvatarUrl(raw) {
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;        // absolute
  if (raw.startsWith("//")) return window.location.protocol + raw; // protocol-relative
  if (raw.startsWith("/")) return `${MEDIA_BASE}${raw}`;           // root-relative
  return `${MEDIA_BASE}/${raw}`;                                   // bare path
}

function initialsFrom(name = "") {
  const parts = String(name).trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const second = parts[1]?.[0] || "";
  return (first + second).toUpperCase() || "U";
}

export default function Navbar() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("access"));
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState("");
  const lastTokenRef = useRef(localStorage.getItem("access"));

  function recomputeFromToken(token) {
    setIsLoggedIn(!!token);
    if (!token) {
      setUsername("");
      setAvatar("");
      return;
    }
    const claims = decodeJwt(token);
    setUsername(getUsername(claims));
    const raw = getRawAvatar(claims);
    setAvatar(normalizeAvatarUrl(raw));
  }

  // init
  useEffect(() => {
    recomputeFromToken(localStorage.getItem("access") || null);
  }, []);

  // cross-tab updates
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "access") {
        lastTokenRef.current = e.newValue;
        recomputeFromToken(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // same-tab polling (only when value changes)
  useEffect(() => {
    const id = setInterval(() => {
      const token = localStorage.getItem("access");
      if (token !== lastTokenRef.current) {
        lastTokenRef.current = token;
        recomputeFromToken(token);
      }
    }, 800);
    return () => clearInterval(id);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    lastTokenRef.current = null;
    setIsLoggedIn(false);
    setUsername("");
    setAvatar("");
    navigate("/login");
  };

  // --- Upload CTA (pill) ---
  const UploadCta = (
    <NavLink
      to="/upload"
      className="upload-cta"
      title="Upload video or image"
      aria-label="Upload"
    >
      <span className="upload-cta__icon" aria-hidden="true">＋</span>
      <span className="upload-cta__text">Upload</span>
    </NavLink>
  );

  // Fancy avatar chip (gradient ring + hover + fallback)
  const ProfileChip = (
    <Link
      to="/profile"
      className="profile-chip"
      title={username ? `Go to profile (${username})` : "Go to profile"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.6rem",
        marginLeft: "1rem",
        textDecoration: "none",
        padding: "0.2rem 0.4rem",
        borderRadius: "9999px",
        transition: "transform 120ms ease, background 120ms ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
    >
      <span
        style={{
          padding: 2,
          borderRadius: "9999px",
          background:
            "conic-gradient(from 180deg at 50% 50%, var(--bc-primary,#6d28d9), var(--bc-accent,#22d3ee), var(--bc-primary,#6d28d9))",
          display: "inline-flex",
        }}
      >
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            overflow: "hidden",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f3f4f6",
            boxShadow: "0 0 0 2px rgba(255,255,255,0.9) inset",
          }}
        >
          {avatar ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <img
              src={avatar || DEFAULT_AVATAR}
              loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              onError={(e) => {
                if (e.currentTarget.src !== DEFAULT_AVATAR) e.currentTarget.src = DEFAULT_AVATAR;
              }}
            />
          ) : (
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 0.4,
                color: "#374151",
              }}
            >
              {initialsFrom(username)}
            </span>
          )}
        </span>
      </span>

      {username && (
        <span style={{ color: "var(--bc-text-muted)", fontWeight: 600, fontSize: 14 }}>
          {username}
        </span>
      )}
    </Link>
  );

  return (
    <header className="navbar">
      <div className="navbar-inner">
        {/* Brand / Logo */}
        <Link to="/" className="brand">
          Buz<span style={{ color: "var(--bc-primary)" }}>Cart</span>
        </Link>

        <nav className="nav-links">
          {isLoggedIn ? (
            <>
              <NavLink to="/products" className={linkClass}>Products</NavLink>
              <NavLink to="/cart" className={linkClass}>Cart</NavLink>
              <NavLink to="/orders" className={linkClass}>Orders</NavLink>

              {/* NEW: Upload CTA (keep it prominent, before profile) */}
              {UploadCta}

              {ProfileChip}

              <button
                className="btn btn-ghost"
                style={{ marginLeft: "1rem" }}
                onClick={handleLogout}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink to="/register" className="btn btn-secondary">Register</NavLink>
              <NavLink to="/login" className="btn btn-primary">Login</NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
