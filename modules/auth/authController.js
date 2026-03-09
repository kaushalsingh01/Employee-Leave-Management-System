const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../../models/userModel");
const BaseAppError = require("../../errors/baseAppError");

const register = async (req, res, next) => {
    try {
        const { name, email, password, role, manager_id } = req.body;

        // Check if user already exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            throw new BaseAppError({
                message: "User with this email already exists",
                errorCode: "USER_EXISTS",
                statusCode: 409,
                type: "VALIDATION_ERROR",
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user - this will automatically create leave balances
        const user = await User.createUser({
            name,
            email,
            password: hashedPassword,
            role,
            manager_id: manager_id || null,
        });

        // Generate token for auto-login after registration
        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.status(201).json({
            message: "User created successfully",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                manager_id: user.manager_id
            }
        });
    } catch (error) {
        next(error);
    }
};

const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

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

        // Get user with balances for the response
        const userWithBalances = await User.getUserWithBalances(user.id);

        res.json({
            token,
            user: userWithBalances || {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                manager_id: user.manager_id
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { register, login };