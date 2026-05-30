// Instance Axios centrale — gestion automatique du JWT et du refresh
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../utils/constants';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Injecter le JWT dans chaque requête
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Sur 401 : tenter le refresh, sinon vider la session
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = await SecureStore.getItemAsync('refresh_token');
        if (!refreshToken) throw new Error('no_refresh');

        const { data } = await axios.post(`${API_BASE_URL}/api/auth/refresh`, null, {
          headers: { 'Refresh-Token': refreshToken },
        });

        await SecureStore.setItemAsync('jwt_token', data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        await SecureStore.deleteItemAsync('jwt_token');
        await SecureStore.deleteItemAsync('refresh_token');
      }
    }

    return Promise.reject(error);
  }
);
