const jwt  = require("jsonwebtoken");
const BaseAppError = require("../errors/baseAppError");
const User = require("../models/userModel");

const authenticate = async (req, res, next) => {
    try{
        const authHeader = req.headers.authorization;
        if(!authHeader || !authHeader.startsWith("Bearer ")) {
            throw new BaseAppError({
                message: "No token provided",
                errorCode: "NO_TOKEN",
                statusCode: 401,
                type: "AUTHENTICATION_ERROR",
            });
        }
        const token = authHeader.split(" ")[1];

        if (!process.env.JWT_SECRET) {
            throw new BaseAppError({
                message: "JWT secret not configured",
                errorCode: "CONFIG_ERROR",
                statusCode: 500,
                type: "SERVER_ERROR",
            });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id);
        if (!user) {
            throw new BaseAppError({
                message: "User not found",
                errorCode: "USER_NOT_FOUND",
                statusCode: 401,
                type: "AUTHENTICATION_ERROR",
            });
        }
        req.user = user;
        next();
    }
    catch (error) {
        if (error.name === "JsonWebTokenError") {
            next(new BaseAppError({
                message: "Invalid token",
                errorCode: "INVALID_TOKEN",
                statusCode: 401,
                type: "AUTHENTICATION_ERROR",
            }));
        } else if (error.name === "TokenExpiredError") {
            next(new BaseAppError({
                message: "Token expired",
                errorCode: "TOKEN_EXPIRED",
                statusCode: 401,
                type: "AUTHENTICATION_ERROR",
            }));
        } else {
            next(error);
        }
    }
};

module.exports = authenticate;