
import * as pathUtils from "path";
import * as fs from "fs";
import * as http from "http";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import expressSession from "express-session";
import logger from "morgan";
import Mustache from "mustache";
import mustacheExpress from "mustache-express";
import { Level } from "level";

dotenv.config();

const projectPath = pathUtils.dirname(fileURLToPath(import.meta.url));
const databasePath = pathUtils.join(projectPath, "levelDb");
const publicPath = pathUtils.join(projectPath, "public");
const viewsPath = pathUtils.join(projectPath, "views");
const isDevMode = (process.env.NODE_ENV === "development");

const levelDb = new Level(databasePath, { valueEncoding: "json" });

const renderPage = (res, path, options = {}, params = {}) => {
    const templatePath = pathUtils.join(viewsPath, path);
    const template = fs.readFileSync(templatePath, "utf8");
    const content = Mustache.render(template, params);
    res.render("template.html", {
        scripts: options.scripts ?? [],
        stylesheets: options.stylesheets ?? [],
        content,
        contentWidth: options.contentWidth ?? 700,
    });
};

const router = express.Router();

router.get("/login", (req, res) => {
    renderPage(
        res,
        "login.html",
        { scripts: ["javascript/login.js"] },
    );
});

const expressApp = express();
expressApp.use(bodyParser.json());
expressApp.use(bodyParser.urlencoded({ extended: false }));
expressApp.use(cookieParser());
expressApp.use(expressSession({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
}));
expressApp.set("trust proxy", 1);

if (isDevMode) {
    console.log("WARNING: Running in development mode! Not suitable for a production environment!");
    expressApp.disable("view cache");
    expressApp.use(logger("dev"));
}

expressApp.use(express.static(publicPath));
expressApp.set("views", viewsPath);
expressApp.engine("html", mustacheExpress());
expressApp.use("/", router);

// Catch 404 status and forward to error handler.
expressApp.use((req, res, next) => {
    const error = new Error("Not Found");
    error.status = 404;
    next(error);
});

// Error handler.
expressApp.use((error, req, res, next) => {
    const statusCode = error.status ?? 500;
    res.status(statusCode);
    const params = { statusCode, message: error.message };
    if (isDevMode) {
        params.stack = error.stack;
    }
    renderPage(res, "error.html", {}, params);
});

const server = http.createServer(expressApp);
const portNumber = parseInt(process.env.PORT_NUMBER, 10);
server.listen(portNumber, () => {
    console.log(`Listening on port ${portNumber}.`);
});


