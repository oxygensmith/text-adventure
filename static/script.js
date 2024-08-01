let currentState = {
    currentRoom: null,
    descriptions: 'brief',
    visited: ['startRoom'],  // Start with the initial room as visited
    score: 0,
    moves: 0,
    awaitingRestartConfirmation: false
};

let gameData;  // Global variable to store game data

document.addEventListener('DOMContentLoaded', function() {
    fetch('/static/game_data.json')  // Adjust the path if necessary
        .then(response => response.json())
        .then(data => {
            gameData = data;  // Store the fetched data in the global variable
            startGame();  // Only call startGame after the data is fully loaded
        })
        .catch(error => {
            console.error('Error loading game data:', error);
        });
});

function addParserResponse(message) {
    // adds parser's input to the message window.
    const messageContainer = document.getElementById('message-container');
    const parserOutputP = document.createElement('p');
    parserOutputP.className = 'parser-output';
    parserOutputP.textContent = message;
    messageContainer.appendChild(parserOutputP);
    messageContainer.scrollTop = messageContainer.scrollHeight; // Ensure new messages are scrolled into view
}

function addPlayerResponse(message) {
    // adds player's input to the message window.
    const messageContainer = document.getElementById('message-container');
    const userInputP = document.createElement('p');
    userInputP.className = 'user-input';
    userInputP.textContent = '>' + message;
    messageContainer.appendChild(userInputP);
}

function startGame() {
    if (!gameData || !gameData.rooms) {
        console.error('Game data is not loaded properly.');
        return;  // Stop execution if data is not correctly loaded
    }

    // Display welcome messages
    const messageContainer = document.getElementById('message-container');
    messageContainer.innerHTML = '';  // Optionally clear existing messages
    gameData.welcomeMessages.forEach(message => {
        addParserResponse(message);  // Use addParserResponse to display each message
    });

    // Initialize the current room using globally accessible gameData
    currentState.currentRoom = gameData.rooms['startRoom'];
    displayRoom(currentState.currentRoom);

    const form = document.getElementById('input-form');
    form.addEventListener('submit', function(event) {
        event.preventDefault();
        const userInput = document.getElementById('user-input').value;
        if (userInput.trim() === '') return;  // Prevent empty input submission

        // Process input considering commands to change rooms, without needing to pass data
        processInput(userInput);
        document.getElementById('user-input').value = '';  // Clear input field after processing
    });
}

function updateScoreAndMovesDisplay() {
    document.getElementById('score').textContent = currentState.score;
    document.getElementById('moves').textContent = currentState.moves;
}

function updateMoveCount() {
    // Increment the move count for player actions
    currentState.moves++;

    // TODO: Check and update any ongoing events with their durations
    // handleEventDurations();

    // Always update the display after changing the move count
    updateScoreAndMovesDisplay();

    // TODO: Additional checks or triggers based on new move count
    // checkForEventTriggers();
}

function restartGame() {
    // Reset the dynamic game state to initial settings
    currentState = {
        currentRoom: gameData.rooms.startRoom, // Reference to static data for the initial room
        descriptions: 'brief',
        visited: ['startRoom'],  // Start with the initial room as visited
        score: 0,
        moves: 0,
        awaitingRestartConfirmation: false
    };
    updateScoreAndMovesDisplay();  // Update the score and moves display
    displayRoom(currentState.currentRoom, true);  // Display the initial room
    const messageContainer = document.getElementById('message-container');
    messageContainer.innerHTML = '';  // Clear previous messages
    addParserResponse('Game restarted.');
}

function handleRestart(input) {
    const messageContainer = document.getElementById('message-container');

    if (currentState.awaitingRestartConfirmation) {
        if (input === "y" || input === "yes") {
            restartGame();
        } else {
            const restartMessage = "Restart cancelled.";
            addParserResponse(restartMessage);
        }
        currentState.awaitingRestartConfirmation = false;
        return;
    }

    currentState.awaitingRestartConfirmation = true;
    const restartMessage = "Do you really want to restart? (y/n)";
    addParserResponse(restartMessage);
}

function handleScoreCommand() {
    const scoreMessage = "Your score is " + currentState.score + ", in a game with " + currentState.moves + " moves.";
    addParserResponse(scoreMessage);
}

function handleWaitCommand() {
    const waitMessage = "Time passes.";
    addParserResponse(waitMessage);
    updateMoveCount();  // Increment moves as looking around counts as a move
}

function handleRandomResponses() {
    const randomMessage = randomResponse(gameData.responses); // Fetch a random response from global gameData
    addParserResponse(randomMessage);
}

function displayRoom(room, forceVerbose = false) {
    const messageContainer = document.getElementById('message-container');
    const roomNameP = document.createElement('p');
    roomNameP.className = 'room-name';
    roomNameP.textContent = room.name;  // No 'Room: ' prefix as per your preference
    messageContainer.appendChild(roomNameP);

    // Check if the room has not been visited, descriptions are set to verbose, or forceVerbose is true
    if (!currentState.visited.includes(room.name) || currentState.descriptions === 'verbose' || forceVerbose) {
        const roomDescP = document.createElement('p');
        roomDescP.className = 'room-description';
        roomDescP.textContent = room.description;
        messageContainer.appendChild(roomDescP);

        // Add room to visited if it's not already there
        if (!currentState.visited.includes(room.name)) {
            currentState.visited.push(room.name);
        }
    }
    messageContainer.scrollTop = messageContainer.scrollHeight;
}

function processInput(input) {
    // handles all player input.
    addPlayerResponse(input);

    const normalizedInput = input.trim().toLowerCase();

    // First, handle directional commands using global gameData
    if (handleDirection(normalizedInput)) {
        // If it's a direction command, handleDirection will return true
        // and we don't need to process further in this call
        return;
    }

    // If it's not a direction, handle other possible commands or default responses
    handleOtherCommands(normalizedInput);
}

function handleDirection(input) {
    const directions = ["n", "s", "e", "w", "u", "d"];
    const directionMap = {
        "north": "n", "south": "s", "east": "e", "west": "w", "up": "u", "down": "d"
    };
    const shortInput = directionMap[input] || input; // Convert full directions to abbreviations

    if (directions.includes(shortInput)) {
        if (currentState.currentRoom.exits && shortInput in currentState.currentRoom.exits) {
            currentState.currentRoom = gameData.rooms[currentState.currentRoom.exits[shortInput]];
            displayRoom(currentState.currentRoom);
            updateMoveCount();
            return true; // Return true indicating a direction command was processed
        } else {
            const customError = currentState.currentRoom.exitErrors ? currentState.currentRoom.exitErrors[shortInput] : null;
            directionErrorMessage = customError ? customError : (currentState.currentRoom.outside ? "You can't go that way." : "There is a wall there.");
            addParserResponse(directionErrorMessage);
            return true; // Return true indicating a direction command was processed
        }
    }
    return false; // Return false indicating this was not a direction command
}

function handleDescriptionToggle(input) {
    let toggleMessage = '';
    if (input === "verbose") {
        currentState.descriptions = 'verbose';
        addParserResponse("Verbose descriptions on.");
        displayRoom(currentState.currentRoom, true);  // Display the current room description as if 'look' was used
    } else if (input === "brief") {
        currentState.descriptions = 'brief';
        addParserResponse("Brief descriptions only. Type \"look\" for longer descriptions of previously visited places.");
    }
}

function randomResponse(responses) {
    return responses[Math.floor(Math.random() * responses.length)];
}

function handleOtherCommands(input) {
    const normalizedInput = input.trim().toLowerCase();
    
    if (normalizedInput === "look" || normalizedInput === "look around") {
        displayRoom(currentState.currentRoom, true); // Force full description display
        updateMoveCount();
    } else if (normalizedInput === "verbose" || normalizedInput === "brief") {
        handleDescriptionToggle(normalizedInput); // Handle description setting toggle
    } else if (normalizedInput === "restart") {
        handleRestart(normalizedInput); // Handle restart command
    } else if (normalizedInput === "score") {
        handleScoreCommand();  // Handle score command
    } else if (normalizedInput === "wait") {
        handleWaitCommand();  // Handle score command
    } else {
        handleRandomResponses(); // Handle all other unrecognized commands
    }
}