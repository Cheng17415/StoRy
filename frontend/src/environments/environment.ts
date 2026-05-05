export const environment = {
  production: false,
  /**
   * Opcional: fuerza el Client ID de OAuth en el navegador sin llamar a /api/auth/google-config.
   * Normalmente basta con GOOGLE_CLIENT_ID en el backend (y .env al arrancar Spring).
   */
  googleClientId: '' as string,
};
