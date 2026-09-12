import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "/v1";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // Include cookies with every request
});

// Alias for backward compatibility
export const axiosInstance = apiClient;

export default apiClient;
