 const express = require('express');
const app = express();
const port = 3001; // You can use any available port

// Define a route for GET requests to the root URL (/)
app.get('/', (req, res) => {
    res.send('Hello World from Express!');
});

// Start the server and listen on the specified port
app.listen(port, () => {
    console.log(`Express app listening at http://localhost:${port}`);
});