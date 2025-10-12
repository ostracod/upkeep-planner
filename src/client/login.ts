
import { GetAuthSaltRequest, GetAuthSaltResponse, LoginRequest, LoginResponse } from "../common/types.js";
import { makeRequest, createStatusLegend, applyCircleColors } from "./global.js";

let bcryptHash: (password: string, salt: string) => Promise<string>;
let isLoggingIn = false;

const logIn = async (): Promise<void> => {
    const usernameTag = document.getElementById("username") as HTMLInputElement;
    const passwordTag = document.getElementById("password") as HTMLInputElement;
    const username = usernameTag.value;
    const password = passwordTag.value;
    if (username.length <= 0) {
        alert("Please enter your username.");
        usernameTag.focus();
        return;
    }
    if (password.length <= 0) {
        alert("Please enter your password.");
        passwordTag.focus();
        return;
    }
    const { authSalt } = await makeRequest(
        "/getAuthSalt",
        { username } satisfies GetAuthSaltRequest,
    ) as GetAuthSaltResponse;
    const authHash = await bcryptHash(password, authSalt);
    const { keySalt, keyVersion } = await makeRequest(
        "/loginAction",
        { username, authHash } satisfies LoginRequest,
    ) as LoginResponse;
    const keyHash = await bcryptHash(password, keySalt);
    localStorage.setItem("keyData", JSON.stringify({ keyHash, keyVersion }));
    window.location = "/tasks" as (string & Location);
};

window.formSubmitEvent = async (): Promise<void> => {
    if (isLoggingIn) {
        return;
    }
    isLoggingIn = true;
    const messageTag = document.getElementById("message");
    messageTag.innerHTML = "Logging in...";
    try {
        await logIn();
    } catch (error) {
        alert(error.message);
    }
    messageTag.innerHTML = "";
    isLoggingIn = false;
};

export const initializePage = (): void => {
    bcryptHash = window.dcodeIO.bcrypt.hash;
    createStatusLegend(document.getElementById("statusLegend"));
    applyCircleColors();
};


