
let isChangingPassword = false;
let oldEncryptionKey;
let oldKeyVersion;
let chunksVersion;

const getChunks = async (names) => {
    const response = await makeRequest("/getChunks", {
        names,
        keyVersion: oldKeyVersion,
        chunksVersion,
    });
    const output = {};
    for (const name of names) {
        const chunk = response.chunks[name];
        output[name] = (chunk === null) ? null : await decryptChunk(chunk, oldEncryptionKey);
    }
    return output;
};

const getTaskIds = (dest, plannerItems) => {
    for (const plannerItem of plannerItems) {
        if (plannerItem.type === "task") {
            dest.push(plannerItem.id);
        } else if (plannerItem.type === "category") {
            getTaskIds(dest, plannerItem.container.plannerItems);
        }
    }
};

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
    const response = await makeRequest("/getSalts", {});
    const { authSalt: oldAuthSalt, keySalt: oldKeySalt } = response;
    oldKeyVersion = response.keyVersion;
    chunksVersion = response.chunksVersion;
    const oldAuthHash = await dcodeIO.bcrypt.hash(oldPassword, oldAuthSalt);
    const oldKeyHash = await dcodeIO.bcrypt.hash(oldPassword, oldKeySalt);
    oldEncryptionKey = await getEncryptionKey(oldKeyHash);
    await makeRequest("/validateAuthHash", {
        authHash: oldAuthHash,
        keyVersion: oldKeyVersion,
        chunksVersion,
    });
    const newAuthSalt = await dcodeIO.bcrypt.genSalt(10);
    const newAuthHash = await dcodeIO.bcrypt.hash(newPassword, newAuthSalt);
    const newKeySalt = await dcodeIO.bcrypt.genSalt(10);
    const newKeyHash = await dcodeIO.bcrypt.hash(newPassword, newKeySalt);
    const newEncryptionKey = await getEncryptionKey(newKeyHash);
    const chunks = await getChunks(["plannerItems", "recentCompletions"]);
    const plannerItemsChunk = chunks.plannerItems;
    if (plannerItemsChunk !== null) {
        const { plannerItems } = plannerItemsChunk;
        const taskIds = [];
        getTaskIds(taskIds, plannerItems);
        const oldCompletionsKeys = taskIds.map((id) => "oldCompletions." + id);
        const oldCompletionsChunks = await getChunks(oldCompletionsKeys);
        for (const name in oldCompletionsChunks) {
            chunks[name] = oldCompletionsChunks[name];
        }
    }
    const encryptedChunks = {};
    for (const name in chunks) {
        const chunk = chunks[name];
        if (chunk !== null) {
            encryptedChunks[name] = await encryptChunk(chunk, newEncryptionKey);
        }
    }
    const { keyVersion: newKeyVersion } = await makeRequest("/changePasswordAction", {
        oldAuthHash,
        newAuthSalt,
        newAuthHash,
        newKeySalt,
        keyVersion: oldKeyVersion,
        chunksVersion,
        chunks: encryptedChunks,
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


