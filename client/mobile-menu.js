// ============================================
// MOBILE MENU HANDLER - VILLAS MARIBELLA
// ============================================

document.addEventListener('DOMContentLoaded', function () {
    const hamburgerMenu = document.getElementById('hamburgerMenu');
    const navLinks = document.querySelector('.nav-links');
    const body = document.body;

    // Toggle menu on hamburger click
    hamburgerMenu.addEventListener('click', function () {
        const isOpen = navLinks.classList.contains('active');

        if (isOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    });

    // Close menu when clicking on a link
    const menuLinks = navLinks.querySelectorAll('a');
    menuLinks.forEach(link => {
        link.addEventListener('click', function () {
            closeMenu();
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', function (event) {
        const isClickInsideNav = navLinks.contains(event.target) || hamburgerMenu.contains(event.target);

        if (!isClickInsideNav && navLinks.classList.contains('active')) {
            closeMenu();
        }
    });

    function openMenu() {
        navLinks.classList.add('active');
        hamburgerMenu.classList.add('active');
        body.style.overflow = 'hidden'; // Prevent scrolling when menu is open
    }

    function closeMenu() {
        navLinks.classList.remove('active');
        hamburgerMenu.classList.remove('active');
        body.style.overflow = ''; // Restore scrolling
    }

    // Handle window resize - close menu if resizing to desktop
    let resizeTimer;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            if (window.innerWidth > 768 && navLinks.classList.contains('active')) {
                closeMenu();
            }
        }, 250);
    });
});
