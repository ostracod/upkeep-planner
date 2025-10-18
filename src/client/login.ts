
import { GetAuthSaltRequest, GetAuthSaltResponse, LoginRequest, LoginResponse } from "../common/types.js";
import { LocalStorageData, makeRequest, createStatusLegend, applyCircleColors } from "./global.js";

let bcryptHash: (password: string, salt: string) => Promise<string>;
let isLoggingIn = false;

// logIn performs these steps:
// 1. Retrieve the auth salt of the account. The salt is not private information.
// 2. Hash the password with the auth salt to produce an auth hash.
// 3. Authenticate against the server and receives the key salt.
// 4. Hash the password with the key salt to produce a key hash.
// 5. Store the key hash in local storage so it may be used later for encryption.
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
    const keyData = JSON.stringify({ keyHash, keyVersion } satisfies LocalStorageData);
    localStorage.setItem("keyData", keyData);
    window.location = "/tasks" as (string & Location);
};

window.formSubmitEvent = async (): Promise<void> => {
    if (isLoggingIn) {
        return;
    }
    isLoggingIn = true;
    const messageTag = document.getElementById("message");
    messageTag.textContent = "Logging in...";
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


