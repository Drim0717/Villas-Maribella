// ============================================
// SISTEMA DE RESERVAS - VILLAS MARIBELLA
// ============================================
import CONFIG from './config.js';

const VILLA_CONFIG = {
    'B-1': { price: 55, maxGuests: 2, name: 'Villa B-1' },
    'C-1': { price: 55, maxGuests: 2, name: 'Villa C-1' },
    'D-1': { price: 55, maxGuests: 2, name: 'Villa D-1' },
    'AA-1': { price: 85, maxGuests: 4, name: 'Villa AA-1' },
    'AB-1': { price: 85, maxGuests: 4, name: 'Villa AB-1' },
    'AF-1': { price: 85, maxGuests: 4, name: 'Villa AF-1' }
};

let currentVillaId = 'B-1';
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
        currentMonth.setDate(1);
        currentMonth.setMonth(currentMonth.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('nextMonth').addEventListener('click', () => {
        currentMonth.setDate(1);
        currentMonth.setMonth(currentMonth.getMonth() + 1);
        renderCalendar();
    });

    // Event listener para número de personas
    document.getElementById('numGuests').addEventListener('input', updatePrice);

    // Event listener para el formulario
    document.getElementById('reservationForm').addEventListener('submit', handleReservation);

    // Initial capacity setup
    updateCapacityLabel();

    // Click fuera del modal para cerrar
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.addEventListener('click', function (e) {
            // Solo cerrar si el click es directamente en el modal (fondo oscuro)
            if (e.target === modal) {
                closePaymentModal();
            }
        });
    }

    // Prevenir que clicks dentro del contenido cierren el modal
    const modalContent = document.getElementById('modalContent');
    if (modalContent) {
        modalContent.addEventListener('click', function (e) {
            e.stopPropagation();
        });
    }
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
        guestCountDisplay.innerText = numGuests;
    }
}

function updateCapacityLabel() {
    const label = document.getElementById('maxCapacityLabel');
    const smallLabel = document.getElementById('maxCapacitySmall');
    const max = VILLA_CONFIG[currentVillaId].maxGuests;

    if (label) {
        label.innerText = `Huéspedes máx. para Villa #${currentVillaId}: ${max}`;
    }
    if (smallLabel) {
        smallLabel.innerText = max;
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
                // Marcar como disponible para interacción
                dayElement.classList.add('available');

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

// Verificar si un rango de fechas está disponible (sin bloqueos ni otras reservas en medio)
function isRangeAvailable(start, end, villaId) {
    if (!start || !end) return true;

    // Asegurar que comparamos fechas normalizadas (00:00:00)
    let tempDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    // Validar cada día del rango
    // Nota: El día de check-out suele ser el mediodía, así que se permite que sea 
    // el mismo día que otro check-in. Por eso el bucle es < endDate.
    while (tempDate < endDate) {
        if (isReserved(new Date(tempDate), villaId)) {
            console.warn("Rango inválido: Fecha bloqueada detectada en", formatDate(tempDate));
            return false;
        }
        tempDate.setDate(tempDate.getDate() + 1);
    }

    return true;
}

// Verificar si una fecha está reservada para una villa específica
function isReserved(date, villaId) {
    if (!(date instanceof Date)) date = new Date(date);

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
    const dateStr = date.toDateString();

    // LÓGICA DE DESELECCIÓN: Si ya está seleccionada como check-in o check-out, se quita
    if (selectedCheckIn && dateStr === selectedCheckIn.toDateString()) {
        selectedCheckIn = selectedCheckOut; // Shift check-out to check-in if check-in is removed
        selectedCheckOut = null;
        document.getElementById('checkIn').value = selectedCheckIn ? formatDate(selectedCheckIn) : '';
        document.getElementById('checkOut').value = '';
    } else if (selectedCheckOut && dateStr === selectedCheckOut.toDateString()) {
        selectedCheckOut = null;
        document.getElementById('checkOut').value = '';
    } else if (!selectedCheckIn || (selectedCheckIn && selectedCheckOut)) {
        // Primera selección o reiniciar después de tener un rango completo
        selectedCheckIn = date;
        selectedCheckOut = null;
        document.getElementById('checkIn').value = formatDate(date);
        document.getElementById('checkOut').value = '';
    } else if (date > selectedCheckIn) {
        // Segunda selección (check-out)
        // VALIDACIÓN: Verificar si hay fechas bloqueadas en el rango
        if (!isRangeAvailable(selectedCheckIn, date)) {
            resetForm();
            showNotification('Rango No Disponible', 'No se puede seleccionar este rango porque contiene fechas ya reservadas o bloqueadas. Por favor elige otro periodo.', true);
            return;
        }

        selectedCheckOut = date;
        document.getElementById('checkOut').value = formatDate(date);
    } else {
        // Si selecciona una fecha anterior al check-in actual, esta se convierte en el nuevo check-in
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
        showNotification('Faltan Datos', 'Por favor selecciona las fechas de tu estadía', true);
        return;
    }

    const villaSelect = document.getElementById('villaSelect');
    const selectedVilla = villaSelect ? villaSelect.value : '';

    if (!selectedVilla) {
        showNotification('Seleccionar Villa', 'Por favor selecciona una villa', true);
        return;
    }

    // Doble verificación de disponibilidad antes de proceder
    if (!isRangeAvailable(selectedCheckIn, selectedCheckOut, selectedVilla)) {
        showNotification('No Disponible', 'Lo sentimos, algunas fechas en este rango ya no están disponibles. Por favor selecciona un nuevo período en el calendario.', true);
        resetForm();
        return;
    }

    const guestsValue = parseInt(document.getElementById('numGuests').value);
    if (guestsValue > VILLA_CONFIG[selectedVilla].maxGuests) {
        showNotification('Capacidad Excedida', `El máximo de personas permitidas para Villa #${selectedVilla} es ${VILLA_CONFIG[selectedVilla].maxGuests}.`, true);
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
    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = `
        <button class="btn-close-modal" onclick="closePaymentModal()" aria-label="Cerrar">×</button>
        <h3 class="text-primary fw-bold mb-4">Datos para Transferencia</h3>
        <p class="text-muted mb-4">Selecciona tu banco y realiza la transferencia por el monto total. Conserva tu comprobante.</p>
        
        <div class="accordion accordion-flush" id="bankAccordion">
            <!-- Bank of America -->
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

            <!-- Banco Popular Dominicano -->
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

// Procesar pago (simulado)
// Procesar pago (simulado)
async function executePayment(method) {
    console.log("Iniciando procesamiento de pago...", method);

    // Validar fechas antes de continuar
    if (!selectedCheckIn || !selectedCheckOut) {
        showNotification('Error', "Error de fechas. Por favor recarga la página.", true);
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

        // Intentar enviar correo (backend)
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
        }).catch(err => console.log("Servidor de correos no detectado (Localhost:3000)"));

        // Mensaje personalizado según el estado
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

        // Auto-reload después de 3 segundos
        setTimeout(() => {
            location.reload();
        }, 3000);
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

// Mostrar notificación personalizada
function showNotification(title, message, isError = false) {
    const modal = document.getElementById('paymentModal');
    const modalContent = document.getElementById('modalContent');
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

// Cerrar modal
function closePaymentModal() {
    document.getElementById('paymentModal').style.display = 'none';
    document.body.classList.remove('modal-open');
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
            showNotification('Error Crítico', "Error al guardar la reserva. Por favor intenta de nuevo.", true);
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

const villaImages = {
    'B-1': ['../images/villas/B-1/sala.jpg', '../images/villas/B-1/cocina.jpg', '../images/villas/B-1/bano.jpg'],
    'C-1': ['../images/villas/C-1/sala.jpg', '../images/villas/C-1/cocina.jpg', '../images/villas/C-1/bano.jpg'],
    'D-1': ['../images/villas/D-1/sala.jpg', '../images/villas/D-1/cocina.jpg', '../images/villas/D-1/bano.jpg'],
    'AA-1': ['../images/villas/AA-1/sala.jpg', '../images/villas/AA-1/cocina.jpg', '../images/villas/AA-1/bano.jpg'],
    'AB-1': ['../images/villas/AB-1/sala.jpg', '../images/villas/AB-1/cocina.jpg', '../images/villas/AB-1/bano.jpg'],
    'AF-1': ['../images/villas/AF-1/sala.jpg', '../images/villas/AF-1/cocina.jpg', '../images/villas/AF-1/bano.jpg']
};

let currentVillaImageIndex = 0;
let currentVillaNumber = 'B-1'; // Changed to string to match VILLA_CONFIG keys

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
    selectVilla('B-1'); // Use the first villa code
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

    // REINICIAR SELECCIÓN al cambiar de villa para evitar errores de disponibilidad
    selectedCheckIn = null;
    selectedCheckOut = null;
    if (document.getElementById('checkIn')) document.getElementById('checkIn').value = '';
    if (document.getElementById('checkOut')) document.getElementById('checkOut').value = '';

    // IMPORTANTE: Recargar el calendario para mostrar disponibilidad de esta villa
    loadReservationsData().then(() => {
        renderCalendar();
        updatePrice();
    });
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
