
let isChangingPassword = false;

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
    const { authSalt: oldAuthSalt, keySalt: oldKeySalt } = await makeRequest("/getSalts", {});
    const oldAuthHash = await dcodeIO.bcrypt.hash(oldPassword, oldAuthSalt);
    const oldKeyHash = await dcodeIO.bcrypt.hash(oldPassword, oldKeySalt);
    const newAuthSalt = await dcodeIO.bcrypt.genSalt(10);
    const newAuthHash = await dcodeIO.bcrypt.hash(newPassword, newAuthSalt);
    const newKeySalt = await dcodeIO.bcrypt.genSalt(10);
    const newKeyHash = await dcodeIO.bcrypt.hash(newPassword, newKeySalt);
    const { keyVersion: newKeyVersion } = await makeRequest("/changePasswordAction", {
        oldAuthHash,
        newAuthSalt,
        newAuthHash,
        newKeySalt,
        // TODO: Send re-encrypted chunks in this request.
    });
    const keyData = JSON.stringify({ keyHash: newKeyHash, keyVersion: newKeyVersion });
    localStorage.setItem("keyData", keyData);
    alert("Your password was changed successfully.");
    window.location = "/tasks";
};

const formSubmitEvent = async () => {
    if (isChangingPassword) {
        return;
    }
    isChangingPassword = true;
    const messageTag = document.getElementById("message");
    messageTag.innerHTML = "Changing password...";
    try {
        await changePassword();
    } catch (error) {
        alert(error.message);
    }
    messageTag.innerHTML = "";
    isChangingPassword = false;
};


