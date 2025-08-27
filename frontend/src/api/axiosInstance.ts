// src/api/axiosInstance.ts
import axios from 'axios';

// This is the public URL of your API Gateway from your Codespace Ports tab
const API_BASE_URL = 'https://fantastic-halibut-jw46rr477wphpq4q-8080.app.github.dev';

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
});

export default axiosInstance;