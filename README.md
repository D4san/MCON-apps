# Continuum Mechanics Hub (MCON)

[![Netlify Status](https://img.shields.io/badge/Netlify-Deployed-success?style=flat&logo=netlify&logoColor=white)](https://mcon-apps.netlify.app)
[![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/react-%2320232a.svg?style=flat&logo=react&logoColor=%2361DAFB)](https://react.dev/)

**Live Demo: [https://mcon-apps.netlify.app](https://mcon-apps.netlify.app)**

Un entorno interactivo para la enseñanza y aprendizaje de la **Mecánica de Medios Continuos**, desarrollado bajo la filosofía de **vibe-coding**.

Este proyecto nació y ha ido evolucionando paralelamente al desarrollo del curso de Medios Continuos en la **Universidad de Antioquia (UdeA)**. La colección de aplicaciones irá creciendo semestre a semestre, integrando nuevas simulaciones y visualizaciones interactivas diseñadas para intuir conceptos complejos como tensores de deformación, campos de velocidades y la hipótesis del continuo.

---

## Aplicaciones Incluidas

Cada módulo está diseñado para abordar un tema fundamental del curso:

### Fundamentos

- **Discreto vs Continuo:** ¿A qué escala la materia se comporta como un continuo? Selecciona volúmenes de control y observa cómo la densidad converge al promedio global.
- **Camino Libre Medio:** Navega tu partícula a través de un gas ideal. Experimenta colisiones elásticas y mide empíricamente el camino libre medio $\lambda$.
- **Deducción de Menisco:** Derivación interactiva paso a paso de la ecuación del menisco capilar, visualizando el perfil y las fuerzas de tensión superficial.

### Cinemática y Deformación

- **Tensor de Deformaciones:** Define campos de desplazamiento $u(x,y,z)$ y visualiza en 3D la deformación de un cubo unitario. El sistema calcula automáticamente el tensor $\varepsilon$ con derivación simbólica.
- **Campo de Velocidades:** Visualiza líneas de corriente, trayectorias y líneas de traza simultáneamente. Define tu propio campo $\vec{v}(x,y,t)$ o explora presets clásicos.
- **Euler vs Lagrange:** Compara lado a lado las perspectivas Euleriana (campo fijo) y Lagrangiana (partícula marcada) con flujos canónicos y visualización de divergencia.

---

## Desarrollo Local

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

---

## Licencia

Este proyecto es de uso libre bajo la licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.

---

Desarrollado en el marco del curso de Mecánica de Medios Continuos - Universidad de Antioquia.
