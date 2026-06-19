const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// تحديد الملفات الثابتة (امتداد المجلد الحالي لملفات HTML و CSS)
app.use(express.static(path.join(__dirname, '/')));

// تخزين الغرف والمستخدمين النشطين
const rooms = {};

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // حدث الانضمام للغرفة
    socket.on('join room', (data) => {
        const { username, room, password, videoUrl } = data;

        if (!room || !username) {
            return socket.emit('join error', 'Missing room name or username.');
        }

        // إذا كانت الغرفة موجودة والرمز غير صحيح
        if (rooms[room] && rooms[room].password !== password) {
            return socket.emit('join error', 'Incorrect Room Password!');
        }

        // إنشاء الغرفة لو غير موجودة
        if (!rooms[room]) {
            rooms[room] = {
                password: password,
                videoUrl: videoUrl || "",
                users: []
            };
        }

        // تسجيل بيانات المستخدم على نفس السوكت للرجوع لها
        socket.username = username;
        socket.roomName = room;

        // الانضمام الفعلي لقنوات Socket.io
        socket.join(room);
        rooms[room].users.push({ id: socket.id, username });

        // تأكيد نجاح الدخول وإرسال الرابط الحالي للغرفة
        socket.emit('join success', { videoUrl: rooms[room].videoUrl });

        // إشعار بقية المستخدمين بدخول مستخدم جديد للدردشة
        io.to(room).emit('system notification', { text: `🔔 ${username} has joined the room!` });

        // تحديث قائمة المتواجدين أونلاين في الغرفة
        io.to(room).emit('update users', rooms[room].users);
    });

    // التحكم بالفيديو ومزامنته (تشغيل / إيقاف مؤقت / تقديم)
    socket.on('video action', (data) => {
        const room = socket.roomName;
        if (room) {
            // تخزين الرابط الجديد في حال تم تغييره برمجياً داخل الغرفة
            if (data.type === 'change_src') {
                rooms[room].videoUrl = data.url;
            }
            // بث الحركة لبقية المتواجدين في نفس الغرفة دون مرسلها
            socket.to(room).emit('video action', data);
        }
    });

    // إرسال واستقبال رسائل Live Chat
    socket.on('chat message', (text) => {
        const room = socket.roomName;
        const username = socket.username;
        if (room && username) {
            socket.to(room).emit('chat message', { username, text });
        }
    });

    // تتبع حالة الكتابة (Typing Indicator)
    socket.on('typing', (isTyping) => {
        const room = socket.roomName;
        const username = socket.username;
        if (room && username) {
            socket.to(room).emit('typing', { username, isTyping });
        }
    });

    // التعامل مع قطع الاتصال وخروج المستخدم
    socket.on('disconnect', () => {
        const room = socket.roomName;
        const username = socket.username;

        if (room && rooms[room]) {
            // فلترة وحذف المستخدم المغادر من الغرفة
            rooms[room].users = rooms[room].users.filter(user => user.id !== socket.id);
            
            // إرسال تنبيه في المحادثة بخروج المستخدم
            io.to(room).emit('system notification', { text: `🚪 ${username} has left the room.` });
            
            // تحديث شارات المتواجدين
            io.to(room).emit('update users', rooms[room].users);

            // حذف الغرفة بالكامل من الذاكرة إذا أصبحت فارغة لتوفير موارد الخادم
            if (rooms[room].users.length === 0) {
                delete rooms[room];
                console.log(`Room [${room}] is empty and has been deleted.`);
            }
        }
        console.log(`User disconnected: ${socket.id}`);
    });
});

// تحديد منفذ التشغيل (Port 3000)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running perfectly on http://localhost:${PORT}`);
});