const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

const roomsData = {};

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    let currentRoom = null;
    let currentUsername = null;

    socket.on('join room', (data) => {
        currentRoom = data.room;
        currentUsername = data.username;
        const roomPassword = data.password;

        if (!roomsData[currentRoom]) {
            roomsData[currentRoom] = {
                password: roomPassword,
                users: [],
                videoUrl: data.videoUrl || ""
            };
        } else {
            if (roomsData[currentRoom].password !== roomPassword) {
                return socket.emit('join error', 'Incorrect password for this room!');
            }
        }

        socket.join(currentRoom);
        roomsData[currentRoom].users.push({ id: socket.id, username: currentUsername });

        socket.emit('join success', { videoUrl: roomsData[currentRoom].videoUrl });

        io.to(currentRoom).emit('system notification', {
            text: `✨ ${currentUsername} has entered the theater!`
        });

        io.to(currentRoom).emit('update users', roomsData[currentRoom].users);
    });

    socket.on('video action', (data) => {
        if (currentRoom) {
            socket.to(currentRoom).emit('video action', data);
        }
    });

    socket.on('chat message', (msg) => {
        if (currentRoom) {
            socket.to(currentRoom).emit('chat message', {
                username: currentUsername,
                text: msg
            });
        }
    });

    socket.on('typing', (isTyping) => {
        if (currentRoom) {
            socket.to(currentRoom).emit('typing', {
                username: currentUsername,
                isTyping: isTyping
            });
        }
    });

    socket.on('disconnect', () => {
        if (currentRoom && roomsData[currentRoom]) {
            roomsData[currentRoom].users = roomsData[currentRoom].users.filter(u => u.id !== socket.id);
            io.to(currentRoom).emit('system notification', { text: `❌ ${currentUsername} left the theater.` });
            io.to(currentRoom).emit('update users', roomsData[currentRoom].users);
            if (roomsData[currentRoom].users.length === 0) {
                delete roomsData[currentRoom];
            }
        }
    });
});

// هذا السطر مهم جداً للرفع على السيرفرات الخارجية مثل Render
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 RAFA Server running on port ${PORT}`);
});