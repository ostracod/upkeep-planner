
import * as http from "http";
import * as dotenv from 'dotenv';
import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import expressSession from "express-session";

dotenv.config();

const router = express.Router();
router.get("/test", (req, res) => {
    res.json({ success: true });
});

const expressApp = express();
expressApp.use(bodyParser.json());
expressApp.use(cookieParser());
expressApp.use(expressSession({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
}));
expressApp.use("/", router);

// Catch 404 status and forward to error handler.
expressApp.use((req, res, next) => {
    const error = new Error("Not Found");
    error.status = 404;
    next(error);
});

// Error handler.
expressApp.use((error, req, res, next) => {
    const { status } = error;
    if (typeof status === "undefined") {
        res.status(500);
    } else {
        res.status(error.status);
    }
    res.json({ success: false, message: error.message });
});

const server = http.createServer(expressApp);
const portNumber = parseInt(process.env.PORT_NUMBER, 10);
server.listen(portNumber, () => {
    console.log(`Listening on port ${portNumber}.`);
});


