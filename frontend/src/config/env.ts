import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getExpoHostIp = () => {
  const hostUri = Constants.expoConfig?.hostUri || '';
  if (!hostUri) return null;

  const [host] = hostUri.split(':');
  if (!host || host === 'localhost' || host === '127.0.0.1') {
    return null;
  }

  return host;
};

const getDefaultBackendUrl = () => {
  const hostIp = getExpoHostIp();

  if (Platform.OS === 'android' && !hostIp) {
    return 'http://10.0.2.2:8001';
  }

  if (hostIp) {
    return `http://${hostIp}:8001`;
  }

  return 'http://localhost:8001';
};

export const ENV = {
  backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL || getDefaultBackendUrl(),
  googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  appEnv: process.env.EXPO_PUBLIC_APP_ENV || 'development',
};

export const getApiUrl = () => ENV.backendUrl;
