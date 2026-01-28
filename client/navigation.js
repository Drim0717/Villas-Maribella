/**
 * Navegación y Menú Móvil - Villas Maribella
 * Maneja el cierre automático del menú de Bootstrap al hacer clic fuera o en enlaces.
 */

document.addEventListener('DOMContentLoaded', function () {
    const navbarCollapse = document.getElementById('navbarNav');
    const navbarToggler = document.querySelector('.navbar-toggler');

    // Si no existe el menú de navegación, salimos
    if (!navbarCollapse || !navbarToggler) return;

    // Instancia de Bootstrap Collapse
    const bsCollapse = new bootstrap.Collapse(navbarCollapse, {
        toggle: false
    });

    // 1. Cerrar al hacer clic en un enlace (para navegación interna)
    const navLinks = navbarCollapse.querySelectorAll('.nav-link, .btn-reserve');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (navbarCollapse.classList.contains('show')) {
                bsCollapse.hide();
            }
        });
    });

    // 2. Cerrar al hacer clic fuera del menú
    document.addEventListener('click', function (event) {
        const isClickInside = navbarCollapse.contains(event.target) || navbarToggler.contains(event.target);
        const isMenuOpen = navbarCollapse.classList.contains('show');

        if (!isClickInside && isMenuOpen) {
            bsCollapse.hide();
        }
    });
});
