
const newCategoryName = "New Category";
const rootCategoryName = "Top Level";
const pageIds = ["viewPlannerItems", "editTask", "viewTask"];

let keyHash;
let rootContainer;
let allCategories;
let currentTask;

const convertNativeDateToDate = (nativeDate) => ({
    year: nativeDate.getFullYear(),
    month: nativeDate.getMonth() + 1,
    day: nativeDate.getDate(),
});

const convertDateToNativeDate = (date) => new Date(date.year, date.month - 1, date.day, 11);

const convertDateToTimestamp = (date) => {
    const nativeDate = convertDateToNativeDate(date);
    return nativeDate.getTime() / 1000;
};

const convertTimestampToDate = (timestamp) => {
    const nativeDate = new Date(timestamp * 1000);
    return convertNativeDateToDate(nativeDate);
};

const getCurrentDate = () => convertNativeDateToDate(new Date());

const convertDateToString = (date) => {
    const terms = [
        `${date.year}`.padStart(4, "0"),
        `${date.month}`.padStart(2, "0"),
        `${date.day}`.padStart(2, "0"),
    ];
    return terms.join("-");
};

const convertStringToDate = (dateString) => {
    const values = dateString.split("-").map((term) => parseInt(term, 10));
    return { year: values[0], month: values[1], day: values[2] };
};

// Returns the number of days from date2 to date1.
const subtractDates = (date1, date2) => {
    const nativeDate1 = convertDateToNativeDate(date1);
    const nativeDate2 = convertDateToNativeDate(date2);
    // `timestampDelta` is measured in seconds.
    const timestampDelta = (nativeDate1 - nativeDate2) / 1000;
    return timestampDelta / (60 * 60 * 24);
};

const createButtons = (buttonDefs) => {
    const output = document.createElement("div");
    output.style.flexShrink = 0;
    for (const buttonDef of buttonDefs) {
        const button = document.createElement("button");
        button.innerHTML = buttonDef.text;
        button.onclick = buttonDef.onClick;
        output.appendChild(button);
    }
    return output;
};

class Completion {
    
    constructor(date, dateIsApproximate, notes) {
        this.date = date;
        this.dateIsApproximate = dateIsApproximate;
        this.notes = notes;
        this.timestamp = convertDateToTimestamp(this.date);
        this.tag = null;
    }
    
    getDateString() {
        let output = convertDateToString(this.date);
        if (this.dateIsApproximate) {
            output = "~" + output;
        }
        return output;
    }
    
    getTag() {
        if (this.tag === null) {
            this.tag = document.createElement("div");
            this.tag.innerHTML = this.getDateString();
        }
        return this.tag;
    }
}

class Container {
    
    constructor(tag) {
        this.tag = tag;
        this.plannerItems = [];
        this.parentPlannerItem = null;
    }
    
    addItem(plannerItem, index = null) {
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
    }
    
    findItem(plannerItem) {
        return this.plannerItems.indexOf(plannerItem);
    }
    
    removeItem(plannerItem) {
        this.tag.removeChild(plannerItem.tag);
        const index = this.findItem(plannerItem);
        this.plannerItems.splice(index, 1);
        plannerItem.parentContainer = null;
    }
    
    getAllCategories() {
        const output = [];
        for (const plannerItem of this.plannerItems) {
            if (plannerItem instanceof Category) {
                output.push(plannerItem);
                const categories = plannerItem.container.getAllCategories();
                for (const category of categories) {
                    output.push(category);
                }
            }
        }
        return output;
    }
}

class PlannerItem {
    // Concrete subclasses of PlannerItem must implement these methods:
    // createTag
    
    constructor(name) {
        this.name = name;
        this.tag = this.createTag();
        this.parentContainer = null;
    }
    
    createButtons(buttonDefs) {
        this.buttonsTag = createButtons([
            ...buttonDefs,
            {
                text: "Move",
                onClick: () => {
                    this.startMove();
                },
            },
        ]);
        return this.buttonsTag;
    }
    
    createMoveButtons() {
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
        ]);
        this.moveButtonsTag.style.display = "none";
        return this.moveButtonsTag;
    }
    
    getParentPlannerItem() {
        return this.parentContainer.parentPlannerItem;
    }
    
    setName(name) {
        this.name = name;
        this.nameTag.innerHTML = name;
    }
    
    remove() {
        this.parentContainer.removeItem(this);
    }
    
    startMove() {
        this.buttonsTag.style.display = "none";
        this.moveButtonsTag.style.display = "";
    }
    
    endMove() {
        this.buttonsTag.style.display = "";
        this.moveButtonsTag.style.display = "none";
    }
    
    getIndex() {
        return this.parentContainer.findItem(this);
    }
    
    moveUp() {
        const nextIndex = this.getIndex() - 1;
        if (nextIndex < 0) {
            return;
        }
        const container = this.parentContainer;
        this.remove();
        container.addItem(this, nextIndex);
    }
    
    moveDown() {
        const nextIndex = this.getIndex() + 1;
        const container = this.parentContainer;
        if (nextIndex >= container.plannerItems.length) {
            return;
        }
        this.remove();
        container.addItem(this, nextIndex);
    }
    
    enterCategory() {
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
    }
    
    exitCategory() {
        const parentPlannerItem = this.getParentPlannerItem();
        if (parentPlannerItem === null) {
            return;
        }
        const container = parentPlannerItem.parentContainer;
        const index = container.findItem(parentPlannerItem);
        this.remove();
        container.addItem(this, index);
    }
}

class Task extends PlannerItem {
    
    constructor(name, notes) {
        super(name);
        this.notes = notes;
        this.completions = [];
        this.updateCompletionDateTag();
    }
    
    createTag() {
        const output = document.createElement("div");
        output.className = "plannerItem";
        
        const rowTag = document.createElement("div");
        rowTag.className = "plannerItemRow";
        
        const textTag = document.createElement("div");
        textTag.style.marginRight = "15px";
        this.nameTag = document.createElement("span");
        this.nameTag.innerHTML = this.name;
        textTag.appendChild(this.nameTag);
        textTag.appendChild(document.createElement("br"));
        this.completionDateTag = document.createElement("span");
        textTag.appendChild(this.completionDateTag);
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
    
    updateCompletionDateTag() {
        const completion = this.getLastCompletion();
        this.completionDateTag.innerHTML = (completion === null)
            ? "Never completed"
            : `Last completed on ${completion.getDateString()}`;
    }
    
    displayCompletions() {
        const completionsTag = document.getElementById("pastCompletions");
        if (this.completions.length <= 0) {
            completionsTag.innerHTML = "(None)";
            return;
        }
        completionsTag.innerHTML = "";
        for (let index = this.completions.length - 1; index >= 0; index--) {
            const completion = this.completions[index];
            const completionTag = completion.getTag();
            completionsTag.appendChild(completionTag);
        }
    }
    
    sortCompletions() {
        this.completions.sort(
            (completion1, completion2) => completion1.timestamp - completion2.timestamp,
        );
    }
    
    addCompletion(completion) {
        this.completions.push(completion);
        this.sortCompletions();
        this.updateCompletionDateTag();
        if (this === currentTask) {
            this.displayCompletions();
        }
    }
    
    getLastCompletion() {
        return (this.completions.length > 0) ? this.completions.at(-1) : null;
    }
    
    markAsComplete() {
        const lastCompletion = this.getLastCompletion();
        const currentDate = getCurrentDate();
        if (lastCompletion === null
                || subtractDates(currentDate, lastCompletion.date) !== 0) {
            const completion = new Completion(currentDate, false, "");
            this.addCompletion(completion);
        } else {
            alert("This task has already been completed today.");
        }
    }
}

class Category extends PlannerItem {
    
    createTag() {
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
        this.renameTag.onkeydown = () => {
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
                    this.removeAndDumpChildren();
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
        ]);
        this.renameButtonsTag.style.display = "none";
        rowTag.appendChild(this.renameButtonsTag);
        output.appendChild(rowTag);
        
        const containerTag = document.createElement("div");
        containerTag.style.marginLeft = "20px";
        this.container = new Container(containerTag);
        this.container.parentPlannerItem = this;
        output.appendChild(containerTag);
        
        return output;
    }
    
    addItem(plannerItem, index = null) {
        this.container.addItem(plannerItem, index);
    }
    
    addNewCategory() {
        const category = new Category(newCategoryName);
        this.addItem(category);
    }
    
    startRename() {
        this.nameTag.style.display = "none";
        this.buttonsTag.style.display = "none";
        this.renameTag.style.display = "";
        this.renameButtonsTag.style.display = "";
        this.renameTag.value = this.name;
        this.renameTag.focus();
    }
    
    finishRename() {
        this.setName(this.renameTag.value);
        this.hideRenameTags();
    }
    
    hideRenameTags() {
        this.nameTag.style.display = "";
        this.buttonsTag.style.display = "";
        this.renameTag.style.display = "none";
        this.renameButtonsTag.style.display = "none";
    }
    
    removeAndDumpChildren() {
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
    }
}

const showPage = (idToShow) => {
    for (const id of pageIds) {
        document.getElementById(id).style.display = (id === idToShow) ? "" : "none";
    }
}

const updateCategoryOptions = (categoryToSelect) => {
    allCategories = rootContainer.getAllCategories();
    const selectTag = document.getElementById("editParentCategory");
    selectTag.innerHTML = "";
    const rootOptionTag = document.createElement("option");
    rootOptionTag.value = "-1";
    rootOptionTag.innerHTML = rootCategoryName;
    selectTag.appendChild(rootOptionTag);
    for (let index = 0; index < allCategories.length; index++) {
        const category = allCategories[index];
        const optionTag = document.createElement("option");
        optionTag.value = `${index}`;
        optionTag.innerHTML = category.name;
        selectTag.appendChild(optionTag);
    }
    const parentIndex = allCategories.indexOf(categoryToSelect);
    selectTag.value = `${parentIndex}`;
};

const startTaskCreation = (parentCategory = null) => {
    currentTask = null;
    showPage("editTask");
    const nameTag = document.getElementById("editTaskName");
    nameTag.value = "";
    nameTag.focus();
    document.getElementById("editTaskNotes").value = "";
    updateCategoryOptions(parentCategory);
};

const startTaskEdit = () => {
    showPage("editTask");
    document.getElementById("editTaskName").value = currentTask.name;
    document.getElementById("editTaskNotes").value = currentTask.notes;
    const parentPlannerItem = currentTask.getParentPlannerItem();
    updateCategoryOptions(parentPlannerItem);
};

const getEditParentContainer = () => {
    const selectTag = document.getElementById("editParentCategory");
    const parentIndex = parseInt(selectTag.value, 10);
    return (parentIndex < 0) ? rootContainer : allCategories[parentIndex].container;
};

const saveTask = () => {
    const nameTag = document.getElementById("editTaskName");
    const name = nameTag.value;
    if (name.length <= 0) {
        alert("Please enter a task name.");
        nameTag.focus();
        return;
    }
    const notes = document.getElementById("editTaskNotes").value;
    const parentContainer = getEditParentContainer();
    if (currentTask === null) {
        const task = new Task(name, notes);
        parentContainer.addItem(task);
        viewPlannerItems();
    } else {
        currentTask.setName(name);
        currentTask.notes = notes;
        if (currentTask.parentContainer !== parentContainer) {
            currentTask.remove();
            parentContainer.addItem(currentTask);
        }
        viewTask();
    }
};

const viewPlannerItems = () => {
    currentTask = null;
    showPage("viewPlannerItems");
};

const displayNotes = (destTag, notes) => {
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

const clearNewCompletionForm = () => {
    const currentDate = getCurrentDate();
    document.getElementById("newCompletionDate").value = convertDateToString(currentDate);
    document.getElementById("dateIsApproximate").checked = false;
    document.getElementById("newCompletionNotes").value = "";
};

const viewTask = (task = null) => {
    if (task !== null) {
        currentTask = task;
    }
    showPage("viewTask");
    document.getElementById("viewTaskName").innerHTML = currentTask.name;
    const notesTag = document.getElementById("viewTaskNotes");
    let displayStyle;
    if (currentTask.notes.length > 0) {
        displayNotes(notesTag, currentTask.notes);
        displayStyle = "";
    } else {
        notesTag.innerHTML = "";
        displayStyle = "none";
    }
    notesTag.style.display = displayStyle;
    const parentPlannerItem = currentTask.getParentPlannerItem();
    let parentName;
    if (parentPlannerItem === null) {
        parentName = rootCategoryName;
    } else {
        parentName = parentPlannerItem.name;
    }
    document.getElementById("viewParentCategory").innerHTML = parentName;
    clearNewCompletionForm();
    currentTask.displayCompletions();
};

const cancelTaskEdit = () => {
    if (currentTask === null) {
        viewPlannerItems();
    } else {
        viewTask();
    }
};

const deleteTask = () => {
    const shouldDelete = confirm("Are you sure you want to delete this task?");
    if (shouldDelete) {
        currentTask.remove();
        viewPlannerItems();
    }
};

const saveNewCompletion = () => {
    const dateString = document.getElementById("newCompletionDate").value;
    if (dateString.length <= 0) {
        alert("Please enter a date for the new completion.");
        return;
    }
    const date = convertStringToDate(dateString);
    const dateIsApproximate = document.getElementById("dateIsApproximate").checked;
    const notes = document.getElementById("newCompletionNotes").value;
    const completion = new Completion(date, dateIsApproximate, notes);
    currentTask.addCompletion(completion);
    clearNewCompletionForm();
};

const addRootCategory = () => {
    const category = new Category(newCategoryName);
    rootContainer.addItem(category);
};

const initializePage = () => {
    keyHash = localStorage.getItem("keyHash");
    if (keyHash === null) {
        alert("You are not currently logged in. Please log in to view your tasks.");
        window.location = "/login";
    }
    rootContainer = new Container(document.getElementById("rootContainer"));
};


