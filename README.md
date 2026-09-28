# 🎲 Rakets Party — App de Campaña DnD

## Setup en 4 pasos

> Importante: este proyecto incluye reglas de seguridad para Firestore y Storage. No dejes Firebase en modo de prueba al publicar la aplicación.

### Seguridad y despliegue de Firebase

Desplegá las reglas e índices versionados junto con la aplicación:

```sh
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Los usuarios nuevos se crean con rol `Jugador`. Para designar un DM, cambiá el campo `role` de su documento `profiles/{uid}` desde Firebase Console o mediante un entorno administrativo confiable. La app no permite que un usuario se asigne privilegios a sí mismo.

La función `/api/chat` requiere `ANTHROPIC_API_KEY` y `FIREBASE_PROJECT_ID` como variables del servidor. `REACT_APP_FIREBASE_PROJECT_ID` se admite por compatibilidad, pero se recomienda configurar la variable de servidor explícitamente en Vercel. La IA paga queda desactivada por defecto y solo funciona si `ENABLE_PAID_AI=true`.

### App Check

1. Registrá la aplicación web en Firebase App Check con reCAPTCHA.
2. Agregá la clave pública como `REACT_APP_FIREBASE_APP_CHECK_SITE_KEY`.
3. Desplegá primero en modo monitoreo y verificá solicitudes legítimas.
4. Activá el cumplimiento obligatorio para Firestore y Storage recién después de esa verificación.

App Check reduce el abuso automatizado, pero no reemplaza las reglas de Firestore. Las notas privadas del DM se guardan en `dm_session_notes`, separadas de las sesiones visibles para la party.

Los mapas editables viven en `maps` y solo los puede leer el DM. La party consume copias filtradas desde `public_maps` y `live_sessions`; los tokens ocultos y otros campos privados no se envían a su navegador.

### Pruebas locales seguras

Las reglas pueden validarse sin credenciales ni conexión al proyecto real:

```powershell
npm run test:rules
```

El comando usa el proyecto ficticio `demo-dnd-app`, elimina credenciales del proceso y limita Firestore, Storage y Auth a `127.0.0.1`. Java y los binarios del emulador se guardan en `.tools`, fuera de Git. No uses `firebase init`, `firebase login` ni `firebase deploy` para esta prueba.

La validación completa local es:

```powershell
npm run test:unit
npm run test:rules
npm run build
```

---

### PASO 1 — Crear proyecto Firebase (5 min)

1. Ir a **https://console.firebase.google.com**
2. Click **"Agregar proyecto"** → nombrar `rakets-party` → Continuar
3. Desactivar Google Analytics (opcional) → Crear proyecto
4. En el panel izquierdo: **Authentication** → Get started → **Email/Password** → Activar → Guardar
5. En el panel izquierdo: **Firestore Database** → Create database → **Start in production mode** → Elegir región → Enable
6. Click en el ⚙️ arriba → **Project settings** → bajar hasta **"Your apps"** → click `</>` (Web)
7. Registrar la app con el nombre `rakets-party` → **Register app**
8. Copiar el objeto `firebaseConfig` que aparece (vas a necesitarlo en el siguiente paso)

---

### PASO 2 — Configurar el proyecto localmente

```bash
# 1. Clonar / crear carpeta
cd tu-carpeta-de-proyectos

# 2. Copiar el archivo de env
cp .env.local.example .env.local

# 3. Abrir .env.local y reemplazar los valores con los de tu firebaseConfig:
#    REACT_APP_FIREBASE_API_KEY=AIzaSy...
#    REACT_APP_FIREBASE_AUTH_DOMAIN=rakets-party.firebaseapp.com
#    REACT_APP_FIREBASE_PROJECT_ID=rakets-party
#    REACT_APP_FIREBASE_STORAGE_BUCKET=rakets-party.appspot.com
#    REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
#    REACT_APP_FIREBASE_APP_ID=1:123...

# 4. Instalar dependencias
npm install

# 5. Correr localmente para verificar
npm start
# Abre http://localhost:3000 — debería funcionar
```

---

### PASO 3 — Subir a GitHub

```bash
# 1. Crear repo nuevo en github.com (llamarlo "dnd-party-app", público o privado)

# 2. En la carpeta del proyecto:
git init
git add .
git commit -m "Initial commit — DnD Party App"
git remote add origin https://github.com/TU-USUARIO/dnd-party-app.git
git push -u origin main
```

---

### PASO 4 — Deploy en Vercel (2 min)

1. Ir a **https://vercel.com** (ya tenés cuenta)
2. Click **"Add New Project"** → importar el repo `dnd-party-app`
3. Antes de deployar, click **"Environment Variables"** y agregar cada variable:
   - `REACT_APP_FIREBASE_API_KEY` → tu valor
   - `REACT_APP_FIREBASE_AUTH_DOMAIN` → tu valor
   - `REACT_APP_FIREBASE_PROJECT_ID` → tu valor
   - `REACT_APP_FIREBASE_STORAGE_BUCKET` → tu valor
   - `REACT_APP_FIREBASE_MESSAGING_SENDER_ID` → tu valor
   - `REACT_APP_FIREBASE_APP_ID` → tu valor
   - `REACT_APP_FIREBASE_APP_CHECK_SITE_KEY` → clave pública de App Check
   - `ENABLE_PAID_AI` → `false` para evitar consumos de IA
4. Click **Deploy** → esperar ~2 minutos
5. Vercel te da una URL tipo `https://dnd-party-app.vercel.app` ✅

---

### Compartir con la party

1. Mandar la URL por WhatsApp
2. Cada uno entra, hace click en **"¿Primera vez? Creá tu cuenta"**
3. Se registran con su email
4. Ya pueden ver las fichas y agregar notas

> **Importante:** Para que cada jugador pueda editar su personaje,
> el campo de propietario debe contener el email completo de su cuenta.

### Mesa en vivo y proyector

El DM puede abrir **Panel del DM → Mesa en vivo**, elegir un mapa y comenzar la transmisión. La vista `/proyector` requiere un usuario autenticado y refleja en tiempo real:

- escena y mensaje activos;
- niebla de guerra;
- tokens visibles para la party;
- ronda, iniciativa y acciones compartidas durante el combate.

Mover un token persiste la posición al soltarlo. La niebla por celdas guarda únicamente las celdas modificadas para evitar escrituras de alta frecuencia.

---

## Estructura del proyecto

```
src/
├── lib/
│   └── firebase.js          # Configuración Firebase
├── pages/
│   ├── Login.js             # Pantalla de login / registro
│   ├── Home.js              # Vista de todos los personajes
│   ├── CharacterSheet.js    # Ficha individual editable
│   ├── Campaign.js          # Registro de sesiones
│   ├── Timeline.js          # Historia / lore de la campaña
│   └── Notes.js             # Chat de la party en tiempo real
├── components/
│   └── Nav.js               # Navegación (desktop + mobile)
├── App.js                   # Rutas y auth
└── index.css                # Variables globales y estilos base
```

## Funcionalidades

- ✅ Login por email para cada miembro de la party
- ✅ Vista de todos los personajes con HP, XP y stats
- ✅ Fichas individuales editables (solo el dueño puede editar la suya)
- ✅ Registro de sesiones con resumen y XP ganada
- ✅ Línea de tiempo del lore (eventos, combates, lugares, PNJs)
- ✅ Chat de notas en tiempo real para toda la party
- ✅ Diseño mobile-first, funciona perfecto en el celular

## Actualizaciones futuras sugeridas

- Agregar nuevos personajes desde la UI
- Tracker de iniciativa para combates
- Mapa interactivo de la campaña
- Inventario compartido del grupo
