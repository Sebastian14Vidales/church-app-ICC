import app from "./server";
import { createHttpServer, initializeSocketServer } from "./realtime/socket";

const port = process.env.PORT || 3000;
const httpServer = createHttpServer(app);

initializeSocketServer(httpServer);

httpServer.listen(port);
