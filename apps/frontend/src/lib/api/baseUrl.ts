// One build-time API setting for auth, Axios and the push worker.
// Vite development retains the existing separate local API default.
export const apiBaseUrl = (import.meta.env?.VITE_API_URL
  || (import.meta.env?.PROD ? "/api" : "http://localhost:3001/api")).replace(/\/$/, "");
