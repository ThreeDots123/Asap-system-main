export const emittedEvents = {
  welcome: "welcome",
  room: "room.joined", // Welcome user to their room
  refreshedAssetBalance: "balance.refresh",
  auth: {
    success: "auth.sucess",
    error: "auth.error",
  },
};

export const listenedEvents = {
  authenticate: "authenticate",
};
