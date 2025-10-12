
import { GetChunksRequest, GetChunksResponse, SetChunksRequest, SetChunksResponse, AccountRequest, GetTaskFilterResponse, SetTaskFilterRequest } from "../common/types.js";
import { TaskStatusName, PlannerDate, ContainerJson, PlannerItemJson, TaskJson, CategoryJson, LocalStorageData, statusColors, makeRequest, createStatusLegend, applyCircleColors } from "./global.js";
import { getEncryptionKey, encryptChunk, decryptChunk } from "./chunk.js";

type NativeDate = Date;
type PageId = "loadingScreen" | "viewPlannerItems" | "viewTask" | "editTask"

interface ButtonDef {
    text: string;
    onClick: () => void;
}

interface Request {
    isSave: boolean;
    func: () => Promise<void>;
}

interface CompletionJson {
    taskId: number;
    date: PlannerDate;
    dateIsApproximate: boolean;
    notes: string;
}

const newCategoryName = "New Category";
const rootCategoryName = "Top Level";
const pageIds = ["loadingScreen", "viewPlannerItems", "editTask", "viewTask"];
const secondsPerDay = 60 * 60 * 24;
const monthAmount = 12;
const monthAbbreviations = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const completionFlushThreshold = 50;

let tag_taskFilter: HTMLSelectElement;
let tag_editTaskName: HTMLInputElement;
let tag_scheduleType: HTMLSelectElement;
let tag_editFrequency: HTMLInputElement;
let tag_editDueDate: HTMLInputElement;
let tag_dueDateIsManual: HTMLInputElement;
let tag_hasUpcomingPeriod: HTMLInputElement;
let tag_editUpcomingPeriod: HTMLInputElement;
let tag_hasGracePeriod: HTMLInputElement;
let tag_editGracePeriod: HTMLInputElement;
let tag_editParentCategory: HTMLSelectElement;
let tag_editTaskNotes: HTMLTextAreaElement;
let tag_newCompletionDate: HTMLInputElement;
let tag_dateIsApproximate: HTMLInputElement;
let tag_newCompletionNotes: HTMLTextAreaElement;

const requestQueue: Request[] = [];
let currentRequest: Request | null = null;
let saveTimestamp: number | null = null;
let keyHash: string;
let keyVersion: number;
let chunksVersion: number | null = null;
let hasFault = false;
let faultMessage: string | null = null;
let shortFaultMessage: string | null = null;
let encryptionKey: CryptoKey;
let rootContainer: Container;
let allCategories: Category[];
let currentTask: Task | null = null;
let nextTaskId: number;
let recentCompletions: Set<Completion> = new Set();
let activeMonthCheckboxes: HTMLInputElement[];
let lastTimerEventDate: PlannerDate | null = null;
let currentPageId: PageId | null = null;
let plannerItemsScroll: number | null = null;
let taskFilter: string;

const pluralize = (amount: number, noun: string): string => (
    (amount === 1) ? `${amount} ${noun}` : `${amount} ${noun}s`
);

const convertNativeDateToDate = (nativeDate: NativeDate): PlannerDate => ({
    year: nativeDate.getFullYear(),
    month: nativeDate.getMonth() + 1,
    day: nativeDate.getDate(),
});

const convertDateToNativeDate = (date: PlannerDate): NativeDate => (
    new Date(date.year, date.month - 1, date.day, 11)
);

const convertDateToTimestamp = (date: PlannerDate): number => {
    const nativeDate = convertDateToNativeDate(date);
    return nativeDate.getTime() / 1000;
};

const convertTimestampToDate = (timestamp: number): PlannerDate => {
    const nativeDate = new Date(timestamp * 1000);
    return convertNativeDateToDate(nativeDate);
};

const getCurrentDate = (): PlannerDate => convertNativeDateToDate(new Date());

const convertDateToString = (date: PlannerDate): string => {
    const terms = [
        `${date.year}`.padStart(4, "0"),
        `${date.month}`.padStart(2, "0"),
        `${date.day}`.padStart(2, "0"),
    ];
    return terms.join("-");
};

const convertStringToDate = (dateString: string): PlannerDate => {
    const values = dateString.split("-").map((term) => parseInt(term, 10));
    return { year: values[0], month: values[1], day: values[2] };
};

// Returns the number of days from date2 to date1.
const subtractDates = (date1: PlannerDate, date2: PlannerDate): number => {
    const nativeDate1 = convertDateToNativeDate(date1);
    const nativeDate2 = convertDateToNativeDate(date2);
    // `timestampDelta` is measured in seconds.
    const timestampDelta = (nativeDate1.getTime() - nativeDate2.getTime()) / 1000;
    return Math.round(timestampDelta / secondsPerDay);
};

const datesAreEqual = (date1: PlannerDate, date2: PlannerDate): boolean => (
    date1.year === date2.year && date1.month === date2.month && date1.day === date2.day
);

const addDaysToDate = (date: PlannerDate, dayAmount: number): PlannerDate => {
    const timestamp = convertDateToTimestamp(date);
    return convertTimestampToDate(timestamp + secondsPerDay * dayAmount);
};

const createButtons = (
    buttonDefs: ButtonDef[],
): { divTag: HTMLDivElement, buttonTags: HTMLButtonElement[] } => {
    const divTag = document.createElement("div");
    divTag.style.flexShrink = "0";
    const buttonTags: HTMLButtonElement[] = [];
    for (const buttonDef of buttonDefs) {
        const button = document.createElement("button");
        button.innerHTML = buttonDef.text;
        button.onclick = buttonDef.onClick;
        divTag.appendChild(button);
        buttonTags.push(button);
    }
    return { divTag, buttonTags };
};

const updateSaveMessage = (): void => {
    let color = "#000000";
    let saveMessage: string;
    if (hasFault) {
        color = "#DD0000";
        saveMessage = "Error! " + shortFaultMessage;
    } else if (currentRequest?.isSave || requestQueue.some((request) => request.isSave)) {
        saveMessage = "Saving...";
    } else if (saveTimestamp === null) {
        saveMessage = "";
    } else {
        saveMessage = "Saved all changes.";
    }
    const messageTag = document.getElementById("saveMessage");
    messageTag.innerHTML = saveMessage;
    messageTag.style.color = color;
}

const checkRequestQueue = (): void => {
    if (currentRequest === null && requestQueue.length > 0) {
        currentRequest = requestQueue.shift();
        currentRequest.func();
    }
    updateSaveMessage();
};

const enterFaultState = (message: string, shortMessage = "Please reload page."): void => {
    hasFault = true;
    faultMessage = message;
    shortFaultMessage = shortMessage;
    alert(faultMessage);
    updateSaveMessage();
};

const dispatchRequest = <T>(
    isSave: boolean,
    requestFunc: () => Promise<T>,
): Promise<T> => new Promise<T>((resolve, reject) => {
    if (hasFault) {
        alert(faultMessage);
        reject(new Error(faultMessage));
        return;
    }
    const wrappedFunc = async (): Promise<void> => {
        let result: T;
        try {
            result = await requestFunc();
        } catch (error) {
            enterFaultState(error.message, error.shortMessage);
            reject(error);
            return;
        }
        currentRequest = null;
        if (isSave) {
            saveTimestamp = Date.now() / 1000;
        }
        checkRequestQueue();
        resolve(result);
    };
    requestQueue.push({ isSave, func: wrappedFunc });
    checkRequestQueue();
});

const getChunks = async (
    names: string[],
    isSave = false,
): Promise<{ [name: string]: any }> => {
    return await dispatchRequest<any>(isSave, async () => {
        const body: GetChunksRequest = { keyVersion, names };
        if (chunksVersion !== null) {
            body.chunksVersion = chunksVersion;
        }
        const response = await makeRequest("/getChunks", body) as GetChunksResponse;
        chunksVersion = response.chunksVersion;
        const output = {};
        for (const name of names) {
            const chunk = response.chunks[name];
            output[name] = (chunk === null) ? null : await decryptChunk(chunk, encryptionKey);
        }
        return output;
    });
};

const setChunks = async (chunks: { [name: string]: any }): Promise<void> => {
    const encryptedChunks: { [name: string]: string | null } = {};
    for (const name in chunks) {
        const chunk = chunks[name];
        encryptedChunks[name] = (chunk === null)
            ? null
            : await encryptChunk(chunk, encryptionKey);
    }
    await dispatchRequest<void>(true, async () => {
        const response = await makeRequest(
            "/setChunks",
            { chunksVersion, keyVersion, chunks: encryptedChunks } satisfies SetChunksRequest,
        ) as SetChunksResponse;
        chunksVersion = response.chunksVersion;
    });
};

const readTaskFilter = async (): Promise<string> => {
    return await dispatchRequest<string>(false, async () => {
        const response = await makeRequest(
            "/getTaskFilter",
            {} satisfies AccountRequest,
        ) as GetTaskFilterResponse;
        return response.taskFilter;
    });
};

const writeTaskFilter = async (): Promise<void> => {
    const filterToWrite = taskFilter;
    await dispatchRequest<void>(true, async () => {
        await makeRequest(
            "/setTaskFilter",
            { taskFilter: filterToWrite } satisfies SetTaskFilterRequest,
        );
    });
};

const savePlannerItems = (): void => {
    const data = rootContainer.toJson();
    setChunks({ plannerItems: data });
};

const recentCompletionsToJson = (): CompletionJson[] => {
    const output: CompletionJson[] = [];
    for (const completion of recentCompletions) {
        output.push(completion.toJson());
    }
    return output;
}

const loadOldCompletions = async (tasks: Task[], isSave = false): Promise<void> => {
    const chunkKeys: string[] = [];
    for (const task of tasks) {
        if (!task.loadedOldCompletions) {
            chunkKeys.push(task.getOldCompletionsKey());
        }
    }
    if (chunkKeys.length <= 0) {
        return;
    }
    const chunks = await getChunks(chunkKeys, isSave);
    for (const task of tasks) {
        const completionsData = chunks[task.getOldCompletionsKey()] as CompletionJson[];
        // Check `loadedOldCompletions` again to make sure we don't
        // accidentally add the same completions twice.
        if (!task.loadedOldCompletions) {
            if (Array.isArray(completionsData)) {
                const completions = completionsData.map((data) => jsonToCompletion(data));
                task.addCompletionsFromServer(completions);
            }
            task.loadedOldCompletions = true;
        }
    }
};

// Saves recent completions, and flushes recent completions to old completions if
// completionFlushThreshold is met. Saves old completions for oldCompletionsTask if provided.
// Old completions must have been previously loaded for oldCompletionsTask.
const saveCompletions = async (oldCompletionsTask: Task | null = null): Promise<void> => {
    const tasks = getAllTasks();
    const surplusCount = recentCompletions.size - tasks.length;
    // Stores all tasks for which old completions should be updated.
    const oldCompletionsTasks: Task[] = [];
    if (oldCompletionsTask !== null) {
        if (!oldCompletionsTask.loadedOldCompletions) {
            enterFaultState("Failed assertion for oldCompletionsTask!");
            return;
        }
        oldCompletionsTasks.push(oldCompletionsTask);
    }
    if (surplusCount >= completionFlushThreshold) {
        const previousCompletions = recentCompletions;
        recentCompletions = new Set();
        for (const task of tasks) {
            const lastCompletion = task.getLastCompletion();
            if (lastCompletion !== null) {
                recentCompletions.add(lastCompletion);
            }
        }
        const tasksToUpdate = new Set<Task>();
        for (const completion of previousCompletions) {
            if (!completion.isRecent()) {
                const { parentTask } = completion;
                if (parentTask !== oldCompletionsTask) {
                    tasksToUpdate.add(parentTask);
                }
            }
        }
        await loadOldCompletions(Array.from(tasksToUpdate), true);
        for (const task of tasksToUpdate) {
            oldCompletionsTasks.push(task);
        }
    }
    const chunks = { recentCompletions: recentCompletionsToJson() };
    for (const task of oldCompletionsTasks) {
        // Make sure that the task hasn't been deleted while running `loadOldCompletions`.
        if (!task.isDeleted) {
            chunks[task.getOldCompletionsKey()] = task.oldCompletionsToJson();
        }
    }
    setChunks(chunks);
};

class Completion {
    date: PlannerDate;
    dateIsApproximate: boolean;
    notes: string;
    timestamp: number;
    tag: HTMLDivElement | null;
    notesAreVisible: boolean;
    parentTask: Task | null;
    rowTag: HTMLDivElement;
    textTag: HTMLDivElement;
    notesTag: HTMLDivElement;
    buttonsTag: HTMLDivElement;
    notesButton: HTMLButtonElement;
    editTag: HTMLDivElement;
    editDateTag: HTMLInputElement;
    editIsApproxTag: HTMLInputElement;
    editNotesTag: HTMLTextAreaElement;
    
    constructor(date: PlannerDate, dateIsApproximate: boolean, notes: string) {
        this.date = date;
        this.dateIsApproximate = dateIsApproximate;
        this.notes = notes;
        this.timestamp = convertDateToTimestamp(this.date);
        this.tag = null;
        this.notesAreVisible = false;
        this.parentTask = null;
    }
    
    getDateString(): string {
        let output = convertDateToString(this.date);
        if (this.dateIsApproximate) {
            output = "~" + output;
        }
        return output;
    }
    
    getTag(): HTMLDivElement {
        if (this.tag !== null) {
            return this.tag;
        }
        this.tag = document.createElement("div");
        this.tag.className = "completion";
        
        this.rowTag = document.createElement("div");
        this.rowTag.style.display = "flex";
        this.textTag = document.createElement("div");
        this.textTag.style.marginRight = "15px";
        this.textTag.innerHTML = this.getDateString();
        this.rowTag.appendChild(this.textTag);
        const buttonsResult = createButtons([
            {
                text: "",
                onClick: () => {
                    this.setNotesVisibility(!this.notesAreVisible);
                },
            },
            {
                text: "Edit",
                onClick: () => {
                    this.showEditTag();
                },
            },
            {
                text: "Delete",
                onClick: () => {
                    const shouldDelete = confirm(`Are you sure you want to delete the completion at ${this.getDateString()}?`);
                    if (shouldDelete) {
                        this.delete();
                    }
                },
            },
        ]);
        this.buttonsTag = buttonsResult.divTag;
        this.notesButton = buttonsResult.buttonTags[0];
        this.updateNotesButton();
        this.rowTag.appendChild(this.buttonsTag);
        this.tag.appendChild(this.rowTag);
        
        this.notesTag = document.createElement("div");
        this.notesTag.style.display = "none";
        this.notesTag.style.marginTop = "10px";
        this.tag.appendChild(this.notesTag);
        
        this.editTag = document.createElement("div");
        this.editTag.style.display = "none";
        this.editTag.style.marginTop = "20px";
        this.editTag.style.marginBottom = "20px";
        
        const dateRowTag = document.createElement("div");
        dateRowTag.style.marginBottom = "10px";
        dateRowTag.appendChild(document.createTextNode("Date: "));
        this.editDateTag = document.createElement("input");
        this.editDateTag.type = "date";
        this.editDateTag.style.marginRight = "15px";
        dateRowTag.appendChild(this.editDateTag);
        this.editIsApproxTag = document.createElement("input");
        this.editIsApproxTag.type = "checkbox";
        dateRowTag.appendChild(this.editIsApproxTag);
        dateRowTag.appendChild(document.createTextNode(" Date is approximate"));
        this.editTag.appendChild(dateRowTag);
        
        const notesRowTag = document.createElement("div");
        notesRowTag.style.marginBottom = "10px";
        notesRowTag.appendChild(document.createTextNode("Notes:"));
        notesRowTag.appendChild(document.createElement("br"));
        this.editNotesTag = document.createElement("textarea");
        this.editNotesTag.style.width = "300px";
        this.editNotesTag.style.height = "80px";
        notesRowTag.appendChild(this.editNotesTag);
        this.editTag.appendChild(notesRowTag);
        
        const buttonsRowTag = document.createElement("div");
        buttonsRowTag.style.display = "flex";
        const editButtonsResult = createButtons([
            {
                text: "Save Completion",
                onClick: () => {
                    this.finishEdit();
                },
            },
            {
                text: "Cancel",
                onClick: () => {
                    this.hideEditTag();
                },
            },
        ]);
        buttonsRowTag.appendChild(editButtonsResult.divTag);
        this.editTag.appendChild(buttonsRowTag);
        
        this.tag.appendChild(this.editTag);
        
        return this.tag;
    }
    
    isRecent(): boolean {
        return recentCompletions.has(this);
    }
    
    updateNotesButton(): void {
        this.notesButton.style.display = (this.notes.length > 0) ? "" : "none";
        this.notesButton.innerHTML = this.notesAreVisible ? "Hide Notes" : "Show Notes";
    }
    
    setNotesVisibility(notesAreVisible: boolean): void {
        this.notesAreVisible = notesAreVisible;
        this.updateNotesButton();
        if (this.notesAreVisible) {
            displayNotes(this.notesTag, this.notes);
            this.notesTag.style.display = "";
        } else {
            this.notesTag.innerHTML = "";
            this.notesTag.style.display = "none";
        }
    }
    
    showEditTag(): void {
        this.rowTag.style.display = "none";
        this.setNotesVisibility(false);
        this.editTag.style.display = "";
        this.editDateTag.value = convertDateToString(this.date);
        this.editIsApproxTag.checked = this.dateIsApproximate;
        this.editNotesTag.value = this.notes;
    }
    
    hideEditTag(): void {
        this.rowTag.style.display = "flex";
        this.editTag.style.display = "none";
    }
    
    finishEdit(): void {
        const dateString = this.editDateTag.value;
        if (dateString.length <= 0) {
            alert("Please enter a date for the completion.");
            return;
        }
        this.date = convertStringToDate(dateString);
        this.timestamp = convertDateToTimestamp(this.date);
        this.dateIsApproximate = this.editIsApproxTag.checked;
        this.notes = this.editNotesTag.value;
        this.hideEditTag();
        this.textTag.innerHTML = this.getDateString();
        this.updateNotesButton();
        this.parentTask.handleCompletionsChange(false, true);
    }
    
    delete(): void {
        this.parentTask.deleteCompletion(this);
    }
    
    toJson(): CompletionJson {
        return {
            taskId: this.parentTask.id,
            date: { ...this.date },
            dateIsApproximate: this.dateIsApproximate,
            notes: this.notes,
        }
    }
}

class Container {
    tag: HTMLDivElement;
    parentCategory: Category | null;
    plannerItems: PlannerItem[];
    
    constructor(tag: HTMLDivElement, parentCategory: Category | null = null) {
        this.tag = tag;
        this.parentCategory = parentCategory;
        if (this.parentCategory !== null) {
            this.parentCategory.container = this;
        }
        this.plannerItems = [];
    }
    
    addItem(plannerItem: PlannerItem, index: number | null = null): void {
        if (plannerItem.parentContainer !== null) {
            plannerItem.remove();
        }
        if (index === null || index >= this.plannerItems.length) {
            this.tag.appendChild(plannerItem.tag);
            this.plannerItems.push(plannerItem);
        } else {
            const nextItem = this.plannerItems[index];
            this.tag.insertBefore(plannerItem.tag, nextItem.tag);
            this.plannerItems.splice(index, 0, plannerItem);
        }
        plannerItem.parentContainer = this;
        if (this.parentCategory === null) {
            updatePlannerItemsPlaceholder();
        } else {
            this.parentCategory.updateVisibility();
        }
    }
    
    findItem(plannerItem: PlannerItem): number {
        return this.plannerItems.indexOf(plannerItem);
    }
    
    removeItem(plannerItem: PlannerItem): void {
        this.tag.removeChild(plannerItem.tag);
        const index = this.findItem(plannerItem);
        this.plannerItems.splice(index, 1);
        plannerItem.parentContainer = null;
        if (this.parentCategory === null) {
            updatePlannerItemsPlaceholder();
        } else {
            this.parentCategory.updateVisibility();
        }
    }
    
    getItems(filter: (plannerItem: PlannerItem) => boolean): PlannerItem[] {
        const output: PlannerItem[] = [];
        for (const plannerItem of this.plannerItems) {
            if (filter(plannerItem)) {
                output.push(plannerItem);
            }
            if (plannerItem instanceof Category) {
                const filteredItems = plannerItem.container.getItems(filter);
                for (const filteredItem of filteredItems) {
                    output.push(filteredItem);
                }
            }
        }
        return output;
    }
    
    toJson(): ContainerJson {
        return {
            plannerItems: this.plannerItems.map((plannerItem) => plannerItem.toJson()),
        };
    }
}

abstract class PlannerItem {
    name: string;
    tag: HTMLDivElement;
    parentContainer: Container | null;
    isVisible: boolean;
    nameTag: HTMLDivElement;
    buttonsTag: HTMLDivElement;
    moveButtonsTag: HTMLDivElement;
    
    constructor(name) {
        this.name = name;
        this.tag = this.createTag();
        this.parentContainer = null;
        this.isVisible = true;
    }
    
    abstract createTag(): HTMLDivElement;
    
    abstract toJson(): PlannerItemJson;
    
    abstract updateVisibility(shouldRecur?: boolean): void;
    
    createButtons(buttonDefs: ButtonDef[]): HTMLDivElement {
        this.buttonsTag = createButtons([
            ...buttonDefs,
            {
                text: "Move",
                onClick: () => {
                    this.startMove();
                },
            },
        ]).divTag;
        return this.buttonsTag;
    }
    
    createMoveButtons(): HTMLDivElement {
        this.moveButtonsTag = createButtons([
            {
                text: "Up",
                onClick: () => {
                    this.moveUp();
                },
            },
            {
                text: "Down",
                onClick: () => {
                    this.moveDown();
                },
            },
            {
                text: "Enter",
                onClick: () => {
                    this.enterCategory();
                },
            },
            {
                text: "Exit",
                onClick: () => {
                    this.exitCategory();
                },
            },
            {
                text: "End Move",
                onClick: () => {
                    this.endMove();
                },
            },
        ]).divTag;
        this.moveButtonsTag.style.display = "none";
        return this.moveButtonsTag;
    }
    
    getParentCategory(): Category | null {
        return this.parentContainer?.parentCategory ?? null;
    }
    
    setName(name: string): void {
        this.name = name;
        this.nameTag.innerHTML = name;
    }
    
    remove(): void {
        this.parentContainer.removeItem(this);
    }
    
    startMove(): void {
        this.buttonsTag.style.display = "none";
        this.moveButtonsTag.style.display = "";
    }
    
    endMove(): void {
        this.buttonsTag.style.display = "";
        this.moveButtonsTag.style.display = "none";
    }
    
    getIndex(): number {
        return this.parentContainer.findItem(this);
    }
    
    moveUp(): void {
        const nextIndex = this.getIndex() - 1;
        if (nextIndex < 0) {
            return;
        }
        const container = this.parentContainer;
        this.remove();
        container.addItem(this, nextIndex);
        savePlannerItems();
    }
    
    moveDown(): void {
        const nextIndex = this.getIndex() + 1;
        const container = this.parentContainer;
        if (nextIndex >= container.plannerItems.length) {
            return;
        }
        this.remove();
        container.addItem(this, nextIndex);
        savePlannerItems();
    }
    
    enterCategory(): void {
        const nextIndex = this.getIndex() + 1;
        const { plannerItems } = this.parentContainer;
        if (nextIndex >= plannerItems.length) {
            return;
        }
        const nextItem = plannerItems[nextIndex];
        if (!(nextItem instanceof Category)) {
            return;
        }
        this.remove();
        nextItem.addItem(this, 0);
        savePlannerItems();
    }
    
    exitCategory(): void {
        const parentCategory = this.getParentCategory();
        if (parentCategory === null) {
            return;
        }
        const container = parentCategory.parentContainer;
        const index = container.findItem(parentCategory);
        this.remove();
        container.addItem(this, index);
        savePlannerItems();
    }
    
    setVisibility(isVisible: boolean): void {
        if (isVisible === this.isVisible) {
            return;
        }
        this.isVisible = isVisible;
        this.tag.style.display = this.isVisible ? "" : "none";
        const parentCategory = this.getParentCategory();
        if (parentCategory === null) {
            updatePlannerItemsPlaceholder();
        } else {
            parentCategory.updateVisibility();
        }
    }
}

class Task extends PlannerItem {
    id: number;
    frequency: number | null;
    dueDate: PlannerDate | null;
    dueDateIsManual: boolean | null;
    upcomingPeriod: number | null;
    gracePeriod: number | null;
    activeMonths: boolean[] | null;
    notes: string;
    // `completions` is sorted by date ascending. Initially `completions` only contains
    // the most recent completion until loadOldCompletions is called with the task.
    completions: Completion[];
    loadedOldCompletions: boolean;
    isDeleted: boolean;
    status: TaskStatusName | null;
    statusCircle: HTMLDivElement;
    dueDateTag: HTMLDivElement;
    completionDateTag: HTMLDivElement;
    
    constructor(data: TaskJson) {
        super(data.name);
        this.id = data.id;
        this.frequency = data.frequency;
        this.dueDate = data.dueDate;
        this.dueDateIsManual = data.dueDateIsManual;
        this.upcomingPeriod = data.upcomingPeriod;
        this.gracePeriod = data.gracePeriod;
        this.activeMonths = data.activeMonths;
        this.notes = data.notes;
        this.completions = [];
        this.loadedOldCompletions = false;
        this.isDeleted = false;
        this.status = null;
        this.updateCompletionDateTag();
        this.updateDueDateTag();
        this.updateStatus();
        this.updateVisibility();
    }
    
    createTag(): HTMLDivElement {
        const output = document.createElement("div");
        output.className = "plannerItem";
        
        const rowTag = document.createElement("div");
        rowTag.className = "plannerItemRow";
        
        const circleContainer = document.createElement("div");
        circleContainer.style.paddingBottom = "2px";
        this.statusCircle = document.createElement("div");
        this.statusCircle.className = "statusCircle";
        this.statusCircle.style.marginRight = "10px";
        circleContainer.appendChild(this.statusCircle);
        rowTag.appendChild(circleContainer);
        
        const textTag = document.createElement("div");
        textTag.style.marginRight = "15px";
        this.nameTag = document.createElement("div");
        this.nameTag.innerHTML = this.name;
        textTag.appendChild(this.nameTag);
        this.completionDateTag = document.createElement("div");
        textTag.appendChild(this.completionDateTag);
        this.dueDateTag = document.createElement("div");
        textTag.appendChild(this.dueDateTag);
        rowTag.appendChild(textTag);
        
        const buttonsTag = this.createButtons([
            {
                text: "Mark as Complete",
                onClick: () => {
                    this.markAsComplete();
                },
            },
            {
                text: "View",
                onClick: () => {
                    viewTask(this);
                },
            },
        ]);
        rowTag.appendChild(buttonsTag);
        const moveButtonsTag = this.createMoveButtons();
        rowTag.appendChild(moveButtonsTag);
        output.appendChild(rowTag);
        
        return output;
    }
    
    updateCompletionDateTag(): void {
        const completion = this.getLastCompletion();
        let text: string;
        let displayStyle: string;
        if (completion === null) {
            text = "";
            displayStyle = "none";
        } else {
            text = `Last completed on ${completion.getDateString()}`;
            displayStyle = "";
        }
        this.completionDateTag.innerHTML = text;
        this.completionDateTag.style.display = displayStyle;
    }
    
    updateDueDateTag(): void {
        let text: string;
        let displayStyle: string;
        if (this.dueDate === null) {
            text = "";
            displayStyle = "none";
        } else {
            text = `Due on ${convertDateToString(this.dueDate)}`;
            displayStyle = "";
        }
        this.dueDateTag.innerHTML = text;
        this.dueDateTag.style.display = displayStyle;
    }
    
    determineStatus(): TaskStatusName {
        const currentDate = getCurrentDate();
        const dueDateOffset = (this.dueDate === null)
            ? null
            : subtractDates(currentDate, this.dueDate);
        if (dueDateOffset !== null) {
            if (dueDateOffset >= 0) {
                if (this.gracePeriod !== null && dueDateOffset < this.gracePeriod) {
                    return "grace";
                }
                return "overdue";
            }
            if (this.upcomingPeriod !== null && dueDateOffset >= -this.upcomingPeriod) {
                return "upcoming";
            }
        }
        if (!dateIsInActiveMonth(currentDate, this.activeMonths)) {
            return "inactive";
        }
        if (this.getLastCompletion() === null) {
            return "neverCompleted";
        }
        return "completed";
    }
    
    updateStatus(): void {
        const status = this.determineStatus();
        if (status !== this.status) {
            this.status = status;
            this.statusCircle.style.background = statusColors[this.status];
            this.updateVisibility();
        }
    }
    
    displayCompletions(): void {
        const completionsTag = document.getElementById("pastCompletions");
        completionsTag.innerHTML = "";
        if (this.completions.length <= 0) {
            const placeholderTag = document.createElement("div");
            placeholderTag.className = "completion";
            placeholderTag.innerHTML = "(None)";
            completionsTag.appendChild(placeholderTag);
        } else {
            for (let index = this.completions.length - 1; index >= 0; index--) {
                const completion = this.completions[index];
                const completionTag = completion.getTag();
                completionsTag.appendChild(completionTag);
            }
        }
    }
    
    displayDueDate(): void {
        let dueDateText: string;
        let displayStyle: string;
        if (this.dueDate === null) {
            dueDateText = "";
            displayStyle = "none";
        } else {
            const dateString = convertDateToString(this.dueDate);
            if (this.frequency === null) {
                dueDateText = `Due on ${dateString}`;
            } else {
                const frequencyText = pluralize(this.frequency, "day");
                dueDateText = `Next due on ${dateString}; repeats every ${frequencyText}`;
            }
            displayStyle = "";
        }
        const dueDateTag = document.getElementById("viewDueDate");
        dueDateTag.innerHTML = dueDateText;
        dueDateTag.style.display = displayStyle;
    }
    
    // Should not be called if this.frequency is null.
    calculateDueDate(): PlannerDate {
        return calculateDueDate(
            this.frequency,
            this.activeMonths,
            this.getLastCompletionDate(),
        );
    }
    
    checkDueDate(addedNewCompletion: boolean): void {
        if (this.dueDate === null) {
            return;
        }
        let dueDateHasChanged = false;
        if (this.dueDateIsManual) {
            const completionDate = this.getLastCompletionDate();
            // We have just finished the task if the most recent completion is after
            // the due date OR we just added the most recent completion (regardless
            // of the completion date).
            if ((completionDate !== null && subtractDates(completionDate, this.dueDate) >= 0)
                    || addedNewCompletion) {
                if (this.frequency === null) {
                    this.dueDate = null;
                    this.dueDateIsManual = null;
                } else {
                    this.dueDate = this.calculateDueDate();
                    this.dueDateIsManual = false;
                }
                dueDateHasChanged = true;
            }
        } else if (this.frequency !== null) {
            const nextDueDate = this.calculateDueDate();
            if (!datesAreEqual(this.dueDate, nextDueDate)) {
                this.dueDate = nextDueDate;
                dueDateHasChanged = true;
            }
        }
        if (dueDateHasChanged) {
            this.handleDueDateChange();
            savePlannerItems();
        }
    }
    
    completionsChangeHelper(): void {
        this.completions.sort(
            (completion1, completion2) => completion1.timestamp - completion2.timestamp,
        );
        this.updateCompletionDateTag();
        if (this === currentTask) {
            this.displayCompletions();
        }
        this.updateStatus();
    }
    
    handleCompletionsChange(
        // addedNewCompletion should be true iff we just added a completion
        // AND it is the most recent completion of the task.
        addedNewCompletion: boolean,
        // Set shouldSaveOldCompletions to true if any completion outside
        // of recentCompletions may have been modified.
        shouldSaveOldCompletions: boolean,
    ): void {
        this.completionsChangeHelper();
        const lastCompletion = this.getLastCompletion();
        if (lastCompletion !== null) {
            recentCompletions.add(lastCompletion);
        }
        this.checkDueDate(addedNewCompletion);
        saveCompletions(shouldSaveOldCompletions ? this : null);
    }
    
    handleDueDateChange(): void {
        this.updateDueDateTag();
        if (this === currentTask) {
            this.displayDueDate();
        }
        this.updateStatus();
        this.updateVisibility();
    }
    
    addCompletionHelper(completion: Completion): void {
        this.completions.push(completion);
        completion.parentTask = this;
    }
    
    addCompletion(completion: Completion): void {
        const lastDate = this.getLastCompletionDate();
        const completionIsNew = (lastDate === null
            || subtractDates(completion.date, lastDate) > 0);
        this.addCompletionHelper(completion);
        recentCompletions.add(completion);
        this.handleCompletionsChange(completionIsNew, false);
    }
    
    addCompletionsFromServer(completions: Completion[]): void {
        for (const completion of completions) {
            this.addCompletionHelper(completion);
        }
        this.completionsChangeHelper();
    }
    
    getLastCompletion(): Completion | null {
        return (this.completions.length > 0) ? this.completions.at(-1) : null;
    }
    
    getLastCompletionDate(): PlannerDate | null {
        return this.getLastCompletion()?.date ?? null;
    }
    
    markAsComplete(): void {
        const lastDate = this.getLastCompletionDate();
        const currentDate = getCurrentDate();
        if (lastDate === null || !datesAreEqual(currentDate, lastDate)) {
            const completion = new Completion(currentDate, false, "");
            this.addCompletion(completion);
        } else {
            alert("This task has already been completed today.");
        }
    }
    
    deleteCompletion(completion: Completion): void {
        const index = this.completions.indexOf(completion);
        this.completions.splice(index, 1);
        completion.parentTask = null;
        recentCompletions.delete(completion);
        this.handleCompletionsChange(false, true);
    }
    
    getOldCompletionsKey(): string {
        return "oldCompletions." + this.id;
    }
    
    delete(): void {
        for (const completion of this.completions) {
            recentCompletions.delete(completion);
        }
        this.isDeleted = true;
        setChunks({
            recentCompletions: recentCompletionsToJson(),
            [this.getOldCompletionsKey()]: null,
        });
        this.remove();
    }
    
    evaluateFilterTerm(term: string): boolean {
        if (term === "all") {
            return true;
        }
        const hasNoDueDate = (this.dueDate === null);
        if (term === "noDueDate") {
            return hasNoDueDate;
        }
        if (hasNoDueDate) {
            return false;
        }
        const components = term.split("_");
        if (components[0] === "days") {
            const threshold = parseInt(components[1], 10);
            const currentDate = getCurrentDate();
            const dueDateOffset = subtractDates(currentDate, this.dueDate);
            return (dueDateOffset > -threshold);
        } else if (components[0] === "status") {
            const threshold = components[1];
            const orderedStatuses = ["upcoming", "grace", "overdue"];
            const statusIndex = orderedStatuses.indexOf(this.status);
            if (statusIndex < 0) {
                return false;
            }
            const thresholdIndex = orderedStatuses.indexOf(threshold);
            return (statusIndex >= thresholdIndex);
        } else {
            throw new Error(`Unknown task filter "${term}".`);
        }
    }
    
    evaluateFilter(
        terms: string[],
        startIndex: number,
    ): { hasMatch: boolean, index: number } {
        let index = startIndex;
        const firstTerm = terms[index];
        index += 1;
        let hasMatch: boolean;
        if (firstTerm === "OR") {
            const result1 = this.evaluateFilter(terms, index);
            ({ index } = result1);
            const result2 = this.evaluateFilter(terms, index);
            ({ index } = result2);
            hasMatch = (result1.hasMatch || result2.hasMatch);
        } else {
            hasMatch = this.evaluateFilterTerm(firstTerm);
        }
        return { hasMatch, index };
    }
    
    updateVisibility(shouldRecur = false): void {
        // Nothing like a good DSL to spice things up.
        const filterTerms = taskFilter.split(" ");
        const isVisible = this.evaluateFilter(filterTerms, 0).hasMatch;
        this.setVisibility(isVisible);
    }
    
    toJson(): TaskJson {
        return {
            type: "task",
            name: this.name,
            id: this.id,
            frequency: this.frequency,
            dueDate: (this.dueDate === null) ? null : { ...this.dueDate },
            dueDateIsManual: this.dueDateIsManual,
            upcomingPeriod: this.upcomingPeriod,
            gracePeriod: this.gracePeriod,
            activeMonths: (this.activeMonths === null) ? null : [...this.activeMonths],
            notes: this.notes,
        };
    }
    
    oldCompletionsToJson(): CompletionJson[] {
        const output: CompletionJson[] = [];
        for (const completion of this.completions) {
            if (!completion.isRecent()) {
                output.push(completion.toJson());
            }
        }
        return output;
    }
}

class Category extends PlannerItem {
    container: Container;
    containerTag: HTMLDivElement;
    renameTag: HTMLInputElement;
    renameButtonsTag: HTMLDivElement;
    
    constructor(name, containerData: ContainerJson | null = null) {
        super(name);
        jsonToContainer(this.containerTag, this, containerData);
        this.updateVisibility();
    }
    
    createTag(): HTMLDivElement {
        const output = document.createElement("div");
        output.className = "plannerItem";
        
        const rowTag = document.createElement("div");
        rowTag.className = "plannerItemRow";
        this.nameTag = document.createElement("div");
        this.nameTag.innerHTML = this.name;
        this.nameTag.style.marginRight = "15px";
        this.nameTag.style.fontWeight = "bold";
        rowTag.appendChild(this.nameTag);
        this.renameTag = document.createElement("input");
        this.renameTag.style.width = "150px";
        this.renameTag.style.marginRight = "15px";
        this.renameTag.style.display = "none";
        this.renameTag.onkeydown = (event) => {
            if (event.keyCode === 13) {
                this.finishRename();
            }
        };
        rowTag.appendChild(this.renameTag);
        const buttonsTag = this.createButtons([
            {
                text: "Add Task",
                onClick: () => {
                    startTaskCreation(this);
                },
            },
            {
                text: "Add Category",
                onClick: () => {
                    this.addNewCategory();
                },
            },
            {
                text: "Rename",
                onClick: () => {
                    this.startRename();
                },
            },
            {
                text: "Delete",
                onClick: () => {
                    this.deleteAndDumpChildren();
                },
            },
        ]);
        rowTag.appendChild(buttonsTag);
        const moveButtonsTag = this.createMoveButtons();
        rowTag.appendChild(moveButtonsTag);
        this.renameButtonsTag = createButtons([
            {
                text: "Save",
                onClick: () => {
                    this.finishRename();
                },
            },
            {
                text: "Cancel",
                onClick: () => {
                    this.hideRenameTags();
                },
            },
        ]).divTag;
        this.renameButtonsTag.style.display = "none";
        rowTag.appendChild(this.renameButtonsTag);
        output.appendChild(rowTag);
        
        this.containerTag = document.createElement("div");
        this.containerTag.style.marginLeft = "20px";
        output.appendChild(this.containerTag);
        
        return output;
    }
    
    addItem(plannerItem: PlannerItem, index: number | null = null): void {
        this.container.addItem(plannerItem, index);
    }
    
    addNewCategory(): void {
        const category = new Category(newCategoryName);
        this.addItem(category);
        if (!category.isVisible) {
            clearTaskFilter();
        }
        savePlannerItems();
    }
    
    startRename(): void {
        this.nameTag.style.display = "none";
        this.buttonsTag.style.display = "none";
        this.renameTag.style.display = "";
        this.renameButtonsTag.style.display = "";
        this.renameTag.value = this.name;
        this.renameTag.focus();
    }
    
    finishRename(): void {
        this.setName(this.renameTag.value);
        this.hideRenameTags();
        savePlannerItems();
    }
    
    hideRenameTags(): void {
        this.nameTag.style.display = "";
        this.buttonsTag.style.display = "";
        this.renameTag.style.display = "none";
        this.renameButtonsTag.style.display = "none";
    }
    
    deleteAndDumpChildren(): void {
        const { parentContainer } = this;
        const index = parentContainer.findItem(this);
        const children = this.container.plannerItems.slice();
        for (const child of children) {
            child.remove();
        }
        this.remove();
        for (let offset = 0; offset < children.length; offset++) {
            const child = children[offset];
            parentContainer.addItem(child, index + offset);
        }
        savePlannerItems();
    }
    
    updateVisibility(shouldRecur = false): void {
        if (shouldRecur) {
            for (const plannerItem of this.container.plannerItems) {
                plannerItem.updateVisibility(shouldRecur);
            }
        }
        if (taskFilter === "all") {
            this.setVisibility(true);
        } else {
            const isVisible = this.container.plannerItems.some(
                (plannerItem) => plannerItem.isVisible,
            );
            this.setVisibility(isVisible);
        }
    }
    
    toJson(): CategoryJson {
        return {
            type: "category",
            name: this.name,
            container: this.container.toJson(),
        };
    }
}

const getAllTasks = (): Task[] => rootContainer.getItems(
    (plannerItem) => (plannerItem instanceof Task)
) as Task[];

const jsonToCompletion = (data: CompletionJson): Completion => (
    new Completion(data.date, data.dateIsApproximate, data.notes)
);

const jsonToContainer = (
    tag: HTMLDivElement,
    parentCategory: Category | null= null,
    data: ContainerJson | null = null,
) => {
    const container = new Container(tag, parentCategory);
    if (data !== null) {
        for (const itemJson of data.plannerItems) {
            const plannerItem = jsonToPlannerItem(itemJson);
            container.addItem(plannerItem);
        }
    }
    return container;
}

const jsonToPlannerItem = (data: PlannerItemJson): PlannerItem => {
    if (data.type === "task") {
        return new Task(data as TaskJson);
    } else if (data.type === "category") {
        const categoryData = data as CategoryJson
        return new Category(categoryData.name, categoryData.container);
    } else {
        throw new Error(`Invalid planner item type "${data.type}".`);
    }
};

const showPage = (idToShow: PageId): void => {
    if (currentPageId === "viewPlannerItems") {
        plannerItemsScroll = window.scrollY;
    }
    for (const id of pageIds) {
        document.getElementById(id).style.display = (id === idToShow) ? "" : "none";
    }
    if (idToShow === "viewPlannerItems") {
        if (plannerItemsScroll !== null) {
            window.scroll({ top: plannerItemsScroll, behavior: "instant" });
        }
    } else {
        window.scroll({ top: 0, behavior: "instant" });
    }
    currentPageId = idToShow;
}

const showLoadingScreen = (message: string): void => {
    showPage("loadingScreen");
    document.getElementById("loadMessage").innerHTML = message;
};

const updateCategoryOptions = (categoryToSelect: Category): void => {
    allCategories = rootContainer.getItems(
        (plannerItem) => (plannerItem instanceof Category),
    ) as Category[];
    tag_editParentCategory.innerHTML = "";
    const rootOptionTag = document.createElement("option");
    rootOptionTag.value = "-1";
    rootOptionTag.innerHTML = rootCategoryName;
    tag_editParentCategory.appendChild(rootOptionTag);
    for (let index = 0; index < allCategories.length; index++) {
        const category = allCategories[index];
        const optionTag = document.createElement("option");
        optionTag.value = `${index}`;
        optionTag.innerHTML = category.name;
        tag_editParentCategory.appendChild(optionTag);
    }
    const parentIndex = allCategories.indexOf(categoryToSelect);
    // Note that if categoryToSelect is null, then tag_editParentCategory.value will be -1.
    tag_editParentCategory.value = `${parentIndex}`;
};

const setAllActiveMonths = (value: boolean): void => {
    for (const checkbox of activeMonthCheckboxes) {
        checkbox.checked = value;
    }
};

const startTaskCreation = (parentCategory: Category | null = null): void => {
    currentTask = null;
    showPage("editTask");
    tag_editTaskName.value = "";
    tag_editTaskName.focus();
    tag_editFrequency.value = "";
    tag_editDueDate.value = "";
    tag_dueDateIsManual.checked = false;
    tag_scheduleType.value = "noDueDate";
    handleScheduleTypeChange();
    tag_hasUpcomingPeriod.checked = false;
    tag_editUpcomingPeriod.value = "";
    handleUpcomingPeriodChange();
    tag_hasGracePeriod.checked = false;
    tag_editGracePeriod.value = "";
    handleGracePeriodChange();
    setAllActiveMonths(true);
    updateCategoryOptions(parentCategory);
    tag_editTaskNotes.value = "";
};

window.startTaskCreation = startTaskCreation;

window.startTaskEdit = (): void => {
    showPage("editTask");
    tag_editTaskName.value = currentTask.name;
    tag_editFrequency.value = `${currentTask.frequency ?? ""}`;
    tag_editDueDate.value = (currentTask.dueDate === null)
        ? ""
        : convertDateToString(currentTask.dueDate);
    tag_dueDateIsManual.checked = currentTask.dueDateIsManual ?? false;
    let scheduleType: string;
    if (currentTask.dueDate === null) {
        scheduleType = "noDueDate";
    } else if (currentTask.frequency === null) {
        scheduleType = "singleDueDate";
    } else {
        scheduleType = "repeatingDueDate";
    }
    tag_scheduleType.value = scheduleType;
    handleScheduleTypeChange();
    const { upcomingPeriod, gracePeriod } = currentTask;
    const hasUpcomingPeriod = (upcomingPeriod !== null);
    tag_hasUpcomingPeriod.checked = hasUpcomingPeriod;
    tag_editUpcomingPeriod.value = hasUpcomingPeriod ? `${upcomingPeriod}` : "";
    handleUpcomingPeriodChange();
    const hasGracePeriod = (gracePeriod !== null);
    tag_hasGracePeriod.checked = hasGracePeriod;
    tag_editGracePeriod.value = hasGracePeriod ? `${gracePeriod}` : "";
    handleGracePeriodChange();
    const { activeMonths } = currentTask;
    if (activeMonths === null) {
        setAllActiveMonths(true);
    } else {
        for (let index = 0; index < activeMonths.length; index++) {
            const monthIsActive = activeMonths[index];
            activeMonthCheckboxes[index].checked = monthIsActive;
        }
    }
    const parentCategory = currentTask.getParentCategory();
    updateCategoryOptions(parentCategory);
    tag_editTaskNotes.value = currentTask.notes;
};

const handleScheduleTypeChange = (): void => {
    const scheduleType = tag_scheduleType.value;
    const hasDueDate = (scheduleType !== "noDueDate");
    const isRepeating = (scheduleType === "repeatingDueDate");
    document.getElementById("editFrequencyRow").style.display = isRepeating ? "" : "none";
    document.getElementById("editDueDateRow").style.display = hasDueDate ? "" : "none";
    document.getElementById("editDueDateLabel").innerHTML = isRepeating ? "Next due date:" : "Due date:";
    document.getElementById("isManualContainer").style.display = isRepeating ? "" : "none";
    updateEditDueDate();
};

window.handleScheduleTypeChange = handleScheduleTypeChange;

const dateIsInActiveMonth = (date: PlannerDate, activeMonths: boolean[] | null): boolean => (
    (activeMonths === null) ? true : activeMonths[date.month - 1]
);

const advanceDateMonth = (date: PlannerDate): PlannerDate => {
    let { year } = date;
    let month = date.month + 1;
    if (month > monthAmount) {
        year += 1;
        month = 1;
    }
    return { year, month, day: 1 };
};

const calculateDueDate = (
    frequency: number,
    activeMonths: boolean[] | null,
    lastCompletionDate: PlannerDate | null,
): PlannerDate => {
    if (lastCompletionDate === null) {
        return getCurrentDate();
    }
    if (activeMonths === null) {
        return addDaysToDate(lastCompletionDate, frequency);
    }
    if (activeMonths.every((monthIsActive) => !monthIsActive)) {
        return getCurrentDate();
    }
    let date = lastCompletionDate;
    for (let count = 0; count < frequency; count += 1) {
        date = addDaysToDate(date, 1);
        while (!dateIsInActiveMonth(date, activeMonths)) {
            date = advanceDateMonth(date);
        }
    }
    return date;
};

const updateEditDueDate = (): void => {
    const scheduleType = tag_scheduleType.value;
    if (scheduleType === "noDueDate") {
        return;
    }
    const isManual = (scheduleType === "singleDueDate") || tag_dueDateIsManual.checked;
    tag_editDueDate.disabled = !isManual;
    if (isManual) {
        return;
    }
    const frequency = parseInt(tag_editFrequency.value, 10);
    if (Number.isNaN(frequency)) {
        return;
    }
    const activeMonths = getEditActiveMonths();
    const completionDate = currentTask?.getLastCompletionDate() ?? null;
    const dueDate = calculateDueDate(frequency, activeMonths, completionDate);
    tag_editDueDate.value = convertDateToString(dueDate);
};

window.updateEditDueDate = updateEditDueDate;

const handleUpcomingPeriodChange = (): void => {
    let labelText = "Upcoming period";
    let displayStyle: string;
    if (tag_hasUpcomingPeriod.checked) {
        labelText += ":";
        displayStyle = "";
    } else {
        displayStyle = "none";
    }
    document.getElementById("upcomingPeriodLabel").innerHTML = labelText;
    document.getElementById("editUpcomingContainer").style.display = displayStyle;
};

window.handleUpcomingPeriodChange = handleUpcomingPeriodChange;

const handleGracePeriodChange = (): void => {
    let labelText = "Grace period";
    let displayStyle: string;
    if (tag_hasGracePeriod.checked) {
        labelText += ":";
        displayStyle = "";
    } else {
        displayStyle = "none";
    }
    document.getElementById("gracePeriodLabel").innerHTML = labelText;
    document.getElementById("editGraceContainer").style.display = displayStyle;
};

window.handleGracePeriodChange = handleGracePeriodChange;

const getEditParentContainer = (): Container => {
    const parentIndex = parseInt(tag_editParentCategory.value, 10);
    return (parentIndex < 0) ? rootContainer : allCategories[parentIndex].container;
};

const getEditActiveMonths = (): boolean[] | null => {
    const activeMonths: boolean[] = [];
    let hasInactiveMonth = false;
    for (const checkbox of activeMonthCheckboxes) {
        activeMonths.push(checkbox.checked);
        if (!checkbox.checked) {
            hasInactiveMonth = true;
        }
    }
    return hasInactiveMonth ? activeMonths : null;
};

window.saveTask = (): void => {
    const name = tag_editTaskName.value;
    if (name.length <= 0) {
        alert("Please enter a task name.");
        tag_editTaskName.focus();
        return;
    }
    updateEditDueDate();
    const scheduleType = tag_scheduleType.value;
    let frequency: number | null = null;
    let dueDate: PlannerDate | null;
    let dueDateIsManual: boolean | null;
    if (scheduleType === "noDueDate") {
        dueDate = null;
        dueDateIsManual = null;
    } else {
        if (scheduleType === "repeatingDueDate") {
            frequency = parseInt(tag_editFrequency.value, 10);
            if (Number.isNaN(frequency)) {
                alert("Please enter a due date frequency.");
                tag_editFrequency.focus();
                return;
            }
            dueDateIsManual = tag_dueDateIsManual.checked;
        } else {
            dueDateIsManual = true;
        }
        const dateString = tag_editDueDate.value;
        if (dateString.length <= 0) {
            alert("Please enter a due date.");
            return;
        }
        dueDate = convertStringToDate(dateString);
    }
    let upcomingPeriod: number | null;
    if (tag_hasUpcomingPeriod.checked) {
        upcomingPeriod = parseInt(tag_editUpcomingPeriod.value, 10);
        if (Number.isNaN(upcomingPeriod)) {
            alert("Please enter an upcoming period duration.");
            tag_editUpcomingPeriod.focus();
            return;
        }
    } else {
        upcomingPeriod = null;
    }
    let gracePeriod: number | null;
    if (tag_hasGracePeriod.checked) {
        gracePeriod = parseInt(tag_editGracePeriod.value, 10);
        if (Number.isNaN(gracePeriod)) {
            alert("Please enter a grace period duration.");
            tag_editGracePeriod.focus();
            return;
        }
    } else {
        gracePeriod = null;
    }
    const activeMonths = getEditActiveMonths();
    const notes = tag_editTaskNotes.value;
    const parentContainer = getEditParentContainer();
    if (currentTask === null) {
        const id = nextTaskId;
        nextTaskId += 1;
        const task = new Task({
            type: "task",
            name,
            id,
            frequency,
            dueDate,
            dueDateIsManual,
            upcomingPeriod,
            gracePeriod,
            activeMonths,
            notes,
        });
        parentContainer.addItem(task);
        if (!task.isVisible) {
            clearTaskFilter();
        }
        task.loadedOldCompletions = true;
        setChunks({ [task.getOldCompletionsKey()]: [] });
        viewPlannerItems();
    } else {
        currentTask.setName(name);
        currentTask.frequency = frequency;
        currentTask.dueDate = dueDate;
        currentTask.dueDateIsManual = dueDateIsManual;
        currentTask.upcomingPeriod = upcomingPeriod;
        currentTask.gracePeriod = gracePeriod;
        currentTask.activeMonths = activeMonths;
        currentTask.notes = notes;
        if (currentTask.parentContainer !== parentContainer) {
            currentTask.remove();
            parentContainer.addItem(currentTask);
        }
        currentTask.handleDueDateChange();
        viewTask();
    }
    savePlannerItems();
};

const viewPlannerItems = (): void => {
    currentTask = null;
    showPage("viewPlannerItems");
};

window.viewPlannerItems = viewPlannerItems;

const displayNotes = (destTag: HTMLParagraphElement, notes: string) => {
    const lines = ["Notes:", ...notes.split("\n")];
    destTag.innerHTML = "";
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        if (index > 0) {
            destTag.appendChild(document.createElement("br"));
        }
        destTag.appendChild(document.createTextNode(line));
    }
};

const clearNewCompletionForm = (): void => {
    const currentDate = getCurrentDate();
    tag_newCompletionDate.value = convertDateToString(currentDate);
    tag_dateIsApproximate.checked = false;
    tag_newCompletionNotes.value = "";
};

const viewTask = async (task: Task | null = null): Promise<void> => {
    if (task !== null) {
        currentTask = task;
    }
    if (!currentTask.loadedOldCompletions) {
        showLoadingScreen("Loading task...");
        await loadOldCompletions([currentTask]);
    }
    showPage("viewTask");
    document.getElementById("viewTaskName").innerHTML = currentTask.name;
    currentTask.displayDueDate();
    const { upcomingPeriod, gracePeriod, activeMonths } = currentTask;
    let upcomingText: string;
    let upcomingStyle: string;
    if (upcomingPeriod === null) {
        upcomingText = "";
        upcomingStyle = "none";
    } else {
        upcomingText = "Upcoming period: " + pluralize(upcomingPeriod, "day");
        upcomingStyle = "";
    }
    const upcomingTag = document.getElementById("viewUpcomingPeriod");
    upcomingTag.innerHTML = upcomingText;
    upcomingTag.style.display = upcomingStyle;
    let graceText: string;
    let graceStyle: string;
    if (gracePeriod === null) {
        graceText = "";
        graceStyle = "none";
    } else {
        graceText = "Grace period: " + pluralize(gracePeriod, "day");
        graceStyle = "";
    }
    const graceTag = document.getElementById("viewGracePeriod");
    graceTag.innerHTML = graceText;
    graceTag.style.display = graceStyle;
    let monthsText: string;
    let monthsStyle: string;
    if (activeMonths === null) {
        monthsText = "";
        monthsStyle = "none"
    } else {
        const activeAbbreviations: string[] = [];
        for (let index = 0; index < activeMonths.length; index++) {
            const monthIsActive = activeMonths[index];
            if (monthIsActive) {
                const abbreviation = monthAbbreviations[index];
                activeAbbreviations.push(abbreviation);
            }
        }
        monthsText = "Active months: " + activeAbbreviations.join(", ");
        monthsStyle = "";
    }
    const monthsTag = document.getElementById("viewActiveMonths");
    monthsTag.innerHTML = monthsText;
    monthsTag.style.display = monthsStyle;
    const parentCategory = currentTask.getParentCategory();
    const parentName = (parentCategory === null) ? rootCategoryName : parentCategory.name;
    document.getElementById("viewParentCategory").innerHTML = parentName;
    const notesTag = document.getElementById("viewTaskNotes") as HTMLParagraphElement;
    let notesStyle: string;
    if (currentTask.notes.length > 0) {
        displayNotes(notesTag, currentTask.notes);
        notesStyle = "";
    } else {
        notesTag.innerHTML = "";
        notesStyle = "none";
    }
    notesTag.style.display = notesStyle;
    clearNewCompletionForm();
    currentTask.displayCompletions();
};

window.cancelTaskEdit = (): void => {
    if (currentTask === null) {
        viewPlannerItems();
    } else {
        viewTask();
    }
};

window.deleteTask = (): void => {
    const shouldDelete = confirm("Are you sure you want to delete this task?");
    if (shouldDelete) {
        currentTask.delete();
        viewPlannerItems();
        savePlannerItems();
    }
};

window.saveNewCompletion = (): void => {
    const dateString = tag_newCompletionDate.value;
    if (dateString.length <= 0) {
        alert("Please enter a date for the new completion.");
        return;
    }
    const date = convertStringToDate(dateString);
    const dateIsApproximate = tag_dateIsApproximate.checked;
    const notes = tag_newCompletionNotes.value;
    const completion = new Completion(date, dateIsApproximate, notes);
    currentTask.addCompletion(completion);
    clearNewCompletionForm();
};

window.addRootCategory = (): void => {
    const category = new Category(newCategoryName);
    rootContainer.addItem(category);
    if (!category.isVisible) {
        clearTaskFilter();
    }
    savePlannerItems();
};

const updatePlannerItemVisibilities = (): void => {
    for (const plannerItem of rootContainer.plannerItems) {
        plannerItem.updateVisibility(true);
    }
};

const updatePlannerItemsPlaceholder = (): void => {
    if (typeof rootContainer === "undefined") {
        return;
    }
    const placeholderTag = document.getElementById("plannerItemsPlaceholder");
    const { plannerItems } = rootContainer;
    let message: string | null;
    if (plannerItems.length <= 0) {
        message = "You don't have any tasks yet. Click the \"Add Task\" button to get started.";
    } else if (plannerItems.some((plannerItem) => plannerItem.isVisible)) {
        message = null;
    } else {
        message = "No items match the selected filter.";
    }
    placeholderTag.style.display = (message === null) ? "none" : "block";
    placeholderTag.innerHTML = message;
};

const clearTaskFilter = (): void => {
    tag_taskFilter.value = "all";
    handleTaskFilterChange();
};

const handleTaskFilterChange = (): void => {
    taskFilter = tag_taskFilter.value;
    writeTaskFilter();
    updatePlannerItemVisibilities();
};

window.handleTaskFilterChange = handleTaskFilterChange;

window.downloadJsonFile = async (): Promise<void> => {
    const buttonTag = document.getElementById("downloadButton");
    const messageTag = document.getElementById("downloadMessage");
    buttonTag.style.display = "none";
    messageTag.style.display = "";
    await loadOldCompletions(getAllTasks());
    // Retrieve all tasks again in case they changed during `loadOldCompletions`.
    const tasks = getAllTasks();
    const completionsData: CompletionJson[] = [];
    for (const task of tasks) {
        for (const completion of task.completions) {
            completionsData.push(completion.toJson());
        }
    }
    const jsonData = {
        rootContainer: rootContainer.toJson(),
        completions: completionsData,
    }
    const jsonText = JSON.stringify(jsonData);
    const file = new File([jsonText], "upkeepPlannerData.json", { type: "application/json" });
    const url = URL.createObjectURL(file);
    const linkTag = document.createElement("a");
    linkTag.style.display = "none";
    linkTag.href = url;
    linkTag.download = file.name;
    document.body.appendChild(linkTag);
    linkTag.click();
    document.body.removeChild(linkTag);
    window.URL.revokeObjectURL(url);
    buttonTag.style.display = "";
    messageTag.style.display = "none";
};

const timerEvent = (): void => {
    const currentDate = getCurrentDate();
    if (lastTimerEventDate === null || !datesAreEqual(lastTimerEventDate, currentDate)) {
        const tasks = getAllTasks();
        for (const task of tasks) {
            task.updateStatus();
        }
        updatePlannerItemVisibilities();
        lastTimerEventDate = currentDate;
    }
    if (saveTimestamp !== null && Date.now() / 1000 > saveTimestamp + 1.2) {
        saveTimestamp = null;
        updateSaveMessage();
    }
};

const initializeTagVars = () => {
    tag_taskFilter = document.getElementById("taskFilter") as any;
    tag_editTaskName = document.getElementById("editTaskName") as any;
    tag_scheduleType = document.getElementById("scheduleType") as any;
    tag_editFrequency = document.getElementById("editFrequency") as any;
    tag_editDueDate = document.getElementById("editDueDate") as any;
    tag_dueDateIsManual = document.getElementById("dueDateIsManual") as any;
    tag_hasUpcomingPeriod = document.getElementById("hasUpcomingPeriod") as any;
    tag_editUpcomingPeriod = document.getElementById("editUpcomingPeriod") as any;
    tag_hasGracePeriod = document.getElementById("hasGracePeriod") as any;
    tag_editGracePeriod = document.getElementById("editGracePeriod") as any;
    tag_editParentCategory = document.getElementById("editParentCategory") as any;
    tag_editTaskNotes = document.getElementById("editTaskNotes") as any;
    tag_newCompletionDate = document.getElementById("newCompletionDate") as any;
    tag_dateIsApproximate = document.getElementById("dateIsApproximate") as any;
    tag_newCompletionNotes = document.getElementById("newCompletionNotes") as any;
};

export const initializePage = async (): Promise<void> => {
    initializeTagVars();
    const keyData = localStorage.getItem("keyData");
    if (keyData === null) {
        alert("You are not currently logged in. Please log in to view your tasks.");
        window.location = "/login" as (string & Location);
    }
    showLoadingScreen("Loading tasks...");
    ({ keyHash, keyVersion } = JSON.parse(keyData) as LocalStorageData);
    encryptionKey = await getEncryptionKey(keyHash);
    const monthsTag = document.getElementById("editActiveMonths");
    activeMonthCheckboxes = [];
    for (const abbreviation of monthAbbreviations) {
        const divTag = document.createElement("div");
        divTag.className = "activeMonth";
        divTag.appendChild(document.createTextNode(abbreviation));
        divTag.appendChild(document.createElement("br"));
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.onchange = updateEditDueDate;
        divTag.appendChild(checkbox);
        activeMonthCheckboxes.push(checkbox);
        monthsTag.appendChild(divTag);
    }
    const buttonsTag = createButtons([
        {
            text: "Select All",
            onClick: () => {
                setAllActiveMonths(true);
                updateEditDueDate();
            },
        },
        {
            text: "Deselect All",
            onClick: () => {
                setAllActiveMonths(false);
                updateEditDueDate();
            },
        },
    ]).divTag;
    buttonsTag.style.marginLeft = "15px";
    monthsTag.appendChild(buttonsTag);
    createStatusLegend(document.getElementById("statusLegend"));
    applyCircleColors();
    taskFilter = await readTaskFilter();
    tag_taskFilter.value = taskFilter;
    const chunks = await getChunks(["plannerItems", "recentCompletions"]);
    const rootContainerTag = document.getElementById("rootContainer") as HTMLDivElement;
    rootContainer = jsonToContainer(rootContainerTag, null, chunks.plannerItems);
    updatePlannerItemsPlaceholder();
    const tasks = getAllTasks();
    const taskMap = new Map();
    nextTaskId = 0;
    for (const task of tasks) {
        taskMap.set(task.id, task);
        if (task.id >= nextTaskId) {
            nextTaskId = task.id + 1;
        }
    }
    if (chunks.recentCompletions !== null) {
        const completionsMap = new Map();
        for (const completionData of (chunks.recentCompletions as CompletionJson[])) {
            const { taskId } = completionData;
            const completion = jsonToCompletion(completionData);
            let completions = completionsMap.get(taskId);
            if (typeof completions === "undefined") {
                completions = [];
                completionsMap.set(taskId, completions);
            }
            completions.push(completion);
            recentCompletions.add(completion);
        }
        for (const [taskId, completions] of completionsMap) {
            const task = taskMap.get(taskId);
            if (typeof task !== "undefined") {
                task.addCompletionsFromServer(completions);
            }
        }
    }
    viewPlannerItems();
    setInterval(timerEvent, 200);
};


