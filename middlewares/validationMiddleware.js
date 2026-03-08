const BaseAppError = require("../errors/baseAppError");

const validate = {
    register: (req, res, next) => {
        const {name, email, password, role} = req.body;
        const errors = [];
        
        if(!name || name.trim().length < 2){
            errors.push("Name must be at least 2 characters long");
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if(!email || !emailRegex.test(email)) {
            errors.push("Valid email is required");
        }

        if(!password || password.length < 6) {
            errors.push("Password must be at least 6 characters long");
        }

        if (!role || !["employee", "manager"].includes(role)) {
            errors.push("Role must be either 'employee' or 'manager'");
        }
        if (errors.length > 0) {
            throw new BaseAppError({
                message: "Validation failed",
                errorCode: "VALIDATION_ERROR",
                statusCode: 400,
                type: "VALIDATION_ERROR",
                details: errors,
            });
        }
        next();
    },

    login: (req, res, next) => {
        const {email, password} = req.body;
        const errors = [];

        if(!email) {
            errors.push("Email is required");
        }
        
        if(!password){
            errors.push("Password is required");
        }

        if (errors.length > 0) {
            throw new BaseAppError({
                message: "Validation failed",
                errorCode: "VALLIDATION_ERROR",
                statusCode: 400,
                type: "VALIDATION_ERROR",
                details: errors,
            });
        }
        next();
    },

    leaveRequest: (req, res, next) => {
        const {leave_type_id, start_date, end_date, reason} = req.body;
        const errors = [];

        if(!leave_type_id) {
            errors.push("Leave type is required");
        }

        if(!start_date || !end_date) {
            errors.push("Start data and end date are required");
        }

        if(!start_date || !end_date) {
            errors.push("Start date and end date are required");
        }

        else {
            const start = new Date(start_date);
            const end = new Date(end_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (start < today) {
                errors.push("Start date cannot be in the past");
            }

            if (end < start) {
                errors.push("End date must be after start date");
            }

            const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            if (daysDiff > 30) {
                errors.push("Leave request cannot exceed 30 days");
            }
        }

        if(!reason || reason.trim().length < 10) {
            errors.push("Reson must be at least 10 charcaters long");
        }

        if(errors.length > 0) {
            throw new BaseAppError({
                message: "Validation failed",
                errorCode: "VALIDATION_ERROR",
                statusCode: 400,
                type: "VALIDATION_ERROR",
                details: errors,
            });
        }
        next();
    },

    approveReject: (req, res, next) => {
        const {status, comments} = req.body;
        const errors = [];

        if (!status || !["approved", "rejected"].includes(status)) {
            errors.push("Status must be either 'approved' or 'rejected'");
        }

        if (status === "rejected" && (!comments || comments.trim().length < 5)) {
            errors.push("Comments are required when rejecting a request (minimum 5 characters)");
        }

        if (errors.length > 0) {
            throw new BaseAppError({
                message: "Validation failed",
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

        if(isNaN(id) || id <= 0) {
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
};

module.exports = validate;