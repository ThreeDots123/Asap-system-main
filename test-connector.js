const { io } = require("socket.io-client");

const socket = io("http://localhost:5000", {
  auth: {
    userId: "68ef9669fb166e2503b973fd",
    token:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OGVmOTY2OWZiMTY2ZTI1MDNiOTczZmQiLCJyb2xlIjoibWVyY2hhbnQiLCJpYXQiOjE3NjA5Njg0MzksImV4cCI6MTc2MDk3MjAzOX0.J_lN8uss9cbYfBo0cgUCbS3TdjH9XusFcHActt2nOjE",
  },
  reconnection: true,
});

socket.on("welcome", (data) => {
  console.log("Welcome event:", data);
});

socket.on("auth-success", (data) => {
  console.log("Auth success:", data);
});

socket.on("auth-error", (err) => {
  console.error("Auth error:", err);
});

socket.on("room", (msg) => {
  console.log("Room event:", msg);
});

// Example: transaction events
socket.on("balance.refresh", (tx) => {
  console.log("Transaction completed:", tx);
});

// Example: transaction events for merchant (Payment recieved)
socket.on("merchant.payment.completed", (pmt) => {
  console.log("Payment recieved:", pmt);
});
