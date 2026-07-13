const express = require("express");

const app = express();
const PORT = 3000;

// Home Page
app.get("/", (req, res) => {
    res.send(`
        <h1>🚀 Department Mail Management System (DMMS)</h1>
        <h2>Server is Running Successfully</h2>
        <p>Welcome Brajesh!</p>
    `);
});

// Health Check
app.get("/health", (req, res) => {
    res.json({
        status: "OK",
        application: "DMMS",
        version: "1.0"
    });
});

// Start Server
app.listen(PORT, () => {
    console.log("=================================");
    console.log(" DMMS Server Started Successfully ");
    console.log("=================================");
    console.log(`Server URL : http://localhost:${PORT}`);
});