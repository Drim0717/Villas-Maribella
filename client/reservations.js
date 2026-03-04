// ============================================
// SISTEMA DE RESERVAS - VILLAS MARIBELLA
// (Optimizado: imports al inicio, eliminados duplicados,
//  constantes consolidadas, un solo DOMContentLoaded)
// ============================================

import CONFIG from './config.js';
import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================
// CONFIGURACIÓN DE VILLAS
// ============================================
const VILLA_CONFIG = {
    'B-1': { price: 55, maxGuests: 2, name: 'Villa B-1' },
    'C-1': { price: 55, maxGuests: 2, name: 'Villa C-1' },
    'D-1': { price: 55, maxGuests: 2, name: 'Villa D-1' },
    'AA-1': { price: 85, maxGuests: 4, name: 'Villa AA-1' },
    'AB-1': { price: 85, maxGuests: 4, name: 'Villa AB-1' },
    'AF-1': { price: 85, maxGuests: 4, name: 'Villa AF-1' }
};

const VILLA_IMAGES = {
    'B-1': ['../images/villas/B-1/sala.jpg', '../images/villas/B-1/cocina.jpg', '../images/villas/B-1/bano.jpg'],
    'C-1': ['../images/villas/C-1/sala.jpg', '../images/villas/C-1/cocina.jpg', '../images/villas/C-1/bano.jpg'],
    'D-1': ['../images/villas/D-1/sala.jpg', '../images/villas/D-1/cocina.jpg', '../images/villas/D-1/bano.jpg'],
    'AA-1': ['../images/villas/AA-1/sala.jpg', '../images/villas/AA-1/cocina.jpg', '../images/villas/AA-1/bano.jpg'],
    'AB-1': ['../images/villas/AB-1/sala.jpg', '../images/villas/AB-1/cocina.jpg', '../images/villas/AB-1/bano.jpg'],
    'AF-1': ['../images/villas/AF-1/sala.jpg', '../images/villas/AF-1/cocina.jpg', '../images/villas/AF-1/bano.jpg']
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// ============================================
// ESTADO DE LA APLICACIÓN
// ============================================
let currentVillaId = 'B-1';
let currentImageIndex = 0;
let numGuests = 2;
let selectedCheckIn = null;
let selectedCheckOut = null;
let currentMonth = new Date();
let dbReservations = [];

// ============================================
// UTILIDADES
// ============================================

/** Formatea un Date a string YYYY-MM-DD */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/** Calcula las noches entre dos fechas */
function calculateNights(checkIn, checkOut) {
    if (!checkIn || !checkOut) return 0;
    return Math.ceil((checkOut - checkIn) / MS_PER_DAY);
}

/** Obtiene un elemento del DOM por ID de forma segura */
function $(id) {
    return document.getElementById(id);
}

// ============================================
// INICIALIZACIÓN (UN SOLO DOMContentLoaded)
// ============================================
document.addEventListener('DOMContentLoaded', async function () {
    // Cargar datos de Firestore
    await loadReservationsData();
    renderCalendar();
    updatePrice();

    // Navegación del calendario
    $('prevMonth')?.addEventListener('click', () => {
        currentMonth.setDate(1);
        currentMonth.setMonth(currentMonth.getMonth() - 1);
        renderCalendar();
    });

    $('nextMonth')?.addEventListener('click', () => {
        currentMonth.setDate(1);
        currentMonth.setMonth(currentMonth.getMonth() + 1);
        renderCalendar();
    });

    // Formulario de reserva
    $('reservationForm')?.addEventListener('submit', handleReservation);

    // Inicializar capacidad
    updateCapacityLabel();

    // Modal: cerrar al hacer click en el fondo
    const modal = $('paymentModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closePaymentModal();
        });
    }

    // Modal: prevenir cierre al hacer click dentro del contenido
    $('modalContent')?.addEventListener('click', (e) => e.stopPropagation());

    // Villa buttons
    document.querySelectorAll('.villa-number-btn').forEach(button => {
        button.addEventListener('click', function () {
            selectVilla(this.getAttribute('data-villa'));
        });
    });

    // Gallery navigation
    $('prevImage')?.addEventListener('click', () => navigateImage(-1));
    $('nextImage')?.addEventListener('click', () => navigateImage(1));

    // Seleccionar villa inicial
    selectVilla('B-1');

    // Mostrar botón "Mis Reservas" si hay reservas guardadas en localStorage
    checkShowMyReservationsButton();

    // Recargar datos cuando el usuario vuelve a la pestaña (evita datos desactualizados)
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            console.log('Recargando datos de reservas (pestaña activa)...');
            await loadReservationsData();
            renderCalendar();
        }
    });
});

// ============================================
// DATOS - FIRESTORE
// ============================================
async function loadReservationsData() {
    try {
        const snapshot = await getDocs(collection(db, "reservations"));
        dbReservations = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            data.firestoreId = docSnap.id;
            dbReservations.push(data);
        });
        console.log("Reservas cargadas:", dbReservations.length);
    } catch (error) {
        console.error("Error cargando reservas:", error);
    }
}

async function saveReservationToStorage(reservation) {
    try {
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Firestore timeout")), 5000)
        );
        const firestorePromise = addDoc(collection(db, "reservations"), reservation);
        const docRef = await Promise.race([firestorePromise, timeoutPromise]);
        console.log("Document written with ID:", docRef.id);
        return true;
    } catch (e) {
        console.warn("Error o timeout en Firestore, guardando localmente:", e);

        // Fallback: localStorage
        try {
            const localReservations = JSON.parse(localStorage.getItem('villasReservationsBackup') || '[]');
            if (!reservation.firestoreId) {
                reservation.firestoreId = 'local_' + Date.now();
            }
            localReservations.push(reservation);
            localStorage.setItem('villasReservationsBackup', JSON.stringify(localReservations));
            console.log("Reserva guardada localmente (Backup)");
            return true;
        } catch (localError) {
            console.error("Error fatal: No se pudo guardar ni en Firestore ni localmente", localError);
            showNotification('Error Crítico', "Error al guardar la reserva. Por favor intenta de nuevo.", true);
            throw localError;
        }
    }
}

function getBlockedDatesFromStorage() {
    const data = localStorage.getItem('villasBlockedDates');
    return data ? JSON.parse(data) : [];
}

// ============================================
// CALENDARIO
// ============================================
function renderCalendar() {
    const calendar = $('calendar');
    const monthYear = $('monthYear');
    if (!calendar || !monthYear) return;

    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    monthYear.textContent = firstDay.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    calendar.innerHTML = '';

    // Encabezados de días
    ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day-header';
        dayHeader.textContent = day;
        calendar.appendChild(dayHeader);
    });

    // Días vacíos al inicio
    for (let i = 0; i < firstDay.getDay(); i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day empty';
        calendar.appendChild(emptyDay);
    }

    // Días del mes
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= lastDay.getDate(); day++) {
        const dayDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = day;

        if (dayDate < today) {
            dayElement.classList.add('past');
        } else if (isReserved(dayDate)) {
            dayElement.classList.add('reserved');
        } else {
            dayElement.classList.add('available');

            if (isSelected(dayDate)) dayElement.classList.add('selected');
            if (isInRange(dayDate)) dayElement.classList.add('in-range');

            dayElement.addEventListener('click', () => selectDate(dayDate));
        }

        calendar.appendChild(dayElement);
    }
}

// ============================================
// VERIFICACIÓN DE DISPONIBILIDAD
// ============================================
function isRangeAvailable(start, end, villaId) {
    if (!start || !end) return true;

    let tempDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    while (tempDate < endDate) {
        if (isReserved(new Date(tempDate), villaId)) {
            console.warn("Rango inválido: Fecha bloqueada en", formatDate(tempDate));
            return false;
        }
        tempDate.setDate(tempDate.getDate() + 1);
    }
    return true;
}

function isReserved(date, villaId) {
    if (!(date instanceof Date)) date = new Date(date);
    const checkVilla = villaId || currentVillaId;
    const dateStr = formatDate(date);

    // Verificar reservas de Firestore
    const isSavedReserved = dbReservations.some(reservation => {
        const matchesVilla = reservation.villaNumber == checkVilla ||
            (reservation.villaNumber == parseInt(checkVilla) && checkVilla.length === 1);
        const isCancelled = reservation.status === 'cancelled';
        return matchesVilla && !isCancelled && dateStr >= reservation.checkIn && dateStr < reservation.checkOut;
    });

    // Verificar fechas bloqueadas
    const blockedDates = getBlockedDatesFromStorage();
    const isBlocked = blockedDates.some(block => {
        const matchesVilla = !block.villaNumber || block.villaNumber == checkVilla;
        return matchesVilla && dateStr >= block.startDate && dateStr <= block.endDate;
    });

    return isSavedReserved || isBlocked;
}

function isSelected(date) {
    if (!selectedCheckIn && !selectedCheckOut) return false;
    const dateStr = date.toDateString();
    return (selectedCheckIn && dateStr === selectedCheckIn.toDateString()) ||
        (selectedCheckOut && dateStr === selectedCheckOut.toDateString());
}

function isInRange(date) {
    if (!selectedCheckIn || !selectedCheckOut) return false;
    return date > selectedCheckIn && date < selectedCheckOut;
}

// ============================================
// SELECCIÓN DE FECHAS
// ============================================
function selectDate(date) {
    const dateStr = date.toDateString();

    if (selectedCheckIn && dateStr === selectedCheckIn.toDateString()) {
        // Deseleccionar check-in
        selectedCheckIn = selectedCheckOut;
        selectedCheckOut = null;
        $('checkIn').value = selectedCheckIn ? formatDate(selectedCheckIn) : '';
        $('checkOut').value = '';
    } else if (selectedCheckOut && dateStr === selectedCheckOut.toDateString()) {
        // Deseleccionar check-out
        selectedCheckOut = null;
        $('checkOut').value = '';
    } else if (!selectedCheckIn || (selectedCheckIn && selectedCheckOut)) {
        // Primera selección o reinicio
        selectedCheckIn = date;
        selectedCheckOut = null;
        $('checkIn').value = formatDate(date);
        $('checkOut').value = '';
    } else if (date > selectedCheckIn) {
        // Segunda selección (check-out) - validar rango
        if (!isRangeAvailable(selectedCheckIn, date)) {
            resetForm();
            showNotification('Rango No Disponible', 'No se puede seleccionar este rango porque contiene fechas ya reservadas o bloqueadas.', true);
            return;
        }
        selectedCheckOut = date;
        $('checkOut').value = formatDate(date);
    } else {
        // Fecha anterior al check-in actual → nuevo check-in
        selectedCheckIn = date;
        selectedCheckOut = null;
        $('checkIn').value = formatDate(date);
        $('checkOut').value = '';
    }

    renderCalendar();
    updatePrice();
}

// ============================================
// PRECIO Y HUÉSPEDES
// ============================================
function updatePrice() {
    const priceDisplay = $('totalPrice');
    const nightsDisplay = $('numNights');
    const priceDetail = $('priceDetail');
    const config = VILLA_CONFIG[currentVillaId];

    if (!priceDisplay || !nightsDisplay) return;

    const nights = calculateNights(selectedCheckIn, selectedCheckOut);
    const total = nights * config.price;

    nightsDisplay.textContent = nights;
    priceDisplay.textContent = `$${total.toFixed(2)}`;
    if (priceDetail) priceDetail.textContent = `$${config.price} x ${nights}`;
}

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
    const display = $('guestCountDisplay');
    if (display) display.innerText = numGuests;
}

function updateCapacityLabel() {
    const label = $('maxCapacityLabel');
    const smallLabel = $('maxCapacitySmall');
    const max = VILLA_CONFIG[currentVillaId].maxGuests;

    if (label) label.innerText = `Huéspedes máx. para Villa #${currentVillaId}: ${max}`;
    if (smallLabel) smallLabel.innerText = max;
}

// ============================================
// GALERÍA DE VILLAS
// ============================================
function selectVilla(villaId) {
    if (!villaId || !VILLA_CONFIG[villaId]) return;
    currentVillaId = villaId;

    // Ajustar huéspedes si exceden la capacidad
    const max = VILLA_CONFIG[villaId].maxGuests;
    if (numGuests > max) {
        numGuests = max;
        updateGuestUI();
    }

    updateCapacityLabel();

    // Actualizar botones activos
    document.querySelectorAll('.villa-number-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-villa') === villaId);
    });

    // Resetear imagen
    currentImageIndex = 0;

    // Actualizar UI
    const villaTitle = $('villaTitle');
    if (villaTitle) villaTitle.textContent = `Villa #${villaId}`;

    updateVillaImage(villaId, 0);
    updateImageIndicator();

    const villaSelect = $('villaSelect');
    if (villaSelect) villaSelect.value = villaId;

    const calendarIndicator = $('calendarVillaIndicator');
    if (calendarIndicator) calendarIndicator.innerHTML = `Villa #${villaId}`;

    // Reiniciar selección de fechas
    selectedCheckIn = null;
    selectedCheckOut = null;
    const checkInEl = $('checkIn');
    const checkOutEl = $('checkOut');
    if (checkInEl) checkInEl.value = '';
    if (checkOutEl) checkOutEl.value = '';

    // Recargar calendario
    loadReservationsData().then(() => {
        renderCalendar();
        updatePrice();
    });
}

function updateVillaImage(villaId, imageIndex) {
    const villaMainImage = $('villaMainImage');
    const images = VILLA_IMAGES[villaId];

    if (images && images[imageIndex] && villaMainImage) {
        villaMainImage.style.opacity = '0';
        setTimeout(() => {
            villaMainImage.src = images[imageIndex];
            villaMainImage.alt = `Interior de Villa #${villaId}`;
            villaMainImage.style.opacity = '1';
        }, 300);
    }
}

function navigateImage(direction) {
    const images = VILLA_IMAGES[currentVillaId];
    if (!images) return;

    currentImageIndex += direction;

    if (currentImageIndex < 0) currentImageIndex = images.length - 1;
    else if (currentImageIndex >= images.length) currentImageIndex = 0;

    updateVillaImage(currentVillaId, currentImageIndex);
    updateImageIndicator();
}

function updateImageIndicator() {
    const indicator = $('imageIndicator');
    const images = VILLA_IMAGES[currentVillaId];
    if (indicator && images) {
        indicator.textContent = `${currentImageIndex + 1} / ${images.length}`;
    }
}

// ============================================
// FORMULARIO DE RESERVA
// ============================================
async function handleReservation(e) {
    e.preventDefault();

    if (!selectedCheckIn || !selectedCheckOut) {
        showNotification('Faltan Datos', 'Por favor selecciona las fechas de tu estadía', true);
        return;
    }

    const selectedVilla = $('villaSelect')?.value || '';
    if (!selectedVilla) {
        showNotification('Seleccionar Villa', 'Por favor selecciona una villa', true);
        return;
    }

    // Recargar datos frescos de Firebase antes de validar
    await loadReservationsData();

    // Doble verificación de disponibilidad con datos actualizados
    if (!isRangeAvailable(selectedCheckIn, selectedCheckOut, selectedVilla)) {
        showNotification('No Disponible', 'Lo sentimos, algunas fechas ya no están disponibles. Selecciona un nuevo período.', true);
        resetForm();
        renderCalendar();
        return;
    }

    const guestsValue = parseInt($('numGuests').value);
    if (guestsValue > VILLA_CONFIG[selectedVilla].maxGuests) {
        showNotification('Capacidad Excedida', `El máximo para Villa #${selectedVilla} es ${VILLA_CONFIG[selectedVilla].maxGuests} personas.`, true);
        return;
    }

    const guestName = $('guestName').value;
    const nights = calculateNights(selectedCheckIn, selectedCheckOut);
    const total = nights * VILLA_CONFIG[selectedVilla].price;

    showPaymentModal(guestName, total, nights, selectedVilla);
}

// ============================================
// MODAL DE PAGO
// ============================================
function showPaymentModal(guestName, total, nights, selectedVilla) {
    const modal = $('paymentModal');
    const modalContent = $('modalContent');

    modalContent.innerHTML = `
        <button class="btn-close-modal" onclick="closePaymentModal()" aria-label="Cerrar">×</button>
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
    document.body.classList.add('modal-open');
}

function processPayment(method) {
    if (method === 'transfer') {
        showTransferDetails();
        return;
    }
    executePayment(method);
}

function showTransferDetails() {
    const modalContent = $('modalContent');
    modalContent.innerHTML = `
        <button class="btn-close-modal" onclick="closePaymentModal()" aria-label="Cerrar">×</button>
        <h3 class="text-primary fw-bold mb-4">Datos para Transferencia</h3>
        <p class="text-muted mb-4">Selecciona tu banco y realiza la transferencia por el monto total. Conserva tu comprobante.</p>
        
        <div class="accordion accordion-flush" id="bankAccordion">
            <div class="accordion-item border rounded-3 mb-3">
                <h2 class="accordion-header">
                    <button class="accordion-button collapsed fw-bold" type="button" data-bs-toggle="collapse" 
                            data-bs-target="#bankOfAmerica" aria-expanded="false" aria-controls="bankOfAmerica">
                        <i class="bi bi-bank me-2"></i> Bank of America
                    </button>
                </h2>
                <div id="bankOfAmerica" class="accordion-collapse collapse" data-bs-parent="#bankAccordion">
                    <div class="accordion-body bg-light">
                        <p class="mb-2"><strong>Banco:</strong> Bank of America</p>
                        <p class="mb-2"><strong>Número de Cuenta:</strong> XXX-XXX-XXX</p>
                        <p class="mb-2"><strong>Routing Number:</strong> XXX-XXX-XXX</p>
                        <p class="mb-0"><strong>Beneficiario:</strong> Vincenzo Pampillonia</p>
                    </div>
                </div>
            </div>
            <div class="accordion-item border rounded-3 mb-3">
                <h2 class="accordion-header">
                    <button class="accordion-button collapsed fw-bold" type="button" data-bs-toggle="collapse" 
                            data-bs-target="#bancoPopular" aria-expanded="false" aria-controls="bancoPopular">
                        <i class="bi bi-bank me-2"></i> Banco Popular Dominicano
                    </button>
                </h2>
                <div id="bancoPopular" class="accordion-collapse collapse" data-bs-parent="#bankAccordion">
                    <div class="accordion-body bg-light">
                        <p class="mb-2"><strong>Banco:</strong> Banco Popular Dominicano</p>
                        <p class="mb-2"><strong>Número de Cuenta:</strong> XXX-XXX-XXX</p>
                        <p class="mb-2"><strong>Identificación:</strong> XXX-XXX-XXX</p>
                        <p class="mb-0"><strong>Beneficiario:</strong> Vincenzo Pampillonia</p>
                    </div>
                </div>
            </div>
        </div>

        <button class="btn-confirm-modern w-100 py-3 fw-bold rounded-4 shadow-sm text-uppercase mt-4" onclick="executePayment('transfer')">
            Confirmar Transferencia
        </button>
        <button class="cancel-btn w-100 mt-2" onclick="closePaymentModal()">
            Cancelar
        </button>
    `;
}

async function executePayment(method) {
    console.log("Procesando pago:", method);

    if (!selectedCheckIn || !selectedCheckOut) {
        showNotification('Error', "Error de fechas. Por favor recarga la página.", true);
        closePaymentModal();
        return;
    }

    const selectedVilla = $('villaSelect')?.value || 'B-1';
    const nights = calculateNights(selectedCheckIn, selectedCheckOut);
    const total = nights * VILLA_CONFIG[selectedVilla].price;

    const guestName = $('guestName')?.value || 'Anónimo';
    const guestEmail = $('guestEmail')?.value || 'no-email@test.com';
    const guestNumGuests = parseInt($('numGuests')?.value) || 1;
    const confirmationCode = 'VM-' + Math.floor(Math.random() * 100000);

    const modalContent = $('modalContent');
    modalContent.innerHTML = `
        <div class="payment-processing">
            <div class="spinner"></div>
            <h3>Procesando pago...</h3>
            <p>Conectando con el servidor...</p>
        </div>
    `;

    try {
        const reservationStatus = method === 'transfer' ? 'pending' : 'confirmed';

        // *** VERIFICACIÓN FINAL: Recargar datos y validar una última vez ***
        await loadReservationsData();
        if (!isRangeAvailable(selectedCheckIn, selectedCheckOut, selectedVilla)) {
            modalContent.innerHTML = `
                <button class="btn-close-modal" onclick="closePaymentModal()" aria-label="Cerrar">×</button>
                <div class="p-4 text-center">
                    <i class="bi bi-exclamation-triangle-fill text-warning fs-1 mb-3 d-block"></i>
                    <h3 class="text-danger fw-bold mb-3">Fechas No Disponibles</h3>
                    <p class="text-secondary mb-4">Lo sentimos, alguien acaba de reservar estas fechas. Por favor selecciona un nuevo período.</p>
                    <button class="btn-confirm-modern w-100 py-3 fw-bold rounded-4 shadow-sm text-uppercase" onclick="closePaymentModal(); resetForm(); renderCalendar();">
                        Seleccionar Nuevas Fechas
                    </button>
                </div>
            `;
            renderCalendar();
            return;
        }

        const reservationData = {
            id: confirmationCode,
            guestName,
            guestEmail,
            villaNumber: selectedVilla,
            checkIn: formatDate(selectedCheckIn),
            checkOut: formatDate(selectedCheckOut),
            numGuests: guestNumGuests,
            total,
            status: reservationStatus,
            paymentMethod: method,
            createdAt: new Date().toISOString()
        };

        await saveReservationToStorage(reservationData);

        // Guardar código en localStorage para "Mis Reservas"
        saveMyReservationCode(confirmationCode, guestEmail);

        // Intentar enviar correo (no-blocking)
        fetch(`${CONFIG.API_URL}/api/send-email`, {
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
        }).catch(err => console.log("Servidor de correos no detectado"));

        const title = method === 'transfer' ? '¡Reserva Pendiente!' : '¡Reserva Confirmada!';
        const message = method === 'transfer'
            ? 'Tu reserva está pendiente de validación del pago.'
            : 'Tu reserva ha sido procesada exitosamente.';
        const icon = method === 'transfer' ? '⏳' : '✓';

        modalContent.innerHTML = `
            <button class="btn-close-modal" onclick="closePaymentModal()" aria-label="Cerrar">×</button>
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
                <button class="confirm-btn" onclick="location.reload()">Aceptar</button>
            </div>
        `;

        setTimeout(() => location.reload(), 3000);
    } catch (error) {
        console.error("Error CRÍTICO en executePayment:", error);
        modalContent.innerHTML = `
            <button class="btn-close-modal" onclick="closePaymentModal()" aria-label="Cerrar">×</button>
            <div class="payment-error p-4 text-center">
                <i class="bi bi-exclamation-triangle-fill text-danger fs-1 mb-3 d-block"></i>
                <h3 class="text-danger">Error de Conexión</h3>
                <p>Hubo un problema guardando la reserva: ${error.message}</p>
                <button class="btn-confirm-modern px-5 py-2 mt-3 rounded-pill" onclick="closePaymentModal()">Cerrar</button>
            </div>
        `;
    }
}

// ============================================
// NOTIFICACIÓN Y UTILIDADES
// ============================================
function showNotification(title, message, isError = false) {
    const modal = $('paymentModal');
    const modalContent = $('modalContent');
    if (!modal || !modalContent) return;

    const iconClass = isError ? 'bi-exclamation-circle text-danger' : 'bi-check-circle text-success';
    const titleClass = isError ? 'text-danger' : 'text-primary';

    modalContent.innerHTML = `
        <button class="btn-close-modal" onclick="closePaymentModal()" aria-label="Cerrar">×</button>
        <div class="p-4 text-center">
            <i class="bi ${iconClass} fs-1 mb-3 d-block"></i>
            <h3 class="${titleClass} fw-bold mb-3">${title}</h3>
            <p class="text-secondary mb-4">${message}</p>
            <button class="btn-confirm-modern w-100 py-3 fw-bold rounded-4 shadow-sm text-uppercase" onclick="closePaymentModal()">
                Entendido
            </button>
        </div>
    `;

    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
}

function closePaymentModal() {
    $('paymentModal').style.display = 'none';
    document.body.classList.remove('modal-open');
}

function resetForm() {
    selectedCheckIn = null;
    selectedCheckOut = null;
    $('reservationForm')?.reset();
    renderCalendar();
    updatePrice();
}

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

// ============================================
// EXPOSE FUNCTIONS TO WINDOW
// (Necesario porque type="module" no expone globalmente,
//  pero el HTML usa onclick="...")
// ============================================
window.processPayment = processPayment;
window.executePayment = executePayment;
window.closePaymentModal = closePaymentModal;
window.resetForm = resetForm;
window.navigateImage = navigateImage;
window.selectVilla = selectVilla;
window.updateVillaImage = updateVillaImage;
window.changeGuests = changeGuests;
window.renderCalendar = renderCalendar;
window.openMyReservations = openMyReservations;
window.closeMyReservations = closeMyReservations;
window.lookupReservation = lookupReservation;
window.showEditMyReservation = showEditMyReservation;
window.discardEditMyReservation = discardEditMyReservation;
window.saveEditMyReservation = saveEditMyReservation;
window.cancelMyReservation = cancelMyReservation;
window.confirmCancelMyReservation = confirmCancelMyReservation;

// ============================================
// MIS RESERVAS - LOCALSTORAGE TRACKING
// ============================================
const MY_RESERVATIONS_KEY = 'myVillasReservations';

function getMyStoredReservations() {
    try {
        return JSON.parse(localStorage.getItem(MY_RESERVATIONS_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveMyReservationCode(code, email) {
    const stored = getMyStoredReservations();
    if (!stored.some(r => r.code === code)) {
        stored.push({ code, email, savedAt: new Date().toISOString() });
        localStorage.setItem(MY_RESERVATIONS_KEY, JSON.stringify(stored));
    }
    checkShowMyReservationsButton();
}

function checkShowMyReservationsButton() {
    const btn = $('myReservationsBtn');
    if (!btn) return;
    const stored = getMyStoredReservations();
    if (stored.length > 0) {
        btn.classList.add('visible');
    } else {
        btn.classList.remove('visible');
    }
}

// ============================================
// MIS RESERVAS - PANEL OPEN/CLOSE
// ============================================
function openMyReservations() {
    const overlay = $('myResOverlay');
    const panel = $('myResPanel');
    if (overlay) overlay.classList.add('active');
    if (panel) panel.classList.add('active');
    document.body.style.overflow = 'hidden';
    loadMyReservationsPanel();
}

function closeMyReservations() {
    const overlay = $('myResOverlay');
    const panel = $('myResPanel');
    if (overlay) overlay.classList.remove('active');
    if (panel) panel.classList.remove('active');
    document.body.style.overflow = '';
}

// ============================================
// MIS RESERVAS - LOAD & DISPLAY
// ============================================
async function loadMyReservationsPanel() {
    const container = $('myResPanelBody');
    if (!container) return;

    container.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-2 text-muted small">Cargando reservas...</p>
        </div>
    `;

    // Recargar datos desde Firebase
    await loadReservationsData();

    const stored = getMyStoredReservations();
    const myReservations = [];

    // Buscar las reservas almacenadas en Firebase
    stored.forEach(s => {
        const found = dbReservations.find(r => r.id === s.code);
        if (found) myReservations.push(found);
    });

    let html = '';

    // Formulario de búsqueda
    html += `
        <div class="my-res-lookup">
            <h5><i class="bi bi-search me-1"></i> Buscar otra reserva</h5>
            <div class="row g-2">
                <div class="col-5">
                    <input type="text" class="form-control" id="lookupCode" placeholder="VM-12345">
                </div>
                <div class="col-7">
                    <input type="email" class="form-control" id="lookupEmail" placeholder="tu@email.com">
                </div>
                <div class="col-12">
                    <button class="my-res-lookup-btn" onclick="lookupReservation()">
                        <i class="bi bi-search me-1"></i> Buscar
                    </button>
                </div>
            </div>
            <div id="lookupError" class="my-res-validation-error mt-2"></div>
        </div>
    `;

    if (myReservations.length === 0) {
        html += `
            <div class="my-res-empty">
                <i class="bi bi-journal-x"></i>
                <p>No tienes reservas guardadas</p>
                <p class="small">Cuando hagas una reserva, aparecerá aquí automáticamente.<br>También puedes buscar una reserva existente usando tu código y email.</p>
            </div>
        `;
    } else {
        html += `<div class="my-res-separator">Tus reservas guardadas</div>`;
        myReservations.forEach(res => {
            html += renderMyReservationCard(res);
        });
    }

    container.innerHTML = html;
}

function renderMyReservationCard(res) {
    const checkIn = new Date(res.checkIn + 'T12:00:00');
    const checkOut = new Date(res.checkOut + 'T12:00:00');
    const nights = Math.ceil((checkOut - checkIn) / MS_PER_DAY);
    const config = VILLA_CONFIG[res.villaNumber] || { price: 0, maxGuests: 2 };
    const isPast = new Date(res.checkOut) < new Date();
    const isCancelled = res.status === 'cancelled';
    const canEdit = !isPast && !isCancelled;

    const statusText = {
        confirmed: 'Confirmada',
        pending: 'Pendiente',
        cancelled: 'Cancelada',
        completed: 'Completada'
    };

    return `
        <div class="my-res-card" id="myResCard-${res.id}">
            <div class="my-res-card-header">
                <span class="my-res-card-villa">Villa ${res.villaNumber}</span>
                <span class="my-res-card-code">${res.id}</span>
            </div>
            <div class="my-res-card-details">
                <div class="my-res-detail-item">
                    <span class="my-res-detail-label">Check-in</span>
                    <span class="my-res-detail-value">${checkIn.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                <div class="my-res-detail-item">
                    <span class="my-res-detail-label">Check-out</span>
                    <span class="my-res-detail-value">${checkOut.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                <div class="my-res-detail-item">
                    <span class="my-res-detail-label">Noches</span>
                    <span class="my-res-detail-value">${nights}</span>
                </div>
                <div class="my-res-detail-item">
                    <span class="my-res-detail-label">Total</span>
                    <span class="my-res-detail-value">$${(res.total || 0).toFixed(2)}</span>
                </div>
                <div class="my-res-detail-item">
                    <span class="my-res-detail-label">Huéspedes</span>
                    <span class="my-res-detail-value">${res.numGuests || 1}</span>
                </div>
                <div class="my-res-detail-item">
                    <span class="my-res-detail-label">Estado</span>
                    <span class="my-res-status ${res.status || 'pending'}">${statusText[res.status] || 'Pendiente'}</span>
                </div>
            </div>
            ${canEdit ? `
            <div class="my-res-card-actions" id="actions-${res.id}">
                <button class="my-res-edit-btn" onclick="showEditMyReservation('${res.id}')">
                    <i class="bi bi-pencil-square"></i> Editar Fechas
                </button>
                <button class="my-res-cancel-btn" onclick="confirmCancelMyReservation('${res.id}', '${res.firestoreId || ''}')">
                    <i class="bi bi-x-circle"></i> Cancelar
                </button>
            </div>
            ` : `
            <div class="text-center small text-muted pt-2 border-top">
                ${isPast ? '📋 Reserva finalizada' : '❌ Reserva cancelada'}
            </div>
            `}
        </div>
    `;
}

// ============================================
// MIS RESERVAS - EDICIÓN
// ============================================
function showEditMyReservation(reservationId) {
    const res = dbReservations.find(r => r.id === reservationId);
    if (!res) return;

    const config = VILLA_CONFIG[res.villaNumber] || { price: 55, maxGuests: 2 };
    const card = document.getElementById(`myResCard-${reservationId}`);
    if (!card) return;

    // Fecha mínima: mañana
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = formatDate(tomorrow);

    card.outerHTML = `
        <div class="my-res-edit-form" id="myResEdit-${reservationId}">
            <h5><i class="bi bi-pencil-square me-2"></i>Editar Reserva ${reservationId}</h5>
            <p class="small text-muted mb-3">Villa ${res.villaNumber} • Máx. ${config.maxGuests} huéspedes • $${config.price}/noche</p>
            <div class="row g-2 mb-2">
                <div class="col-6">
                    <label class="form-label">Check-in</label>
                    <input type="date" class="form-control" id="editMyCheckIn-${reservationId}"
                           value="${res.checkIn}" min="${minDate}">
                </div>
                <div class="col-6">
                    <label class="form-label">Check-out</label>
                    <input type="date" class="form-control" id="editMyCheckOut-${reservationId}"
                           value="${res.checkOut}" min="${minDate}">
                </div>
            </div>
            <div class="mb-2">
                <label class="form-label">Huéspedes</label>
                <select class="form-control" id="editMyGuests-${reservationId}">
                    ${Array.from({ length: config.maxGuests }, (_, i) =>
        `<option value="${i + 1}" ${(res.numGuests || 1) === i + 1 ? 'selected' : ''}>${i + 1}</option>`
    ).join('')}
                </select>
            </div>
            <div id="editMyError-${reservationId}" class="my-res-validation-error"></div>
            <div class="my-res-edit-actions">
                <button class="my-res-save-btn" onclick="saveEditMyReservation('${reservationId}', '${res.firestoreId || ''}', '${res.villaNumber}', ${config.price})">
                    <i class="bi bi-check2 me-1"></i> Guardar
                </button>
                <button class="my-res-discard-btn" onclick="discardEditMyReservation('${reservationId}')">
                    Cancelar
                </button>
            </div>
        </div>
    `;
}

// Volver a mostrar la tarjeta original sin recargar todo el panel
function discardEditMyReservation(reservationId) {
    const editForm = document.getElementById(`myResEdit-${reservationId}`);
    if (!editForm) return;
    const res = dbReservations.find(r => r.id === reservationId);
    if (!res) {
        loadMyReservationsPanel();
        return;
    }
    editForm.outerHTML = renderMyReservationCard(res);
}

async function saveEditMyReservation(reservationId, firestoreId, villaId, pricePerNight) {
    const checkInInput = document.getElementById(`editMyCheckIn-${reservationId}`);
    const checkOutInput = document.getElementById(`editMyCheckOut-${reservationId}`);
    const guestsInput = document.getElementById(`editMyGuests-${reservationId}`);
    const errorDiv = document.getElementById(`editMyError-${reservationId}`);

    if (!checkInInput || !checkOutInput || !guestsInput) return;

    const newCheckIn = checkInInput.value;
    const newCheckOut = checkOutInput.value;
    const newGuests = parseInt(guestsInput.value);

    // Validaciones básicas
    if (!newCheckIn || !newCheckOut) {
        showEditError(errorDiv, 'Por favor selecciona ambas fechas.');
        return;
    }

    if (newCheckIn >= newCheckOut) {
        showEditError(errorDiv, 'La fecha de check-out debe ser posterior al check-in.');
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(newCheckIn) < today) {
        showEditError(errorDiv, 'La fecha de check-in no puede ser en el pasado.');
        return;
    }

    // Recargar datos frescos de Firebase antes de validar
    await loadReservationsData();

    // Verificar disponibilidad (excluyendo esta reserva) con datos actualizados
    const isAvailable = isEditRangeAvailable(newCheckIn, newCheckOut, villaId, reservationId);
    if (!isAvailable) {
        showEditError(errorDiv, '⚠️ Las fechas seleccionadas tienen conflicto con otra reserva o fechas bloqueadas. Elige otras fechas.');
        return;
    }

    // Calcular nuevo total
    const nights = Math.ceil((new Date(newCheckOut) - new Date(newCheckIn)) / MS_PER_DAY);
    const newTotal = nights * pricePerNight;

    if (!firestoreId) {
        showEditError(errorDiv, 'Error interno: No se encontró el ID de la reserva.');
        return;
    }

    try {
        await updateDoc(doc(db, "reservations", firestoreId), {
            checkIn: newCheckIn,
            checkOut: newCheckOut,
            numGuests: newGuests,
            total: newTotal,
            lastModified: new Date().toISOString()
        });

        // Recargar datos
        await loadReservationsData();

        // Mostrar éxito
        const panelBody = $('myResPanelBody');
        if (panelBody) {
            panelBody.innerHTML = `
                <div class="text-center py-5">
                    <div style="font-size: 3.5rem; margin-bottom: 1rem;">✅</div>
                    <h4 class="fw-bold" style="color: #0077B6;">¡Reserva Actualizada!</h4>
                    <p class="text-muted">Tus nuevas fechas han sido guardadas correctamente.</p>
                    <p class="small fw-bold">Nuevo total: $${newTotal.toFixed(2)} (${nights} noches)</p>
                </div>
            `;
            setTimeout(loadMyReservationsPanel, 2500);
        }

        // Actualizar calendario principal
        renderCalendar();
        updatePrice();
    } catch (error) {
        console.error("Error actualizando reserva:", error);
        showEditError(errorDiv, 'Error al guardar los cambios. Por favor intenta de nuevo.');
    }
}

// Verificar disponibilidad para edición (excluye la reserva actual)
function isEditRangeAvailable(newCheckIn, newCheckOut, villaId, excludeReservationId) {
    // Verificar conflictos con otras reservas de la misma villa
    const hasConflict = dbReservations.some(reservation => {
        if (reservation.id === excludeReservationId) return false;
        if (reservation.villaNumber !== villaId) return false;
        if (reservation.status === 'cancelled') return false;

        // Overlap: start < existingEnd AND end > existingStart
        return newCheckIn < reservation.checkOut && newCheckOut > reservation.checkIn;
    });

    if (hasConflict) return false;

    // Verificar contra fechas bloqueadas
    const blockedDates = getBlockedDatesFromStorage();
    const hasBlockConflict = blockedDates.some(block => {
        const matchesVilla = !block.villaNumber || block.villaNumber === villaId;
        if (!matchesVilla) return false;
        return newCheckIn <= block.endDate && newCheckOut > block.startDate;
    });

    return !hasBlockConflict;
}

// ============================================
// MIS RESERVAS - CANCELACIÓN
// ============================================
function confirmCancelMyReservation(reservationId, firestoreId) {
    const modal = $('paymentModal');
    const modalContent = $('modalContent');
    if (!modal || !modalContent) return;

    modalContent.innerHTML = `
        <button class="btn-close-modal" onclick="closePaymentModal()" aria-label="Cerrar">×</button>
        <div class="p-4 text-center">
            <i class="bi bi-exclamation-triangle-fill text-warning fs-1 mb-3 d-block"></i>
            <h3 class="text-danger fw-bold mb-3">Cancelar Reserva</h3>
            <p class="text-secondary mb-4">¿Estás seguro de que deseas cancelar la reserva <strong>${reservationId}</strong>? Las fechas quedarán libres para otros huéspedes.</p>
            <button class="w-100 py-3 fw-bold rounded-4 shadow-sm text-uppercase mb-2" 
                style="background: #dc3545; color: white; border: none; font-size: 1rem; cursor: pointer; transition: all 0.2s;"
                onmouseover="this.style.background='#bb2d3b'" onmouseout="this.style.background='#dc3545'"
                onclick="closePaymentModal(); cancelMyReservation('${reservationId}', '${firestoreId}')">
                Sí, Cancelar Reserva
            </button>
            <button class="cancel-btn w-100" onclick="closePaymentModal()">
                No, Mantener Reserva
            </button>
        </div>
    `;

    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
}

async function cancelMyReservation(reservationId, firestoreId) {
    if (!firestoreId) {
        alert('Error: No se pudo identificar la reserva.');
        return;
    }

    try {
        const panelBody = $('myResPanelBody');
        if (panelBody) {
            panelBody.innerHTML = `
                <div class="text-center py-5">
                    <div class="spinner-border text-danger" role="status"></div>
                    <p class="mt-3 fw-bold">Cancelando reserva...</p>
                </div>
            `;
        }

        await updateDoc(doc(db, "reservations", firestoreId), {
            status: 'cancelled',
            cancelledAt: new Date().toISOString()
        });

        await loadReservationsData();

        if (panelBody) {
            panelBody.innerHTML = `
                <div class="text-center py-5">
                    <div style="font-size: 3.5rem; margin-bottom: 1rem;">🗑️</div>
                    <h4 class="fw-bold" style="color: #dc3545;">Reserva Cancelada</h4>
                    <p class="text-muted">La reserva ${reservationId} ha sido eliminada y las fechas están libres.</p>
                </div>
            `;
            setTimeout(loadMyReservationsPanel, 2500);
        }

        renderCalendar();
        updatePrice();
    } catch (error) {
        console.error("Error cancelando reserva:", error);
        alert('Error al cancelar la reserva. Intenta de nuevo.');
        loadMyReservationsPanel();
    }
}

// ============================================
// MIS RESERVAS - BÚSQUEDA (LOOKUP)
// ============================================
async function lookupReservation() {
    const code = document.getElementById('lookupCode')?.value?.trim();
    const email = document.getElementById('lookupEmail')?.value?.trim();
    const errorDiv = document.getElementById('lookupError');

    if (!code || !email) {
        showEditError(errorDiv, 'Ingresa tu código de reserva y email.');
        return;
    }

    // Recargar datos de Firebase
    await loadReservationsData();

    const found = dbReservations.find(r =>
        r.id && r.id.toUpperCase() === code.toUpperCase() &&
        r.guestEmail && r.guestEmail.toLowerCase() === email.toLowerCase()
    );

    if (found) {
        saveMyReservationCode(found.id, found.guestEmail);
        loadMyReservationsPanel();
    } else {
        showEditError(errorDiv, 'No se encontró ninguna reserva con ese código y email.');
    }
}

// Mostrar errores de validación
function showEditError(errorDiv, message) {
    if (!errorDiv) return;
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
    setTimeout(() => errorDiv.classList.remove('show'), 5000);
}
