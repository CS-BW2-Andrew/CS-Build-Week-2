// *** First: specify the required files and dependencies ***

require('dotenv').config();
// Allows you to use window.fetch functionality in node
const fetch = require('node-fetch');
// Stores JSON data in the file system (no database needed)
const storage = require('node-persist');

// *** Second: create the helper functions ***

function sleep(ms) {
    // Docs say a "delay" is required between moves
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Function used to update endpoint and pass in relevant data
async function callEndpoint(endpoint, method, data) {
    try {
        // Fetch the data from our endpoint
        let res = await fetch(
            `https://lambda-treasure-hunt.herokuapp.com/api/${endpoint}/`,
            {
                method: `${method}`,
                headers: { Authorization: `Token ${process.env.TOKEN}` },
                body: JSON.stringify(data)
            }
        )
        // Convert the data to JSON 
        res = await res.json()
        // Instructions specify to add a delay between actions
        await sleep(res.cooldown * 1000)
        // Print res to console so we can keep up with the player
        console.log('Res in call endpoint: ', res);
        return res;
    // Handle any errors
    } catch (err) {
        console.log('Error in call endpoint: ', err);
    }
}

// Flip the directions when we reach a dead-end so it's easy to turn around and retrace steps
function change_direction(direction) {
    if (direction === 'n') return 's';
    else if (direction === 's') return 'n';
    else if (direction === 'e') return 'w';
    else if (direction === 'w') return 'e';
}

// *** Third: begin the game ***

async function game() {
    // Initialize our storage object
    await storage.init();

    // If we haven't yet retrieved the unique username associated with this token...
    if(!(await storage.getItem(`${process.env.NAME}'s-traveled`))) {
        // Set that information and keep track of the rooms traveled
        await storage.setItem(`${process.env.NAME}'s-traveled`, []);
    }

    // Assign the same storage device to "traveled" so we can update conveniently 
    let traveled = await storage.getItem(`${process.env.NAME}'s-traveled`);

    // If we haven't yet retrieved the map (available directions) associated with the same user/token...
    if (!(await storage.getItem(`${process.env.NAME}'s-map`))) {
        // Set that information and keep track of all the valid/unexplored paths
        await storage.setItem(`${process.env.NAME}'s-map`, {});
    }

    // Assign the same storage device to "visited" so we can update conveniently
    let visited = await storage.getItem(`${process.env.NAME}'s-map`);

    // While we haven't yet visited all 500 rooms...
    while (Object.keys(visited).length <= 500) {
        // Print an update of the total rooms visited after checking every direction in each room
        console.log(`Total rooms visited: ${Object.keys(visited).length} \n`);

        // Create a variable containing the player's relevant statistics (stored on /status)
        const player = await callEndpoint('adv/status', 'post');

        // Create a variable containing the room data -- ID, items, directions, coordinates, etc -- stored on /init
        let current_room = await callEndpoint('adv/init', 'get');

        // Check to see if the room has any items or treasure + player has enough strength left to carry it
        if (current_room.items.length && player.encumbrance < player.strength && parseInt(player.gold) <= 1000) {
            // If all of the above are true, take all the treasure
            for (let treasure of current_room.items) {
                // Take all the treasure by posting the { item: name } to /take
                await callEndpoint('adv/take', 'post', { name: treasure });
                // Update the console every time our brave explorer finds new treasure
                console.log(`Oh boy, treasure: ${treasure} \n`);
            }
        }

        // Grab the ID associated with the current room and assign to a variable so we can update it
        let current_room_id = current_room.room_id;

        // ** Fourth: specify what should happen when we reach the key rooms ***

        // If we made it to Pirate Ry (where we can change our name)...
        if (current_room.title.includes('Pirate Ry')) {
            // Update the room ID
            await storage.setItem('Pirate-Ry', current_room_id);
            // Confirm the update registered
            console.log(`Made it to Pirate Ry: ${current_room_id}`);
            
            // Assuming we have enough gold (at least 1000), purachase a new name
            if (parseInt(player.gold) >= 1000) {
                // Call the endpoint to change our name
                await callEndpoint('adv/change_name', 'post', {
                    // Should change name to "daniel" as stored in .env
                    name: process.env.NAME,
                    confirm: 'aye'
                })
                // Confirm the name change was successful
                console.log(`Changed name! \n`)
            }
        }

        // If we made it to the shop...
        if (current_room.title.includes('Shop')) {
            // Update the room ID
            await storage.setItem('Shop', current_room_id);
            // Confirm update was successful
            console.log(`Made it to the shop! \n`);

            // If the player has any treasure ("encumbrance") to sell...
            for (let i = 0; i < parseInt(player.encumbrance); i++) {
                // Call the endpoint to sell our treasure
                await callEndpoint('adv/sell', 'post', {
                    name: 'treasure',
                    confirm: 'yes'
                })
                // Confirm the sell was successful
                console.log(`Sold treasure! \n`);
            }
        }

        // If we made it to the well...
        if (current_room.description.includes('EXAMINE WELL')) {
            // Update the room ID
            await storage.setItem('Well', current_room_id);
            // Confirm update was successful
            console.log(`Made it to the well! \n`);
            // Call the endpoint to obtain our clue
            await callEndpoint('adv/examine', 'post', {
                name: 'item'
            })
            // Make sure we were indeed successful
            console.log('Got our clue from the well!');
        }

        // ** Fifth: now take care of the less important (random) room traversal logic ***

        // If the current room ID hasn't been visited...
        if (!(current_room_id in visited)) {
            // Assign an empty object to this room
            visited[current_room_id] = {};
            // For the exits in the current room...
            for (let i = 0; i < current_room.exits.length; i++) {
                // Assign to a question mark (indicates they haven't been explored)
                visited[current_room_id][current_room.exits[i]] = '?';
            }
        }

        // Initialize an empty array for the rooms we haven't visited
        let unvisited = [];
       
        // Update (set) storage with the visited items
        await storage.setItem(`${process.env.NAME}'s-map`, visited);

        // For each direction in the current room we are visiting
        for (direction in visited[current_room_id]) {
            // If a certain direction hasn't been explored (=== '?')
            if (visited[current_room_id][direction] === '?') {
                // Push that direction to the unvisited array
                unvisited.push(direction);
            }
        }

        // If we haven't visited every direction pushed to unvisited yet...
        if (unvisited.length > 0) {

            // Use Math.floor and random to calculate an index from unvisited and assign to direction
            let direction = unvisited[Math.floor(Math.random() * unvisited.length)];
            
            // Call the move endpoint, pass in the direction, and assign to new room
            let new_room = await callEndpoint('adv/move', 'post', {
                direction: direction
            });

            // If we've explored every direction in the current room...
            if (traveled[traveled.length - 1] != current_room_id) {
                // Push the current ID to our list of traveled rooms
                traveled.push(current_room_id);
            }

            // Reset our storage object to include newly/fully traveled rooms
            await storage.setItem(`${process.env.NAME}'s-traveled`, traveled);
            
            // Grab and assign the ID belonging to our new room
            let new_room_id = new_room.room_id;
            // Specify the direction you must take from current visited room to reach it
            visited[current_room_id][direction] = new_room_id;
           
            // If it hasn't been visited yet...
            if (!(new_room_id in visited)) {
                // Assign an empty object to the visited new room's id (same thing we did for current earlier)
                visited[new_room_id] = {};
                // For all the exits available in the new room (ditto)...
                for (let i = 0; i < new_room.exits.length; i++) {
                    // Assign a question mark to indicate the [exit] hasn't been visited
                    visited[new_room_id][new_room.exits[i]] = '?';
                }
            }

            // Specify what happens when you hit a dead end: change(direction) and assign to turn_around
            let turn_around = change_direction(direction);
            // Attach the opposite direction to visited new room and assign to current room's ID
            visited[new_room_id][turn_around] = current_room_id;
            // Reset the map of our storage object and pass in visited
            await storage.setItem(`${process.env.NAME}'s-map`, visited);

            // Repeat the conditions RE: picking up treasure to make sure we don't miss any while backtracking
            if (current_room.items.length && player.encumbrance < player.strength && parseInt(player.gold) <= 1000) {
                // If all of the above are true, take all the treasure
                for (let treasure of current_room.items) {
                    // Take all the treasure
                    await callEndpoint('adv/take', 'post', { name: treasure });
                    // Confirm the /take endpoint works
                    console.log(`Oh boy, treasure: ${treasure} \n`);
                }
            } 

        // Otherwise (we've explored every possible direction you can take from here)...)
        } else {
            // Pop the last item off traveled and assign to go_back
            let go_back = traveled.pop();

            // For each direction within the visited array of the updated room...
            for (direction in visited[current_room_id]) {

                // If we have effectively turned around (directions in current room match go_back)...
                if (visited[current_room_id][direction] === go_back) {
                    // Call the move endpoint to continue exploring
                    await callEndpoint('adv/move', 'post', {
                        // Pass in the direction that was taken
                        direction: direction,
                        // Stringify the response and assign to next_room_id
                        next_room_id: JSON.stringify(go_back)
                    })

                    // Copy the "take items" logic one last time to make sure we don't leave any treasure behind
                    if (current_room.items.length && player.encumbrance < player.strength && parseInt(player.gold) <= 1000) {
                        // If all of the above are true, take all the treasure
                        for (let treasure of current_room.items) {
                            // Take all the treasure
                            await callEndpoint('adv/take', 'post', { name: treasure });
                            // Confirm the /take endpoint works
                            console.log(`Oh boy, treasure: ${treasure} \n`);
                        }
                    }
                }
            }
        }

        // Continuously update our map (directions) and traveled (rooms) storage objects while the loop is active
        await storage.setItem(`${process.env.NAME}'s-map`, visited);
        await storage.setItem(`${process.env.NAME}'s-traveled`, traveled);
    }
} 

// Call the game function globally so it will run until loop is complete
game();