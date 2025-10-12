
import { AccountRequest, GetSaltsResponse, ValidateAuthHashRequest, ChangePasswordRequest, ChangePasswordResponse, GetChunksRequest, GetChunksResponse } from "../common/types.js";
import { PlannerItemJson, TaskJson, CategoryJson, makeRequest } from "./global.js";
import { getEncryptionKey, encryptChunk, decryptChunk } from "./chunk.js";

let bcryptHash: (password: string, salt: string) => Promise<string>;
let genBcryptSalt: (roundAmount: number) => string;
let isChangingPassword = false;
let oldEncryptionKey: CryptoKey;
let oldKeyVersion: number;
let chunksVersion: number;

const getChunks = async (names: string[]): Promise<{ [name: string]: any }> => {
    const response = await makeRequest("/getChunks", {
        names,
        keyVersion: oldKeyVersion,
        chunksVersion,
    } satisfies GetChunksRequest) as GetChunksResponse;
    const output: { [name: string]: any } = {};
    for (const name of names) {
        const chunk = response.chunks[name];
        output[name] = (chunk === null) ? null : await decryptChunk(chunk, oldEncryptionKey);
    }
    return output;
};

const getTaskIds = (dest: number[], plannerItems: PlannerItemJson[]): void => {
    for (const plannerItem of plannerItems) {
        if (plannerItem.type === "task") {
            dest.push((plannerItem as TaskJson).id);
        } else if (plannerItem.type === "category") {
            getTaskIds(dest, (plannerItem as CategoryJson).container.plannerItems);
        }
    }
};

const changePassword = async (): Promise<void> => {
    const oldPasswordTag = document.getElementById("oldPassword") as HTMLInputElement;
    const newPasswordTag = document.getElementById("newPassword") as HTMLInputElement;
    const confirmPasswordTag = document.getElementById("confirmPassword") as HTMLInputElement;
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
    const response = await makeRequest(
        "/getSalts",
        {} satisfies AccountRequest,
    ) as GetSaltsResponse;
    const { authSalt: oldAuthSalt, keySalt: oldKeySalt } = response;
    oldKeyVersion = response.keyVersion;
    chunksVersion = response.chunksVersion;
    const oldAuthHash = await bcryptHash(oldPassword, oldAuthSalt);
    const oldKeyHash = await bcryptHash(oldPassword, oldKeySalt);
    oldEncryptionKey = await getEncryptionKey(oldKeyHash);
    await makeRequest("/validateAuthHash", {
        authHash: oldAuthHash,
        keyVersion: oldKeyVersion,
        chunksVersion,
    } satisfies ValidateAuthHashRequest);
    const newAuthSalt = await genBcryptSalt(10);
    const newAuthHash = await bcryptHash(newPassword, newAuthSalt);
    const newKeySalt = await genBcryptSalt(10);
    const newKeyHash = await bcryptHash(newPassword, newKeySalt);
    const newEncryptionKey = await getEncryptionKey(newKeyHash);
    const chunks = await getChunks(["plannerItems", "recentCompletions"]);
    const plannerItemsChunk = chunks.plannerItems;
    if (plannerItemsChunk !== null) {
        const { plannerItems } = plannerItemsChunk;
        const taskIds: number[] = [];
        getTaskIds(taskIds, plannerItems);
        const oldCompletionsKeys = taskIds.map((id) => "oldCompletions." + id);
        const oldCompletionsChunks = await getChunks(oldCompletionsKeys);
        for (const name in oldCompletionsChunks) {
            chunks[name] = oldCompletionsChunks[name];
        }
    }
    const encryptedChunks: { [name: string]: string } = {};
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
    } satisfies ChangePasswordRequest) as ChangePasswordResponse;
    const keyData = JSON.stringify({ keyHash: newKeyHash, keyVersion: newKeyVersion });
    localStorage.setItem("keyData", keyData);
    alert("Your password was changed successfully.");
    window.location = "/tasks" as (string & Location);
};

window.formSubmitEvent = async () => {
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

export const initializePage = (): void => {
    bcryptHash = window.dcodeIO.bcrypt.hash;
    genBcryptSalt = window.dcodeIO.bcrypt.genSalt;
};


