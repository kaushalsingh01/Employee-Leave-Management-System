// public/js/auth.js

// Check if already logged in
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
        if (API.isAuthenticated()) {
            redirectToDashboard();
        }
    }
});

// Login form handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            showLoading(loginForm);
            const response = await API.auth.login(email, password);

            showAlert('Login successful! Redirecting...', 'success');

            setTimeout(() => {
                redirectToDashboard();
            }, 1500);

        } catch (error) {
            hideLoading(loginForm);
            showAlert(error.message, 'error');
        }
    });
}

// Register form handler
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    // Show/hide manager field based on role
    const roleSelect = document.getElementById('role');
    const managerField = document.getElementById('managerField');

    roleSelect.addEventListener('change', () => {
        if (roleSelect.value === 'employee') {
            managerField.style.display = 'block';
        } else {
            managerField.style.display = 'none';
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            password: document.getElementById('password').value,
            role: document.getElementById('role').value
        };

        // Add manager_id if employee and provided
        if (formData.role === 'employee') {
            const managerId = document.getElementById('manager_id').value;
            if (managerId) {
                formData.manager_id = parseInt(managerId);
            }
        }

        try {
            showLoading(registerForm);
            await API.auth.register(formData);

            showAlert('Registration successful! Please login.', 'success');

            setTimeout(() => {
                window.location.href = '/';
            }, 2000);

        } catch (error) {
            hideLoading(registerForm);

            if (error.details && error.details.length > 0) {
                error.details.forEach(detail => showAlert(detail, 'error'));
            } else {
                showAlert(error.message, 'error');
            }
        }
    });
}

// Helper functions
function showAlert(message, type) {
    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) return;

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
        <span>${message}</span>
        <button class="alert-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    alertContainer.appendChild(alert);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 5000);
}

function showLoading(form) {
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width: 20px; height: 20px; margin: 0;"></span> Loading...';
}

function hideLoading(form) {
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = false;
    btn.innerHTML = btn.classList.contains('btn-danger') ? 'Cancel Request' :
        btn.classList.contains('btn-success') ? 'Approve' :
            btn.classList.contains('btn-secondary') ? 'Reject' : 'Submit';
}