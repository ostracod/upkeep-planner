
const newCategoryName = "New Category";

let keyHash;
let rootContainer;

class Container {
    
    constructor(tag) {
        this.tag = tag;
        this.plannerItems = [];
    }
    
    addItem(plannerItem) {
        this.tag.appendChild(plannerItem.tag);
        this.plannerItems.push(plannerItem);
    }
}

class PlannerItem {
    // Concrete subclasses of PlannerItem must implement these methods:
    // createTag
    
    constructor(name) {
        this.name = name;
        this.tag = this.createTag();
    }
    
    createButtons(inputButtonDefs) {
        const buttonDefs = [
            ...inputButtonDefs,
            {
                text: "Move",
                onClick: () => {},
            },
        ];
        const output = document.createElement("span");
        output.style.marginLeft = "15px";
        for (const buttonDef of buttonDefs) {
            const button = document.createElement("button");
            button.innerHTML = buttonDef.text;
            button.onclick = buttonDef.onClick;
            output.appendChild(button);
        }
        return output;
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
        const nameTag = document.createElement("span");
        nameTag.innerHTML = this.name;
        rowTag.appendChild(nameTag);
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
                onClick: () => {},
            },
            {
                text: "Delete",
                onClick: () => {},
            },
        ]);
        rowTag.appendChild(buttonsTag);
        output.appendChild(rowTag);
        
        const containerTag = document.createElement("div");
        containerTag.style.marginLeft = "20px";
        this.container = new Container(containerTag);
        output.appendChild(containerTag);
        
        return output;
    }
    
    addNewCategory() {
        const category = new Category(newCategoryName);
        this.container.addItem(category);
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


