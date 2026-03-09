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

// Load initial data
loadPendingRequests();

// Logout handler
document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    API.auth.logout();
});

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
        showAlert(error.message, 'error');
    }
}

function setAction(action) {
    currentAction = action;
}

function closeActionModal() {
    currentActionId = null;
    currentAction = null;
    actionModal.classList.remove('active');
    document.getElementById('comments').value = '';
}

if (actionForm) {
    actionForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!currentAction) {
            showAlert('Please select Approve or Reject', 'warning');
            return;
        }

        const comments = document.getElementById('comments').value;

        if (currentAction === 'rejected' && !comments) {
            showAlert('Comments are required when rejecting', 'warning');
            return;
        }

        try {
            const btn = e.submitter;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner" style="width: 20px; height: 20px; margin: 0;"></span> Processing...';

            await API.leave.processRequest(currentActionId, currentAction, comments);

            showAlert(`Request ${currentAction} successfully`, 'success');
            closeActionModal();

            // Refresh data
            loadPendingRequests();

        } catch (error) {
            if (error.details && error.details.length > 0) {
                error.details.forEach(detail => showAlert(detail, 'error'));
            } else {
                showAlert(error.message, 'error');
            }
        }
    });
}

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === actionModal) {
        closeActionModal();
    }
});