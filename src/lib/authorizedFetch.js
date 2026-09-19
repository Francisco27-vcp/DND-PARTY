import { auth } from './firebase';

export async function authorizedFetch(url, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Tenés que iniciar sesión.');
  const token = await user.getIdToken();
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}
