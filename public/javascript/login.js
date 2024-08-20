
let isLoggingIn = false;

const logIn = async () => {
    const usernameTag = document.getElementById("username");
    const passwordTag = document.getElementById("password");
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
    const { authSalt } = await makeRequest("/getAuthSalt", { username });
    const authHash = await dcodeIO.bcrypt.hash(password, authSalt);
    const { keySalt, keyVersion } = await makeRequest("/loginAction", { username, authHash });
    const keyHash = await dcodeIO.bcrypt.hash(password, keySalt);
    localStorage.setItem("keyData", JSON.stringify({ keyHash, keyVersion }));
    window.location = "/tasks";
};

const formSubmitEvent = async () => {
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

const initializePage = () => {
    createStatusLegend(document.getElementById("statusLegend"));
    applyCircleColors();
};


