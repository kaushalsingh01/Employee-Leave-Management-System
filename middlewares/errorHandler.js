const { v4: uuidv4 } = require("uuid");
const normalizeError = require("../errors/normalizeError");

function errorHandler(err, req, res, next) {
    const traceId = uuidv4();
    const normalizedError = normalizeError(err);

    console.error({
        traceId,
        errorCode: normalizedError.errorCode,
        message: normalizedError.message,
        details: normalizedError.details,
        stack: err.stack,
    });

    const statusCode = normalizedError.statusCode || 500;

    res.status(statusCode).json({
        errorCode: normalizedError.errorCode || "UNEXPECTED_ERROR",
        message: normalizedError.message || "Unexpected error occurred",
        type: normalizedError.type || "INTERNAL_ERROR",
        details: normalizedError.details || null,
        traceId,
    });
}

module.exports = errorHandler;