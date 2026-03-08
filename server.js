const express = require('express');
const errorHandler = require('./middlewares/errorHandler');
const authRoutes = require('./modules/auth/authRoutes');
const dotenv = require("dotenv");

dotenv.config()
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get('/health', (req, res) => {
    res.json({Connection:"Healthy"});
})
app.use('/auth', authRoutes);
app.use(errorHandler);

app.listen(port, () => {
    console.log('The site is working on - http://localhost:3000/')
})
