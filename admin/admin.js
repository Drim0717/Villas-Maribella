// ============================================
// ADMIN PANEL - VILLAS MARIBELLA
// ============================================

import { db } from '../client/firebase-config.js';
import { collection, onSnapshot, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const ADMIN_PASSWORD = 'Maribella';
const PRICE_PER_NIGHT = 45;

let allReservations = []; // Global state for reservations
let allBlockedDates = []; // Global state for blocked dates

// ============================================
// AUTHENTICATION
// ============================================
document.addEventListener('DOMContentLoaded', function () {
    // Check if already logged in
    if (localStorage.getItem('adminLoggedIn') === 'true') {
        showDashboard();
    }

    // Login form handler
    document.getElementById('loginForm').addEventListener('submit', function (e) {
        e.preventDefault();
        const password = document.getElementById('adminPassword').value;

        if (password === ADMIN_PASSWORD) {
            localStorage.setItem('adminLoggedIn', 'true');
            showDashboard();
        } else {
            alert('Contraseña incorrecta');
        }
    });

    // Block dates form
    document.getElementById('blockDatesForm').addEventListener('submit', handleBlockDates);

    // Edit form
    document.getElementById('editForm').addEventListener('submit', handleEditReservation);

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
});

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
    loadReservationsTable(); // Renamed to avoid confusion
    loadBlockedDates();
    updateStatistics();
}

function refreshData() {
    // With onSnapshot, manual refresh isn't strictly needed for data, but good for UI state
    loadDashboardData();
    alert('Datos actualizados (Sincronización en tiempo real activa)');
}

function loadReservationsTable() {
    let reservations = [...allReservations]; // Copy from global state
    const tbody = document.getElementById('reservationsBody');
    tbody.innerHTML = '';

    // Aplicar filtro por mes si está seleccionado
    const monthFilter = document.getElementById('monthFilter');
    if (monthFilter && monthFilter.value) {
        const selectedMonth = monthFilter.value; // formato: "2025-01"
        reservations = reservations.filter(reservation => {
            const checkInMonth = reservation.checkIn.substring(0, 7); // "2025-01-15" -> "2025-01"
            return checkInMonth === selectedMonth;
        });
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

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${reservation.id}</td>
            <td><strong>Villa #${villaNumber}</strong></td>
            <td>${reservation.guestName}</td>
            <td>${reservation.guestEmail}</td>
            <td>${formatDate(reservation.checkIn)}</td>
            <td>${formatDate(reservation.checkOut)}</td>
            <td>${nights}</td>
            <td>${reservation.numGuests}</td>
            <td>$${reservation.total.toFixed(2)}</td>
            <td><span class="status-badge ${reservation.status}">${getStatusText(reservation.status)}</span></td>
            <td class="action-buttons">
                <button class="edit-btn-small" data-reservation-id="${reservation.id}">✏️</button>
                <button class="delete-btn-small" data-firestore-id="${reservation.firestoreId}">🗑️</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function loadBlockedDates() {
    const blockedDates = getBlockedDates();
    const container = document.getElementById('blockedDatesList');
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

    // Occupancy Rate (simplified calculation)
    const totalNights = reservations.reduce((sum, r) => {
        const checkIn = new Date(r.checkIn);
        const checkOut = new Date(r.checkOut);
        return sum + Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    }, 0);
    const occupancyRate = Math.min(100, Math.round((totalNights / 365) * 100));
    document.getElementById('occupancyRate').textContent = `${occupancyRate}%`;

    // Blocked Days Count
    const blockedDaysCount = blockedDates.reduce((sum, block) => {
        const start = new Date(block.startDate);
        const end = new Date(block.endDate);
        return sum + Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    }, 0);
    document.getElementById('blockedDaysCount').textContent = blockedDaysCount;
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
// TAB SWITCHING
// ============================================
function switchTab(tabName) {
    // Update tab buttons
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // Update tab content
    document.getElementById('reservationsTab').classList.remove('active');
    document.getElementById('calendarTab').classList.remove('active');

    if (tabName === 'reservations') {
        document.getElementById('reservationsTab').classList.add('active');
    } else {
        document.getElementById('calendarTab').classList.add('active');
    }
}

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

// Close modal when clicking outside
window.onclick = function (event) {
    if (event.target.id === 'editModal') {
        closeEditModal();
    }
}
