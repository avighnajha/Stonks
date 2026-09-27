import axios from "axios";
export const API_BASE_URL = import.meta.env.VITE_API_URL || "";
const axiosInstance = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !error.config?.url?.match(/\/auth\/(login|register)$/)
    ) {
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      localStorage.removeItem("refreshToken");
      window.dispatchEvent(new Event("auth:unauthorized"));
    }
    return Promise.reject(error);
  },
);
export default axiosInstance;
