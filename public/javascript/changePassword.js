
const changePassword = async () => {
    const oldPasswordTag = document.getElementById("oldPassword");
    const newPasswordTag = document.getElementById("newPassword");
    const confirmPasswordTag = document.getElementById("confirmPassword");
    const oldPassword = oldPasswordTag.value;
    const newPassword = newPasswordTag.value;
    const confirmPassword = confirmPasswordTag.value;
    if (oldPassword.length <= 0) {
        alert("Please enter your old password.");
        oldPasswordTag.focus();
        return;
    }
    if (newPassword.length <= 0) {
        alert("Please enter a new password.");
        newPasswordTag.focus();
        return;
    }
    if (newPassword !== confirmPassword) {
        alert("Password confirmation does not match.");
        confirmPasswordTag.focus();
        return;
    }
    const response1 = await (await fetch("/getSalts")).json();
    if (!response1.success) {
        alert(response1.message);
        return;
    }
    const { authSalt: oldAuthSalt, keySalt, oldKeySalt } = response1;
    const oldAuthHash = await dcodeIO.bcrypt.hash(oldPassword, oldAuthSalt);
    const newAuthSalt = await dcodeIO.bcrypt.genSalt(10);
    const newKeySalt = await dcodeIO.bcrypt.genSalt(10);
    const newAuthHash = await dcodeIO.bcrypt.hash(newPassword, newAuthSalt);
    const response2 = await (await fetch("/changePasswordAction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            oldAuthHash,
            newAuthSalt,
            newKeySalt,
            newAuthHash,
            // TODO: Send re-encrypted chunks in this request.
        }),
    })).json();
    if (!response2.success) {
        alert(response2.message);
        return;
    }
    alert("Your password was changed successfully.");
    window.location = "/tasks";
};

const formSubmitEvent = async () => {
    const messageTag = document.getElementById("message");
    messageTag.innerHTML = "Changing password...";
    await changePassword();
    messageTag.innerHTML = "";
};


