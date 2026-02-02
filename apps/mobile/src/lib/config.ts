/**
 * App config. Uses react-native-config when linked (native build),
 * otherwise falls back to default API URL.
 */
let API_URL = 'https://api-859348256463.asia-south1.run.app';
try {
  const Config = require('react-native-config').default;
  if (Config?.API_URL) {
    API_URL = String(Config.API_URL).replace(/\/$/, '');
  }
} catch {
  // react-native-config not linked; use default
}
if (process.env?.API_URL) {
  API_URL = String(process.env.API_URL).replace(/\/$/, '');
}

export { API_URL };
