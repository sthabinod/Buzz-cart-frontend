import axios from "axios";
import api, { tokenStore } from "../apiClient";

const API_BASE = (process.env.REACT_APP_API_BASE || "").replace(/\/+$/, "");

export async function login({ username, password }) {
  const res = await axios.post(
    `${API_BASE}/api/auths/token/`,
    { username, password },
    { headers: { "Content-Type": "application/json", Accept: "application/json" } }
  );
  const { access, refresh } = res.data || {};
  tokenStore.access = access;
  tokenStore.refresh = refresh;

  // (Optional) Decode access for claims like tenant_id, username
  let claims = null;
  try {
    const [, payload] = access.split(".");
    claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {}
  return { access, refresh, claims };
}

export function logout() {
  tokenStore.clear();
}

export async function getMyProfile() {
  // Adjust to your actual profile endpoint
  const res = await api.get(`/api/users/me/`);
  return res.data;
}
