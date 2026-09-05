// Faculty/Trainer Portal module's axios instance: baseURL already includes
// "/api/v1" (its page components call short relative paths like
// "/faculty/batches"). Reads the same "accessToken" localStorage key the
// rest of the app uses, so a single login works across every portal.
import axios from "axios";

const ROOT = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const facultyClient = axios.create({
  baseURL: `${ROOT}/api/v1`,
});

facultyClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

facultyClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }
    return Promise.reject(error);
  }
);

export default facultyClient;
