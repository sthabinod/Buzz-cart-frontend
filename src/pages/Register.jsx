import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { normalizeApiErrors, firstError } from "../utils/errors";

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: "",
    first_name: "",
    last_name: "",
    password: "",
    confirm_password: "",
  });

  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
    // clear field error as user types
    setFieldErrors((errs) => ({ ...errs, [name]: undefined }));
    setGlobalError("");
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setGlobalError("");
    setFieldErrors({});

    // quick client-side validations
    if (form.password !== form.confirm_password) {
      setLoading(false);
      setFieldErrors((s) => ({ ...s, confirm_password: ["Passwords do not match"] }));
      setGlobalError("Please fix the highlighted fields.");
      return;
    }
    if (form.password.length < 6) {
      setLoading(false);
      setFieldErrors((s) => ({ ...s, password: ["Password must be at least 6 characters long"] }));
      setGlobalError("Please fix the highlighted fields.");
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/auths/register/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          username: form.username,
          first_name: form.first_name,
          last_name: form.last_name,
          password: form.password,
          confirm_password: form.confirm_password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const { fieldErrors: fe, message } = normalizeApiErrors(data);
        setFieldErrors(fe);
        throw new Error(message);
      }

      // success
      navigate("/login");
    } catch (err) {
      setGlobalError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // a tiny component for field error text
  const FieldError = ({ name }) => {
    const msg = firstError(fieldErrors, name);
    if (!msg) return null;
    return <p className="mt-1 text-xs" style={{ color: "var(--bc-danger, #ef4444)" }}>{msg}</p>;
  };

  // helper to mark invalid input
  const invalidClass = (name) =>
    firstError(fieldErrors, name) ? "input w-full ring-1 ring-red-400" : "input w-full";

  return (
    <section className="auth-card auth-wrap">
      <h2 className="text-2xl font-semibold mb-4 text-center">Create account</h2>

      <form onSubmit={onSubmit} className="form-col">
        <div className="form-field">
          <label>Username</label>
          <input
            name="username"
            className={invalidClass("username")}
            type="text"
            placeholder="Choose a username"
            required
            value={form.username}
            onChange={handleChange}
          />
          <FieldError name="username" />
        </div>

        <div className="form-field">
          <label>First Name</label>
          <input
            name="first_name"
            className={invalidClass("first_name")}
            type="text"
            placeholder="Enter your first name"
            required
            value={form.first_name}
            onChange={handleChange}
          />
          <FieldError name="first_name" />
        </div>

        <div className="form-field">
          <label>Last Name</label>
          <input
            name="last_name"
            className={invalidClass("last_name")}
            type="text"
            placeholder="Enter your last name"
            required
            value={form.last_name}
            onChange={handleChange}
          />
        </div>
        <FieldError name="last_name" />

        <div className="form-field">
          <label>Password</label>
          <input
            name="password"
            className={invalidClass("password")}
            type="password"
            placeholder="Create a password"
            required
            value={form.password}
            onChange={handleChange}
          />
          <FieldError name="password" />
        </div>

        <div className="form-field">
          <label>Confirm Password</label>
          <input
            name="confirm_password"
            className={invalidClass("confirm_password")}
            type="password"
            placeholder="Re-enter your password"
            required
            value={form.confirm_password}
            onChange={handleChange}
          />
          <FieldError name="confirm_password" />
        </div>

        <button type="submit" className="btn btn-primary w-full mt-1" disabled={loading}>
          {loading ? "Registering..." : "Register"}
        </button>
      </form>

      {globalError && (
        <div className="text-center mt-3 whitespace-pre-line" style={{ color: "var(--bc-danger, #ef4444)" }}>
          {globalError}
        </div>
      )}

      <p className="text-center mt-4 text-sm" style={{ color: "var(--bc-text-muted)" }}>
        Already have an account?{" "}
        <Link to="/login" className="underline" style={{ color: "var(--bc-primary)" }}>
          Log in
        </Link>
      </p>
    </section>
  );
}
