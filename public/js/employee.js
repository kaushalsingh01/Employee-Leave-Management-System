// public/js/employee.js

// Check authentication
requireAuth();

// Load user data
const user = API.getCurrentUser();
if (user) {
    document.getElementById('userName').textContent = user.name;
    document.getElementById('userRole').textContent = user.role;
}

// Load initial data
loadBalance();
loadMyRequests();

// Logout handler
document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    API.auth.logout();
});

// Leave form handler
const leaveForm = document.getElementById('leaveForm');
if (leaveForm) {
    // Set min date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('start_date').min = today;
    document.getElementById('end_date').min = today;

    leaveForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = {
            leave_type_id: parseInt(document.getElementById('leave_type_id').value),
            start_date: document.getElementById('start_date').value,
            end_date: document.getElementById('end_date').value,
            reason: document.getElementById('reason').value
        };

        try {
            showLoading(leaveForm);
            await API.leave.submit(formData);

            showAlert('Leave request submitted successfully!', 'success');
            leaveForm.reset();

            // Refresh data
            await loadBalance();
            await loadMyRequests();

        } catch (error) {
            if (error.details && error.details.length > 0) {
                error.details.forEach(detail => showAlert(detail, 'error'));
            } else {
                showAlert(error.message, 'error');
            }
        } finally {
            hideLoading(leaveForm);
        }
    });
}

// Load leave balance
async function loadBalance() {
    const container = document.getElementById('balanceContainer');
    if (!container) return;

    try {
        const balances = await API.leave.getMyBalance();

        if (balances.length === 0) {
            container.innerHTML = '<p>No balance information available.</p>';
            return;
        }

        container.innerHTML = balances.map(balance => `
            <div class="balance-card">
                <h4>${balance.leave_type}</h4>
                <div class="balance-value">${balance.balance}</div>
                <div>days remaining</div>
            </div>
        `).join('');

    } catch (error) {
        container.innerHTML = '<p class="alert alert-error">Failed to load balance</p>';
    }
}

// Load my leave requests
async function loadMyRequests() {
    const container = document.getElementById('requestsContainer');
    if (!container) return;

    try {
        const requests = await API.leave.getMyRequests();

        if (requests.length === 0) {
            container.innerHTML = '<p>No leave requests found.</p>';
            return;
        }

        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Leave Type</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th>Days</th>
                        <th>Reason</th>
                        <th>Status</th>
                        <th>Submitted</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${requests.map(request => `
                        <tr>
                            <td>${request.leave_type || 'N/A'}</td>
                            <td>${new Date(request.start_date).toLocaleDateString()}</td>
                            <td>${new Date(request.end_date).toLocaleDateString()}</td>
                            <td>${calculateDays(request.start_date, request.end_date)}</td>
                            <td>${request.reason.substring(0, 30)}${request.reason.length > 30 ? '...' : ''}</td>
                            <td><span class="status-badge status-${request.status}">${request.status}</span></td>
                            <td>${new Date(request.submitted_at).toLocaleDateString()}</td>
                            <td>
                                ${request.status === 'pending' ?
                `<button class="action-btn btn-danger" onclick="openCancelModal(${request.id})">Cancel</button>` :
                '-'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

    } catch (error) {
        container.innerHTML = '<p class="alert alert-error">Failed to load requests</p>';
    }
}

// Calculate days between dates
function calculateDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

// Cancel request functionality
let currentCancelId = null;
const cancelModal = document.getElementById('cancelModal');
const cancelForm = document.getElementById('cancelForm');

function openCancelModal(requestId) {
    currentCancelId = requestId;
    cancelModal.classList.add('active');
}

function closeCancelModal() {
    currentCancelId = null;
    cancelModal.classList.remove('active');
    document.getElementById('cancelReason').value = '';
}

if (cancelForm) {
    cancelForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const reason = document.getElementById('cancelReason').value;

        try {
            const btn = cancelForm.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner" style="width: 20px; height: 20px; margin: 0;"></span> Canceling...';

            await API.leave.cancelRequest(currentCancelId, reason);

            showAlert('Request cancelled successfully', 'success');
            closeCancelModal();

            // Refresh data
            await loadMyRequests();

        } catch (error) {
            showAlert(error.message, 'error');
        } finally {
            const btn = cancelForm.querySelector('button[type="submit"]');
            btn.disabled = false;
            btn.innerHTML = 'Cancel Request';
        }
    });
}

// Show loading spinner inside a form
function showLoading(form) {
    const btn = form.querySelector('button[type="submit"]');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner" style="width: 20px; height: 20px;"></span> Loading...';
    }
}

// Hide loading spinner and restore button text
function hideLoading(form) {
    const btn = form.querySelector('button[type="submit"]');
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Submit';
    }
}

// Simple alert utility
function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) return;

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;

    alertContainer.appendChild(alert);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === cancelModal) {
        closeCancelModal();
    }
});