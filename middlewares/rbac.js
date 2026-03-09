// middlewares/rbac.js
const BaseAppError = require("../errors/baseAppError");

// Role-based authorization middleware factory
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        try {
            // Check if user exists on request
            if (!req.user) {
                throw new BaseAppError({
                    message: "Authentication required. User not found in request.",
                    errorCode: "AUTH_REQUIRED",
                    statusCode: 401,
                    type: "AUTHENTICATION_ERROR",
                });
            }

            // Check if user has role property
            if (!req.user.role) {
                throw new BaseAppError({
                    message: "User role not found",
                    errorCode: "ROLE_NOT_FOUND",
                    statusCode: 403,
                    type: "AUTHORIZATION_ERROR",
                });
            }

            // Check if user's role is allowed
            if (!allowedRoles.includes(req.user.role)) {
                throw new BaseAppError({
                    message: "Access denied. Insufficient permissions.",
                    errorCode: "INSUFFICIENT_PERMISSIONS",
                    statusCode: 403,
                    type: "AUTHORIZATION_ERROR",
                });
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};

// Check if user is the owner of the resource or a manager
const isOwnerOrManager = (getResourceUserId) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                throw new BaseAppError({
                    message: "Authentication required",
                    errorCode: "AUTH_REQUIRED",
                    statusCode: 401,
                    type: "AUTHENTICATION_ERROR",
                });
            }

            const resourceUserId = typeof getResourceUserId === 'function'
                ? getResourceUserId(req)
                : getResourceUserId;

            // Allow if user is the owner
            if (req.user.id === resourceUserId) {
                return next();
            }

            // Allow if user is a manager
            if (req.user.role === "manager") {
                return next();
            }

            throw new BaseAppError({
                message: "Access denied. You don't own this resource.",
                errorCode: "NOT_OWNER",
                statusCode: 403,
                type: "AUTHORIZATION_ERROR",
            });
        } catch (error) {
            next(error);
        }
    };
};

// Check if manager is the direct manager of the employee
const isDirectManager = (getEmployeeId) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                throw new BaseAppError({
                    message: "Authentication required",
                    errorCode: "AUTH_REQUIRED",
                    statusCode: 401,
                    type: "AUTHENTICATION_ERROR",
                });
            }

            const employeeId = typeof getEmployeeId === 'function'
                ? getEmployeeId(req)
                : getEmployeeId;

            // Only managers can use this check
            if (req.user.role !== "manager") {
                throw new BaseAppError({
                    message: "Access denied. Manager role required.",
                    errorCode: "INSUFFICIENT_PERMISSIONS",
                    statusCode: 403,
                    type: "AUTHORIZATION_ERROR",
                });
            }

            // Get the employee from database
            const User = require("../models/userModel"); // Import here to avoid circular dependency
            const employee = await User.findById(employeeId);

            if (!employee) {
                throw new BaseAppError({
                    message: "Employee not found",
                    errorCode: "EMPLOYEE_NOT_FOUND",
                    statusCode: 404,
                    type: "RESOURCE_ERROR",
                });
            }

            // Check if this manager is the employee's manager
            if (employee.manager_id !== req.user.id) {
                throw new BaseAppError({
                    message: "Access denied. You are not the manager of this employee.",
                    errorCode: "NOT_DIRECT_MANAGER",
                    statusCode: 403,
                    type: "AUTHORIZATION_ERROR",
                });
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};

module.exports = {
    authorize,
    isOwnerOrManager,
    isDirectManager,
};