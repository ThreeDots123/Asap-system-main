import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { TokenService } from "src/token/token.service";
import { emittedEvents, listenedEvents } from "./events";

@WebSocketGateway({
  cors: {
    origin: "*", // Configure this for production
    methods: ["GET", "POST"],
  },
})
export class SocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  constructor(private tokenService: TokenService) {}
  private userRooms = new Map<string, string>(); // clientId -> userId mapping

  @WebSocketServer() server: Server;
  private logger: Logger = new Logger("SocketGateway");

  createRoomName(userId: string) {
    return `user_${userId}`;
  }

  // Called when the gateway is initialized and injected into the dependecies
  afterInit(server: Server) {
    this.logger.log("WebSocket Gateway initialized");
  }

  // Called when a client connects
  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);

    // You can emit a welcome message
    const token = client.handshake.auth.token;
    const userId = client.handshake.auth.userId;

    if (token && userId) {
      this.tryAutoAuthenticate(client, userId, token);
    } else {
      client.emit("welcome", {
        message: "Connected to WebSocket server",
        clientId: client.id,
        instruction:
          "Please authenticate by sending your userId and accessToken to the authenticate event.",
      });
    }
  }

  // Called when a client disconnects
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage(listenedEvents.authenticate)
  handleAuthentication(
    @MessageBody() data: { userId: string; accessToken: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { userId, accessToken } = data;
    // TODO: Validate accessToken here...
    this.tryAutoAuthenticate(client, userId, accessToken);
  }

  private tryAutoAuthenticate(
    client: Socket,
    userId: string,
    accessToken: string,
  ) {
    try {
      const payload = this.tokenService.decodeToken(accessToken);

      if (!payload || payload.sub !== userId) {
        client.emit("auth-error", { message: "Invalid token or userId" });
        return;
      }

      const userRoom = `user_${userId}`;
      client.join(userRoom);

      this.logger.log(`Client ${client.id} authenticated as user ${userId}`);

      client.emit("auth-success", {
        userId,
        message: `Authenticated and joined room: ${userRoom}`,
      });

      this.server.to(userRoom).emit("room", `Welcome back, user ${userId}!`);
    } catch (err) {
      this.logger.error(`Auth failed: ${err.message}`);
      client.emit("auth-error", { message: "Error in verification" });
    }
  }
}
