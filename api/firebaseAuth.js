const crypto = require('crypto');

const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certCache = { values: null, expiresAt: 0 };

function decodePart(part) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

async function getCertificates() {
  if (certCache.values && certCache.expiresAt > Date.now()) return certCache.values;
  const response = await fetch(CERTS_URL, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('No se pudieron cargar los certificados de Firebase.');
  const values = await response.json();
  const maxAge = /max-age=(\d+)/i.exec(response.headers.get('cache-control') || '');
  certCache = {
    values,
    expiresAt: Date.now() + (Number(maxAge?.[1] || 300) * 1000),
  };
  return values;
}

async function verifyFirebaseToken(token, projectId) {
  if (typeof token !== 'string' || token.length > 10000) throw new Error('Token inválido.');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Token inválido.');

  const header = decodePart(parts[0]);
  const payload = decodePart(parts[1]);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Firma de token inválida.');

  const certificates = await getCertificates();
  const certificate = certificates[header.kid];
  if (!certificate) throw new Error('Certificado de token desconocido.');

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  if (!verifier.verify(certificate, Buffer.from(parts[2], 'base64url'))) {
    throw new Error('Firma de token inválida.');
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId) throw new Error('Audiencia de token inválida.');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Emisor de token inválido.');
  if (!payload.sub || payload.sub.length > 128) throw new Error('Usuario de token inválido.');
  if (!payload.exp || payload.exp <= now) throw new Error('Token vencido.');
  if (!payload.iat || payload.iat > now + 300) throw new Error('Fecha de token inválida.');
  return payload;
}

async function getUserRole(projectId, uid, token) {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}`
    + `/databases/(default)/documents/profiles/${encodeURIComponent(uid)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) return null;
  const profile = await response.json();
  return profile.fields?.role?.stringValue || null;
}

async function requireDM(req) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.REACT_APP_FIREBASE_PROJECT_ID;
  if (!projectId) {
    const error = new Error('FIREBASE_PROJECT_ID no está configurado en el servidor.');
    error.status = 500;
    throw error;
  }

  const authorization = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match) {
    const error = new Error('Autenticación requerida.');
    error.status = 401;
    throw error;
  }

  try {
    const payload = await verifyFirebaseToken(match[1], projectId);
    const role = await getUserRole(projectId, payload.sub, match[1]);
    if (!['Dungeon Master', 'Jugador / DM'].includes(role)) {
      const error = new Error('Se requiere rol de Dungeon Master.');
      error.status = 403;
      throw error;
    }
    return { uid: payload.sub, email: payload.email || '', role };
  } catch (error) {
    if (error.status) throw error;
    const authError = new Error('Token de autenticación inválido.');
    authError.status = 401;
    throw authError;
  }
}

module.exports = { requireDM, verifyFirebaseToken };
