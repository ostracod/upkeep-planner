
const newCategoryName = "New Category";

let keyHash;
let rootContainer;

const createButtons = (buttonDefs) => {
    const output = document.createElement("span");
    for (const buttonDef of buttonDefs) {
        const button = document.createElement("button");
        button.innerHTML = buttonDef.text;
        button.onclick = buttonDef.onClick;
        output.appendChild(button);
    }
    return output;
};

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
        const { parentPlannerItem } = this.parentContainer;
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
    
    createTag() {
        // TODO: Implement.
        
    }
}

class Category extends PlannerItem {
    
    createTag() {
        const output = document.createElement("div");
        output.className = "plannerItem";
        
        const rowTag = document.createElement("div");
        this.nameTag = document.createElement("span");
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
                onClick: () => {},
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
                    this.remove();
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
        this.name = this.renameTag.value;
        this.nameTag.innerHTML = this.name;
        this.hideRenameTags();
    }
    
    hideRenameTags() {
        this.nameTag.style.display = "";
        this.buttonsTag.style.display = "";
        this.renameTag.style.display = "none";
        this.renameButtonsTag.style.display = "none";
    }
}

const addRootTask = () => {
    // TODO: Implement.
    
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


