
class ServerError extends Error {
    
    constructor(message, shortMessage) {
        super(message);
        this.shortMessage = shortMessage;
    }
}

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
        throw new ServerError(responseData.message, responseData.shortMessage ?? null);
    }
    return responseData;
};

const taskStatuses = [];
const statusColors = {};

class TaskStatus {
    
    constructor(name, displayName, color) {
        this.name = name;
        this.displayName = displayName;
        this.color = color;
        taskStatuses.push(this);
        statusColors[this.name] = this.color;
    }
}

new TaskStatus ("neverCompleted", "Never completed", "#4444FF");
new TaskStatus ("completed", "Completed", "#44FF44");
new TaskStatus ("upcoming", "Due date is upcoming", "#DDDD00");
new TaskStatus ("grace", "Grace period after due date", "#FF8800");
new TaskStatus ("overdue", "Overdue", "#FF0000");
new TaskStatus ("inactive", "Out of season", "#CCCCCC");

const createStatusLegend = (destTag) => {
    destTag.style.lineHeight = "22px";
    for (let index = 0; index < taskStatuses.length; index++) {
        if (index > 0) {
            destTag.appendChild(document.createElement("br"));
        }
        const status = taskStatuses[index];
        const circleTag = document.createElement("span");
        circleTag.setAttribute("name", status.name + "Circle");
        circleTag.className = "statusCircle inlineCircle";
        destTag.appendChild(circleTag);
        destTag.appendChild(document.createTextNode(" = " + status.displayName));
    }
}

const applyCircleColors = () => {
    for (const name in statusColors) {
        const color = statusColors[name];
        const tags = document.getElementsByName(name + "Circle");
        for (const tag of tags) {
            tag.style.background = color;
        }
    }
};


