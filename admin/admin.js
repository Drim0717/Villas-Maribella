// ============================================
// ADMIN PANEL - VILLAS MARIBELLA
// ============================================

import { db } from '../client/firebase-config.js';
import { collection, onSnapshot, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const ADMIN_PASSWORD = 'Maribella';
const PRICE_PER_NIGHT = 45;

let allReservations = [];
let allBlockedDates = [];
let currentCalendarMonth = new Date().getMonth();
let currentCalendarYear = new Date().getFullYear();

// Modal Edit State
let currentEditReservationId = null;
let editSelectedCheckIn = null;
let editSelectedCheckOut = null;
let editVillaId = null;
let editCurrentMonth = new Date();

// ============================================
// AUTHENTICATION
// ============================================
function initializeEventListeners() {
    // Block dates form
    const blockDatesForm = document.getElementById('blockDatesForm');
    if (blockDatesForm) {
        blockDatesForm.addEventListener('submit', handleBlockDates);
    }

    // Edit form
    const editForm = document.getElementById('editForm');
    if (editForm) {
        editForm.addEventListener('submit', handleEditReservation);
    }

    // Event delegation for dynamically created buttons
    document.addEventListener('click', function (e) {
        // Handle edit button clicks
        if (e.target.classList.contains('edit-btn-small')) {
            const reservationId = e.target.getAttribute('data-reservation-id');
            if (reservationId) {
                editReservation(reservationId);
            }
        }

        // Handle delete button clicks
        if (e.target.classList.contains('delete-btn-small')) {
            const firestoreId = e.target.getAttribute('data-firestore-id');
            if (firestoreId) {
                deleteReservation(firestoreId);
            }
        }

        // Handle unblock button clicks
        if (e.target.classList.contains('unblock-btn')) {
            const blockIndex = e.target.getAttribute('data-block-index');
            if (blockIndex !== null) {
                unblockDates(parseInt(blockIndex));
            }
        }
    });

    // Add month filter event listener
    const monthFilter = document.getElementById('monthFilter');
    if (monthFilter) {
        monthFilter.addEventListener('change', loadDashboardData);
    }

    const showPastReservations = document.getElementById('showPastReservations');
    if (showPastReservations) {
        showPastReservations.addEventListener('change', loadReservationsTable);
    }

    const calendarVillaFilter = document.getElementById('calendarVillaFilter');
    if (calendarVillaFilter) {
        calendarVillaFilter.addEventListener('change', renderCalendar);
    }

    // Bootstrap Tab Events
    const tabEl = document.querySelector('button[data-bs-target="#calendar-panel"]');
    if (tabEl) {
        tabEl.addEventListener('shown.bs.tab', function (event) {
            renderCalendar();
        });
    }

    // Navigation buttons
    document.getElementById('prevMonthAdmin')?.addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonthAdmin')?.addEventListener('click', () => changeMonth(1));
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
}

function initializeApp() {
    console.log('Initializing admin panel...');

    // Setup all event listeners
    initializeEventListeners();

    // Check if already logged in
    if (localStorage.getItem('adminLoggedIn') === 'true') {
        showDashboard();
        return;
    }

    // Login form handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const password = document.getElementById('adminPassword').value;

            if (password === ADMIN_PASSWORD) {
                localStorage.setItem('adminLoggedIn', 'true');
                showDashboard();
            } else {
                alert('Contraseña incorrecta');
            }
        });
        console.log('Login form handler attached successfully');
    } else {
        console.error('Login form not found!');
    }
}

// Handle both document ready states
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM is already ready
    initializeApp();
}

function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'block';

    // Initialize Firestore Listener
    initRealTimeUpdates();
}

function initRealTimeUpdates() {
    const unsubscribe = onSnapshot(collection(db, "reservations"), (snapshot) => {
        allReservations = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            data.firestoreId = doc.id; // Important for edit/delete
            allReservations.push(data);
        });
        console.log("Datos actualizados desde Firebase", allReservations);
        loadDashboardData();
    }, (error) => {
        console.error("Error obteniendo datos en tiempo real:", error);
    });
}

function logout() {
    localStorage.removeItem('adminLoggedIn');
    location.reload();
}

// ============================================
// DATA LOADING
// ============================================
function loadDashboardData() {
    populateMonthFilter();
    loadReservationsTable();
    loadBlockedDates();
    updateStatistics();

    // Refresh calendar if element exists
    if (document.getElementById('adminCalendar')) {
        renderCalendar();
    }
}

function populateMonthFilter() {
    const monthFilter = document.getElementById('monthFilter');
    if (!monthFilter) return;

    // Set default value to current month if empty
    if (!monthFilter.value) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        monthFilter.value = `${year}-${month}`;
    }
}

function refreshData() {
    // With onSnapshot, manual refresh isn't strictly needed for data, but good for UI state
    loadDashboardData();
    alert('Datos actualizados (Sincronización en tiempo real activa)');
}

function loadReservationsTable() {
    let reservations = [...allReservations];

    // Cargar reservas locales (Backup)
    const localReservations = JSON.parse(localStorage.getItem('villasReservationsBackup') || '[]');

    // Fusionar evitando duplicados (por ID de reserva)
    localReservations.forEach(localRes => {
        if (!reservations.some(r => r.id === localRes.id)) {
            // Marcar visualmente que es local
            localRes.isLocal = true;
            reservations.push(localRes);
        }
    });

    const tbody = document.getElementById('reservationsBody');
    tbody.innerHTML = '';

    // Aplicar filtro por mes si está seleccionado
    // Aplicar filtro por mes si está seleccionado
    const monthFilter = document.getElementById('monthFilter');
    if (monthFilter && monthFilter.value && monthFilter.value !== 'all') {
        const selectedMonth = monthFilter.value; // formato: "2026-01"
        reservations = reservations.filter(reservation => {
            if (!reservation.checkIn) return false;
            const checkInMonth = reservation.checkIn.substring(0, 7);
            return checkInMonth === selectedMonth;
        });
    }

    // Filtro para ocultar reservas pasadas (default: ocultas)
    const showPastCheckbox = document.getElementById('showPastReservations');
    const isMonthFilterActive = monthFilter && monthFilter.value && monthFilter.value !== 'all';

    // Solo ocultamos pasadas si: 
    // 1. El checkbox NO está marcado
    // 2. NO hay un filtro de mes específico seleccionado (si el usuario busca un mes, quiere ver todo ese mes)
    if (showPastCheckbox && !showPastCheckbox.checked && !isMonthFilterActive) {
        const todayStr = new Date().toISOString().split('T')[0];
        reservations = reservations.filter(reservation => reservation.checkOut >= todayStr);
    }

    // Sort by date (newest first)
    reservations.sort((a, b) => new Date(b.createdAt || b.checkIn) - new Date(a.createdAt || a.checkIn));

    if (reservations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 2rem;">No hay reservas para este período</td></tr>';
        return;
    }

    // Mapeo de IDs viejos a nuevos para consistencia visual
    const villaMapping = {
        '1': 'B-1', '2': 'C-1', '3': 'D-1',
        '4': 'AA-1', '5': 'AB-1', '6': 'AF-1',
        '1A': 'B-1', '2B': 'C-1', '3C': 'D-1',
        '4D': 'AA-1', '5E': 'AB-1', '6F': 'AF-1',
        '6G': 'AF-1'
    };

    reservations.forEach(reservation => {
        const checkIn = new Date(reservation.checkIn);
        const checkOut = new Date(reservation.checkOut);
        const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

        let villaNumber = reservation.villaNumber || 'N/A';
        // Si el ID es viejo (solo número), lo convertimos al nuevo formato
        if (villaMapping[villaNumber]) {
            villaNumber = villaMapping[villaNumber];
        }

        const totalAmount = typeof reservation.total === 'number' ? reservation.total : 0;
        const numGuests = reservation.numGuests || 1;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><small class="text-muted fw-bold">${reservation.id}</small></td>
            <td><strong>Villa #${villaNumber}</strong></td>
            <td>${reservation.guestName || 'Sin Nombre'}</td>
            <td><small>${reservation.guestEmail || ''}</small></td>
            <td>${formatDate(reservation.checkIn)}</td>
            <td>${formatDate(reservation.checkOut)}</td>
            <td>${nights}</td>
            <td>${numGuests}</td>
            <td class="fw-bold">$${totalAmount.toFixed(2)}</td>
            <td>
                <select class="form-select form-select-sm status-select ${reservation.status}" 
                        onchange="quickUpdateStatus('${reservation.firestoreId}', this.value)"
                        style="width: auto; font-size: 0.75rem; font-weight: 600;">
                    <option value="pending" ${reservation.status === 'pending' ? 'selected' : ''}>Pendiente</option>
                    <option value="confirmed" ${reservation.status === 'confirmed' ? 'selected' : ''}>Confirmada</option>
                    <option value="completed" ${reservation.status === 'completed' ? 'selected' : ''}>Completada</option>
                    <option value="cancelled" ${reservation.status === 'cancelled' ? 'selected' : ''}>Cancelada</option>
                </select>
                ${reservation.isLocal ? '<div style="font-size:0.7em; color:orange;">(Offline)</div>' : ''}
            </td>
            <td>
                <div class="d-flex gap-1 justify-content-center">
                    <button class="btn btn-outline-primary btn-sm" onclick="editReservation('${reservation.id}')" title="Editar"><i class="bi bi-calendar-event"></i></button>
                    <button class="btn btn-outline-danger btn-sm" onclick="deleteReservation('${reservation.firestoreId}')" title="Eliminar"><i class="bi bi-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function loadBlockedDates() {
    const blockedDates = getBlockedDates();
    const container = document.getElementById('blockedDatesList');
    if (!container) return;
    container.innerHTML = '';

    if (blockedDates.length === 0) {
        container.innerHTML = '<p class="no-data">No hay fechas bloqueadas</p>';
        return;
    }

    blockedDates.forEach((block, index) => {
        const div = document.createElement('div');
        div.className = 'blocked-date-item';
        div.innerHTML = `
            <div class="blocked-date-info">
                <strong>${formatDate(block.startDate)} - ${formatDate(block.endDate)}</strong>
                <p>${block.reason}</p>
            </div>
            <button class="unblock-btn" data-block-index="${index}">Desbloquear</button>
        `;
        container.appendChild(div);
    });
}

function updateStatistics() {
    const reservations = allReservations; // Use global state
    const blockedDates = getBlockedDates();

    // Total Reservations
    document.getElementById('totalReservations').textContent = reservations.length;

    // Total Revenue
    const totalRevenue = reservations.reduce((sum, r) => sum + r.total, 0);
    document.getElementById('totalRevenue').textContent = `$${totalRevenue.toFixed(2)}`;

    // Occupancy Rate and Blocked Days logic removed to prevent UI errors
}

// ============================================
// RESERVATION MANAGEMENT
// ============================================
function editReservation(id) {
    console.log("Iniciando editReservation para ID:", id);
    const reservation = allReservations.find(r => String(r.id) === String(id));

    if (!reservation) {
        console.error("Reserva no encontrada");
        return;
    }

    currentEditReservationId = reservation.firestoreId;

    const villaMapping = {
        '1': 'B-1', '2': 'C-1', '3': 'D-1',
        '4': 'AA-1', '5': 'AB-1', '6': 'AF-1',
        '1A': 'B-1', '2B': 'C-1', '3C': 'D-1',
        '4D': 'AA-1', '5E': 'AB-1', '6F': 'AF-1',
        '6G': 'AF-1'
    };
    let vNumber = String(reservation.villaNumber || 'B-1');
    if (villaMapping[vNumber]) vNumber = villaMapping[vNumber];

    editVillaId = vNumber;

    // Configurar fechas para el calendario y inputs
    const checkInVal = reservation.checkIn || formatDateISO(new Date());
    const checkOutVal = reservation.checkOut || formatDateISO(new Date(Date.now() + 86400000));

    editSelectedCheckIn = new Date(checkInVal + 'T12:00:00');
    editSelectedCheckOut = new Date(checkOutVal + 'T12:00:00');

    if (isNaN(editSelectedCheckIn.getTime())) editSelectedCheckIn = new Date();
    if (isNaN(editSelectedCheckOut.getTime())) editSelectedCheckOut = new Date(Date.now() + 86400000);

    editCurrentMonth = new Date(editSelectedCheckIn.getFullYear(), editSelectedCheckIn.getMonth(), 1);

    document.getElementById('editReservationId').value = reservation.firestoreId || '';
    document.getElementById('editGuestName').value = reservation.guestName || '';
    document.getElementById('editGuestEmail').value = reservation.guestEmail || '';
    document.getElementById('editCheckIn').value = checkInVal;
    document.getElementById('editCheckOut').value = checkOutVal;
    document.getElementById('editNumGuests').value = reservation.numGuests || 1;
    document.getElementById('editStatus').value = reservation.status || 'confirmed';

    const editVillaLabel = document.getElementById('editVillaLabel');
    if (editVillaLabel) editVillaLabel.textContent = editVillaId;

    // Mostrar modal con Bootstrap API o fallback manual
    const modalEl = document.getElementById('editModal');
    if (modalEl) {
        try {
            if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                let modal = bootstrap.Modal.getInstance(modalEl);
                if (!modal) modal = new bootstrap.Modal(modalEl);
                modal.show();
            } else {
                // Fallback si Bootstrap no cargó correctamente
                modalEl.style.display = 'block';
                modalEl.classList.add('show');
                document.body.classList.add('modal-open');
                if (!document.querySelector('.modal-backdrop')) {
                    const b = document.createElement('div');
                    b.className = 'modal-backdrop fade show';
                    document.body.appendChild(b);
                }
            }
        } catch (e) {
            console.error("Error al abrir modal:", e);
            modalEl.style.display = 'block';
            modalEl.classList.add('show');
        }
    }

    renderEditCalendar();
}

async function quickUpdateStatus(firestoreId, newStatus) {
    if (!firestoreId) return;
    try {
        await updateDoc(doc(db, "reservations", firestoreId), { status: newStatus });
        console.log("Estado actualizado a:", newStatus);
    } catch (error) {
        console.error("Error actualizando estado:", error);
        alert("Error al actualizar el estado");
    }
}

async function handleEditReservation(e) {
    e.preventDefault();

    const firestoreId = document.getElementById('editReservationId').value;
    if (!firestoreId) return;

    const checkIn = document.getElementById('editCheckIn').value;
    const checkOut = document.getElementById('editCheckOut').value;
    const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));

    // Only updating dates and status as requested
    const updatedData = {
        checkIn: checkIn,
        checkOut: checkOut,
        status: document.getElementById('editStatus').value,
        total: nights * PRICE_PER_NIGHT
    };

    try {
        await updateDoc(doc(db, "reservations", firestoreId), updatedData);
        closeEditModal();
        alert('Reserva actualizada exitosamente');
    } catch (error) {
        console.error("Error updating document: ", error);
        alert("Error al actualizar la reserva");
    }
}

async function deleteReservation(firestoreId) {
    if (!firestoreId) return;
    if (!confirm('¿Estás seguro de que deseas eliminar esta reserva? Esta acción no se puede deshacer.')) return;

    try {
        await deleteDoc(doc(db, "reservations", firestoreId));
        console.log("Reserva eliminada satisfactoriamente");
        // snapshot listener updates UI
    } catch (error) {
        console.error("Error removing document: ", error);
        alert("Error al eliminar la reserva");
    }
}

function closeEditModal() {
    const modalEl = document.getElementById('editModal');
    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) {
            modal.hide();
        } else {
            modalEl.style.display = 'none';
        }
    }
}

// ============================================
// EDIT CALENDAR VIEW FUNCTIONS
// ============================================
function changeEditMonth(delta) {
    editCurrentMonth.setMonth(editCurrentMonth.getMonth() + delta);
    renderEditCalendar();
}

function formatDateISO(date) {
    if (!date || isNaN(new Date(date).getTime())) return '';
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
}

function getEditDayStatus(date) {
    const dateStr = formatDateISO(date);

    let hasCheckIn = false;
    let hasCheckOut = false;
    let isMiddleDay = false;

    const villaMapping = {
        '1': 'B-1', '2': 'C-1', '3': 'D-1',
        '4': 'AA-1', '5': 'AB-1', '6': 'AF-1',
        '1A': 'B-1', '2B': 'C-1', '3C': 'D-1',
        '4D': 'AA-1', '5E': 'AB-1', '6F': 'AF-1',
        '6G': 'AF-1'
    };

    // Verificar reservas de Firestore
    allReservations.forEach(reservation => {
        if (reservation.firestoreId === currentEditReservationId) return;

        let resVilla = String(reservation.villaNumber);
        if (villaMapping[resVilla]) resVilla = villaMapping[resVilla];

        const checkVilla = editVillaId;
        const matchesVilla = resVilla === checkVilla;
        const isCancelled = reservation.status === 'cancelled';

        if (matchesVilla && !isCancelled) {
            // Compare actual strings for precise matching
            if (dateStr === reservation.checkIn) hasCheckIn = true;
            if (dateStr === reservation.checkOut) hasCheckOut = true;
            if (dateStr > reservation.checkIn && dateStr < reservation.checkOut) isMiddleDay = true;
        }
    });

    // Verificar fechas bloqueadas
    const blockedDates = getBlockedDates();
    blockedDates.forEach(block => {
        const matchesVilla = !block.villaNumber || block.villaNumber == editVillaId;
        if (matchesVilla && dateStr >= block.startDate && dateStr <= block.endDate) {
            isMiddleDay = true;
        }
    });

    if (isMiddleDay) return 'fully-reserved';
    if (hasCheckIn && hasCheckOut) return 'fully-reserved';
    if (hasCheckIn) return 'checkin-reserved';
    if (hasCheckOut) return 'checkout-reserved';

    return 'available';
}

function selectEditDate(date) {
    const status = getEditDayStatus(date);
    const dateStr = formatDateISO(date);

    const checkInEl = document.getElementById('editCheckIn');
    const checkOutEl = document.getElementById('editCheckOut');

    const editCheckInStr = editSelectedCheckIn ? formatDateISO(editSelectedCheckIn) : null;
    const editCheckOutStr = editSelectedCheckOut ? formatDateISO(editSelectedCheckOut) : null;

    if (editCheckInStr && dateStr === editCheckInStr) {
        editSelectedCheckIn = editSelectedCheckOut;
        editSelectedCheckOut = null;
        checkInEl.value = editSelectedCheckIn ? formatDateISO(editSelectedCheckIn) : '';
        checkOutEl.value = '';
    } else if (editCheckOutStr && dateStr === editCheckOutStr) {
        editSelectedCheckOut = null;
        checkOutEl.value = '';
    } else if (!editCheckInStr || (editCheckInStr && editCheckOutStr) || (dateStr < editCheckInStr)) {
        if (status === 'checkin-reserved') {
            alert('El check-in no está disponible para este día.');
            return;
        }
        editSelectedCheckIn = new Date(dateStr + 'T12:00:00');
        editSelectedCheckOut = null;
        checkInEl.value = formatDateISO(editSelectedCheckIn);
        checkOutEl.value = '';
    } else if (dateStr > editCheckInStr) {
        if (status === 'checkout-reserved') {
            alert('El check-out no está disponible para este día.');
            return;
        }

        let targetCheckOut = new Date(dateStr + 'T12:00:00');
        if (!isEditRangeAvailable(editSelectedCheckIn, targetCheckOut)) {
            alert('No se puede seleccionar este rango porque contiene fechas bloqueadas u ocupadas.');
            return;
        }
        editSelectedCheckOut = targetCheckOut;
        checkOutEl.value = formatDateISO(targetCheckOut);
    }
    renderEditCalendar();
}

function isEditRangeAvailable(start, end) {
    if (!start || !end) return true;
    let tempDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    let safetyCounter = 0; // limit 300 days to prevent infinite loop
    while (tempDate <= endDate && safetyCounter < 300) {
        safetyCounter++;
        const status = getEditDayStatus(tempDate);
        const dateStr = formatDateISO(tempDate);
        const startStr = formatDateISO(start);
        const endStr = formatDateISO(endDate);

        if (dateStr === startStr) {
            if (status === 'fully-reserved' || status === 'checkin-reserved') return false;
        } else if (dateStr === endStr) {
            if (status === 'fully-reserved' || status === 'checkout-reserved') return false;
        } else {
            if (status !== 'available') return false;
        }

        tempDate.setDate(tempDate.getDate() + 1);
    }
    return true;
}

function renderEditCalendar() {
    const calendar = document.getElementById('editCalendar');
    const monthYear = document.getElementById('editMonthYear');
    if (!calendar || !monthYear) return;

    const firstDay = new Date(editCurrentMonth.getFullYear(), editCurrentMonth.getMonth(), 1);
    const lastDay = new Date(editCurrentMonth.getFullYear(), editCurrentMonth.getMonth() + 1, 0);

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    monthYear.textContent = `${monthNames[editCurrentMonth.getMonth()]} ${editCurrentMonth.getFullYear()}`;

    calendar.innerHTML = '';

    ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day-header';
        dayHeader.textContent = day;
        calendar.appendChild(dayHeader);
    });

    for (let i = 0; i < firstDay.getDay(); i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day empty';
        calendar.appendChild(emptyDay);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checkInStrFixed = editSelectedCheckIn ? formatDateISO(editSelectedCheckIn) : null;
    const checkOutStrFixed = editSelectedCheckOut ? formatDateISO(editSelectedCheckOut) : null;

    for (let day = 1; day <= lastDay.getDate(); day++) {
        const dayDate = new Date(editCurrentMonth.getFullYear(), editCurrentMonth.getMonth(), day);
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = day;

        const status = getEditDayStatus(dayDate);

        if (dayDate < today) {
            dayElement.classList.add('past');
        } else if (status === 'fully-reserved') {
            dayElement.classList.add('reserved');
        } else {
            dayElement.classList.add(status);

            const dateStr = formatDateISO(dayDate);
            const inSelected = checkInStrFixed && dateStr === checkInStrFixed;
            const outSelected = checkOutStrFixed && dateStr === checkOutStrFixed;
            const inRange = checkInStrFixed && checkOutStrFixed && dateStr > checkInStrFixed && dateStr < checkOutStrFixed;

            if (inSelected || outSelected) dayElement.classList.add('selected');
            if (inRange) dayElement.classList.add('in-range');

            dayElement.onclick = () => selectEditDate(dayDate);
        }

        calendar.appendChild(dayElement);
    }
}


// ============================================
// CALENDAR BLOCKING
// ============================================
// ============================================
// CALENDAR BLOCKING (Still LocalStorage for now to keep changes focused)
// ============================================
function handleBlockDates(e) {
    e.preventDefault();

    const startDate = document.getElementById('blockStartDate').value;
    const endDate = document.getElementById('blockEndDate').value;
    const reason = document.getElementById('blockReason').value;

    if (new Date(endDate) < new Date(startDate)) {
        alert('La fecha de fin debe ser posterior a la fecha de inicio');
        return;
    }

    const blockedDates = getBlockedDates();
    const villaNumber = document.getElementById('blockVillaSelect').value;

    blockedDates.push({
        startDate: startDate,
        endDate: endDate,
        reason: reason,
        villaNumber: villaNumber
    });

    saveBlockedDates(blockedDates);
    loadBlockedDates();
    updateStatistics();
    document.getElementById('blockDatesForm').reset();
    alert('Fechas bloqueadas exitosamente');
}

function unblockDates(index) {
    if (!confirm('¿Deseas desbloquear estas fechas?')) return;

    const blockedDates = getBlockedDates();
    blockedDates.splice(index, 1);
    saveBlockedDates(blockedDates);
    loadBlockedDates();
    updateStatistics();
    alert('Fechas desbloqueadas');
}

// ============================================
// LOCAL STORAGE FUNCTIONS
// ============================================
// getReservations and saveReservations REMOVED - using Firebase

function getBlockedDates() {
    const data = localStorage.getItem('villasBlockedDates');
    return data ? JSON.parse(data) : [];
}

function saveBlockedDates(blockedDates) {
    localStorage.setItem('villasBlockedDates', JSON.stringify(blockedDates));
}

// ============================================
// EXPOSE FUNCTIONS TO WINDOW
// ============================================
// Cleanup: Removed manual window assignments in favor of event listeners
// window.logout = logout; 
// window.switchTab = switchTab; 
// window.refreshData = refreshData;
window.closeEditModal = closeEditModal;
window.showAddReservation = showAddReservation; // Critical for inline onclick in admin.html

// ============================================
// TAB SWITCHING (Removed - handled by Bootstrap)
// ============================================

function showAddReservation() {
    alert('Esta función permite agregar reservas manualmente. Por ahora, las reservas se crean desde la página principal.');
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function getStatusText(status) {
    const statuses = {
        'confirmed': 'Confirmada',
        'pending': 'Pendiente',
        'cancelled': 'Cancelada'
    };
    return statuses[status] || status;
}

// Close modal when clicking outside (Bootstrap handles this, but keeping if needed for custom modals)
// window.onclick = function (event) { ... } REMOVED

// ============================================
// CALENDAR VIEW FUNCTIONS
// ============================================
function renderCalendar() {
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    document.getElementById('currentMonthYear').textContent = `${monthNames[currentCalendarMonth]} ${currentCalendarYear}`;
    const firstDay = new Date(currentCalendarYear, currentCalendarMonth, 1);
    const lastDay = new Date(currentCalendarYear, currentCalendarMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const calendarGrid = document.getElementById('adminCalendar'); // Fixed ID mismatch
    if (!calendarGrid) {
        console.error("Critical: 'adminCalendar' element not found in DOM.");
        return;
    }
    calendarGrid.innerHTML = '';
    const dayHeaders = ['Dom', 'Lun', 'Mar', 'Mi�', 'Jue', 'Vie', 'S�b'];
    dayHeaders.forEach(day => {
        const headerCell = document.createElement('div');
        headerCell.className = 'calendar-day-header';
        headerCell.textContent = day;
        calendarGrid.appendChild(headerCell);
    });
    for (let i = 0; i < startingDayOfWeek; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day empty';
        calendarGrid.appendChild(emptyCell);
    }
    const occupiedDates = getOccupiedDates();
    const blockedDates = getBlockedDates();
    const calendarVillaFilter = document.getElementById('calendarVillaFilter');
    const selectedVilla = calendarVillaFilter ? calendarVillaFilter.value : 'all';

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${currentCalendarYear}-${String(currentCalendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';

        let occupancyInfo = occupiedDates.find(od => od.date === dateStr);
        // Filtrar info de ocupación si hay una villa seleccionada
        if (occupancyInfo && selectedVilla !== 'all') {
            // Clonar para no mutar original y filtrar guests
            const filteredGuests = occupancyInfo.guests.filter(g => g.villa == selectedVilla);
            if (filteredGuests.length > 0) {
                occupancyInfo = { ...occupancyInfo, guests: filteredGuests };
            } else {
                occupancyInfo = null; // No hay ocupación para esta villa en este día
            }
        }

        const blockInfo = blockedDates.find(bd => dateStr >= bd.startDate && dateStr <= bd.endDate);
        if (blockInfo) {
            dayCell.classList.add('blocked');
            dayCell.innerHTML = `<div class="day-number">${day}</div><div class="day-info">🚫 Bloqueado</div>`;
        } else if (occupancyInfo && occupancyInfo.guests.length > 0) {
            dayCell.classList.add('occupied');
            const guestList = occupancyInfo.guests.map(g => {
                let badgeClass = 'bg-secondary';
                if (g.type.includes('Entrada')) badgeClass = 'bg-success';
                else if (g.type.includes('Salida')) badgeClass = 'bg-danger';

                return `<div class="guest-name" title="Villa #${g.villa}">
                    <span class="badge ${badgeClass}" style="font-size: 0.6rem; padding: 2px 4px;">${g.type.replace(/[()]/g, '').trim()}</span>
                    <strong>${g.name}</strong> <small>(V${g.villa})</small>
                </div>`;
            }).join('');
            dayCell.innerHTML = `<div class="day-number">${day}</div><div class="day-info">${guestList}</div>`;
        } else {
            dayCell.classList.add('available');
            dayCell.innerHTML = `<div class="day-number">${day}</div>`;
        }
        calendarGrid.appendChild(dayCell);
    }
}
function getOccupiedDates() {
    const occupiedMap = {};
    const villaMapping = {
        '1': 'B-1', '2': 'C-1', '3': 'D-1',
        '4': 'AA-1', '5': 'AB-1', '6': 'AF-1',
        '1A': 'B-1', '2B': 'C-1', '3C': 'D-1',
        '4D': 'AA-1', '5E': 'AB-1', '6F': 'AF-1',
        '6G': 'AF-1'
    };

    allReservations.forEach(reservation => {
        const checkInStr = reservation.checkIn;
        const checkOutStr = reservation.checkOut;
        let vNum = String(reservation.villaNumber || 'N/A');
        if (villaMapping[vNum]) vNum = villaMapping[vNum];

        let d = new Date(checkInStr + 'T12:00:00');
        const end = new Date(checkOutStr + 'T12:00:00');

        while (d <= end) {
            const dateStr = formatDateISO(d);
            if (!occupiedMap[dateStr]) {
                occupiedMap[dateStr] = { date: dateStr, guests: [] };
            }

            let type = '';
            if (dateStr === checkInStr) type = ' (Entrada)';
            else if (dateStr === checkOutStr) type = ' (Salida)';

            occupiedMap[dateStr].guests.push({ name: reservation.guestName, villa: vNum, type: type });
            d.setDate(d.getDate() + 1);
        }
    });
    return Object.values(occupiedMap);
}
function changeMonth(delta) {
    currentCalendarMonth += delta;
    if (currentCalendarMonth > 11) {
        currentCalendarMonth = 0;
        currentCalendarYear++;
    } else if (currentCalendarMonth < 0) {
        currentCalendarMonth = 11;
        currentCalendarYear--;
    }
    renderCalendar();
}
// Export functions to global scope for HTML event handlers
window.editReservation = editReservation;
window.deleteReservation = deleteReservation;
window.quickUpdateStatus = quickUpdateStatus;
window.closeEditModal = closeEditModal;
window.logout = logout;
window.changeMonth = changeMonth;
window.changeEditMonth = changeEditMonth;
window.loadDashboardData = loadDashboardData;
window.loadReservationsTable = loadReservationsTable;
