import app from "./server";
import colors from "colors";
import { createHttpServer, initializeSocketServer } from "./realtime/socket";

const port = process.env.PORT || 3000;
const httpServer = createHttpServer(app);

initializeSocketServer(httpServer);

httpServer.listen(port, () => {
    console.log(colors.green.bold(`Server is running on port ${port}`));
});
