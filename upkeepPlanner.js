
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
import bcrypt from "bcrypt";
import { Level } from "level";

dotenv.config();

const projectPath = pathUtils.dirname(fileURLToPath(import.meta.url));
const databasePath = pathUtils.join(projectPath, "levelDb");
const publicPath = pathUtils.join(projectPath, "public");
const viewsPath = pathUtils.join(projectPath, "views");
const isDevMode = (process.env.NODE_ENV === "development");

const levelDb = new Level(databasePath, { valueEncoding: "json" });

const getAccountKey = (username) => "account_" + username;

const levelGetSafe = async (key) => {
    try {
        return await levelDb.get(key);
        return true;
    } catch (error) {
        if (error.code === "LEVEL_NOT_FOUND") {
            return null;
        }
        throw error;
    }
};

const levelKeyExists = async (key) => (await levelGetSafe(key) !== null);

const getUsername = (req) => {
    if (isDevMode) {
        const { username } = req.query;
        if (typeof username !== "undefined") {
            req.session.username = username;
        }
    }
    return req.session.username ?? null;
};

const hasLoggedIn = (req) => (getUsername(req) !== null);

const getAccount = async (req, res) => {
    const username = getUsername(req);
    if (username === null) {
        res.json({ success: false, message: "You are not currently logged in." });
        return null
    }
    const accountKey = getAccountKey(req.session.username);
    return await levelDb.get(accountKey);
};

const putAccount = async (account) => {
    const accountKey = getAccountKey(account.username);
    await levelDb.put(accountKey, account);
};

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

const checkAuthentication = (req, res) => {
    if (hasLoggedIn(req)) {
        return true;
    }
    res.redirect("/login");
    return false;
};

const router = express.Router();

router.get("/bcrypt.min.js", (req, res) => {
    const path = pathUtils.join(
        projectPath, "node_modules", "bcryptjs", "dist", "bcrypt.min.js",
    );
    res.sendFile(path);
});

router.get("/", (req, res) => {
    if (hasLoggedIn(req)) {
        res.redirect("/tasks");
    } else {
        res.redirect("/login");
    }
});

router.get("/login", (req, res) => {
    renderPage(
        res,
        "login.html",
        { scripts: ["/bcrypt.min.js", "/javascript/login.js"] },
        { hasLoggedIn: hasLoggedIn(req) },
    );
});

router.get("/createAccount", (req, res) => {
    renderPage(
        res,
        "createAccount.html",
        { scripts: ["/bcrypt.min.js", "/javascript/createAccount.js"] },
    );
});

router.post("/createAccountAction", async (req, res) => {
    const { username, authSalt, keySalt, authHash, emailAddress } = req.body;
    const accountKey = getAccountKey(username);
    if (await levelKeyExists(accountKey)) {
        res.json({
            success: false,
            message: "An account with that username already exists.",
        });
        return;
    }
    const authHashHash = await bcrypt.hash(authHash, 10);
    await putAccount({
        username,
        authSalt,
        keySalt,
        authHashHash,
        emailAddress,
        nextTaskId: 0,
        changeNumber: 0,
    });
    res.json({ success: true });
});

router.post("/getAuthSalt", async (req, res) => {
    const { username } = req.body;
    const accountKey = getAccountKey(username);
    const account = await levelGetSafe(accountKey);
    if (account === null) {
        res.json({
            success: false,
            message: "Could not find an account with the given username.",
        });
        return;
    }
    res.json({ success: true, authSalt: account.authSalt });
});

router.post("/loginAction", async (req, res) => {
    const { username, authHash } = req.body;
    const accountKey = getAccountKey(username);
    const account = await levelGetSafe(accountKey);
    if (account === null) {
        res.json({
            success: false,
            message: "Could not find an account with the given username.",
        });
        return;
    }
    const hashMatches = await bcrypt.compare(authHash, account.authHashHash);
    if (!hashMatches) {
        res.json({
            success: false,
            message: "Incorrect password.",
        });
        return;
    }
    req.session.username = username;
    res.json({ success: true, keySalt: account.keySalt });
});

router.get("/logout", (req, res) => {
    delete req.session.username;
    res.redirect("/login");
});

router.get("/tasks", (req, res) => {
    if (!checkAuthentication(req, res)) {
        return;
    }
    renderPage(
        res,
        "tasks.html",
        {
            scripts: ["/javascript/tasks.js"],
            stylesheets: ["/stylesheets/tasks.css"],
        },
    );
});

router.get("/changePassword", (req, res) => {
    if (!checkAuthentication(req, res)) {
        return;
    }
    renderPage(
        res,
        "changePassword.html",
        { scripts: ["/bcrypt.min.js", "/javascript/changePassword.js"] },
    );
});

router.get("/getSalts", async (req, res) => {
    const account = await getAccount(req, res);
    if (account === null) {
        return;
    }
    res.json({ success: true, authSalt: account.authSalt, keySalt: account.keySalt });
});

router.post("/changePasswordAction", async (req, res) => {
    const account = await getAccount(req, res);
    if (account === null) {
        return;
    }
    const { oldAuthHash, newAuthSalt, newKeySalt, newAuthHash } = req.body;
    const hashMatches = await bcrypt.compare(oldAuthHash, account.authHashHash);
    if (!hashMatches) {
        res.json({
            success: false,
            message: "Incorrect old password.",
        });
        return;
    }
    account.authSalt = newAuthSalt;
    account.keySalt = newKeySalt;
    account.authHashHash = await bcrypt.hash(newAuthHash, 10);
    account.changeNumber += 1;
    await putAccount(account);
    res.json({ success: true });
});

const expressApp = express();
expressApp.use(bodyParser.json({ limit: "50mb" }));
expressApp.use(bodyParser.urlencoded({ limit: "50mb", extended: false }));
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


