from time import sleep
from actions import *

flip_directions = {'n': 's', 's': 'n', 'e': 'w', 'w': 'e'}
traversal_path = []
rooms_visited = 1
data = get_init()

while rooms_visited < 500:
    current_room = data['room_id']
    room_details = get_room_info(data)

    for key in room_data:
        rooms[current_room][key] = room_data[key]

# Stopping here because the logic looks pretty complex and I'd like help
