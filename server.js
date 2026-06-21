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
        const { username, room, password, videoUrl } = data;

        if (!room || !username) {
            return socket.emit('join error', 'Missing room details.');
        }

        if (rooms[room] && rooms[room].password !== password) {
            return socket.emit('join error', 'Incorrect Room Password!');
        }

        if (!rooms[room]) {
            rooms[room] = {
                password: password,
                videoUrl: videoUrl || "",
                users: []
            };
        }

        socket.username = username;
        socket.roomName = room;
        socket.join(room);
        
        rooms[room].users.push({ id: socket.id, username });

        socket.emit('join success', { videoUrl: rooms[room].videoUrl });
        io.to(room).emit('system notification', { text: `🔔 ${username} has entered the party!` });
        io.to(room).emit('update users', rooms[room].users);
    });

    socket.on('video action', (data) => {
        const room = socket.roomName;
        if (room) {
            if (data.type === 'change_src') rooms[room].videoUrl = data.url;
            socket.to(room).emit('video action', data);
        }
    });

    socket.on('chat message', (text) => {
        const room = socket.roomName;
        if (room && socket.username) {
            socket.to(room).emit('chat message', { username: socket.username, text });
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
            io.to(room).emit('update users', rooms[room].users);

            if (rooms[room].users.length === 0) delete rooms[room];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running perfectly on port ${PORT}`);
});