const CONFIG = {
    // Si estamos en localhost, usa el servidor local.
    // Si estamos en producción (vercel, netlify), usa la URL de tu backend deployado.
    API_URL: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:3000'
        : 'https://villas-maribella-api.onrender.com' // <--- CAMBIA ESTO POR TU URL DE RENDER CUANDO DEPLOYES
};

export default CONFIG;
