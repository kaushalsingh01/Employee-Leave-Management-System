class BaseAppError extends Error {
    constructor({message, errorCode, statusCode = 500, type = 'SYSTEM_ERROR', details = null}) {
        super(message);
        this.name = this.constructor.name;
        this.errorCode = errorCode;
        this.statusCode = statusCode;
        this.type = type;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = BaseAppError;