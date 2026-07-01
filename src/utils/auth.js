export const saveToken = (token) => localStorage.setItem('token', token);
export const getToken = () => localStorage.getItem('token');
export const removeToken = () => localStorage.removeItem('token');

export const getUser = () => {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Treat expired tokens as no session
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      removeToken();
      return null;
    }
    return payload;
  } catch {
    removeToken();
    return null;
  }
};

// Returns seconds until token expires, or 0 if already expired
export const tokenExpiresIn = () => {
  const token = getToken();
  if (!token) return 0;
  try {
    const { exp } = JSON.parse(atob(token.split('.')[1]));
    return Math.max(0, exp - Math.floor(Date.now() / 1000));
  } catch {
    return 0;
  }
};

export const isAuthenticated = () => !!getUser();
