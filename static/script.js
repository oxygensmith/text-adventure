class Game {
    constructor(data) {
        this.data = data;
        this.findObjectInCurrentRoom = this.findObjectInCurrentRoom.bind(this);
        this.objects = data.objects;
        this.awakenessMessages = data.awakenessMessages;
        this.wakeUpMessages = data.wakeUpMessages;
        this.timePeriods = data.timePeriods;
        this.gameConstants = {
            defaultMoveTime: 0.25,  // Time advanced for a successful move, in hours
            defaultSleepTime: 7.5, // hours advanced after sleep
            defaultRegeneration: 0.1, // amount generated per MoveTime above
        };
        this.initializeGameState();
        this.setupCommands(); // init commands map
        this.setupCommandSynonyms(); // init commands map
        this.setupDisplay(); // init display components (score, moves etc)
        // inputHandling is set up in start() now to ensure components have loaded
    }

    initializeGameState() {
        this.state = {
            currentRoom: null,
            descriptions: 'brief', // only describes rooms fully on 1st visit
            visited: ['startRoom'],
            inventoryWeight: 0,
            inventoryMaxWeight: 10,
            inventoryObjects: [],
            score: 0,
            moves: 0,
            time: 8,
            currentPeriod: null,
            health: 5,
            maxHealth: 10,
            awakeness: 10,
            mode: localStorage.getItem('gameMode') || 'light',
            awaitingRestartConfirmation: false
        };
    }

    setupDisplay() {
        document.body.className = this.state.mode; 
        this.scoreDisplay = document.getElementById('score');
        this.movesDisplay = document.getElementById('moves');
        this.healthDisplay = document.getElementById('health');
        this.updateConsole();  // Initial display update
        this.updateTimeDisplay();
    }

    setupCommands() {
        this.commands = {
            'n': new NorthCommand(this),
            's': new SouthCommand(this),
            'e': new EastCommand(this),
            'w': new WestCommand(this),
            'u': new UpCommand(this),
            'd': new DownCommand(this),
            'get': new GetCommand(this),
            'drop': new DropCommand(this),
            'i': new InventoryCommand(this),
            'look': new LookCommand(this),
            'time': new TimeCommand(this),
            'wait': new WaitCommand(this),
            'sleep': new SleepCommand(this),
            'diagnose': new DiagnoseCommand(this),
            'score': new ScoreCommand(this),
            'brief': new BriefCommand(this),
            'verbose': new VerboseCommand(this),
            'mode': new ModeCommand(this),
            'clear': new ClearCommand(this),
            'restart': new RestartCommand(this)
            // potentially more commands
        };
        console.log('Commands initialized.');
    }

    setupCommandSynonyms() {
        this.synonyms = {
            'north': 'n',
            'south': 's',
            'east': 'e',
            'west': 'w',
            'up': 'u',
            'down': 'd',
            'take': 'get',
            'pick up': 'get',
            'dump': 'drop'
            // Add more synonyms as needed
        };
        console.log('Synonyms initialized.');
    }

    start() {
        this.initializeGameState(); 
        this.displayWelcomeMessages();
        this.changeRoom(this.data.rooms['startRoom']);
        this.setupInputHandling(); // set it up here b/c everything is now safely loaded
        this.updateConsole();
    }

    displayWelcomeMessages() {
        this.data.welcomeMessages.forEach(message => this.addParserResponse(message));
    }

    setVerbosity(level) {
        this.state.descriptions = level;
        this.addParserResponse(`${level.charAt(0).toUpperCase() + level.slice(1)} descriptions on.`);
        if(level === 'verbose') {
            this.displayRoom(true);
        }
    }

    changeRoom(room) {
        this.state.currentRoom = room;
        this.displayRoom();
    }

    displayRoom(forceVerbose = false) {
        const room = this.state.currentRoom;
        this.addParserResponse(room.name);
        // conditions for displaying description:
        // -- haven't visited before
        // -- if room descriptions are set to verbose
        // -- forceVerbose is true (player said 'LOOK' or 'VERBOSE')
        if (!this.state.visited.includes(room.name) || this.state.descriptions === 'verbose' || forceVerbose) {
            this.addParserResponse(room.description);
            // Add room to visited if it's not already there
            if (!this.state.visited.includes(room.name)) {
                this.state.visited.push(room.name);
            }
        }
        // List objects:
        // First pass: Display initial descriptions for items that haven't been moved and are not embedded in the description.
        this.objects.filter(obj => 
            obj.location === room.name && !obj.moved && !obj.descriptionEmbedded
        ).forEach(obj => {
            this.addParserResponse(obj.descriptionInitial);
        });

        // Second pass: Collect and list items that have been moved and dropped here and are not embedded.
        const movedObjects = this.objects.filter(obj => 
            obj.location === room.name && obj.moved && !obj.descriptionEmbedded
        );
        if (movedObjects.length > 0) {
            let groundItems = "On the ground is:";
            movedObjects.forEach(obj => {
                groundItems += `<li>${obj.article} ${obj.name}.</li>`; // Use HTML list format if suitable
            });
            this.addParserResponse(groundItems, true); // Pass 'true' if your addParserResponse supports HTML
        }
    }

    addPlayerResponse(message) {
        // adds player's input to the message window.
        const messageContainer = document.getElementById('message-container');
        const userInputP = document.createElement('p');
        userInputP.className = 'user-input';
        userInputP.textContent = '>' + message;
        messageContainer.appendChild(userInputP);
    }

    addParserResponse(message, isHTML = false, style = "normal") {
        const messageContainer = document.getElementById('message-container');
        const responseElement = document.createElement('p');
        responseElement.className = `$('parser-output')`;
        if (isHTML) {
            responseElement.innerHTML = message;
        } else {
            responseElement.textContent = message;
        }    
        messageContainer.appendChild(responseElement);
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }

    setupInputHandling() {
        const form = document.getElementById('input-form');
        form.addEventListener('submit', event => {
            event.preventDefault();
            const inputElement = document.getElementById('user-input');
            const userInput = inputElement.value.trim().toLowerCase(); // normalize output
            if (userInput === '') return; // If the input is empty, do nothing
            inputElement.value = ''; // Clear the input field
            this.processInput(userInput);
        });
    }

    normalizeInput(input) {
        if (!this.synonyms) {
            console.error('Synonyms not initialized');
            return input;  // Default to returning input if synonyms are not available
        }
        return this.synonyms[input.toLowerCase()] || input;
    }

    processInput(input) {
        // the heart of our parser.
        this.addPlayerResponse(input); // show what player typed
        const parts = input.trim().split(/\s+/);
        const commandWord = this.normalizeInput(parts.shift()); // Normalize the first word using synonyms
        console.log('Normalized Command:', commandWord); 
        const command = this.commands[commandWord];

        if (command) {
            console.log('Executing Command:', commandWord);
            command.execute(parts);  // Execute the command with any additional arguments
        } else {
            console.log('Command Not Found:', commandWord);
            this.handleUnknownCommand(input);
        }
    }

    updateMoveCount() {
        // for successful actions that increment the
        // move count in the game.
        this.state.moves++;
        if (this.state.time >= 21) {
            this.updateAwakeness();
        }
        this.advanceTime(this.gameConstants.defaultMoveTime);
        this.regenerateHealth(this.gameConstants.defaultRegeneration);
        // console.log("visited:", this.state.visited);
        console.log(`Time: ${this.state.time}`);
        console.log(`Awakeness: ${this.state.awakeness}`);
        // TO DO: 
        // this.game.handleEventDurations();
        this.updateConsole();
        // TO DO:
        // this.game.checkForEventTriggers();
    }

    updateConsole() {
        this.scoreDisplay.textContent = this.state.score;
        this.movesDisplay.textContent = this.state.moves;
        this.healthDisplay.textContent = `Health: ${Math.trunc(this.state.health)}`; // integer only
    }

    updateTimeDisplay() {
        const hour = Math.floor(this.state.time);
        const minutes = (this.state.time % 1) * 60;
        const newPeriod = this.findClosestPeriod(hour);

        if (newPeriod && newPeriod.name !== this.state.currentPeriod) {
            console.log(`Period changed from ${this.state.currentPeriod} to ${newPeriod.name}`);
            this.state.currentPeriod = newPeriod.name; // Update the period of day
            this.addParserResponse(newPeriod.message); // Display period transition message
        }

        // this.addParserResponse(`The current time is ${hour}:${minutes < 10 ? '0' : ''}${minutes}.`); // don't add regular time updates to parser output
        this.updatePeriodOfDayDisplay();
    }

    findClosestPeriod(currentHour) {
        // Start from currentHour and go backward to find the closest period
        let lastPeriod = null;
        for (let period of this.timePeriods) {
            if (period.hour > currentHour) break;
            lastPeriod = period;
        }
        return lastPeriod;
    }
    
    updatePeriodOfDayDisplay() {
        const periodDisplay = document.getElementById('period-of-day');
        periodDisplay.textContent = `${this.state.currentPeriod}`;
    }

    updateHealthDisplay() {
        const healthDisplay = document.getElementById('health');
        healthDisplay.textContent = `Health: ${this.state.health}`;
    }

    advanceTime(hours) {
        this.state.time += hours;
        if (this.state.time >= 24) {
            this.state.time -= 24; // Handle time wrap-around
        }
        if (this.state.time >= 21) { // After 9 PM
            this.updateAwakeness();
        }
        this.updateTimeDisplay(); // Recalculate period of day and update UI
    }

    updateAwakeness() {
        console.log("updateAwakeness called", new Error().stack);
        this.state.awakeness--;
        let message = this.awakenessMessages[this.state.awakeness.toString()];
        if (message) {
            this.addParserResponse(message);
        }
        if (this.state.awakeness <= 0) {
            this.resetAwakeness();
        }
    }

    resetAwakeness() {
        console.log("Resetting awakeness...");
        this.state.awakeness = 10;
        this.advanceTime(this.gameConstants.defaultSleepTime);
        this.regenerateHealth(this.gameConstants.defaultSleepTime);
        console.log(`New time after sleep: ${this.state.time}`);
        this.updateTimeDisplay();
        this.updatePeriodOfDayDisplay();
        let randomIndex = Math.floor(Math.random() * this.wakeUpMessages.length);
        let wakeMessage = this.wakeUpMessages[randomIndex];
        this.addParserResponse(wakeMessage);
        this.displayRoom(true); // Force a full room description
    }

    regenerateHealth(hours) {
        const healthIncrement = hours * (0.1 / 0.15);  // Calculate health increase per 15 minutes
        this.state.health += healthIncrement;
        this.state.health = Math.min(this.state.health, this.state.maxHealth);  // Cap health at maxHealth
        // Round health to one decimal place
        this.state.health = Math.round(this.state.health * 10) / 10;
        console.log(`Health updated to: ${this.state.health}`);
    }

    // inventory

    addItemToInventory(item) {
        if (this.state.inventoryWeight + item.inventorySpace <= this.state.inventoryMaxWeight) {
            this.state.inventoryObjects.push(item);
            item.location = null;
            item.moved = true;
            this.state.inventoryWeight += item.inventorySpace;
            this.addParserResponse(`${capitalizeFirstLetter(item.name)}: taken.`);
        } else {
            this.addParserResponse("You can't carry any more.");
        }
    }

    removeItemFromInventory(itemName) {
        let itemIndex = this.state.inventoryObjects.findIndex(item => item.name === itemName);
        if (itemIndex !== -1) {
            let item = this.state.inventoryObjects[itemIndex];
            this.state.inventoryObjects.splice(itemIndex, 1);
            this.state.inventoryWeight -= item.inventorySpace;
            this.addParserResponse(`You have dropped ${item.article} ${item.name}.`);
        }
    }

    findObjectInCurrentRoom(objectName) {
        console.dir('Current this: ', this);
        console.log('Game state:', this.state);  // Check access to state
        console.log('Current room:', this.state.currentRoom);  // Check access to current room
        return this.objects.find(obj => 
            obj.location === this.state.currentRoom.name &&
            (obj.name.toLowerCase() === objectName.toLowerCase() ||
             obj.shortNames.includes(objectName.toLowerCase())));
    }
}        

class Command {
    constructor(game) {
        this.game = game;
    }
    execute() {
        throw new Error("Execute method should be implemented by subclass");
    }
}

class DirectionCommand extends Command {
    constructor(game, direction) {
        super(game);
        // can simply assume synonym pre-processing in processInput
        this.direction = direction;
    }

    execute() {
        const room = this.game.state.currentRoom;
        const exitKey = room.exits[this.direction];

        // Log the current room and exit information
        console.log('Current Room:', room.name);
        console.log('Available Exits:', room.exits);
        console.log('Trying to go:', this.direction, 'to:', exitKey);


        if (exitKey) {
            this.movePlayer(exitKey);
        } else {
            this.handleNoExit(this.direction);
        }
    }

    movePlayer(exitKey) {
        const nextRoom = this.game.data.rooms[exitKey];
        console.log('Moving to:', exitKey, nextRoom ? nextRoom.name : "Room not found");
        this.game.state.currentRoom = nextRoom;
        this.game.displayRoom();
        this.game.updateMoveCount();
    }

    handleNoExit(direction) {
        const currentRoom = this.game.state.currentRoom;
        // Check if there is a custom error message for this direction
        const customError = currentRoom.exitErrors && currentRoom.exitErrors[this.direction];
        let errorMessage;
        if (customError) {
            errorMessage = customError;
        } else {
        // if no custom message, use a default message based on whether:
        // -- the room is outside or inside
        // -- the direction is up, down, or something else
            switch (direction) {
                case 'up':
                    errorMessage = currentRoom.outside ? "There is no way into the sky." : `There is just the ceiling of the ${currentRoom.name} there.`;
                    break;
                case 'down':
                    errorMessage = currentRoom.outside ? `There is only the ground of the ${currentRoom.name} there.` : `There is only the ${currentRoom.name}'s floor there.`;
                    break;
                default:
                    errorMessage = currentRoom.outside ? "You can't go that way." : "There is a wall there.";
                    break;
            }
        }    
        this.game.addParserResponse(errorMessage);
        console.log('No exit found:', errorMessage);
    }
}

class NorthCommand extends DirectionCommand {
    constructor(game) {
        super(game, 'n');
    }
}

class SouthCommand extends DirectionCommand {
    constructor(game) {
        super(game, 's');
    }
}

class EastCommand extends DirectionCommand {
    constructor(game) {
        super(game, 'e');
    }
}

class WestCommand extends DirectionCommand {
    constructor(game) {
        super(game, 'w');
    }
}

class UpCommand extends DirectionCommand {
    constructor(game) {
        super(game, 'u');
    }
}

class DownCommand extends DirectionCommand {
    constructor(game) {
        super(game, 'd');
    }
}

class GetCommand extends Command {
    execute(args) {
        if (!args.length) {
            this.game.addParserResponse("What would you like to take?");
            return;
        }
        if (args.join(' ').toLowerCase() === 'all') {
            const objectsInRoom = this.game.objects.filter(obj => obj.location === this.game.state.currentRoom.name && obj.carryable);
            let response = "";
            objectsInRoom.forEach(obj => {
                if (this.game.addItemToInventory(obj)) {
                    response += `${obj.name}: taken.<br />`;
                } else {
                    response += `${obj.name}: cannot take.<br />`;
                }
            });
            this.game.addParserResponse(response.trim(), true);
            this.game.updateMoveCount();
        } else {    
            const objectName = args.join(' '); // Handle multi-word objects
            console.log("object specified: " + objectName);
            const object = this.game.findObjectInCurrentRoom(objectName);
            if (object && object.carryable) {
                this.game.addItemToInventory(object);
                this.game.updateMoveCount();
            } else if (!object) {
                this.game.addParserResponse(`There is no ${objectName} here.`);
            } else {
                this.game.addParserResponse(`You cannot take the ${objectName}.`);
            }
        }
    }
}    

class DropCommand extends Command {
    execute(args) {
        if (!args.length) {
            this.game.addParserResponse("What would you like to drop?");
            return;
        }
        if (args.join(' ').toLowerCase() === 'all') {
            let response = "";
            while (this.game.state.inventoryObjects.length > 0) {
                const obj = this.game.state.inventoryObjects.shift();
                obj.location = this.game.state.currentRoom.name;
                response += `${capitalizeFirstLetter(obj.name)}: dropped.<br />`;
            }
            this.game.state.inventoryWeight = 0; // Reset inventory weight
            this.game.addParserResponse(response.trim(), true);
            this.game.updateMoveCount();
        } else {
            const objectName = args.join(' ');
            const objectIndex = this.game.state.inventoryObjects.findIndex(obj => obj.name.toLowerCase() === objectName.toLowerCase() || obj.shortName.toLowerCase() === objectName.toLowerCase());

            if (objectIndex !== -1) {
                const object = this.game.state.inventoryObjects[objectIndex];
                this.game.state.inventoryObjects.splice(objectIndex, 1);
                this.game.state.inventoryWeight -= object.inventorySpace;
                object.location = this.game.state.currentRoom.name; // Object is now in the current room
                this.game.addParserResponse(`${capitalizeFirstLetter(object.name)}: dropped.`);
                this.game.updateMoveCount();
            } else {
                this.game.addParserResponse(`You don't have ${object.article} ${objectName}.`);
            }
        }
    }
}

class InventoryCommand extends Command {
    execute() {
        if (this.game.state.inventoryObjects.length === 0) {
            this.game.addParserResponse("You are empty-handed.");
        } else {
            let htmlContent = "You are carrying: <ul>";
            this.game.state.inventoryObjects.forEach(item => {
                htmlContent += `<li>${item.article} ${item.name}.</li>`;
            });
            htmlContent += "</ul>";
            this.game.addParserResponse(htmlContent, true); // pass true to render as HTML
        }
    }
}

class LookCommand extends Command {
    execute() {
        this.game.displayRoom(true); // forceVerbose = true
        this.game.updateMoveCount();
    }
}

class TimeCommand extends Command {
    execute() {
        const hour = Math.floor(this.game.state.time);
        const minutes = (this.game.state.time % 1) * 60;
        this.game.addParserResponse(`The current time is ${hour}:${minutes < 10 ? '0' : ''}${minutes}.`);
        this.game.addParserResponse(`It is currently ${this.game.state.currentPeriod}.`);
    }
}

class WaitCommand extends Command {
    execute() {
        this.game.addParserResponse("Time passes.");
        this.game.updateMoveCount();
    }
}

class SleepCommand extends Command {
    execute() {
        if (this.game.state.awakeness === 10) {
            this.game.addParserResponse("You are nowhere near tired.");
        } else {
            this.game.addParserResponse("You lay down, resting your head on the softest thing nearby, and after a short while, you drift off.");
            this.game.resetAwakeness();  // Call the resetAwakeness method to handle the sleep logic
        }
    }
}

class ScoreCommand extends Command {
    execute() {
        this.game.addParserResponse("Your score is " + this.game.state.score + ", in a game with " + this.game.state.moves + " moves.");
    }
}

class BriefCommand extends Command {
    execute() {
        this.game.setVerbosity("brief");
    }
}

class VerboseCommand extends Command {
    execute() {
        this.game.setVerbosity("verbose");
    }
}

class ModeCommand extends Command {
    execute() {
        if (this.game.state.mode === 'light') {
            this.game.state.mode = 'dark';
        } else {
            this.game.state.mode = 'light';
        }
        document.body.className = this.game.state.mode;
        localStorage.setItem('gameMode', this.game.state.mode);
        this.game.addParserResponse(`Switched to ${this.game.state.mode} mode.`);
    }
}

class DiagnoseCommand extends Command {
    constructor(game) {
        super(game);
    }

    execute() {
        const healthPercentage = (this.game.state.health / this.game.state.maxHealth) * 100;
        const message = this.getHealthMessage(healthPercentage);
        this.game.addParserResponse(message);
    }

    getHealthMessage(percentage) {
        if (percentage >= 90) return "You are in perfect health.";
        if (percentage >= 80) return "You are very lightly wounded.";
        if (percentage >= 70) return "You have light wounds.";
        if (percentage >= 60) return "You are fairly healthy.";
        if (percentage >= 50) return "You are moderately healthy.";
        if (percentage >= 40) return "You are quite wounded.";
        if (percentage >= 30) return "You have a severe wound.";
        if (percentage >= 20) return "You have several severe wounds.";
        if (percentage >= 10) return "You have life-threatening injuries.";
        return "You are basically at death's door.";
    }
}

class UnknownCommand extends Command {
    execute() {
        const randomMessage = this.randomResponse();
        this.game.addParserResponse(randomMessage);
    }

    randomResponse() {
        const responses = this.game.data.responses; // Assuming responses are part of the loaded game data
        return responses[Math.floor(Math.random() * responses.length)];
    }
}

class ClearCommand extends Command {
    execute() {
        const messageContainer = document.getElementById('message-container');
        messageContainer.innerHTML = '';
        this.game.addParserResponse("Screen cleared.");
    }
}

class RestartCommand extends Command {
    execute() {
        const messageContainer = document.getElementById('message-container');
        messageContainer.innerHTML = '';  // Clear the contents of the message container

        // After restarting the game, display a confirmation message
        this.game.addParserResponse("Game restarted.");
        // Restart the game
        this.game.start();
    }
}



document.addEventListener('DOMContentLoaded', function() {
    fetch('/static/game_data.json')
        .then(response => response.json())
        .then(data => {
            const game = new Game(data);  // Initialize the game with data
            game.start();                // Start the game
        })
        .catch(error => {
            console.error('Error loading game data:', error);
        });
});

// utility functions

function capitalizeFirstLetter(string) {
    if (!string) return string; // handle null, undefined, or empty string
    return string.charAt(0).toUpperCase() + string.slice(1);
}