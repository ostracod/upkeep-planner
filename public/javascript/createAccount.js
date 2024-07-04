
const createAccount = async () => {
    const usernameTag = document.getElementById("username");
    const passwordTag = document.getElementById("password");
    const confirmPasswordTag = document.getElementById("confirmPassword");
    const emailAddressTag = document.getElementById("emailAddress");
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
    const authSalt = await dcodeIO.bcrypt.genSalt(10);
    const keySalt = await dcodeIO.bcrypt.genSalt(10);
    const authHash = await dcodeIO.bcrypt.hash(password, authSalt);
    const response = await (await fetch("/createAccountAction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            username,
            authSalt,
            keySalt,
            authHash,
            emailAddress,
        }),
    })).json();
    if (!response.success) {
        alert(response.message);
        return;
    }
    alert("Your account was created successfully.");
    window.location = "/login";
};

const formSubmitEvent = async () => {
    const messageTag = document.getElementById("message");
    messageTag.innerHTML = "Creating account...";
    await createAccount();
    messageTag.innerHTML = "";
};


