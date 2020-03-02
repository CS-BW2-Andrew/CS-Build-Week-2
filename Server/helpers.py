import json

def get_room_info(data):
    room = {}
    room_details = ['room_id', 'title', 'coordiates', 'description', 'terrain', 'elevation', 'exits', 'items']
    for deet in room_details:
        room[value] = data[value]
    return room

def create_map(room_count = 500):
    rooms = {}
    for i in range(room_count):
        rooms[i] = {
            "n": None,
            "s": None,
            "e": None,
            "w": None,
            "title": None,
            "terrain": None,
            "elevation": None,
            "coordinates": None,
            "description": None
        }  
    return rooms

def print_map(data, file):
    with open(file, 'w') as output:
        json.dump(data, output)

def json_map(file):
    with open(file) as jfile:
        file = json.load(jfile)
    return file

def identify_directions(exits, current_room):
    unvisited = []
    for direction in exits:
        if current_room[direction] is None:
            unvisited.append(direction)
    return unvisited