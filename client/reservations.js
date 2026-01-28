// ============================================
// SISTEMA DE RESERVAS - VILLAS MARIBELLA
// ============================================

const VILLA_CONFIG = {
    '1A': { price: 55, maxGuests: 2, name: 'Villa #1A' },
    '2B': { price: 55, maxGuests: 2, name: 'Villa #2B' },
    '3C': { price: 55, maxGuests: 2, name: 'Villa #3C' },
    '4D': { price: 85, maxGuests: 4, name: 'Villa #4D' },
    '5E': { price: 85, maxGuests: 4, name: 'Villa #5E' },
    '6F': { price: 85, maxGuests: 4, name: 'Villa #6F' }
};

let currentVillaId = '1A';
let numGuests = 2; // Initial state
let selectedCheckIn = null;
let selectedCheckOut = null;
let currentMonth = new Date();

// Reservas existentes (simuladas + Firestore)
let dbReservations = []; // Global state for Firestore reservations
const existingReservations = [
    { checkIn: new Date(2025, 0, 10), checkOut: new Date(2025, 0, 15) },
    { checkIn: new Date(2025, 0, 22), checkOut: new Date(2025, 0, 25) },
    { checkIn: new Date(2025, 1, 5), checkOut: new Date(2025, 1, 8) },
];

// Inicializar calendario cuando se carga la página
document.addEventListener('DOMContentLoaded', async function () {
    await loadReservationsData();
    renderCalendar();
    updatePrice();

    // Event listeners para navegación del calendario
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentMonth.setMonth(currentMonth.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('nextMonth').addEventListener('click', () => {
        currentMonth.setMonth(currentMonth.getMonth() + 1);
        renderCalendar();
    });

    // Event listener para número de personas
    document.getElementById('numGuests').addEventListener('input', updatePrice);

    // Event listener para el formulario
    document.getElementById('reservationForm').addEventListener('submit', handleReservation);

    // Initial capacity setup
    updateCapacityLabel();
});

// Contador de huéspedes
function changeGuests(delta) {
    const config = VILLA_CONFIG[currentVillaId];
    const newCount = numGuests + delta;

    if (newCount >= 1 && newCount <= config.maxGuests) {
        numGuests = newCount;
        updateGuestUI();
        updatePrice();
    }
}

function updateGuestUI() {
    const guestCountDisplay = document.getElementById('guestCountDisplay');
    if (guestCountDisplay) {
        guestCountDisplay.innerText = `${numGuests} ${numGuests === 1 ? 'Persona' : 'Personas'}`;
    }
}

function updateCapacityLabel() {
    const label = document.getElementById('maxCapacityLabel');
    if (label) {
        label.innerText = `Capacidad máxima para Villa #${currentVillaId}: ${VILLA_CONFIG[currentVillaId].maxGuests} personas`;
    }
}

async function loadReservationsData() {
    try {
        const snapshot = await getDocs(collection(db, "reservations"));
        dbReservations = [];
        snapshot.forEach(doc => {
            dbReservations.push(doc.data());
        });
        console.log("Reservas cargadas:", dbReservations.length);
        renderCalendar(); // Re-render when data arrives
    } catch (error) {
        console.error("Error cargando reservas:", error);
    }
}

// Renderizar calendario
function renderCalendar() {
    const calendar = document.getElementById('calendar');
    const monthYear = document.getElementById('monthYear');

    // Obtener primer y último día del mes
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    // Actualizar título del mes
    monthYear.textContent = firstDay.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

    // Limpiar calendario
    calendar.innerHTML = '';

    // Agregar encabezados de días
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    dayNames.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day-header';
        dayHeader.textContent = day;
        calendar.appendChild(dayHeader);
    });

    // Agregar días vacíos al inicio
    const startDayOfWeek = firstDay.getDay();
    for (let i = 0; i < startDayOfWeek; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day empty';
        calendar.appendChild(emptyDay);
    }

    // Agregar días del mes
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const dayDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = day;

        // Marcar días pasados
        if (dayDate < new Date().setHours(0, 0, 0, 0)) {
            dayElement.classList.add('past');
        } else {
            // Verificar si está reservado
            if (isReserved(dayDate)) {
                dayElement.classList.add('reserved');
            } else {
                // Marcar si está seleccionado
                if (isSelected(dayDate)) {
                    dayElement.classList.add('selected');
                }

                // Marcar rango seleccionado
                if (isInRange(dayDate)) {
                    dayElement.classList.add('in-range');
                }

                // Agregar evento de click
                dayElement.addEventListener('click', () => selectDate(dayDate));
            }
        }

        calendar.appendChild(dayElement);
    }
}

// Verificar si una fecha está reservada para una villa específica
function isReserved(date, villaId) {
    // Si no se especifica villa, usar la villa actualmente seleccionada
    const checkVilla = villaId || currentVillaId;
    // Format checking date to YYYY-MM-DD to match storage format and avoid timezone issues
    const dateStr = formatDate(date);

    // Check existing reservations (simulated)
    const isExistingReserved = existingReservations.some(reservation => {
        const matchesVilla = !reservation.villaNumber || reservation.villaNumber == checkVilla;
        // Convert existing Date objects to strings for consistent comparison
        const checkInStr = formatDate(reservation.checkIn);
        const checkOutStr = formatDate(reservation.checkOut);
        return matchesVilla && dateStr >= checkInStr && dateStr < checkOutStr; // Exclusive checkout
    });

    // Check Firestore reservations for this villa
    // Uses the global dbReservations array which is loaded asynchronously
    const isSavedReserved = dbReservations.some(reservation => {
        // reservation.checkIn is already "YYYY-MM-DD" string
        // Note: Logic handles both alphanumeric IDs like "1A" and legacy numbers
        const matchesVilla = reservation.villaNumber == checkVilla ||
            (reservation.villaNumber == parseInt(checkVilla) && checkVilla.length === 1);
        // Compare strings: "2026-01-19" (date) >= "2026-01-19" (checkIn) -> True
        // AND "2026-01-19" (date) < "2026-01-21" (checkOut) -> True
        return matchesVilla && dateStr >= reservation.checkIn && dateStr < reservation.checkOut;
    });

    // Check blocked dates para esta villa (o bloques globales sin villa específica)
    const blockedDates = getBlockedDatesFromStorage();
    const isBlocked = blockedDates.some(block => {
        // block.startDate might be YYYY-MM-DD string from input type="date"
        const matchesVilla = !block.villaNumber || block.villaNumber == checkVilla;
        return matchesVilla && dateStr >= block.startDate && dateStr <= block.endDate; // Blocked is inclusive usually
    });

    return isExistingReserved || isSavedReserved || isBlocked;
}

// Verificar si una fecha está seleccionada
function isSelected(date) {
    if (!selectedCheckIn && !selectedCheckOut) return false;
    const dateStr = date.toDateString();
    return (selectedCheckIn && dateStr === selectedCheckIn.toDateString()) ||
        (selectedCheckOut && dateStr === selectedCheckOut.toDateString());
}

// Verificar si una fecha está en el rango seleccionado
function isInRange(date) {
    if (!selectedCheckIn || !selectedCheckOut) return false;
    return date > selectedCheckIn && date < selectedCheckOut;
}

// Seleccionar fecha
function selectDate(date) {
    if (!selectedCheckIn || (selectedCheckIn && selectedCheckOut)) {
        // Primera selección o reiniciar
        selectedCheckIn = date;
        selectedCheckOut = null;
        document.getElementById('checkIn').value = formatDate(date);
        document.getElementById('checkOut').value = '';
    } else if (date > selectedCheckIn) {
        // Segunda selección (check-out)
        selectedCheckOut = date;
        document.getElementById('checkOut').value = formatDate(date);
    } else {
        // Si selecciona una fecha anterior, reiniciar
        selectedCheckIn = date;
        selectedCheckOut = null;
        document.getElementById('checkIn').value = formatDate(date);
        document.getElementById('checkOut').value = '';
    }

    renderCalendar();
    updatePrice();
}

// Formatear fecha para input
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Actualizar cálculo de precio
function updatePrice() {
    const priceDisplay = document.getElementById('totalPrice');
    const nightsDisplay = document.getElementById('numNights');
    const priceDetail = document.getElementById('priceDetail');
    const config = VILLA_CONFIG[currentVillaId];

    if (!priceDisplay || !nightsDisplay) return;

    if (!selectedCheckIn || !selectedCheckOut) {
        priceDisplay.textContent = '$0.00';
        nightsDisplay.textContent = '0';
        if (priceDetail) priceDetail.textContent = `$${config.price} x 0`;
        return;
    }

    // Calcular número de noches
    const nights = Math.ceil((selectedCheckOut - selectedCheckIn) / (1000 * 60 * 60 * 24));
    const total = nights * config.price;

    nightsDisplay.textContent = nights;
    priceDisplay.textContent = `$${total.toFixed(2)}`;

    if (priceDetail) {
        priceDetail.textContent = `$${config.price} x ${nights}`;
    }
}

// Manejar reserva
function handleReservation(e) {
    e.preventDefault();

    if (!selectedCheckIn || !selectedCheckOut) {
        alert('Por favor selecciona las fechas de tu estadía');
        return;
    }

    const villaSelect = document.getElementById('villaSelect');
    const selectedVilla = villaSelect ? villaSelect.value : '';

    if (!selectedVilla) {
        alert('Por favor selecciona una villa');
        return;
    }

    const guestsValue = parseInt(document.getElementById('numGuests').value);
    if (guestsValue > VILLA_CONFIG[selectedVilla].maxGuests) {
        alert(`El máximo de personas permitidas para Villa #${selectedVilla} es ${VILLA_CONFIG[selectedVilla].maxGuests}.`);
        return;
    }

    const guestName = document.getElementById('guestName').value;
    const guestEmail = document.getElementById('guestEmail').value;
    const numGuests = document.getElementById('numGuests').value;
    const nights = Math.ceil((selectedCheckOut - selectedCheckIn) / (1000 * 60 * 60 * 24));
    const total = nights * VILLA_CONFIG[selectedVilla].price;

    // Mostrar modal de pago
    showPaymentModal(guestName, total, nights, selectedVilla);
}

// Mostrar modal de pago
function showPaymentModal(guestName, total, nights, selectedVilla) {
    const modal = document.getElementById('paymentModal');
    const modalContent = document.getElementById('modalContent');

    modalContent.innerHTML = `
        <h3>Confirmar Reserva</h3>
        <div class="reservation-summary">
            <p><strong>Huésped:</strong> ${guestName}</p>
            <p><strong>Villa:</strong> Villa #${selectedVilla}</p>
            <p><strong>Check-in:</strong> ${selectedCheckIn.toLocaleDateString('es-ES')}</p>
            <p><strong>Check-out:</strong> ${selectedCheckOut.toLocaleDateString('es-ES')}</p>
            <p><strong>Noches:</strong> ${nights}</p>
            <p><strong>Total:</strong> $${total.toFixed(2)} USD</p>
        </div>
        
        <div class="payment-methods">
            <h4>Método de Pago</h4>
            <button class="payment-btn" onclick="processPayment('card')">
                💳 Tarjeta de Crédito/Débito
            </button>
            <button class="payment-btn" onclick="processPayment('paypal')">
                <span style="color: #003087;">Pay</span><span style="color: #009cde;">Pal</span>
            </button>
            <button class="payment-btn" onclick="processPayment('transfer')">
                🏦 Transferencia Bancaria
            </button>
        </div>
        
        <button class="cancel-btn" onclick="closePaymentModal()">Cancelar</button>
    `;

    modal.style.display = 'flex';
}

function processPayment(method) {
    if (method === 'transfer') {
        showTransferDetails();
        return;
    }
    executePayment(method);
}

function showTransferDetails() {
    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = `
        <h3>Datos para Transferencia</h3>
        <div class="transfer-details" style="background-color: #f8f9fa; padding: 1.5rem; border-radius: 8px; margin: 1.5rem 0; text-align: left;">
            <p style="margin-bottom: 0.5rem;"><strong>Banco:</strong> Banco XXX</p>
            <p style="margin-bottom: 0.5rem;"><strong>Número de Cuenta:</strong> XXX-XXX-XXX</p>
            <p style="margin-bottom: 0.5rem;"><strong>Identificación:</strong> XXX-XXX-XXX</p>
            <p style="margin-bottom: 0;"><strong>Beneficiario:</strong> Vincenzo Pampillonia</p>
        </div>
        <p style="margin-bottom: 1.5rem; font-size: 0.9rem; color: #666;">
            Por favor realiza la transferencia por el monto total y conserva tu comprobante.
        </p>
        <button class="confirm-btn" onclick="executePayment('transfer')">
            Confirmar Transferencia
        </button>
        <button class="cancel-btn" onclick="closePaymentModal()" style="margin-top: 10px;">
            Cancelar
        </button>
    `;
}

// Procesar pago (simulado)
// Procesar pago (simulado)
async function executePayment(method) {
    console.log("Iniciando procesamiento de pago...", method);

    // Validar fechas antes de continuar
    if (!selectedCheckIn || !selectedCheckOut) {
        alert("Error de fechas. Por favor recarga la página.");
        closePaymentModal();
        return;
    }

    const villaSelect = document.getElementById('villaSelect');
    const selectedVilla = villaSelect ? villaSelect.value : '1'; // Default to '1' if not found

    const nights = Math.ceil((selectedCheckOut - selectedCheckIn) / (1000 * 60 * 60 * 24));
    const total = nights * VILLA_CONFIG[selectedVilla].price;

    // Obtener valores con fallbacks seguros para evitar 'undefined' en Firestore
    const guestNameInput = document.getElementById('guestName');
    const guestEmailInput = document.getElementById('guestEmail');
    const numGuestsInput = document.getElementById('numGuests');


    const guestName = guestNameInput ? guestNameInput.value : 'Anónimo';
    const guestEmail = guestEmailInput ? guestEmailInput.value : 'no-email@test.com';
    const numGuests = numGuestsInput ? (parseInt(numGuestsInput.value) || 1) : 1;


    const confirmationCode = 'VM-' + Math.floor(Math.random() * 100000);

    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = `
        <div class="payment-processing">
            <div class="spinner"></div>
            <h3>Procesando pago...</h3>
            <p>Conectando con el servidor...</p>
        </div>
    `;

    try {
        console.log("Enviando datos a Firestore...");

        // Determinar estado según el método de pago
        const reservationStatus = method === 'transfer' ? 'pending' : 'confirmed';

        // Construir objeto de reserva limpio
        const reservationData = {
            id: confirmationCode,
            guestName: guestName,
            guestEmail: guestEmail,
            villaNumber: selectedVilla,
            checkIn: formatDate(selectedCheckIn),
            checkOut: formatDate(selectedCheckOut),
            numGuests: numGuests,
            total: total,
            status: reservationStatus, // Estado dinámico
            paymentMethod: method,
            createdAt: new Date().toISOString()
        };

        console.log("Datos a guardar:", reservationData);

        await saveReservationToStorage(reservationData);

        console.log("Guardado exitoso!");

        // Intentar enviar correo (backend local)
        fetch('http://localhost:3000/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                guestName,
                guestEmail,
                reservationId: confirmationCode,
                checkIn: selectedCheckIn.toLocaleDateString('es-ES'),
                checkOut: selectedCheckOut.toLocaleDateString('es-ES'),
                total: total.toFixed(2),
                villaNumber: selectedVilla
            })
        }).catch(err => console.log("Servidor de correos no detectado (Localhost:3000)"));

        // Mensaje personalizado según el estado
        const title = method === 'transfer' ? '¡Reserva Pendiente!' : '¡Reserva Confirmada!';
        const message = method === 'transfer'
            ? 'Tu reserva está pendiente de validación del pago.'
            : 'Tu reserva ha sido procesada exitosamente.';
        const icon = method === 'transfer' ? '⏳' : '✓';

        modalContent.innerHTML = `
            <div class="payment-success">
                <div class="success-icon">${icon}</div>
                <h2>${title}</h2>
                <p>${message}</p>
                <div class="confirmation-details">
                    <p><strong>Código:</strong> ${confirmationCode}</p>
                    <p><strong>Método:</strong> ${method === 'transfer' ? 'Transferencia' : 'Tarjeta/PayPal'}</p>
                    <p><strong>Estado:</strong> ${method === 'transfer' ? 'Pendiente de Validación' : 'Confirmada'}</p>
                    <p><strong>Total:</strong> $${total.toFixed(2)} USD</p>
                </div>
                <p class="email-notice">📧 Hemos enviado un correo con los detalles</p>
                <button class="confirm-btn" onclick="closePaymentModal(); resetForm();">Aceptar</button>
            </div>
        `;
    } catch (error) {
        console.error("Error CRÍTICO en executePayment:", error);
        modalContent.innerHTML = `
            <div class="payment-error">
                <h3>Error de Conexión</h3>
                <p>Hubo un problema guardando la reserva: ${error.message}</p>
                <button class="cancel-btn" onclick="closePaymentModal()">Cerrar</button>
            </div>
        `;
    }
}

// Cerrar modal
function closePaymentModal() {
    document.getElementById('paymentModal').style.display = 'none';
}

// Resetear formulario
function resetForm() {
    selectedCheckIn = null;
    selectedCheckOut = null;
    document.getElementById('reservationForm').reset();
    renderCalendar();
    updatePrice();
}

// ============================================
// FIREBASE IMPORTS
// ============================================
import { db } from './firebase-config.js';
import { collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================
// DATA LOADING
// ============================================
async function getReservationsFromStorage() {
    // For now we return empty array or fetch simple snapshot for checking availability locally
    // Ideally availability check should be a server query or listener
    // To keep it simple for this step, we will fetch once on load
    try {
        const querySnapshot = await getDocs(collection(db, "reservations"));
        const reservations = [];
        querySnapshot.forEach((doc) => {
            reservations.push(doc.data());
        });
        return reservations;
    } catch (e) {
        console.error("Error fetching reservations: ", e);
        return [];
    }
}

async function saveReservationToStorage(reservation) {
    try {
        // Intentar guardar en Firestore con un timeout de 5 segundos
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Firestore timeout")), 5000)
        );

        const firestorePromise = addDoc(collection(db, "reservations"), reservation);

        const docRef = await Promise.race([firestorePromise, timeoutPromise]);
        console.log("Document written with ID: ", docRef.id);
        return true;
    } catch (e) {
        console.warn("Error o timeout en Firestore, guardando localmente:", e);

        // Fallback: Guardar en localStorage
        try {
            const localReservations = JSON.parse(localStorage.getItem('villasReservationsBackup') || '[]');
            // Asegurar que tenga un ID (usamos el mismo código de confirmación si existe, o generamos uno)
            if (!reservation.firestoreId) {
                reservation.firestoreId = 'local_' + Date.now();
            }
            localReservations.push(reservation);
            localStorage.setItem('villasReservationsBackup', JSON.stringify(localReservations));
            console.log("Reserva guardada localmente (Backup)");
            return true;
        } catch (localError) {
            console.error("Error fatal: No se pudo guardar ni en Firestore ni localmente", localError);
            alert("Error al guardar la reserva. Por favor intenta de nuevo.");
            throw localError;
        }
    }
}

function getBlockedDatesFromStorage() {
    // Similar migration would be needed for blocked dates if we want them in firebase too
    // returning empty for now to avoid breaking or need to migrate that too right now
    const data = localStorage.getItem('villasBlockedDates');
    return data ? JSON.parse(data) : [];
}

// ============================================
// VILLA GALLERY FUNCTIONALITY
// ============================================

// Villa images mapping
const villaImages = {
    '1A': ['../images/sala.jpg', '../images/cocina.jpg', '../images/bano.jpg'],
    '2B': ['../images/cocina.jpg', '../images/sala.jpg', '../images/bano.jpg'],
    '3C': ['../images/bano.jpg', '../images/sala.jpg', '../images/cocina.jpg'],
    '4D': ['../images/sala.jpg', '../images/bano.jpg', '../images/cocina.jpg'],
    '5E': ['../images/cocina.jpg', '../images/bano.jpg', '../images/sala.jpg'],
    '6F': ['../images/bano.jpg', '../images/cocina.jpg', '../images/sala.jpg']
};

let currentVillaImageIndex = 0;
let currentVillaNumber = '1A'; // Changed to string to match VILLA_CONFIG keys

// Initialize villa gallery
document.addEventListener('DOMContentLoaded', function () {
    const villaButtons = document.querySelectorAll('.villa-number-btn');

    villaButtons.forEach(button => {
        button.addEventListener('click', function () {
            const villaId = this.getAttribute('data-villa');
            selectVilla(villaId);
        });
    });

    // Initialize image navigation buttons
    const prevImageBtn = document.getElementById('prevImage');
    const nextImageBtn = document.getElementById('nextImage');

    if (prevImageBtn) {
        prevImageBtn.addEventListener('click', () => navigateImage(-1));
    }

    if (nextImageBtn) {
        nextImageBtn.addEventListener('click', () => navigateImage(1));
    }

    // Add listener to villa selector in reservation form
    const villaSelect = document.getElementById('villaSelect');
    if (villaSelect) {
        villaSelect.addEventListener('change', function () {
            const selectedVillaId = this.value;
            if (selectedVillaId) {
                selectVilla(selectedVillaId);
            }
        });
    }

    // Initialize the first villa display
    selectVilla('1A'); // Use the first villa code
});

// Select villa and update display
function selectVilla(villaId) {
    if (!villaId) return;
    currentVillaId = villaId;
    currentVillaNumber = villaId; // Use villaId directly for images mapping

    // Check if current numGuests exceeds new villa capacity
    const max = VILLA_CONFIG[villaId].maxGuests;
    if (numGuests > max) {
        numGuests = max;
        updateGuestUI();
    }

    updateCapacityLabel();

    // Update active button state
    document.querySelectorAll('.villa-number-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-villa') === villaId);
    });

    // Reset image index for the new villa
    currentVillaImageIndex = 0;

    // Update villa title
    const villaTitle = document.getElementById('villaTitle');
    if (villaTitle) villaTitle.textContent = `Villa #${villaId}`;

    // Update villa image
    updateVillaImage(currentVillaNumber, 0);
    updateImageIndicator();

    // Update villa selector in reservation form
    const villaSelect = document.getElementById('villaSelect');
    if (villaSelect) {
        villaSelect.value = villaId;
    }

    // Actualizar indicador del calendario
    const calendarIndicator = document.getElementById('calendarVillaIndicator');
    if (calendarIndicator) {
        calendarIndicator.innerHTML = `Villa #${villaId}`;
    }

    // IMPORTANTE: Recargar el calendario para mostrar disponibilidad de esta villa
    loadReservationsData().then(() => renderCalendar());
}

// Update villa image
function updateVillaImage(villaNumber, imageIndex) {
    const villaMainImage = document.getElementById('villaMainImage');
    const images = villaImages[villaNumber];

    if (images && images[imageIndex]) {
        // Add fade effect
        villaMainImage.style.opacity = '0';

        setTimeout(() => {
            villaMainImage.src = images[imageIndex];
            villaMainImage.alt = `Interior de Villa #${villaNumber}`;
            villaMainImage.style.opacity = '1';
        }, 300);
    }
}

// Navigate through images (direction: -1 for previous, 1 for next)
function navigateImage(direction) {
    const images = villaImages[currentVillaNumber];
    if (!images) return;

    currentVillaImageIndex += direction;

    // Loop around
    if (currentVillaImageIndex < 0) {
        currentVillaImageIndex = images.length - 1;
    } else if (currentVillaImageIndex >= images.length) {
        currentVillaImageIndex = 0;
    }

    updateVillaImage(currentVillaNumber, currentVillaImageIndex);
    updateImageIndicator();
}

// Update image indicator
function updateImageIndicator() {
    const indicator = document.getElementById('imageIndicator');
    const images = villaImages[currentVillaNumber];
    if (indicator && images) {
        indicator.textContent = `${currentVillaImageIndex + 1} / ${images.length}`;
    }
}

// ============================================
// EXPOSE FUNCTIONS TO WINDOW
// ============================================
// Needed because type="module" does not expose functions globally by default,
// but our HTML uses onclick="..." attributes.
window.processPayment = processPayment;
window.executePayment = executePayment;
window.closePaymentModal = closePaymentModal;
window.resetForm = resetForm;
window.navigateImage = navigateImage;
window.selectVilla = selectVilla;
window.updateVillaImage = updateVillaImage;
window.changeGuests = changeGuests;

// ============================================
// NAVBAR SCROLL LOGIC
// ============================================
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    if (window.scrollY > 50) {
        navbar.classList.add('navbar-dark-solid');
        navbar.classList.remove('navbar-transparent');
    } else {
        navbar.classList.add('navbar-transparent');
        navbar.classList.remove('navbar-dark-solid');
    }
});
