
const ivLength = 16;

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

const concatenateBuffers = (buffer1, buffer2) => {
    const byteArray = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    byteArray.set(new Uint8Array(buffer1), 0);
    byteArray.set(new Uint8Array(buffer2), buffer1.byteLength);
    return byteArray.buffer;
};

const getEncryptionKey = async (passwordText) => {
    const passwordBuffer = convertTextToBuffer(passwordText);
    const keyBuffer = await crypto.subtle.digest("SHA-256", passwordBuffer);
    return await crypto.subtle.importKey(
        "raw",
        keyBuffer,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"],
    );
};

const encryptChunk = async (chunk, encryptionKey) => {
    const ivBuffer = new ArrayBuffer(ivLength);
    crypto.getRandomValues(new Uint8Array(ivBuffer));
    const inputText = JSON.stringify(chunk);
    const inputBuffer = convertTextToBuffer(inputText);
    const encryptedBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: ivBuffer, tagLength: 128 },
        encryptionKey,
        inputBuffer,
    );
    const bufferWithHeader = concatenateBuffers(ivBuffer, encryptedBuffer);
    return convertBufferToBase64(bufferWithHeader);
};

const decryptChunk = async (chunk, encryptionKey) => {
    const bufferWithHeader = convertBase64ToBuffer(chunk);
    const ivBuffer = bufferWithHeader.slice(0, ivLength);
    const encryptedBuffer = bufferWithHeader.slice(ivLength, bufferWithHeader.length);
    const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: ivBuffer, tagLength: 128 },
        encryptionKey,
        encryptedBuffer,
    );
    const decryptedText = convertBufferToText(decryptedBuffer);
    return JSON.parse(decryptedText);
};


