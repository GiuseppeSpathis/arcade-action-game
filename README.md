# arcade-action-game
This project is a 2D minimalist arcade game inspired by the fast-paced, arena-based gameplay of Flat Heroes. It was built from scratch as a computer science project, focusing on low-level browser APIs without the use of any game engines.

The entire game is rendered on HTML5 Canvas using requestAnimationFrame for a smooth 60 FPS animation loop. The project is built using ES6 Classes and Modules for a clean, object-oriented structure.

A primary feature is the 4-player local multiplayer mode, which uses Firebase Realtime Database to allow players 2-4 to connect and play using their smartphones as controllers.
## Main Features
This game was built with a focus on core web technologies. All graphics are drawn to the HTML5 Canvas, and the entire experience is structured using Object-Oriented Design with ES6 classes like PlayerController, TriangleEnemy, and Bullet. The gameplay is dynamic: players have three lives and can jump and shoot in four directions. They face reactive enemies, including a flying Triangle that shoots projectiles, a "seek and destroy" Circle that inflicts touch damage, and a ground-based Square that can jump over obstacles. A key "stretch goal" implemented is the Firebase-powered 4-player local multiplayer. This system allows Player 1 to use the keyboard while up to three others join using a web-based controller on their phones, with all inputs synced in real-time. The game also features background music and sound effects managed via the Web Audio API, along with custom-written physics and collision detection.



- Firebase Multiplayer (4P Local): A key "stretch goal" that was implemented. Player 1 uses the keyboard, while up to 3 other players can join by connecting their phones to a web-based controller, which syncs inputs via Firebase.

- Audio: The game includes background music for the menu and main scenario, as well as sound effects for player hits and game over, managed via the Web Audio API.

- Custom Physics & Collision: All physics (gravity, acceleration) and A-to-B collision detection logic were written from scratch.

## How to Play

#### Single Player (Player 1)

- Move: A / D keys

- Jump: Spacebar / W key

- Shoot: Arrow Keys (Up, Down, Left, Right)

#### Local Multiplayer (Players 2-4)
This mode requires all devices (the host laptop and player smartphones) to be connected to the same Wi-Fi network.
1. Host Setup (Laptop)
   - From the main menu, select "2 Players", "3 Players", or "4 Players".
   - A lobby screen will appear, showing a 4-letter Room Code.
2. Player Setup (Smartphone)
   - On your phone, find the host laptop's Local IP Address (e.g., 192.168.1.10).
   - Open your phone's web browser and navigate to: http://[LAPTOP_IP_ADDRESS]:[PORT]/scenario/controller/phoneController.html (Example: http://192.168.1.10:5500/scenario/controller/phoneController.html)
   - Enter the 4-letter Room Code from the laptop screen and select your player slot (P2, P3, or P4) and then press Connect.
Once all players are connected, the game will start automatically. Use the on-screen D-pads for moving and shooting and the "JUMP" button to jump.

#### Code Overview
The project is structured with a clear separation of concerns. The /menu/ directory handles the main menu and player-count selection. The core of the game resides in /scenario/, where scenario.js acts as the main game engine, controlling the render loop, managing game state, and initializing all objects from the constants.json file. The /scenario/helper/ directory contains the core gameplay classes, including player.js for player logic, map.js for dynamic platform generation, and bullet.js. The different enemy classes (circle.js, triangle.js, square.js) are defined in /scenario/enemies/. The multiplayer functionality is split between /scenario/controller/phoneController.html, which is the mobile controller interface, and /helper/firebaseRemoteController.js, which manages the host-side Firebase connection, session creation, and input listening. Finally, /helper/audioController.js is a simple module for managing sound.

#### External Resources
The project used Google Firebase for its Realtime Database to sync controller inputs for the multiplayer mode. All background music and sound effects (hit, game over) were sourced from Pixabay Music (https://pixabay.com/fr/music/search/arcade%20game/).
