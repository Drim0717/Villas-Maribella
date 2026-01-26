# Configuración del Servidor de Correos (Resend)

Para que el sistema envíe correos electrónicos reales, necesitas activar el "Servidor Backend" que he preparado. Sigue estos pasos:

## 1. Instalar Node.js
Si no lo tienes, descarga e instala **Node.js**

## 2. Configurar la API Key
1. Entra a la carpeta `server`.
2. Crea un archivo nuevo llamado `.env`.
3. Abre el archivo `.env.example`, copia su contenido y pégalo en `.env`.
4. Reemplaza `re_123456789_your_api_key_here` por tu llave real de **Resend.com**.

## 3. Instalar Dependencias
Abre una terminal en la carpeta `server` y ejecuta:
`npm install`

## 4. Encender el Servidor
En la misma terminal, ejecuta:
`node server.js`

Verás un mensaje: `Server running at http://localhost:3000`.

---
**¡Listo!** Mientras esa ventana negra esté abierta, cualquier reserva que se haga en la página web enviará automáticamente un correo electrónico al cliente.
