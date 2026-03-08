const BaseAppError = require("../errors/baseAppError");

const validate = {
    register: (req, res, next) => {
        const { name, email, password, role, manager_id } = req.body;
        const errors = [];

        // Name validation
        if (!name || name.trim().length < 2) {
            errors.push("Name must be at least 2 characters long");
        } else if (name.trim().length > 100) {
            errors.push("Name cannot exceed 100 characters");
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            errors.push("Valid email is required");
        } else if (email.length > 100) {
            errors.push("Email cannot exceed 100 characters");
        }

        // Password validation - stronger requirements
        if (!password) {
            errors.push("Password is required");
        } else {
            if (password.length < 6) {
                errors.push("Password must be at least 6 characters long");
            }
            if (password.length > 255) {
                errors.push("Password cannot exceed 255 characters");
            }
        }

        // Role validation
        if (!role || !["employee", "manager"].includes(role)) {
            errors.push("Role must be either 'employee' or 'manager'");
        }

        // Manager ID validation (if provided)
        if (manager_id !== undefined && manager_id !== null) {
            const managerIdNum = parseInt(manager_id);
            if (isNaN(managerIdNum) || managerIdNum <= 0) {
                errors.push("Manager ID must be a valid positive number");
            }
        }

        if (errors.length > 0) {
            throw new BaseAppError({
                message: "Registration validation failed",
                errorCode: "VALIDATION_ERROR",
                statusCode: 400,
                type: "VALIDATION_ERROR",
                details: errors,
            });
        }
        next();
    },

    login: (req, res, next) => {
        const { email, password } = req.body;
        const errors = [];

        // Email validation
        if (!email) {
            errors.push("Email is required");
        } else {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                errors.push("Valid email is required");
            }
        }

        // Password validation
        if (!password) {
            errors.push("Password is required");
        } else if (password.length < 6) {
            errors.push("Password must be at least 6 characters long");
        }

        if (errors.length > 0) {
            throw new BaseAppError({
                message: "Login validation failed",
                errorCode: "VALIDATION_ERROR",
                statusCode: 400,
                type: "VALIDATION_ERROR",
                details: errors,
            });
        }
        next();
    },

    leaveRequest: (req, res, next) => {
        const { leave_type_id, start_date, end_date, reason } = req.body;
        const errors = [];

        // Leave type validation
        if (!leave_type_id) {
            errors.push("Leave type is required");
        } else {
            const leaveTypeIdNum = parseInt(leave_type_id);
            if (isNaN(leaveTypeIdNum) || leaveTypeIdNum <= 0) {
                errors.push("Leave type ID must be a valid positive number");
            }
        }

        // Date validation - remove duplicate check
        if (!start_date || !end_date) {
            errors.push("Start date and end date are required");
        } else {
            const start = new Date(start_date);
            const end = new Date(end_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Check if dates are valid
            if (isNaN(start.getTime())) {
                errors.push("Invalid start date format");
            }
            if (isNaN(end.getTime())) {
                errors.push("Invalid end date format");
            }

            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                if (start < today) {
                    errors.push("Start date cannot be in the past");
                }

                if (end < start) {
                    errors.push("End date must be after start date");
                }

                // Calculate days difference (inclusive)
                const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
                if (daysDiff > 30) {
                    errors.push("Leave request cannot exceed 30 days");
                }
                if (daysDiff < 1) {
                    errors.push("Leave request must be at least 1 day");
                }
            }
        }

        // Reason validation
        if (!reason) {
            errors.push("Reason is required");
        } else if (reason.trim().length < 10) {
            errors.push("Reason must be at least 10 characters long");
        } else if (reason.trim().length > 500) {
            errors.push("Reason cannot exceed 500 characters");
        }

        if (errors.length > 0) {
            throw new BaseAppError({
                message: "Leave request validation failed",
                errorCode: "VALIDATION_ERROR",
                statusCode: 400,
                type: "VALIDATION_ERROR",
                details: errors,
            });
        }
        next();
    },

    approveReject: (req, res, next) => {
        const { status, comments } = req.body;
        const errors = [];

        // Status validation
        if (!status) {
            errors.push("Status is required");
        } else if (!["approved", "rejected"].includes(status)) {
            errors.push("Status must be either 'approved' or 'rejected'");
        }

        // Comments validation based on status
        if (status === "rejected") {
            if (!comments) {
                errors.push("Comments are required when rejecting a request");
            } else if (comments.trim().length < 5) {
                errors.push("Comments must be at least 5 characters long");
            } else if (comments.trim().length > 500) {
                errors.push("Comments cannot exceed 500 characters");
            }
        } else if (status === "approved" && comments && comments.trim().length > 500) {
            errors.push("Comments cannot exceed 500 characters");
        }

        if (errors.length > 0) {
            throw new BaseAppError({
                message: "Approval/Rejection validation failed",
                errorCode: "VALIDATION_ERROR",
                statusCode: 400,
                type: "VALIDATION_ERROR",
                details: errors,
            });
        }

        next();
    },

    idParam: (req, res, next) => {
        const id = parseInt(req.params.id);

        if (isNaN(id) || id <= 0) {
            throw new BaseAppError({
                message: "Invalid ID parameter",
                errorCode: "INVALID_ID",
                statusCode: 400,
                type: "VALIDATION_ERROR",
            });
        }
        req.params.id = id;
        next();
    },

    employeeIdParam: (req, res, next) => {
        const employeeId = parseInt(req.params.employeeId || req.params.employee_id);

        if (isNaN(employeeId) || employeeId <= 0) {
            throw new BaseAppError({
                message: "Invalid employee ID parameter",
                errorCode: "INVALID_EMPLOYEE_ID",
                statusCode: 400,
                type: "VALIDATION_ERROR",
            });
        }
        req.params.employeeId = employeeId;
        next();
    },

    dateRange: (req, res, next) => {
        const { startDate, endDate } = req.query;
        const errors = [];

        if (startDate || endDate) {
            if (startDate) {
                const start = new Date(startDate);
                if (isNaN(start.getTime())) {
                    errors.push("Invalid start date format in query");
                }
            }

            if (endDate) {
                const end = new Date(endDate);
                if (isNaN(end.getTime())) {
                    errors.push("Invalid end date format in query");
                }
            }

            if (startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                if (end < start) {
                    errors.push("End date cannot be before start date");
                }
            }
        }

        if (errors.length > 0) {
            throw new BaseAppError({
                message: "Date range validation failed",
                errorCode: "VALIDATION_ERROR",
                statusCode: 400,
                type: "VALIDATION_ERROR",
                details: errors,
            });
        }
        next();
    },

    pagination: (req, res, next) => {
        const { page, limit } = req.query;
        const errors = [];

        if (page) {
            const pageNum = parseInt(page);
            if (isNaN(pageNum) || pageNum < 1) {
                errors.push("Page must be a positive number");
            }
        }

        if (limit) {
            const limitNum = parseInt(limit);
            if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
                errors.push("Limit must be between 1 and 100");
            }
        }

        if (errors.length > 0) {
            throw new BaseAppError({
                message: "Pagination validation failed",
                errorCode: "VALIDATION_ERROR",
                statusCode: 400,
                type: "VALIDATION_ERROR",
                details: errors,
            });
        }
        next();
    },

    cancelRequest: (req, res, next) => {
        const { reason } = req.body;
        const errors = [];

        if (reason && reason.trim().length > 500) {
            errors.push("Cancellation reason cannot exceed 500 characters");
        }

        if (errors.length > 0) {
            throw new BaseAppError({
                message: "Cancellation validation failed",
                errorCode: "VALIDATION_ERROR",
                statusCode: 400,
                type: "VALIDATION_ERROR",
                details: errors,
            });
        }
        next();
    },

    idsArray: (req, res, next) => {
        const { ids } = req.body;
        const errors = [];

        if (!ids || !Array.isArray(ids)) {
            errors.push("IDs must be provided as an array");
        } else {
            for (const id of ids) {
                const idNum = parseInt(id);
                if (isNaN(idNum) || idNum <= 0) {
                    errors.push("All IDs must be valid positive numbers");
                    break;
                }
            }
        }

        if (errors.length > 0) {
            throw new BaseAppError({
                message: "IDs array validation failed",
                errorCode: "VALIDATION_ERROR",
                statusCode: 400,
                type: "VALIDATION_ERROR",
                details: errors,
            });
        }
        next();
    }
};

module.exports = validate;