
const newCategoryName = "New Category";
const rootCategoryName = "Top Level";
const pageIds = ["viewPlannerItems", "editTask", "viewTask"];
const secondsPerDay = 60 * 60 * 24;
const monthAmount = 12;
const monthAbbreviations = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const statusColors = {
    neverCompleted: "#4444FF",
    completed: "#44FF44",
    upcoming: "#DDDD00",
    grace: "#FF8800",
    overdue: "#FF0000",
    inactive: "#CCCCCC",
};

let keyHash;
let rootContainer;
let allCategories;
let currentTask;
let activeMonthCheckboxes;
let lastTimerEventDate = null;

const pluralize = (amount, noun) => (
    (amount === 1) ? `${amount} ${noun}` : `${amount} ${noun}s`
);

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
    return timestampDelta / secondsPerDay;
};

const addDaysToDate = (date, dayAmount) => {
    const timestamp = convertDateToTimestamp(date);
    return convertTimestampToDate(timestamp + secondsPerDay * dayAmount);
};

const createButtons = (buttonDefs) => {
    const divTag = document.createElement("div");
    divTag.style.flexShrink = 0;
    const buttonTags = [];
    for (const buttonDef of buttonDefs) {
        const button = document.createElement("button");
        button.innerHTML = buttonDef.text;
        button.onclick = buttonDef.onClick;
        divTag.appendChild(button);
        buttonTags.push(button);
    }
    return { divTag, buttonTags };
};

class Completion {
    
    constructor(date, dateIsApproximate, notes) {
        this.date = date;
        this.dateIsApproximate = dateIsApproximate;
        this.notes = notes;
        this.timestamp = convertDateToTimestamp(this.date);
        this.tag = null;
        this.notesAreVisible = false;
        this.parentTask = null;
    }
    
    getDateString() {
        let output = convertDateToString(this.date);
        if (this.dateIsApproximate) {
            output = "~" + output;
        }
        return output;
    }
    
    getTag() {
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
                        this.remove();
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
    
    updateNotesButton() {
        this.notesButton.style.display = (this.notes.length > 0) ? "" : "none";
        this.notesButton.innerHTML = this.notesAreVisible ? "Hide Notes" : "Show Notes";
    }
    
    setNotesVisibility(notesAreVisible) {
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
    
    showEditTag() {
        this.rowTag.style.display = "none";
        this.setNotesVisibility(false);
        this.editTag.style.display = "";
        this.editDateTag.value = convertDateToString(this.date);
        this.editIsApproxTag.checked = this.dateIsApproximate;
        this.editNotesTag.value = this.notes;
    }
    
    hideEditTag() {
        this.rowTag.style.display = "flex";
        this.editTag.style.display = "none";
    }
    
    finishEdit() {
        const dateString = this.editDateTag.value;
        if (dateString.length <= 0) {
            alert("Please enter a date for the completion.");
            return;
        }
        this.date = convertStringToDate(dateString)
        this.timestamp = convertDateToTimestamp(this.date);
        this.dateIsApproximate = this.editIsApproxTag.checked;
        this.notes = this.editNotesTag.value;
        this.hideEditTag();
        this.textTag.innerHTML = this.getDateString();
        this.updateNotesButton();
        this.parentTask.handleCompletionsChange();
    }
    
    remove() {
        this.parentTask.removeCompletion(this);
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
    
    updateStatusCircles() {
        for (const plannerItem of this.plannerItems) {
            plannerItem.updateStatusCircles();
        }
    }
}

class PlannerItem {
    // Concrete subclasses of PlannerItem must implement these methods:
    // createTag, updateStatusCircles
    
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
        ]).divTag;
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
        ]).divTag;
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
    
    constructor(
        name,
        frequency,
        dueDate,
        dueDateIsManual,
        upcomingPeriod,
        gracePeriod,
        activeMonths,
        notes,
    ) {
        super(name);
        this.frequency = frequency;
        this.dueDate = dueDate;
        this.dueDateIsManual = dueDateIsManual;
        this.upcomingPeriod = upcomingPeriod;
        this.gracePeriod = gracePeriod;
        this.activeMonths = activeMonths;
        this.notes = notes;
        this.completions = [];
        this.updateCompletionDateTag();
        this.updateDueDateTag();
        this.updateStatusCircle();
    }
    
    createTag() {
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
    
    updateCompletionDateTag() {
        const completion = this.getLastCompletion();
        let text;
        let displayStyle;
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
    
    updateDueDateTag() {
        let text;
        let displayStyle;
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
    
    getStatusCircleColor() {
        const currentDate = getCurrentDate();
        const dueDateOffset = (this.dueDate === null)
            ? null
            : subtractDates(currentDate, this.dueDate);
        if (dueDateOffset !== null) {
            if (dueDateOffset >= 0) {
                if (this.gracePeriod !== null && dueDateOffset < this.gracePeriod) {
                    return statusColors.grace;
                }
                return statusColors.overdue;
            }
            if (this.upcomingPeriod !== null && dueDateOffset >= -this.upcomingPeriod) {
                return statusColors.upcoming;
            }
        }
        if (!dateIsInActiveMonth(currentDate, this.activeMonths)) {
            return statusColors.inactive;
        }
        const completionDate = this.getLastCompletionDate();
        if (completionDate === null) {
            return statusColors.neverCompleted;
        }
        return statusColors.completed;
    }
    
    updateStatusCircle() {
        this.statusCircle.style.background = this.getStatusCircleColor();
    }
    
    updateStatusCircles() {
        this.updateStatusCircle();
    }
    
    displayCompletions() {
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
    
    displayDueDate() {
        let dueDateText;
        let displayStyle;
        if (currentTask.dueDate === null) {
            dueDateText = "";
            displayStyle = "none";
        } else {
            const dateString = convertDateToString(currentTask.dueDate);
            if (currentTask.frequency === null) {
                dueDateText = `Due on ${dateString}`;
            } else {
                const frequencyText = pluralize(currentTask.frequency, "day");
                dueDateText = `Next due on ${dateString}; repeats every ${frequencyText}`;
            }
            displayStyle = "";
        }
        const dueDateTag = document.getElementById("viewDueDate");
        dueDateTag.innerHTML = dueDateText;
        dueDateTag.style.display = displayStyle;
    }
    
    checkDueDate() {
        if (this.frequency === null || this.dueDate === null || this.dueDateIsManual) {
            return;
        }
        const completionDate = this.getLastCompletionDate();
        this.dueDate = calculateDueDate(this.frequency, this.activeMonths, completionDate);
        this.handleDueDateChange();
    }
    
    handleCompletionsChange() {
        this.completions.sort(
            (completion1, completion2) => completion1.timestamp - completion2.timestamp,
        );
        this.updateCompletionDateTag();
        if (this === currentTask) {
            this.displayCompletions();
        }
        this.updateStatusCircle();
        this.checkDueDate();
    }
    
    handleDueDateChange() {
        this.updateDueDateTag();
        if (this === currentTask) {
            this.displayDueDate();
        }
        this.updateStatusCircle();
    }
    
    addCompletion(completion) {
        if (this.dueDate !== null && this.dueDateIsManual) {
            const lastDate = this.getLastCompletionDate();
            if (lastDate === null || subtractDates(completion.date, lastDate) > 0) {
                if (this.frequency === null) {
                    this.dueDate = null;
                    this.dueDateIsManual = null;
                } else {
                    this.dueDate = addDaysToDate(completion.date, this.frequency);
                    this.dueDateIsManual = false;
                }
                this.handleDueDateChange();
            }
        }
        this.completions.push(completion);
        completion.parentTask = this;
        this.handleCompletionsChange();
    }
    
    getLastCompletion() {
        return (this.completions.length > 0) ? this.completions.at(-1) : null;
    }
    
    getLastCompletionDate() {
        return this.getLastCompletion()?.date ?? null;
    }
    
    markAsComplete() {
        const lastDate = this.getLastCompletionDate();
        const currentDate = getCurrentDate();
        if (lastDate === null || subtractDates(currentDate, lastDate) !== 0) {
            const completion = new Completion(currentDate, false, "");
            this.addCompletion(completion);
        } else {
            alert("This task has already been completed today.");
        }
    }
    
    removeCompletion(completion) {
        const index = this.completions.indexOf(completion);
        this.completions.splice(index, 1);
        completion.parentTask = null;
        this.handleCompletionsChange();
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
        ]).divTag;
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
    
    updateStatusCircles() {
        this.container.updateStatusCircles();
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

const setAllActiveMonths = (value) => {
    for (const checkbox of activeMonthCheckboxes) {
        checkbox.checked = value;
    }
};

const startTaskCreation = (parentCategory = null) => {
    currentTask = null;
    showPage("editTask");
    const nameTag = document.getElementById("editTaskName");
    nameTag.value = "";
    nameTag.focus();
    document.getElementById("editFrequency").value = "";
    document.getElementById("editDueDate").value = "";
    document.getElementById("dueDateIsManual").checked = false;
    document.getElementById("scheduleType").value = "noDueDate";
    handleScheduleTypeChange();
    document.getElementById("hasUpcomingPeriod").checked = false;
    document.getElementById("editUpcomingPeriod").value = "";
    handleUpcomingPeriodChange();
    document.getElementById("hasGracePeriod").checked = false;
    document.getElementById("editGracePeriod").value = "";
    handleGracePeriodChange();
    setAllActiveMonths(true);
    updateCategoryOptions(parentCategory);
    document.getElementById("editTaskNotes").value = "";
};

const startTaskEdit = () => {
    showPage("editTask");
    document.getElementById("editTaskName").value = currentTask.name;
    document.getElementById("editFrequency").value = currentTask.frequency ?? "";
    document.getElementById("editDueDate").value = (currentTask.dueDate === null)
        ? ""
        : convertDateToString(currentTask.dueDate);
    document.getElementById("dueDateIsManual").checked = currentTask.dueDateIsManual ?? false;
    let scheduleType;
    if (currentTask.dueDate === null) {
        scheduleType = "noDueDate";
    } else if (currentTask.frequency === null) {
        scheduleType = "singleDueDate";
    } else {
        scheduleType = "repeatingDueDate";
    }
    document.getElementById("scheduleType").value = scheduleType;
    handleScheduleTypeChange();
    const { upcomingPeriod, gracePeriod } = currentTask;
    const hasUpcomingPeriod = (upcomingPeriod !== null);
    document.getElementById("hasUpcomingPeriod").checked = hasUpcomingPeriod;
    document.getElementById("editUpcomingPeriod").value = hasUpcomingPeriod ? upcomingPeriod : "";
    handleUpcomingPeriodChange();
    const hasGracePeriod = (gracePeriod !== null);
    document.getElementById("hasGracePeriod").checked = hasGracePeriod;
    document.getElementById("editGracePeriod").value = hasGracePeriod ? gracePeriod : "";
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
    const parentPlannerItem = currentTask.getParentPlannerItem();
    updateCategoryOptions(parentPlannerItem);
    document.getElementById("editTaskNotes").value = currentTask.notes;
};

const handleScheduleTypeChange = () => {
    const scheduleType = document.getElementById("scheduleType").value;
    const hasDueDate = (scheduleType !== "noDueDate");
    const isRepeating = (scheduleType === "repeatingDueDate");
    document.getElementById("editFrequencyRow").style.display = isRepeating ? "" : "none";
    document.getElementById("editDueDateRow").style.display = hasDueDate ? "" : "none";
    document.getElementById("editDueDateLabel").innerHTML = isRepeating ? "Next due date:" : "Due date:";
    document.getElementById("isManualContainer").style.display = isRepeating ? "" : "none";
    updateEditDueDate();
};

const dateIsInActiveMonth = (date, activeMonths) => (
    (activeMonths === null) ? true : activeMonths[date.month - 1]
);

const advanceDateMonth = (date) => {
    let { year } = date;
    let month = date.month + 1;
    if (month > monthAmount) {
        year += 1;
        month = 1;
    }
    return { year, month, day: 1 };
};

const calculateDueDate = (frequency, activeMonths, lastCompletionDate) => {
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

const updateEditDueDate = () => {
    const scheduleType = document.getElementById("scheduleType").value;
    if (scheduleType === "noDueDate") {
        return;
    }
    const isManual = (scheduleType === "singleDueDate") || document.getElementById("dueDateIsManual").checked;
    const dueDateTag = document.getElementById("editDueDate");
    dueDateTag.disabled = !isManual;
    if (isManual) {
        return;
    }
    const frequency = parseInt(document.getElementById("editFrequency").value, 10);
    if (Number.isNaN(frequency)) {
        return;
    }
    const activeMonths = getEditActiveMonths();
    const completionDate = currentTask?.getLastCompletionDate() ?? null;
    const dueDate = calculateDueDate(frequency, activeMonths, completionDate);
    dueDateTag.value = convertDateToString(dueDate);
};

const handleUpcomingPeriodChange = () => {
    let labelText = "Upcoming period";
    let displayStyle;
    if (document.getElementById("hasUpcomingPeriod").checked) {
        labelText += ":";
        displayStyle = "";
    } else {
        displayStyle = "none";
    }
    document.getElementById("upcomingPeriodLabel").innerHTML = labelText;
    document.getElementById("editUpcomingContainer").style.display = displayStyle;
};

const handleGracePeriodChange = () => {
    let labelText = "Grace period";
    let displayStyle;
    if (document.getElementById("hasGracePeriod").checked) {
        labelText += ":";
        displayStyle = "";
    } else {
        displayStyle = "none";
    }
    document.getElementById("gracePeriodLabel").innerHTML = labelText;
    document.getElementById("editGraceContainer").style.display = displayStyle;
};

const getEditParentContainer = () => {
    const selectTag = document.getElementById("editParentCategory");
    const parentIndex = parseInt(selectTag.value, 10);
    return (parentIndex < 0) ? rootContainer : allCategories[parentIndex].container;
};

const getEditActiveMonths = () => {
    const activeMonths = [];
    let hasInactiveMonth = false;
    for (const checkbox of activeMonthCheckboxes) {
        activeMonths.push(checkbox.checked);
        if (!checkbox.checked) {
            hasInactiveMonth = true;
        }
    }
    return hasInactiveMonth ? activeMonths : null;
};

const saveTask = () => {
    const nameTag = document.getElementById("editTaskName");
    const name = nameTag.value;
    if (name.length <= 0) {
        alert("Please enter a task name.");
        nameTag.focus();
        return;
    }
    updateEditDueDate();
    const scheduleType = document.getElementById("scheduleType").value;
    let frequency = null;
    let dueDate;
    let dueDateIsManual;
    if (scheduleType === "noDueDate") {
        dueDate = null;
        dueDateIsManual = null;
    } else {
        if (scheduleType === "repeatingDueDate") {
            const frequencyTag = document.getElementById("editFrequency");
            frequency = parseInt(frequencyTag.value, 10);
            if (Number.isNaN(frequency)) {
                alert("Please enter a due date frequency.");
                frequencyTag.focus();
                return;
            }
            dueDateIsManual = document.getElementById("dueDateIsManual").checked;
        } else {
            dueDateIsManual = true;
        }
        const dateString = document.getElementById("editDueDate").value;
        if (dateString.length <= 0) {
            alert("Please enter a due date.");
            return;
        }
        dueDate = convertStringToDate(dateString);
    }
    let upcomingPeriod;
    if (document.getElementById("hasUpcomingPeriod").checked) {
        const periodTag = document.getElementById("editUpcomingPeriod");
        upcomingPeriod = parseInt(periodTag.value, 10);
        if (Number.isNaN(upcomingPeriod)) {
            alert("Please enter an upcoming period duration.");
            periodTag.focus();
            return;
        }
    } else {
        upcomingPeriod = null;
    }
    let gracePeriod;
    if (document.getElementById("hasGracePeriod").checked) {
        const periodTag = document.getElementById("editGracePeriod");
        gracePeriod = parseInt(periodTag.value, 10);
        if (Number.isNaN(gracePeriod)) {
            alert("Please enter a grace period duration.");
            periodTag.focus();
            return;
        }
    } else {
        gracePeriod = null;
    }
    const activeMonths = getEditActiveMonths();
    const notes = document.getElementById("editTaskNotes").value;
    const parentContainer = getEditParentContainer();
    if (currentTask === null) {
        const task = new Task(
            name,
            frequency,
            dueDate,
            dueDateIsManual,
            upcomingPeriod,
            gracePeriod,
            activeMonths,
            notes,
        );
        parentContainer.addItem(task);
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
    currentTask.displayDueDate();
    const parentPlannerItem = currentTask.getParentPlannerItem();
    let parentName;
    if (parentPlannerItem === null) {
        parentName = rootCategoryName;
    } else {
        parentName = parentPlannerItem.name;
    }
    const { upcomingPeriod, gracePeriod, activeMonths } = currentTask;
    let upcomingText;
    let upcomingStyle;
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
    let graceText;
    let graceStyle;
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
    let monthsText;
    let monthsStyle;
    if (activeMonths === null) {
        monthsText = "";
        monthsStyle = "none"
    } else {
        const activeAbbreviations = [];
        for (let index = 0; index < activeMonths.length; index++) {
            const monthIsActive = activeMonths[index];
            if (monthIsActive) {
                abbreviation = monthAbbreviations[index];
                activeAbbreviations.push(abbreviation);
            }
        }
        monthsText = "Active months: " + activeAbbreviations.join(", ");
        monthsStyle = "";
    }
    const monthsTag = document.getElementById("viewActiveMonths");
    monthsTag.innerHTML = monthsText;
    monthsTag.style.display = monthsStyle;
    document.getElementById("viewParentCategory").innerHTML = parentName;
    const notesTag = document.getElementById("viewTaskNotes");
    let notesStyle;
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

const timerEvent = () => {
    const currentDate = getCurrentDate();
    if (lastTimerEventDate === null || subtractDates(lastTimerEventDate, currentDate) !== 0) {
        rootContainer.updateStatusCircles();
        lastTimerEventDate = currentDate;
    }
};

const initializePage = () => {
    keyHash = localStorage.getItem("keyHash");
    if (keyHash === null) {
        alert("You are not currently logged in. Please log in to view your tasks.");
        window.location = "/login";
    }
    rootContainer = new Container(document.getElementById("rootContainer"));
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
            },
        },
        {
            text: "Deselect All",
            onClick: () => {
                setAllActiveMonths(false);
            },
        },
    ]).divTag;
    buttonsTag.style.marginLeft = "15px";
    monthsTag.appendChild(buttonsTag);
    for (const name in statusColors) {
        const color = statusColors[name];
        const tags = document.getElementsByName(name + "Circle");
        for (const tag of tags) {
            tag.style.background = color;
        }
    }
    setInterval(timerEvent, 1000);
};


