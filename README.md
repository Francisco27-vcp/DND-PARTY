# 🎲 Rakets Party — App de Campaña DnD

## Setup en 4 pasos

---

### PASO 1 — Crear proyecto Firebase (5 min)

1. Ir a **https://console.firebase.google.com**
2. Click **"Agregar proyecto"** → nombrar `rakets-party` → Continuar
3. Desactivar Google Analytics (opcional) → Crear proyecto
4. En el panel izquierdo: **Authentication** → Get started → **Email/Password** → Activar → Guardar
5. En el panel izquierdo: **Firestore Database** → Create database → **Start in test mode** → Elegir región (us-east1) → Enable
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
4. Click **Deploy** → esperar ~2 minutos
5. Vercel te da una URL tipo `https://dnd-party-app.vercel.app` ✅

---

### Compartir con la party

1. Mandar la URL por WhatsApp
2. Cada uno entra, hace click en **"¿Primera vez? Creá tu cuenta"**
3. Se registran con su email
4. Ya pueden ver las fichas y agregar notas

> **Importante:** Para que cada jugador pueda editar su personaje,
> el campo "Jugador" en la ficha debe coincidir con la primera parte
> de su email (antes del @). Ejemplo: si el email es `azrael@gmail.com`,
> el campo jugador debe decir `azrael`.

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
