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
            mode: localStorage.getItem('gameMode') || 'light',
            awaitingRestartConfirmation: false
        };
    }

    setupDisplay() {
        document.body.className = this.state.mode; 
        this.scoreDisplay = document.getElementById('score');
        this.movesDisplay = document.getElementById('moves');
        this.updateScoreAndMovesDisplay();  // Initial display update
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

    addParserResponse(message) {
        const messageContainer = document.getElementById('message-container');
        const parserOutputP = document.createElement('p');
        parserOutputP.className = 'parser-output';
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
        console.log("visited:", this.state.visited);
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