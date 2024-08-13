
const convertTextToBuffer = (text) => {
    const textEncoder = new TextEncoder("utf-8");
    return textEncoder.encode(text).buffer;
};

const convertBufferToText = (buffer) => {
    const textDecoder = new TextDecoder("utf-8");
    return textDecoder.decode(new Uint8Array(buffer));
};

const convertBase64ToBuffer = (base64) => {
    const binText = atob(base64);
    const byteArray = new Uint8Array(binText.length);
    for (let index = 0; index < binText.length; index++) {
        byteArray[index] = binText.charCodeAt(index);
    }
    return byteArray.buffer;
};

const convertBufferToBase64 = (buffer) => {
    const byteArray = new Uint8Array(buffer);
    const binChars = [];
    for (let index = 0; index < byteArray.length; index++) {
        const charCode = byteArray[index];
        binChars.push(String.fromCharCode(charCode));
    }
    const binText = binChars.join("");
    return btoa(binText);
};

const getEncryption = async (passwordText) => {
    const passwordBuffer = convertTextToBuffer(passwordText);
    const keyBuffer = await crypto.subtle.digest("SHA-256", passwordBuffer);
    const key = await crypto.subtle.importKey(
        "raw",
        keyBuffer,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"],
    );
    const ivBuffer = new ArrayBuffer(16);
    crypto.getRandomValues(new Uint8Array(ivBuffer));
    const aesAlgorithm = { name: "AES-GCM", iv: ivBuffer, tagLength: 128 };
    return { key, aesAlgorithm };
};

const decryptChunk = async (chunk, encryption) => {
    const encryptedBuffer = convertBase64ToBuffer(chunk);
    const decryptedBuffer = await crypto.subtle.decrypt(
        encryption.aesAlgorithm,
        encryption.key,
        encryptedBuffer,
    );
    const decryptedText = convertBufferToText(decryptedBuffer);
    return JSON.parse(decryptedText);
};

const encryptChunk = async (chunk, encryption) => {
    const inputText = JSON.stringify(chunk);
    const inputBuffer = convertTextToBuffer(inputText);
    const encryptedBuffer = await crypto.subtle.encrypt(
        encryption.aesAlgorithm,
        encryption.key,
        inputBuffer,
    );
    return convertBufferToBase64(encryptedBuffer);
};


