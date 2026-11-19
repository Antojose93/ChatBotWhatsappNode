# Frontend

Panel web construido con Vue 3, TypeScript, Vite y Tailwind CSS. Su responsabilidad es presentar el estado de una sesión de WhatsApp y dirigir las acciones del usuario; la conexión real y el procesamiento del chatbot pertenecen al backend.

## Estructura

| Ruta | Responsabilidad |
|---|---|
| `src/main.ts` | Crea la aplicación e instala el router. |
| `src/router/` | Define las rutas del panel. `/` redirige a `/sessions`. |
| `src/services/api.ts` | Encapsula REST y Server-Sent Events (SSE). |
| `src/types/session.ts` | Tipos del modelo visual de sesión. |
| `src/views/SessionsView.vue` | Orquesta carga, filtros, modales y conexión QR. |
| `src/components/layout/` | Navegación lateral y elementos de menú. |
| `src/components/sessions/` | Lista, tarjeta, estado y filtros de sesiones. |
| `src/components/ui/` | Componentes visuales reutilizables. |

## Flujo de conexión

1. `SessionsView` solicita `POST /api/whatsapp/connect`.
2. Abre `GET /api/whatsapp/events` para recibir cambios de estado.
3. Convierte `qr.code` en una imagen en el navegador usando `qrcode`.
4. Cierra el `EventSource` al conectar, cerrar el modal o destruir la vista.
5. Recarga el estado REST para dejar la tarjeta sincronizada.

El stream SSE debe cerrarse cuando deja de ser necesario; de lo contrario, los reintentos del navegador pueden dejar listeners duplicados.

## Variables de entorno

Vite expone al cliente únicamente variables con prefijo `VITE_`:

```env
VITE_API_URL=http://localhost:5001
```

No coloques claves secretas en este archivo ni en variables `VITE_*`: terminan incluidas en el bundle del navegador.

## Comandos

```bash
npm run dev     # servidor de desarrollo
npm run build   # vue-tsc + compilación de producción
npm run preview # sirve el bundle localmente
```

`DashboardView.vue` y `SubscriptionView.vue` son vistas reservadas para futuras funcionalidades; por eso actualmente no muestran contenido.

## Personalidades

La vista de sesiones carga las personalidades desde `GET /api/personas` y
permite crear, editar, eliminar y activar perfiles mediante la API HTTP. El
selector y el botón `Apply` limpian el historial de conversaciones y afectan
los mensajes nuevos del chatbot. La personalidad activa no puede
eliminarse hasta activar otra.

La variable `VITE_API_URL` debe apuntar al backend, por ejemplo:

```env
VITE_API_URL=http://localhost:5001
```
