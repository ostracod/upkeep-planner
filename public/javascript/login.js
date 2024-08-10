
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
    const response1 = await (await fetch("/getAuthSalt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
    })).json();
    if (!response1.success) {
        alert(response1.message);
        return;
    }
    const { authSalt } = response1;
    const authHash = await dcodeIO.bcrypt.hash(password, authSalt);
    const response2 = await (await fetch("/loginAction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, authHash }),
    })).json();
    if (!response2.success) {
        alert(response2.message);
        return;
    }
    const { keySalt, keyVersion } = response2;
    const keyHash = await dcodeIO.bcrypt.hash(password, keySalt);
    localStorage.setItem("keyData", JSON.stringify({ keyHash, keyVersion }));
    window.location = "/tasks";
};

const formSubmitEvent = async () => {
    const messageTag = document.getElementById("message");
    messageTag.innerHTML = "Logging in...";
    await logIn();
    messageTag.innerHTML = "";
};


