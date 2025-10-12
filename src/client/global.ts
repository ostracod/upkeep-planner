
import { Response, ErrorResponse } from "../common/types.js";

export type TaskStatusName = "neverCompleted" | "completed" | "upcoming" | "grace" | "overdue" | "inactive";

export interface PlannerDate {
    year: number;
    month: number;
    day: number;
}

export interface ContainerJson {
    plannerItems: PlannerItemJson[];
}

export interface PlannerItemJson {
    type: string;
    name: string;
}

export interface TaskJson extends PlannerItemJson {
    type: "task";
    id: number;
    frequency: number | null;
    dueDate: PlannerDate | null;
    dueDateIsManual: boolean | null;
    upcomingPeriod: number | null;
    gracePeriod: number | null;
    activeMonths: boolean[] | null;
    notes: string;
}

export interface CategoryJson extends PlannerItemJson {
    type: "category";
    container: ContainerJson;
}

class ServerError extends Error {
    shortMessage: string;
    
    constructor(message: string, shortMessage: string) {
        super(message);
        this.shortMessage = shortMessage;
    }
}

export const makeRequest = async (path: string, data: any): Promise<Response> => {
    const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (response.status !== 200) {
        throw new Error("There was an error while communicating with the server.");
    }
    const responseData = await response.json() as Response;
    if (!responseData.success) {
        const errorResponse = responseData as ErrorResponse;
        throw new ServerError(errorResponse.message, errorResponse.shortMessage ?? null);
    }
    return responseData;
};

const taskStatuses: TaskStatus[] = [];
// Each key of statusColors is a TaskStatus.
export const statusColors: { [name: string]: string } = {};

class TaskStatus {
    name: TaskStatusName;
    displayName: string;
    color: string;
    
    constructor(name: TaskStatusName, displayName: string, color: string) {
        this.name = name;
        this.displayName = displayName;
        this.color = color;
        taskStatuses.push(this);
        statusColors[this.name] = this.color;
    }
}

new TaskStatus("neverCompleted", "Never completed", "#4444FF");
new TaskStatus("completed", "Completed", "#44FF44");
new TaskStatus("upcoming", "Due date is upcoming", "#DDDD00");
new TaskStatus("grace", "Grace period after due date", "#FF8800");
new TaskStatus("overdue", "Overdue", "#FF0000");
new TaskStatus("inactive", "Out of season", "#CCCCCC");

export const createStatusLegend = (destTag: HTMLElement): void => {
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

export const applyCircleColors = (): void => {
    for (const name in statusColors) {
        const color = statusColors[name];
        const tags = document.getElementsByName(name + "Circle");
        for (const tag of Array.from(tags)) {
            tag.style.background = color;
        }
    }
};


