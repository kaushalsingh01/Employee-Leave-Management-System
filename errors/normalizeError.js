const  BaseAppError = require('./baseAppError');
const normalizeExternalError = require('./normalizeExternalError');

function normalizeError(error) {
    if(error instanceof BaseAppError){
        return error;
    }

    const externalError = normalizeExternalError(error);
    if(externalError) {
        return externalError;
    }

    return new BaseAppError({
        message: 'unexpected error occured',
        errorCode: 'UNEXPECTED_ERROR',
        statusCode: 500,
        type: 'SYSTEM_ERROR'
    })
}

module.exports = normalizeError;