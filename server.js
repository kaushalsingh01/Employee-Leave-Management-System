const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

const errorHandler = require('./middlewares/errorHandler');
const authRoutes = require('./modules/auth/authRoutes');
const leaveRoutes = require('./modules/leaves_manager/leaveRoutes');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static("public"));


// Serve static files from public directory
app.use(express.static(path.join(__dirname, "public")));


// Health check
app.get('/health', (req, res) => {
    res.json({ Connection: "Healthy" });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/leaves', leaveRoutes);

// Serve index.html for root route
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Error handler
app.use(errorHandler);

// Server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});