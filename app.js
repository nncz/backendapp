const express = require('express');
const mysql = require('mysql');
const os = require('os');
const bcrypt = require('bcryptjs');

const app = express();

// Middleware for parsing JSON requests
app.use(express.json());

// Database connection details
const hostname = "ohdz4.h.filess.io";
const database = "delivery_busybeside";
const port = "3306";
const username = "delivery_busybeside";
const password = "5b61c1ac975712bfc22fcd008a77de81f6bf90b3";

// Create a MySQL connection
const con = mysql.createConnection({
  host: hostname,
  user: username,
  password: password,
  database: database,
  port: port,
});

// Connect to the database
con.connect(function (err) {
  if (err) throw err;
  console.log("Connected to the database!");
});

// Route for /getall to get all users
app.get('/users', (req, res) => {
  const sql = 'SELECT * FROM users';  // SQL query to select all users
  con.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(200).json(results);  // Send the results as JSON response
  });
});

// สมัครสมาชิกผู้ใช้ (User)
app.post('/user', async (req, res) => {
  const { phone_number, password, name, profile_picture, address, gps_location } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10); // Hash password
  const sql = 'INSERT INTO users (phone_number, password, name, profile_picture, address, gps_location) VALUES (?, ?, ?, ?, ?, ?)';
  con.query(sql, [phone_number, hashedPassword, name, profile_picture, address, gps_location.lat, gps_location.lng], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: 'User registered successfully!', userId: results.insertId });
  });
});

app.get('/user/id/:userId', (req, res) => {
  const { userId } = req.params; // รับ user_id จาก URL

  // SQL Query สำหรับค้นหาผู้ใช้ตาม user_id
  const sql = 'SELECT * FROM users WHERE user_id = ?';

  // รัน Query เพื่อดึงข้อมูลจากฐานข้อมูล
  con.query(sql, [userId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message }); // หากเกิดข้อผิดพลาด
    }

    // ตรวจสอบว่ามีข้อมูลหรือไม่
    if (results.length > 0) {
      // ส่งข้อมูลผู้ใช้กลับไป
      res.status(200).json(results[0]); // ส่งข้อมูลของผู้ใช้คนแรกที่พบ
    } else {
      res.status(404).json({ message: 'User not found' }); // หากไม่พบข้อมูล
    }
  });
});

// สมัครสมาชิกไรเดอร์ (Rider)
app.post('/rider', async (req, res) => {
  const { phone_number, password, name, profile_picture, vehicle_registration} = req.body;
  const hashedPassword = await bcrypt.hash(password, 10); // Hash password
  const sql = 'INSERT INTO riders (phone_number, password, name, profile_picture, vehicle_registration) VALUES (?, ?, ?, ?, ?)';
  con.query(sql, [phone_number, hashedPassword, name, profile_picture, vehicle_registration], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: 'Rider registered successfully!', riderId: results.insertId });
  });
});


// การเข้าสู่ระบบ (Login)
app.post('/login', (req, res) => {
  console.log(req.body); // ตรวจสอบข้อมูลที่ส่งเข้ามา
  const { phone_number, password } = req.body;

  if (!phone_number || !password) {
    return res.status(400).json({ message: 'กรุณากรอกหมายเลขโทรศัพท์และรหัสผ่าน' });
  }

  // ค้นหาผู้ใช้ในตาราง User
  const userSql = 'SELECT user_id, name, password FROM users WHERE phone_number = ?';
  con.query(userSql, [phone_number], async (err, userResults) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    console.log(userResults);
    // ถ้าเจอผู้ใช้ในตาราง User
    if (userResults.length > 0) {
      const match =  bcrypt.compare(password, userResults[0].password); // เปรียบเทียบรหัสผ่าน

      console.log('User password match:', match); // เพิ่มการตรวจสอบที่นี่

      if (match) {
        return res.status(200).json({
          message: 'Login successful!',
          user: { id: userResults[0].user_id, name: userResults[0].name, role: 'user' }
        });
      } else {
        return res.status(401).json({ message: 'หมายเลขโทรศัพท์หรือรหัสผ่านไม่ถูกต้อง' });
      }
    }

    // ถ้าไม่เจอในตาราง User ให้ค้นหาในตาราง Rider
    const riderSql = 'SELECT rider_id, name, password FROM riders WHERE phone_number = ?';
    con.query(riderSql, [phone_number], async (err, riderResults) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // ถ้าเจอผู้ใช้ในตาราง Rider
      if (riderResults.length > 0) {
        const match = bcrypt.compare(password, riderResults[0].password); // เปรียบเทียบรหัสผ่าน

        console.log('Rider password match:', match); // เพิ่มการตรวจสอบที่นี่

        if (match) {
          return res.status(200).json({
            message: 'Login successful!',
            user: { id: riderResults[0].rider_id, name: riderResults[0].name, role: 'rider' }
          });
        } else {
          return res.status(401).json({ message: 'หมายเลขโทรศัพท์หรือรหัสผ่านไม่ถูกต้อง' });
        }
      }

      // ถ้าไม่เจอทั้งในตาราง User และ Rider
      return res.status(401).json({ message: 'หมายเลขโทรศัพท์หรือรหัสผ่านไม่ถูกต้อง' });
    });
  });
});

app.get('/user/:phone', (req, res) => {
  const { phone } = req.params; // รับเบอร์โทรศัพท์จาก URL

  // SQL Query สำหรับค้นหาผู้ใช้ตามเบอร์โทรศัพท์ โดยเลือกเฉพาะคอลัมน์ที่ต้องการ
  const sql = 'SELECT name, profile_picture, address, gps_location FROM users WHERE phone_number = ?';

  // รัน Query เพื่อดึงข้อมูลจากฐานข้อมูล
  con.query(sql, [phone], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message }); // หากเกิดข้อผิดพลาด
    }

    // ตรวจสอบว่ามีข้อมูลหรือไม่
    if (results.length > 0) {
      // ส่งข้อมูลที่ต้องการกลับไป
      res.status(200).json(results[0]); // ส่งข้อมูลของผู้ใช้คนแรกที่พบ
    } else {
      res.status(404).json({ message: 'User not found' }); // หากไม่พบข้อมูล
    }
  });
});



// สร้างออร์เดอร์การส่งสินค้า
app.post('/delivery', (req, res) => {
  const { sender_id, receiver_phone, item_details, pickup_location, delivery_location } = req.body;
  const sql = 'INSERT INTO delivery (sender_id, receiver_phone, item_details, pickup_location, delivery_location) VALUES (?, ?, ?, POINT(?, ?), POINT(?, ?))';
  con.query(sql, [sender_id, receiver_phone, item_details, pickup_location.lat, pickup_location.lng, delivery_location.lat, delivery_location.lng], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: 'Delivery order created successfully!', deliveryId: results.insertId });
  });
});

// ไรเดอร์รับงาน
app.put('/rider/:rider_id/assign/:delivery_id', (req, res) => {
  const { rider_id, delivery_id } = req.params;
  const sql = 'INSERT INTO rider_assignment (rider_id, delivery_id, status) VALUES (?, ?, "assigned")';
  con.query(sql, [rider_id, delivery_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json({ message: 'Rider assigned to delivery!', assignmentId: results.insertId });
  });
});

// อัปเดตสถานะการจัดส่ง
app.put('/delivery/:delivery_id/status', (req, res) => {
  const { status, gps_location, photo } = req.body;
  const { delivery_id } = req.params;
  const sql = 'UPDATE delivery SET status = ?, gps_location = POINT(?, ?), photo = ? WHERE id = ?';
  con.query(sql, [status, gps_location.lat, gps_location.lng, photo, delivery_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json({ message: 'Delivery status updated successfully!' });
  });
});

// ดูสถานะและติดตามการจัดส่ง
app.get('/delivery/:delivery_id', (req, res) => {
  const { delivery_id } = req.params;
  const sql = 'SELECT d.*, r.name AS rider_name, ST_AsText(d.gps_location) AS current_location FROM delivery d LEFT JOIN rider_assignment ra ON d.id = ra.delivery_id LEFT JOIN rider r ON ra.rider_id = r.id WHERE d.id = ?';
  con.query(sql, [delivery_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json(results[0]);
  });
});

// Get the IP address of the server
const getIpAddress = () => {
  const interfaces = os.networkInterfaces();
  let ipAddress = '0.0.0.0';
  
  for (let iface in interfaces) {
    for (let alias of interfaces[iface]) {
      if (alias.family === 'IPv4' && !alias.internal) {
        ipAddress = alias.address;
        break;
      }
    }
  }
  return ipAddress;
};

// Start the server
const serverPort = 3306;  // You can adjust the server port if needed
app.listen(serverPort, () => {
  const ip = getIpAddress();
  console.log(`Server is running on http://${ip}:${serverPort}`);
});

app.get('/deliveries', (req, res) => {
  const sql = 'SELECT * FROM deliveries';
  
  con.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json({ deliveries: results });
  });
});
