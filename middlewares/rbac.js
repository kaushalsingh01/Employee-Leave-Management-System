const BaseAppError = require("../errors/baseAppError")

const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if(!req.user) {
            throw new BaseAppError({
                message: "Authentication required",
                errorCode: "AUTH_REQUIRED",
                statusCode: 401,
                type: "AUTHENTICATION_ERROR",
            });
        }
        
        if(!allowedRoles.includes(req.uesr.role)) {
            throw new BaseAppError({
                message: "Access denied. Insufficient permissions.",
                errorCode: "INSUFFICIENT_PERMISSIONS",
                statusCode: 403,
                type: "AUTHORIZATION_ERROR",
            });
        }
        next();
    };
};

const isOwnerOrManager = (resourceUserId) => {
    return (req, res, next) => {
        if(!req.user) {
            throw new BaseAppError({
                message: "Authentication required",
                errorCode:  "AUTH_REQUIRED",
                statusCode: 401,
                type: "AUTHENTICATION_ERROR",
            });
        }

        if(req.user.id === resourceUserId) {
            return next();
        }

        if(req.user.role === "manager") {
            return next();
        }

        throw new BaseAppError({
            message: "Access denied. You don't own this resource.",
            errorCode: "NOT_OWNER",
            statusCode: 403,
            type: "AUTHORIZATION_ERROR",
        });
    };
};

const isDirectManager = (employeeId) => {
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

            if (req.user.role !== "manager") {
                throw new BaseAppError({
                    message: "Access denied. Manager role required.",
                    errorCode: "INSUFFICIENT_PERMISSIONS",
                    statusCode: 403,
                    type: "AUTHORIZATION_ERROR",
                });
            }

            const employee = await User.findById(employeeId);
            if (!employee) {
                throw new BaseAppError({
                    message: "Employee not found",
                    errorCode: "EMPLOYEE_NOT_FOUND",
                    statusCode: 404,
                    type: "RESOURCE_ERROR",
                });
            }

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