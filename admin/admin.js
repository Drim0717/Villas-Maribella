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
}

function populateMonthFilter() {
    const monthFilter = document.getElementById('monthFilter');
    if (!monthFilter || monthFilter.options.length > 1) return; // Ya está lleno

    const months = [
        { val: '2025-11', label: 'Noviembre 2025' },
        { val: '2025-12', label: 'Diciembre 2025' },
        { val: '2026-01', label: 'Enero 2026' },
        { val: '2026-02', label: 'Febrero 2026' },
        { val: '2026-03', label: 'Marzo 2026' }
    ];

    months.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.val;
        opt.textContent = m.label;
        monthFilter.appendChild(opt);
    });
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

    reservations.forEach(reservation => {
        const checkIn = new Date(reservation.checkIn);
        const checkOut = new Date(reservation.checkOut);
        const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
        const villaNumber = reservation.villaNumber || 'N/A';
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
                <span class="badge ${reservation.status === 'confirmed' ? 'bg-success' : (reservation.status === 'pending' ? 'bg-warning text-dark' : 'bg-secondary')}">
                    ${getStatusText(reservation.status)}
                </span>
                ${reservation.isLocal ? '<div style="font-size:0.7em; color:orange;">(Offline)</div>' : ''}
            </td>
            <td>
                <div class="d-flex gap-1 justify-content-center">
                    <button class="btn btn-outline-primary btn-sm" onclick="editReservation('${reservation.id}')" title="Editar"><i class="bi bi-pencil"></i></button>
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
// ============================================
// RESERVATION MANAGEMENT
// ============================================
function editReservation(id) {
    const reservation = allReservations.find(r => r.id === id); // Find in global state

    if (!reservation) return;

    document.getElementById('editReservationId').value = reservation.firestoreId; // Use Firestore ID for updates
    document.getElementById('editGuestName').value = reservation.guestName;
    document.getElementById('editGuestEmail').value = reservation.guestEmail;
    document.getElementById('editCheckIn').value = reservation.checkIn;
    document.getElementById('editCheckOut').value = reservation.checkOut;
    document.getElementById('editNumGuests').value = reservation.numGuests;
    document.getElementById('editStatus').value = reservation.status || 'confirmed';

    document.getElementById('editModal').style.display = 'flex';
}

async function handleEditReservation(e) {
    e.preventDefault();

    const firestoreId = document.getElementById('editReservationId').value;
    if (!firestoreId) return;

    const checkIn = document.getElementById('editCheckIn').value;
    const checkOut = document.getElementById('editCheckOut').value;
    const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));

    const updatedData = {
        guestName: document.getElementById('editGuestName').value,
        guestEmail: document.getElementById('editGuestEmail').value,
        checkIn: checkIn,
        checkOut: checkOut,
        numGuests: parseInt(document.getElementById('editNumGuests').value),
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

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

async function deleteReservation(firestoreId) {
    if (!confirm('¿Estás seguro de que deseas eliminar esta reserva?')) return;

    try {
        await deleteDoc(doc(db, "reservations", firestoreId));
        alert('Reserva eliminada');
        // Snapshot listener will auto-update the UI
    } catch (error) {
        console.error("Error removing document: ", error);
        alert("Error al eliminar la reserva");
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
    blockedDates.push({
        startDate: startDate,
        endDate: endDate,
        reason: reason
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
            const guestList = occupancyInfo.guests.map(g => `<div class="guest-name" title="Villa #${g.villa}">${g.name} (V${g.villa})</div>`).join('');
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
    allReservations.forEach(reservation => {
        const checkIn = new Date(reservation.checkIn);
        const checkOut = new Date(reservation.checkOut);
        const villaNum = reservation.villaNumber || 'N/A';
        for (let d = new Date(checkIn); d < checkOut; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            if (!occupiedMap[dateStr]) {
                occupiedMap[dateStr] = { date: dateStr, guests: [] };
            }
            occupiedMap[dateStr].guests.push({ name: reservation.guestName, villa: villaNum });
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
window.changeMonth = changeMonth;
