
import { makeRequest } from "./global.js";

let bcryptHash: (password: string, salt: string) => Promise<string>;
let genBcryptSalt: (roundAmount: number) => string;
let isCreatingAccount = false;

const createAccount = async (): Promise<void> => {
    const usernameTag = document.getElementById("username") as HTMLInputElement;
    const passwordTag = document.getElementById("password") as HTMLInputElement;
    const confirmPasswordTag = document.getElementById("confirmPassword") as HTMLInputElement;
    const emailAddressTag = document.getElementById("emailAddress") as HTMLInputElement;
    const username = usernameTag.value;
    const password = passwordTag.value;
    const confirmPassword = confirmPasswordTag.value;
    const emailAddress = emailAddressTag.value;
    if (username.length <= 0) {
        alert("Please enter a username.");
        usernameTag.focus();
        return;
    }
    if (password.length <= 0) {
        alert("Please enter a password.");
        passwordTag.focus();
        return;
    }
    if (password !== confirmPassword) {
        alert("Password confirmation does not match.");
        confirmPasswordTag.focus();
        return;
    }
    if (emailAddress.length <= 0) {
        alert("Please enter an email address.");
        emailAddressTag.focus();
        return;
    }
    if (emailAddress.indexOf("@") < 0 || emailAddress.indexOf(".") < 0) {
        alert("Please enter a valid email address.");
        emailAddressTag.focus();
        return;
    }
    const authSalt = await genBcryptSalt(10);
    const keySalt = await genBcryptSalt(10);
    const authHash = await bcryptHash(password, authSalt);
    await makeRequest("/createAccountAction", {
        username,
        authSalt,
        keySalt,
        authHash,
        emailAddress,
    });
    alert("Your account was created successfully.");
    window.location = "/login" as (string & Location);
};

window.formSubmitEvent = async (): Promise<void> => {
    if (isCreatingAccount) {
        return;
    }
    isCreatingAccount = true;
    const messageTag = document.getElementById("message");
    messageTag.innerHTML = "Creating account...";
    try {
        await createAccount();
    } catch (error) {
        alert(error.message);
    }
    messageTag.innerHTML = "";
    isCreatingAccount = false;
};

export const initializePage = (): void => {
    bcryptHash = window.dcodeIO.bcrypt.hash;
    genBcryptSalt = window.dcodeIO.bcrypt.genSalt;
};


