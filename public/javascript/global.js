
const makeRequest = async (path, data) => {
    const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (response.status !== 200) {
        throw new Error("There was an error while communicating with the server.");
    }
    const responseData = await response.json();
    if (!responseData.success) {
        throw new Error(responseData.message);
    }
    return responseData;
};


