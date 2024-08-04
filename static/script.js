class Game {
    constructor(data) {
        this.data = data;
        this.initializeGameState();
        this.setupCommands(); // init commands map
        this.setupDisplay(); // init display components (score, moves etc)
    }

    initializeGameState() {
        this.state = {
            currentRoom: null,
            descriptions: 'brief', // only describes rooms fully on 1st visit
            visited: ['startRoom'],
            score: 0,
            moves: 0,
            time: 8,
            mode: localStorage.getItem('gameMode') || 'light',
            awaitingRestartConfirmation: false
        };
    }

    setupDisplay() {
        document.body.className = this.state.mode; 
        this.scoreDisplay = document.getElementById('score');
        this.movesDisplay = document.getElementById('moves');
        this.updateScoreAndMovesDisplay();  // Initial display update
        this.updateTimeDisplay();
    }

    setupCommands() {
        this.commands = {
            'n': new NorthCommand(this),
            'north': new NorthCommand(this),
            's': new SouthCommand(this),
            'south': new SouthCommand(this),
            'e': new EastCommand(this),
            'east': new EastCommand(this),
            'w': new WestCommand(this),
            'west': new WestCommand(this),
            'u': new UpCommand(this),
            'up': new UpCommand(this),
            'd': new DownCommand(this),
            'down': new DownCommand(this),
            'look': new LookCommand(this),
            'time': new TimeCommand(this),
            'wait': new WaitCommand(this),
            'score': new ScoreCommand(this),
            'brief': new BriefCommand(this),
            'verbose': new VerboseCommand(this),
            'mode': new ModeCommand(this),
            'clear': new ClearCommand(this),
            'restart': new RestartCommand(this)
            // potentially more commands
        };
    }

    start() {
        this.initializeGameState(); 
        this.displayWelcomeMessages();
        this.changeRoom(this.data.rooms['startRoom']);
        this.setupInputHandling(); // set it up here b/c everything is now safely loaded
        this.updateScoreAndMovesDisplay();
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
    }

    addPlayerResponse(message) {
        // adds player's input to the message window.
        const messageContainer = document.getElementById('message-container');
        const userInputP = document.createElement('p');
        userInputP.className = 'user-input';
        userInputP.textContent = '>' + message;
        messageContainer.appendChild(userInputP);
    }

    addParserResponse(message, style = "normal") {
        const messageContainer = document.getElementById('message-container');
        const parserOutputP = document.createElement('p');
        parserOutputP.className = `$('parser-output')`;
        parserOutputP.textContent = message;
        messageContainer.appendChild(parserOutputP);
        // Ensure new messages are scrolled into view
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

    processInput(input) {
        this.addPlayerResponse(input);
        const command = this.commands[input] || new UnknownCommand(this);
        command.execute();
    }

    updateMoveCount() {
        // for successful actions that increment the
        // move count in the game.
        this.state.moves++;
        this.advanceTime(1);
        console.log("visited:", this.state.visited);
        console.log(this.state.time);
        // TO DO: 
        // this.game.handleEventDurations();
        this.updateScoreAndMovesDisplay();
        // TO DO:
        // this.game.checkForEventTriggers();
    }

    updateScoreAndMovesDisplay() {
        this.scoreDisplay.textContent = this.state.score;
        this.movesDisplay.textContent = this.state.moves;
    }

    updateTimeDisplay() {
        const hour = this.state.time;
        let periodMessage = "";

        if (hour === 8) {
            this.state.periodOfDay = "Sunrise";
            periodMessage = "A soft glow pierces the horizon.";
        } else if (hour === 9) {
            this.state.periodOfDay = "Morning";
            periodMessage = "The day brightens as the sun climbs.";
        } else if (hour === 12) {
            this.state.periodOfDay = "Noon";
            periodMessage = "The sun reigns overhead, relentless.";
        } else if (hour === 15) {
            this.state.periodOfDay = "Late Afternoon";
            periodMessage = "The shadows of objects begin to lengthen.";
        } else if (hour === 18) {
            this.state.periodOfDay = "Dusk";
            periodMessage = "The horizon burns with the dying light.";
        } else if (hour === 20) {
            this.state.periodOfDay = "Evening";
            periodMessage = "Twilight descends, enveloping the world in soft darkness.";
        } else if (hour === 22) {
            this.state.periodOfDay = "Night";
            periodMessage = "The cloak of night covers all in stillness.";
        } else if (hour === 4) {
            this.state.periodOfDay = "Before Sunrise";
            periodMessage = "The deepest dark before the dawn.";
        }

        if (periodMessage) {
            this.addParserResponse(periodMessage);
        }
        // this.addParserResponse(`The current time is ${this.state.time}:00.`);
        this.updatePeriodOfDayDisplay();
    }

    updatePeriodOfDayDisplay() {
        const periodDisplay = document.getElementById('period-of-day');
        periodDisplay.textContent = `${this.state.periodOfDay}`;
    }

    advanceTime(hours) {
        this.state.time += hours;
        if (this.state.time >= 24) {
            this.state.time -= 24; // Handle time wrap-around
        }
        this.updateTimeDisplay(); // Recalculate period of day and update UI
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
        this.direction = direction;
    }

    execute() {
        const room = this.game.state.currentRoom;
        const exitKey = room.exits[this.direction];

        if (exitKey) {
            this.movePlayer(exitKey);
        } else {
            this.handleNoExit();
        }
    }

    movePlayer(exitKey) {
        const nextRoom = this.game.data.rooms[exitKey];
        this.game.state.currentRoom = nextRoom;
        this.game.displayRoom();
        this.game.updateMoveCount();
    }

    handleNoExit() {
        const currentRoom = this.game.state.currentRoom;
        // Check if there is a custom error message for this direction
        const customError = currentRoom.exitErrors && currentRoom.exitErrors[this.direction];
        // if no custom message, use a default method based on whether the room is outside or inside
        const errorMessage = customError ? customError : (currentRoom.outside ? "You can't go that way." : "There is a wall there.");
        this.game.addParserResponse(errorMessage);
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

class LookCommand extends Command {
    execute() {
        this.game.displayRoom(true); // forceVerbose = true
        this.game.updateMoveCount();
    }
}

class TimeCommand extends Command {
    execute() {
        this.game.addParserResponse(`The current time is ${this.state.time}:00.`);
    }
}

class WaitCommand extends Command {
    execute() {
        this.game.addParserResponse("Time passes.");
        this.game.updateMoveCount();
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