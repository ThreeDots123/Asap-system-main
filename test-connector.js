const { io } = require("socket.io-client");

const socket = io("http://localhost:5000", {
  auth: {
    userId: "68d6ed95ee3762b6febb7eb7",
    token:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OGQ2ZWQ5NWVlMzc2MmI2ZmViYjdlYjciLCJyb2xlIjoidXNlciIsImlhdCI6MTc1OTMwOTE2MywiZXhwIjoxNzU5MzEyNzYzfQ.Rx4GHV5fn29rd6DzdrEGadOlmy1pf52pcJy_YUMCdDQ",
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
