import axios from "axios";

const API_BASE = (process.env.REACT_APP_API_BASE || "").replace(/\/+$/, "");

let isRefreshing = false;
let refreshPromise = null;
const subscribers = [];

function onRefreshed(newAccess) {
  subscribers.forEach((cb) => cb(newAccess));
  subscribers.length = 0;
}
function addSubscriber(cb) {
  subscribers.push(cb);
}

// Simple localStorage token store
export const tokenStore = {
  get access() {
    return localStorage.getItem("access");
  },
  set access(v) {
    if (v) localStorage.setItem("access", v);
    else localStorage.removeItem("access");
  },
  get refresh() {
    return localStorage.getItem("refresh");
  },
  set refresh(v) {
    if (v) localStorage.setItem("refresh", v);
    else localStorage.removeItem("refresh");
  },
  clear() {
    this.access = null;
    this.refresh = null;
  },
};

const api = axios.create({
  baseURL: API_BASE,
  headers: { Accept: "application/json" },
});

// Attach Authorization header
api.interceptors.request.use((config) => {
  const token = tokenStore.access;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto refresh on 401 and retry original request
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config || {};
    const status = error?.response?.status;

    if (status === 401 && !original.__isRetryRequest) {
      const refresh = tokenStore.refresh;
      if (!refresh) {
        tokenStore.clear();
        return Promise.reject(error);
      }

      if (!isRefreshing) {
        isRefreshing = true;
        original.__isRetryRequest = true;

        refreshPromise = axios
          .post(`${API_BASE}/api/auths/token/refresh/`, { refresh }, { headers: { "Content-Type": "application/json" } })
          .then((r) => {
            const newAccess = r.data?.access;
            if (!newAccess) throw new Error("No access token in refresh response");
            tokenStore.access = newAccess;
            onRefreshed(newAccess);
            return newAccess;
          })
          .catch((e) => {
            tokenStore.clear();
            throw e;
          })
          .finally(() => {
            isRefreshing = false;
            refreshPromise = null;
          });
      }

      // Queue until refresh finishes
      return new Promise((resolve, reject) => {
        addSubscriber((newAccess) => {
          original.headers = { ...(original.headers || {}), Authorization: `Bearer ${newAccess}` };
          resolve(api(original));
        });
        if (refreshPromise) refreshPromise.catch(reject);
      });
    }

    return Promise.reject(error);
  }
);

export default api;
