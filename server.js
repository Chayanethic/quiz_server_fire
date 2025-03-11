const express = require('express');
const quizRoutes = require('./routes/quizRoutes');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.header('Access-Control-Allow-Methods', 'GET, POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Use routes
app.use('/api', quizRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.status(200).json({ message: 'Welcome to the Quiz API', version: '2.0' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));