const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '/')));

const rooms = {};

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('join room', (data) => {
        // Updated to receive photo from Google Sign-In
        const { username, photo, room, password, videoUrl } = data;

        if (!room || !username) {
            return socket.emit('join error', 'Missing room details.');
        }

        if (rooms[room] && rooms[room].password !== password) {
            return socket.emit('join error', 'Incorrect Room Password!');
        }

        // If room doesn't exist, create it and make this user the Host
        let assignAsHost = false;
        if (!rooms[room]) {
            rooms[room] = {
                password: password,
                videoUrl: videoUrl || "",
                hostId: socket.id, // Store the Host's socket ID
                users: []
            };
            assignAsHost = true;
        }

        socket.username = username;
        socket.userPhoto = photo || ""; // Save user photo in socket instance
        socket.roomName = room;
        socket.isHost = assignAsHost || (rooms[room].hostId === socket.id);
        
        socket.join(room);
        
        // Push user details including photo and host status to the array
        rooms[room].users.push({ 
            id: socket.id, 
            username, 
            photo: socket.userPhoto, 
            isHost: socket.isHost 
        });

        // Send confirmation back with videoUrl and host status
        socket.emit('join success', { 
            videoUrl: rooms[room].videoUrl,
            isHost: socket.isHost
        });

        io.to(room).emit('system notification', { text: `🔔 ${username} has entered the party!` });
        io.to(room).emit('update users', rooms[room].users);
    });

    socket.on('video action', (data) => {
        const room = socket.roomName;
        if (room && rooms[room]) {
            // Only allow video control actions if the sender is the official Host of the room
            if (socket.isHost && rooms[room].hostId === socket.id) {
                if (data.type === 'change_src') rooms[room].videoUrl = data.url;
                socket.to(room).emit('video action', data);
            } else {
                // Optional: Inform non-host users they cannot control the player
                socket.emit('system notification', { text: `⚠️ Only the host can control the video.` });
            }
        }
    });

    socket.on('chat message', (text) => {
        const room = socket.roomName;
        if (room && socket.username) {
            // Updated to send username and profile photo with the chat message
            io.to(room).emit('chat message', { 
                username: socket.username, 
                photo: socket.userPhoto, 
                text 
            });
        }
    });

    socket.on('typing', (isTyping) => {
        const room = socket.roomName;
        if (room && socket.username) {
            socket.to(room).emit('typing', { username: socket.username, isTyping });
        }
    });

    socket.on('disconnect', () => {
        const room = socket.roomName;
        if (room && rooms[room]) {
            rooms[room].users = rooms[room].users.filter(u => u.id !== socket.id);
            io.to(room).emit('system notification', { text: `🚪 ${socket.username} has left.` });
            
            // If the host disconnects, assign a new host from remaining users
            if (socket.isHost && rooms[room].users.length > 0) {
                const newHost = rooms[room].users[0];
                rooms[room].hostId = newHost.id;
                newHost.isHost = true;
                
                // Find the socket of the new host and update its property
                const newHostSocket = io.sockets.sockets.get(newHost.id);
                if (newHostSocket) newHostSocket.isHost = true;

                io.to(room).emit('system notification', { text: `👑 ${newHost.username} is now the host of the room!` });
            }

            io.to(room).emit('update users', rooms[room].users);

            if (rooms[room].users.length === 0) delete rooms[room];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running perfectly on port ${PORT}`);
});