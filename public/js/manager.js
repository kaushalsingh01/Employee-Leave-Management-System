// public/js/manager.js

// Check authentication and role
requireAuth();
if (!API.hasRole('manager')) {
    window.location.href = '/dashboard.html';
}

// Load user data
const user = API.getCurrentUser();
if (user) {
    document.getElementById('userName').textContent = user.name;
    document.getElementById('userRole').textContent = 'Manager';
}

// Global calendar variables
let currentMonth = new Date().getMonth() + 1;
let currentYear = new Date().getFullYear();
let calendarLeaves = [];
let teamMembers = [];
let selectedEmployee = 'all';
let calendarGrid = [];

// Load initial data
loadPendingRequests();
loadCalendarData(); // Load calendar on page load

// Logout handler
document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    API.auth.logout();
});

// Helper function to show alerts/notifications
function showNotification(message, type = 'info') {
    // Check if showAlert exists (from your existing code)
    if (typeof showAlert === 'function') {
        showAlert(message, type);
    } else {
        // Fallback notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : '#2196F3'};
            color: white;
            border-radius: 4px;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}

// Tab switching
function showTab(tab) {
    const pendingTab = document.getElementById('pendingTab');
    const teamTab = document.getElementById('teamTab');
    const pendingBtn = document.querySelector('button[onclick="showTab(\'pending\')"]');
    const teamBtn = document.querySelector('button[onclick="showTab(\'team\')"]');

    if (tab === 'pending') {
        pendingTab.style.display = 'block';
        teamTab.style.display = 'none';
        pendingBtn.classList.add('btn');
        pendingBtn.classList.remove('btn-secondary');
        teamBtn.classList.remove('btn');
        teamBtn.classList.add('btn-secondary');
        loadPendingRequests();
    } else {
        pendingTab.style.display = 'none';
        teamTab.style.display = 'block';
        teamBtn.classList.add('btn');
        teamBtn.classList.remove('btn-secondary');
        pendingBtn.classList.remove('btn');
        pendingBtn.classList.add('btn-secondary');
        loadTeamRequests();
    }
}

// Load pending requests
async function loadPendingRequests() {
    const container = document.getElementById('pendingContainer');
    if (!container) return;

    try {
        const requests = await API.leave.getPendingRequests();

        if (requests.length === 0) {
            container.innerHTML = '<p>No pending requests.</p>';
            return;
        }

        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Employee</th>
                        <th>Leave Type</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th>Days</th>
                        <th>Reason</th>
                        <th>Submitted</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${requests.map(request => `
                        <tr>
                            <td>${request.employee_name}</td>
                            <td>${request.leave_type || 'N/A'}</td>
                            <td>${new Date(request.start_date).toLocaleDateString()}</td>
                            <td>${new Date(request.end_date).toLocaleDateString()}</td>
                            <td>${calculateDays(request.start_date, request.end_date)}</td>
                            <td>${request.reason.substring(0, 30)}${request.reason.length > 30 ? '...' : ''}</td>
                            <td>${new Date(request.submitted_at).toLocaleDateString()}</td>
                            <td>
                                <div class="action-buttons">
                                    <button class="action-btn approve-btn" onclick="openActionModal(${request.id}, '${request.employee_name}')">Review</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

    } catch (error) {
        container.innerHTML = '<p class="alert alert-error">Failed to load pending requests</p>';
    }
}

// Load team requests
async function loadTeamRequests() {
    const container = document.getElementById('teamContainer');
    if (!container) return;

    try {
        const requests = await API.leave.getTeamRequests();

        if (requests.length === 0) {
            container.innerHTML = '<p>No team requests found.</p>';
            return;
        }

        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Employee</th>
                        <th>Leave Type</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th>Days</th>
                        <th>Reason</th>
                        <th>Status</th>
                        <th>Submitted</th>
                        <th>Reviewed By</th>
                    </tr>
                </thead>
                <tbody>
                    ${requests.map(request => `
                        <tr>
                            <td>${request.employee_name}</td>
                            <td>${request.leave_type || 'N/A'}</td>
                            <td>${new Date(request.start_date).toLocaleDateString()}</td>
                            <td>${new Date(request.end_date).toLocaleDateString()}</td>
                            <td>${calculateDays(request.start_date, request.end_date)}</td>
                            <td>${request.reason.substring(0, 30)}${request.reason.length > 30 ? '...' : ''}</td>
                            <td><span class="status-badge status-${request.status}">${request.status}</span></td>
                            <td>${new Date(request.submitted_at).toLocaleDateString()}</td>
                            <td>${request.reviewer_name || 'Pending'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

    } catch (error) {
        container.innerHTML = '<p class="alert alert-error">Failed to load team requests</p>';
    }
}

// Calculate days between dates
function calculateDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

// Action modal functionality
let currentActionId = null;
let currentAction = null;
const actionModal = document.getElementById('actionModal');
const actionForm = document.getElementById('actionForm');
const requestDetails = document.getElementById('requestDetails');
const modalTitle = document.getElementById('modalTitle');

async function openActionModal(requestId, employeeName) {
    currentActionId = requestId;

    try {
        // Load request details
        const request = await API.leave.getRequest(requestId);

        modalTitle.textContent = `Review Request from ${employeeName}`;
        requestDetails.innerHTML = `
            <div style="margin-bottom: 20px; padding: 10px; background: var(--background-color); border-radius: 4px;">
                <p><strong>Leave Type:</strong> ${request.leave_type || 'N/A'}</p>
                <p><strong>Dates:</strong> ${new Date(request.start_date).toLocaleDateString()} - ${new Date(request.end_date).toLocaleDateString()}</p>
                <p><strong>Days:</strong> ${calculateDays(request.start_date, request.end_date)}</p>
                <p><strong>Reason:</strong> ${request.reason}</p>
            </div>
        `;

        actionModal.classList.add('active');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function setAction(action) {
    currentAction = action;

    // Update button styles
    document.querySelectorAll('.action-btn.approve, .action-btn.reject').forEach(btn => {
        btn.classList.remove('active');
    });

    if (action === 'approved') {
        document.querySelector('.action-btn.approve').classList.add('active');
    } else if (action === 'rejected') {
        document.querySelector('.action-btn.reject').classList.add('active');
    }
}

function closeActionModal() {
    currentActionId = null;
    currentAction = null;
    actionModal.classList.remove('active');
    document.getElementById('comments').value = '';

    // Reset action buttons
    document.querySelectorAll('.action-btn.approve, .action-btn.reject').forEach(btn => {
        btn.classList.remove('active');
    });
}

if (actionForm) {
    actionForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!currentAction) {
            showNotification('Please select Approve or Reject', 'warning');
            return;
        }

        const comments = document.getElementById('comments').value;

        if (currentAction === 'rejected' && !comments) {
            showNotification('Comments are required when rejecting', 'warning');
            return;
        }

        try {
            const btn = e.submitter;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner" style="width: 20px; height: 20px; margin: 0;"></span> Processing...';

            await API.leave.processRequest(currentActionId, currentAction, comments);

            showNotification(`Request ${currentAction} successfully`, 'success');
            closeActionModal();

            // Refresh data
            loadPendingRequests();

        } catch (error) {
            if (error.details && error.details.length > 0) {
                error.details.forEach(detail => showNotification(detail, 'error'));
            } else {
                showNotification(error.message, 'error');
            }
        } finally {
            const btn = e.submitter;
            btn.disabled = false;
            btn.innerHTML = 'Submit';
        }
    });
}

// ============ CALENDAR FUNCTIONS ============

// Load calendar data
async function loadCalendarData() {
    try {
        const response = await API.leave.getCalendarData(currentMonth, currentYear);

        if (response) {
            calendarLeaves = response.leaves || [];
            teamMembers = response.teamMembers || [];
            calendarGrid = response.calendar || [];

            // Populate employee filter
            populateEmployeeFilter();

            // Render calendar
            renderMonthDisplay();
            renderCalendar();
        }
    } catch (error) {
        console.error('Failed to load calendar:', error);
        showNotification('Failed to load calendar data', 'error');
    }
}

// Populate employee filter dropdown
function populateEmployeeFilter() {
    const filter = document.getElementById('employeeFilter');
    if (!filter) return;

    filter.innerHTML = '<option value="all">All Team Members</option>';

    if (teamMembers && teamMembers.length > 0) {
        teamMembers.forEach(member => {
            const option = document.createElement('option');
            option.value = member.id;
            option.textContent = member.name;
            filter.appendChild(option);
        });
    }
}

// Render month display
function renderMonthDisplay() {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const display = document.getElementById('currentMonthDisplay');
    if (display) {
        display.textContent = `${monthNames[currentMonth - 1]} ${currentYear}`;
    }
}

// Render calendar grid
function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    if (!grid) return;

    // Get filtered leaves
    const filteredLeaves = getFilteredLeaves();

    // Generate calendar HTML
    let html = '';
    for (let week = 0; week < calendarGrid.length; week++) {
        for (let day = 0; day < 7; day++) {
            const dayData = calendarGrid[week]?.[day];

            if (!dayData) {
                html += '<div class="calendar-day empty"></div>';
                continue;
            }

            // Get leaves for this day (filtered)
            const dayLeaves = filteredLeaves.filter(leave =>
                dayData.leaves && dayData.leaves.some(l => l.id === leave.id)
            );

            const classes = ['calendar-day'];
            if (dayData.isToday) classes.push('today');

            html += `
                <div class="${classes.join(' ')}" data-date="${dayData.date}">
                    <div class="day-number">${dayData.day}</div>
                    <div class="leave-indicators">
                        ${renderLeaveBadges(dayLeaves)}
                    </div>
                </div>
            `;
        }
    }

    grid.innerHTML = html;

    // Add click handlers to days
    grid.querySelectorAll('.calendar-day:not(.empty)').forEach(day => {
        day.addEventListener('click', () => showDayDetails(day.dataset.date));
    });
}

// Render leave badges for a day
function renderLeaveBadges(leaves) {
    if (!leaves || !leaves.length) return '';

    // Show up to 3 badges, then indicate more
    const visibleLeaves = leaves.slice(0, 3);
    const remainingCount = leaves.length - 3;

    let badges = visibleLeaves.map(leave => `
        <div class="leave-badge ${getLeaveTypeClass(leave.leave_type)}" 
             title="${leave.employee_name} - ${leave.reason || 'No reason'}">
            ${leave.employee_name ? leave.employee_name.split(' ')[0] : 'Employee'}: ${leave.leave_type || 'Leave'}
        </div>
    `).join('');

    if (remainingCount > 0) {
        badges += `<div class="more-indicator">+${remainingCount} more</div>`;
    }

    return badges;
}

// Get CSS class for leave type
function getLeaveTypeClass(leaveType) {
    const typeMap = {
        'Vacation': 'vacation',
        'Sick Leave': 'sick',
        'Personal Leave': 'personal'
    };
    return typeMap[leaveType] || 'vacation';
}

// Get filtered leaves based on selected employee
function getFilteredLeaves() {
    if (!calendarLeaves) return [];

    if (selectedEmployee === 'all') {
        return calendarLeaves;
    }
    return calendarLeaves.filter(leave =>
        leave.user_id === parseInt(selectedEmployee)
    );
}

// Show day details modal
function showDayDetails(date) {
    if (!calendarLeaves) return;

    const dayLeaves = calendarLeaves.filter(leave => {
        const leaveStart = new Date(leave.start_date);
        const leaveEnd = new Date(leave.end_date);
        const currentDate = new Date(date);
        return currentDate >= leaveStart && currentDate <= leaveEnd;
    });

    if (!dayLeaves.length) {
        showNotification('No leaves on this day', 'info');
        return;
    }

    const modal = document.getElementById('leaveModal');
    const details = document.getElementById('leaveDetails');

    if (modal && details) {
        details.innerHTML = dayLeaves.map(leave => `
            <div class="leave-detail-item">
                <div>
                    <span class="employee-name">${leave.employee_name || 'Unknown'}</span>
                    <span class="leave-type ${getLeaveTypeClass(leave.leave_type)}">${leave.leave_type || 'Leave'}</span>
                </div>
                <div class="leave-dates">
                    ${formatDate(leave.start_date)} - ${formatDate(leave.end_date)}
                </div>
                <div class="leave-reason">${leave.reason || 'No reason provided'}</div>
            </div>
        `).join('');

        modal.style.display = 'block';
    }
}

// Format date for display
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

// Navigate to previous month
async function previousMonth() {
    if (currentMonth === 1) {
        currentMonth = 12;
        currentYear--;
    } else {
        currentMonth--;
    }
    await loadCalendarData();
}

// Navigate to next month
async function nextMonth() {
    if (currentMonth === 12) {
        currentMonth = 1;
        currentYear++;
    } else {
        currentMonth++;
    }
    await loadCalendarData();
}

// Handle employee filter change
function handleEmployeeFilterChange() {
    const filter = document.getElementById('employeeFilter');
    if (filter) {
        selectedEmployee = filter.value;
        renderCalendar();
    }
}

// Initialize calendar event listeners
function initCalendarListeners() {
    // Previous month button
    const prevBtn = document.getElementById('prevMonth');
    if (prevBtn) {
        prevBtn.addEventListener('click', previousMonth);
    }

    // Next month button
    const nextBtn = document.getElementById('nextMonth');
    if (nextBtn) {
        nextBtn.addEventListener('click', nextMonth);
    }

    // Employee filter
    const filter = document.getElementById('employeeFilter');
    if (filter) {
        filter.addEventListener('change', handleEmployeeFilterChange);
    }

    // Modal close button
    const closeBtn = document.querySelector('.close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            const modal = document.getElementById('leaveModal');
            if (modal) modal.style.display = 'none';
        });
    }

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('leaveModal');
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// Initialize calendar when page loads
if (document.getElementById('calendarGrid')) {
    initCalendarListeners();
}

// Close modal when clicking outside (for action modal)
window.addEventListener('click', (e) => {
    if (e.target === actionModal) {
        closeActionModal();
    }
});