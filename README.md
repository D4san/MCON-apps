# Continuum Mechanics Hub (MCON)

[![Netlify Status](https://api.netlify.com/api/v1/badges/6997dd80613b23bd7c218d49/deploy-status)](https://app.netlify.com/sites/mcon-apps/deploys)
[![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/react-%2320232a.svg?style=flat&logo=react&logoColor=%2361DAFB)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

Un entorno interactivo para la enseñanza y aprendizaje de la **Mecánica de Medios Continuos**. Este proyecto agrupa una colección de simulaciones y visualizaciones diseñadas para intuir conceptos complejos como tensores de deformación, campos de velocidades y la hipótesis del continuo.

🔗 **Live Demo:** [https://mcon-apps.netlify.app](https://mcon-apps.netlify.app)

## 🚀 Aplicaciones Incluidas

Cada módulo está diseñado para abordar un tema fundamental del curso:

### 📦 Fundamentos

- **Discreto vs Continuo:** ¿A qué escala la materia se comporta como un continuo? Selecciona volúmenes de control y observa cómo la densidad converge al promedio global.
- **Camino Libre Medio:** Navega tu partícula a través de un gas ideal. Experimenta colisiones elásticas y mide empíricamente el camino libre medio $\lambda$.
- **Deducción de Menisco:** Derivación interactiva paso a paso de la ecuación del menisco capilar, visualizando el perfil y las fuerzas de tensión superficial.

### 📐 Cinemática y Deformación

- **Tensor de Deformaciones:** Define campos de desplazamiento $u(x,y,z)$ y visualiza en 3D la deformación de un cubo unitario. El sistema calcula automáticamente el tensor $\varepsilon$ con derivación simbólica.
- **Campo de Velocidades:** Visualiza líneas de corriente, trayectorias y líneas de traza simultáneamente. Define tu propio campo $\vec{v}(x,y,t)$ o explora presets clásicos.
- **Euler vs Lagrange:** Compara lado a lado las perspectivas Euleriana (campo fijo) y Lagrangiana (partícula marcada) con flujos canónicos y visualización de divergencia.

## 🛠️ Tecnologías

Este proyecto está construido con un stack moderno enfocado en **rendimiento** y **experiencia de usuario**:

- **[Vite](https://vitejs.dev/):** Build tool ultrarrápido.
- **[React](https://react.dev/):** Librería de UI para componentes interactivos.
- **[TypeScript](https://www.typescriptlang.org/):** Tipado estático para robustez en cálculos matemáticos.
- **[Tailwind CSS](https://tailwindcss.com/):** Estilizado utilitario para un diseño limpio y responsivo.
- **[Framer Motion](https://www.framer.com/motion/):** Animaciones fluidas para transiciones y micro-interacciones.
- **[KaTeX](https://katex.org/):** Renderizado rápido de ecuaciones matemáticas LaTeX.
- **[Math.js](https://mathjs.org/):** Procesamiento simbólico y numérico para las simulaciones.
- **[Three.js](https://threejs.org/):** Visualizaciones 3D (para el módulo de deformaciones).

## 💻 Desarrollo Local

Para correr este proyecto en tu máquina:

1. **Clonar el repositorio:**

   ```bash
   git clone https://github.com/D4san/MCON-apps.git
   cd MCON-apps
   ```

2. **Instalar dependencias:**

   ```bash
   npm install
   ```

3. **Iniciar servidor de desarrollo:**

   ```bash
   npm run dev
   ```

4. **Construir para producción:**
   ```bash
   npm run build
   ```

---

Desarrollado para el curso de Mecánica de Medios Continuos - Universidad de Antioquia.
