import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { normalizeApiErrors, firstError } from "../utils/errors";

export default function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // Vite env fallback to localhost
  const API_BASE =
    (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE) ||
    "http://127.0.0.1:8001";

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setGlobalError("");
    setFieldErrors({});

    if (!username || !password) {
      setLoading(false);
      const errs = {};
      if (!username) errs.username = ["Username is required"];
      if (!password) errs.password = ["Password is required"];
      setFieldErrors(errs);
      setGlobalError("Please fill in the required fields.");
      return;
    }

    try {
      const res = await axios.post(
        `${API_BASE.replace(/\/+$/, "")}/api/auths/token/`,
        { username, password },
        { headers: { "Content-Type": "application/json", Accept: "application/json" } }
      );

      const { access, refresh } = res.data || {};
      if (access) localStorage.setItem("access", access);
      if (refresh) localStorage.setItem("refresh", refresh);

      // (Optional) decode claims for debugging
      // try { const [, p] = access.split("."); console.log(JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")))); } catch {}

      navigate("/");
    } catch (err) {
      // Prefer server payload → normalize for consistent UI
      const data = err?.response?.data || { detail: "Invalid credentials or server error" };
      const { fieldErrors: fe, message } = normalizeApiErrors(data);

      // If backend returns only `detail`, show it as global error.
      setFieldErrors(fe);
      setGlobalError(message || "Unable to log in. Please try again.");

      // Common 401/400: add friendly hints if no field-level errors
      if (!fe.username && !fe.password && err?.response?.status === 401) {
        setFieldErrors({
          ...fe,
          password: ["Invalid username or password"],
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const invalidClass = (name) =>
    firstError(fieldErrors, name) ? "input w-full ring-1 ring-red-400" : "input w-full";

  const FieldError = ({ name }) => {
    const msg = firstError(fieldErrors, name);
    if (!msg) return null;
    return (
      <p className="mt-1 text-xs" style={{ color: "var(--bc-danger, #ef4444)" }}>
        {msg}
      </p>
    );
  };

  return (
    <section className="auth-card auth-wrap">
      <h2 className="text-2xl font-semibold mb-4 text-center">Log in</h2>

      <form onSubmit={onSubmit} className="form-col">
        <div className="form-field">
          <label>Username</label>
          <input
            className={invalidClass("username")}
            type="text"
            placeholder="Enter your username"
            required
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setFieldErrors((s) => ({ ...s, username: undefined }));
              setGlobalError("");
            }}
            autoComplete="username"
          />
          <FieldError name="username" />
        </div>

        <div className="form-field">
          <label>Password</label>
          <input
            className={invalidClass("password")}
            type="password"
            placeholder="Enter your password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldErrors((s) => ({ ...s, password: undefined }));
              setGlobalError("");
            }}
            autoComplete="current-password"
          />
          <FieldError name="password" />
        </div>

        {globalError && (
          <div className="text-center mt-2 whitespace-pre-line" style={{ color: "var(--bc-danger, #ef4444)" }}>
            {globalError}
          </div>
        )}

        <button type="submit" className="btn btn-primary w-full mt-1" disabled={loading}>
          {loading ? "Logging in..." : "Log In"}
        </button>
      </form>

      <p className="text-center mt-4 text-sm" style={{ color: "var(--bc-text-muted)" }}>
        No account?{" "}
        <Link to="/register" className="underline" style={{ color: "var(--bc-primary)" }}>
          Register
        </Link>
      </p>
    </section>
  );
}
