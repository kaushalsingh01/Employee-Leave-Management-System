const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../../models/userModel");
const BaseAppError = require("../../errors/baseAppError");

const register = async (req, res, next) => {
    try {
        const { name, email, password, role, manager_id } = req.body;

        // Validation
        if (!name || !email || !password || !role) {
            throw new BaseAppError({
                message: "Missing required fields",
                errorCode: "MISSING_FIELDS",
                statusCode: 400,
                type: "VALIDATION_ERROR",
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.createUser({
            name,
            email,
            password: hashedPassword,
            role,
            manager_id,
        });

        res.status(201).json({ message: "User created successfully", user });
    } catch (error) {
        next(error);
    }
};

const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            throw new BaseAppError({
                message: "Email and password required",
                errorCode: "MISSING_CREDENTIALS",
                statusCode: 400,
                type: "VALIDATION_ERROR",
            });
        }

        const user = await User.findByEmail(email);
        if (!user) {
            throw new BaseAppError({
                message: "Invalid credentials",
                errorCode: "INVALID_CREDENTIALS",
                statusCode: 401,
                type: "AUTHENTICATION_ERROR",
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            throw new BaseAppError({
                message: "Invalid credentials",
                errorCode: "INVALID_CREDENTIALS",
                statusCode: 401,
                type: "AUTHENTICATION_ERROR",
            });
        }

        // Ensure JWT_SECRET is defined
        if (!process.env.JWT_SECRET) {
            throw new BaseAppError({
                message: "JWT secret not configured",
                errorCode: "CONFIG_ERROR",
                statusCode: 500,
                type: "SERVER_ERROR",
            });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.json({
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { register, login };