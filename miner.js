// *** First: specify required dependencies ***
require('dotenv').config();
const fetch = require('node-fetch');
const shajs = require('sha.js');

// *** Second: create the necessary helper functions ***

function sleep(ms) {
    // ReadMe says a "pause" must occur between movements
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Handle the endpoints
async function callEndpoint(endpoint, method, data) {
    try {
        // Fetch the resolution
        let res = await fetch(
            // Dynamic URL so we can use different endpoints
            `https://lambda-treasure-hunt.herokuapp.com/api/${endpoint}/`,
            {
                method: `${method}`,
                // Confirm the user should be able to access the page
                headers: { Authorization: `Token ${process.env.TOKEN}` },
                // Convert the body (object data) into a JSON string
                body: JSON.stringify(data)
            }
        )
        // Grab the status
        let status = res.status;
        // Grab the object, turn into JSON
        let obj = await res.json();
        // Destructure the object and pass this along with status to result
        let result = { ...obj, status };
        // Take the specified "cooldown" period
        await sleep(obj.cooldown * 1000);
        // Confirm we are getting the right resolution
        console.log('Res from Miner: ', res);
        return result;
    // Error handling
    } catch (err) {
        console.log('Error from miner: ', err);
    }
}

// Proof validation
function validate_proof(last_proof, proof, difficulty) {
    // Use the sha256 hash library to update current/last proof, then make it hexadecimal
    let hash = shajs('sha256').update(`${last_proof}${proof}`).digest('hex');
    // Return (repeat) an amount of zeroes that match the given difficulty level
    return hash.substring(0, difficulty) === '0'.repeat(difficulty);
}

// *** Third: create the main workhorse function to mine blocks ***

async function miner() {
    // While it's true there is stuff to be mined...
    while (true) {
        // Get the last block from the endpoint
        let last_block = await callEndpoint('bc/last_proof', 'get');
        // Parse the attached .proof and assign to a variable
        let last_proof = parseInt(last_block.proof);
        // Grab the assigned difficulty level
        let difficulty = last_block.difficulty;
        // Assign last_proof to proof
        let proof = last_proof;
        // Make placeholder variable used to confirm proof is valid
        let is_valid = false;
        // Print to console so we know it works
        console.log('Please hold while we validate the proof...');
        // While we *do* have a valid proof...
        while (!is_valid) {
            // Increment proof +1
            proof += 1;
            // Assign the validation function to is_valid
            is_valid = validate_proof(last_proof, proof, difficulty);
        }
        // Confirm validation was successful
        console.log('Validation complete. Proof is ', proof);
        // Call / post to the /mine endpoint, pass in our proof, assign to mine
        let mine = await callEndpoint('bc/mine', 'post', {
            proof
        })
        // If we received a status 200, confirm the proof was mined
        if (mine.status === 200) console.log('Mined the proof!');
        // Exit the function
        break;
    }
}

// Call miner globally so it runs until we access a valid proof
miner();