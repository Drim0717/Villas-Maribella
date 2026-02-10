// ============================================
// HERO SLIDESHOW - VILLAS MARIBELLA
// ============================================

// Array de imágenes para el slideshow
const heroImages = [
    '../images/Principal/villa_hero.jpg',
    '../images/Principal/piscina_dia.jpg',
    '../images/Principal/piscina_noche.png',
    '../images/Principal/sala.jpg'
];

let currentImageIndex = 0;

// Función para cambiar la imagen de fondo con efecto fade
function changeHeroBackground() {
    const heroSection = document.querySelector('.hero');

    if (heroSection) {
        // Crear elemento temporal para precargar la siguiente imagen
        const nextIndex = (currentImageIndex + 1) % heroImages.length;
        const img = new Image();
        img.src = heroImages[nextIndex];

        img.onload = function () {
            // Aplicar efecto de fade out
            heroSection.style.opacity = '0.7';

            setTimeout(() => {
                // Cambiar imagen
                currentImageIndex = nextIndex;
                heroSection.style.backgroundImage = `linear-gradient(100deg, rgba(0, 180, 216, 0.4) 0%, rgba(0, 119, 182, 0.3) 100%), url('${heroImages[currentImageIndex]}')`;

                // Aplicar efecto de fade in
                heroSection.style.opacity = '1';
            }, 300);
        };
    }
}

// Iniciar el slideshow cuando la página cargue
document.addEventListener('DOMContentLoaded', function () {
    const heroSection = document.querySelector('.hero');
    if (heroSection) {
        // Agregar transición suave de opacidad
        heroSection.style.transition = 'opacity 0.6s ease-in-out';
    }

    // Cambiar imagen cada 3 segundos (3000 milisegundos)
    setInterval(changeHeroBackground, 3000);
});
