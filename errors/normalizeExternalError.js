const BaseAppError = require("./baseAppError");

function normalizeExternalError(error) {
    if (error.name === 'ValidationError') {
        return new BaseAppError({
            message: 'Validation failed',
            errorCode: 'VALIDATION_ERROR',
            statusCode: 400,
            type: 'VALIDATION_ERROR',
            details: error.errors || error.message
        });
    }

    // Database / ORM errors
    if (error.code === 'ER_DUP_ENTRY') {
        return new BaseAppError({
            message: 'Duplicate record found',
            errorCode: 'DUPLICATE_ENTRY',
            statusCode: 409,
            type: 'DATABASE_ERROR'
        });
    }

    // External API errors
    if (error.response) {
        return new BaseAppError({
            message: 'External service failed',
            errorCode: 'EXTERNAL_API_ERROR',
            statusCode: error.response.status || 502,
            type: 'INTEGRATION_ERROR',
            details: error.response.data
        });
    }

    return null;
}

function normalizeUnkownError(error) {
    return new BaseAppError({
        message: 'Something went wrong',
        errorCode: 'INTERNAL_SERVER_ERROR',
        statusCode: 500,
        type: 'SYSTEM_ERROR'
    });
}

module.exports = normalizeExternalError;