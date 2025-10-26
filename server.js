// Budget API with MySQL for Both Budget Data and User Signup on Digital Ocean

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

// MySQL connection configuration for Digital Ocean droplet (for both budget and user data)
const mysqlConfig = {
    host: '143.198.136.197',
    user: 'mariaadmin',           // ← Your created MySQL user
    password: 'mariapassword123', // ← Your created password
    database: 'personal_budget',
    port: 3306,
    connectTimeout: 60000
};
// Create MySQL connection pool for all data
const mysqlPool = mysql.createPool(mysqlConfig);

// Function to initialize MySQL database for both budget and user data
async function initializeMySQL() {
    try {
        console.log('Connecting to MySQL database on Digital Ocean droplet...');
        
        // Test MySQL connection
        const connection = await mysqlPool.getConnection();
        console.log('✅ MySQL connected successfully to Digital Ocean');
        connection.release();
        
        // Create both budget and users tables
        await createTables();
        
        // Insert initial budget data
        await insertInitialBudgetData();
        
        console.log('✅ MySQL database initialized for both budget and user data');
    } catch (error) {
        console.error('❌ Error connecting to MySQL:', error);
        console.error('Make sure your MySQL server is running and accessible on Digital Ocean');
        console.error('Check your MySQL database configuration in server.js');
    }
}

// Function to create both budget and users tables in MySQL
async function createTables() {
    const createBudgetTable = `
        CREATE TABLE IF NOT EXISTS budget (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL UNIQUE,
            budget DECIMAL(10,2) NOT NULL,
            color VARCHAR(7) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `;

    const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE,
            first_name VARCHAR(255),
            last_name VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `;

    try {
        await mysqlPool.execute(createBudgetTable);
        console.log('✅ Budget table created or already exists in MySQL');
        
        await mysqlPool.execute(createUsersTable);
        console.log('✅ Users table created or already exists in MySQL');
    } catch (error) {
        console.error('❌ Error creating tables:', error);
    }
}

// Function to insert initial budget data into MySQL
async function insertInitialBudgetData() {
    try {
        // Check if budget data already exists
        const [existing] = await mysqlPool.execute('SELECT COUNT(*) as count FROM budget');
        
        if (existing[0].count > 0) {
            console.log('Budget data already exists in MySQL, skipping initial data insertion');
            return;
        }

        const initialBudgetData = [
            { title: "Eat out", budget: 52, color: "#FF6B6B" },
            { title: "Rent", budget: 604, color: "#4ECDC4" },
            { title: "Grocery", budget: 156, color: "#45B7D1" },
            { title: "Utilities", budget: 174, color: "#96CEB4" },
            { title: "Transportation", budget: 104, color: "#FFEAA7" },
            { title: "Entertainment", budget: 87, color: "#DDA0DD" },
            { title: "Savings", budget: 139, color: "#98D8C8" },
            { title: "Healthcare", budget: 70, color: "#F7DC6F" },
            { title: "Education", budget: 114, color: "#BB8FCE" }
        ];

        for (const item of initialBudgetData) {
            await mysqlPool.execute(
                'INSERT INTO budget (title, budget, color) VALUES (?, ?, ?)',
                [item.title, item.budget, item.color]
            );
        }
        
        console.log(`✅ Inserted ${initialBudgetData.length} initial budget items into MySQL`);
    } catch (error) {
        console.error('❌ Error inserting initial budget data into MySQL:', error);
    }
}

// GET /budget - Fetch all budget data from MySQL
app.get('/budget', async (req, res) => {
    try {
        const [rows] = await mysqlPool.execute('SELECT * FROM budget ORDER BY created_at DESC');
        
        // Format the response to match the original JSON structure
        const budgetData = {
            myBudget: rows
        };
        
        res.json(budgetData);
    } catch (error) {
        console.error('Error fetching budget data from MySQL:', error);
        res.status(500).json({ 
            error: 'Failed to fetch budget data from MySQL',
            message: error.message 
        });
    }
});

// POST /budget - Add new budget entry to MySQL
app.post('/budget', async (req, res) => {
    try {
        const { title, budget, color } = req.body;
        
        // Validate required fields
        if (!title || budget === undefined || budget === null || !color) {
            return res.status(400).json({ 
                error: 'All fields are required',
                message: 'Please provide title, budget, and color fields'
            });
        }

        // Validate budget is a positive number
        if (typeof budget !== 'number' || budget < 0) {
            return res.status(400).json({ 
                error: 'Invalid budget value',
                message: 'Budget must be a positive number'
            });
        }

        // Validate color format (hexadecimal with at least 6 digits)
        if (!/^#[0-9A-Fa-f]{6,8}$/.test(color)) {
            return res.status(400).json({ 
                error: 'Invalid color format',
                message: 'Color must be in hexadecimal format with at least 6 digits (e.g., #ED4523)'
            });
        }

        // Check if title already exists in MySQL
        const [existing] = await mysqlPool.execute('SELECT id FROM budget WHERE title = ?', [title.trim()]);
        if (existing.length > 0) {
            return res.status(409).json({ 
                error: 'Budget entry already exists',
                message: `A budget entry with title "${title}" already exists`
            });
        }

        // Insert new budget entry into MySQL
        const [result] = await mysqlPool.execute(
            'INSERT INTO budget (title, budget, color) VALUES (?, ?, ?)',
            [title.trim(), budget, color.toUpperCase()]
        );
        
        // Fetch the created entry
        const [newEntry] = await mysqlPool.execute('SELECT * FROM budget WHERE id = ?', [result.insertId]);
        
        res.status(201).json({
            message: 'Budget entry created successfully in MySQL',
            data: newEntry[0]
        });
        
    } catch (error) {
        console.error('Error creating budget entry in MySQL:', error);
        res.status(500).json({ 
            error: 'Failed to create budget entry in MySQL',
            message: error.message 
        });
    }
});

// POST /signup - User signup functionality with all user parameters
app.post('/signup', async (req, res) => {
    try {
        const { username, password, email, first_name, last_name } = req.body;
        
        // Validate required fields
        if (!username || !password) {
            return res.status(400).json({ 
                error: 'Username and password are required',
                message: 'Please provide both username and password'
            });
        }

        // Validate username length
        if (username.length < 3) {
            return res.status(400).json({ 
                error: 'Invalid username',
                message: 'Username must be at least 3 characters long'
            });
        }

        // Validate password length
        if (password.length < 6) {
            return res.status(400).json({ 
                error: 'Invalid password',
                message: 'Password must be at least 6 characters long'
            });
        }

        // Validate email format if provided
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ 
                error: 'Invalid email format',
                message: 'Please provide a valid email address'
            });
        }

        // Validate name fields if provided
        if (first_name && (first_name.length < 2 || first_name.length > 50)) {
            return res.status(400).json({ 
                error: 'Invalid first name',
                message: 'First name must be between 2 and 50 characters'
            });
        }

        if (last_name && (last_name.length < 2 || last_name.length > 50)) {
            return res.status(400).json({ 
                error: 'Invalid last name',
                message: 'Last name must be between 2 and 50 characters'
            });
        }

        // Check if username already exists in MySQL
        const [existingUser] = await mysqlPool.execute('SELECT id FROM users WHERE username = ?', [username.trim()]);
        if (existingUser.length > 0) {
            return res.status(409).json({ 
                error: 'Username already exists',
                message: 'This username is already taken. Please choose a different one.'
            });
        }

        // Check if email already exists (if provided) in MySQL
        if (email) {
            const [existingEmail] = await mysqlPool.execute('SELECT id FROM users WHERE email = ?', [email.trim()]);
            if (existingEmail.length > 0) {
                return res.status(409).json({ 
                    error: 'Email already exists',
                    message: 'This email is already registered. Please use a different email.'
                });
            }
        }

        // Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insert new user into MySQL with all user parameters
        const [result] = await mysqlPool.execute(
            'INSERT INTO users (username, password, email, first_name, last_name) VALUES (?, ?, ?, ?, ?)',
            [
                username.trim(), 
                hashedPassword, 
                email ? email.trim() : null,
                first_name ? first_name.trim() : null,
                last_name ? last_name.trim() : null
            ]
        );
        
        // Return success response (don't include password)
        res.status(201).json({
            message: 'User created successfully in MySQL on Digital Ocean',
            data: {
                id: result.insertId,
                username: username.trim(),
                email: email ? email.trim() : null,
                first_name: first_name ? first_name.trim() : null,
                last_name: last_name ? last_name.trim() : null,
                created_at: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Error creating user in MySQL:', error);
        res.status(500).json({ 
            error: 'Failed to create user in MySQL',
            message: error.message 
        });
    }
});

// POST /login - User login functionality
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Validate required fields
        if (!username || !password) {
            return res.status(400).json({ 
                error: 'Username and password are required',
                message: 'Please provide both username and password'
            });
        }

        // Find user in MySQL database
        const [users] = await mysqlPool.execute('SELECT * FROM users WHERE username = ?', [username.trim()]);
        
        if (users.length === 0) {
            return res.status(401).json({ 
                error: 'Invalid credentials',
                message: 'Username or password is incorrect'
            });
        }

        const user = users[0];

        // Compare password with hashed password
        const passwordMatch = await bcrypt.compare(password, user.password);
        
        if (!passwordMatch) {
            return res.status(401).json({ 
                error: 'Invalid credentials',
                message: 'Username or password is incorrect'
            });
        }

        // Login successful - return user data (without password)
        res.status(200).json({
            message: 'Login successful',
            data: {
                id: user.id,
                username: user.username,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                created_at: user.created_at
            }
        });
        
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ 
            error: 'Failed to login',
            message: error.message 
        });
    }
});

// GET /users - Get all users from MySQL (for testing purposes - remove in production)
app.get('/users', async (req, res) => {
    try {
        const [rows] = await mysqlPool.execute('SELECT id, username, email, first_name, last_name, created_at FROM users ORDER BY created_at DESC');
        
        res.json({
            message: 'Users retrieved successfully from MySQL on Digital Ocean',
            data: rows
        });
    } catch (error) {
        console.error('Error fetching users from MySQL:', error);
        res.status(500).json({ 
            error: 'Failed to fetch users from MySQL',
            message: error.message 
        });
    }
});

// GET /api/info - Information about available endpoints
app.get('/api/info', (req, res) => {
    res.json({
        message: 'Personal Budget API with MySQL on Digital Ocean',
        endpoints: {
            'GET /budget': 'Fetch all budget data from MySQL',
            'POST /budget': 'Add new budget entry to MySQL',
            'POST /signup': 'Create a new user account in MySQL',
            'POST /login': 'User login authentication',
            'GET /users': 'Get all users from MySQL (for testing)',
            'GET /api/info': 'Get API information'
        },
        database: {
            type: 'MySQL',
            host: '143.198.136.197',
            database: 'personal_budget',
            description: 'Stores both budget entries and user accounts'
        },
        schema: {
            budget: {
                title: 'string (required) - Budget category name',
                budget: 'number (required, positive) - Budget amount',
                color: 'string (required) - Hexadecimal color code with at least 6 digits'
            },
            user: {
                username: 'string (required, min 3 chars) - Unique username',
                password: 'string (required, min 6 chars) - User password',
                email: 'string (optional) - Valid email address',
                first_name: 'string (optional, 2-50 chars) - User first name',
                last_name: 'string (optional, 2-50 chars) - User last name'
            }
        },
        usage: {
            'POST /budget': {
                method: 'POST',
                url: '/budget',
                headers: { 'Content-Type': 'application/json' },
                body: {
                    title: 'string (required)',
                    budget: 'number (required, positive)',
                    color: 'string (required, hex format)'
                },
                example: {
                    title: 'Coffee',
                    budget: 25,
                    color: '#ED4523'
                }
            },
            'POST /signup': {
                method: 'POST',
                url: '/signup',
                headers: { 'Content-Type': 'application/json' },
                body: {
                    username: 'string (required, min 3 chars)',
                    password: 'string (required, min 6 chars)',
                    email: 'string (optional)'
                },
                example: {
                    username: 'johndoe',
                    password: 'securepass123',
                    email: 'john@example.com',
                    first_name: 'John',
                    last_name: 'Doe'
                }
            },
            'POST /login': {
                method: 'POST',
                url: '/login',
                headers: { 'Content-Type': 'application/json' },
                body: {
                    username: 'string (required)',
                    password: 'string (required)'
                },
                example: {
                    username: 'johndoe',
                    password: 'securepass123'
                }
            }
        }
    });
});

// Initialize MySQL and start server
initializeMySQL().then(() => {
    app.listen(port, () => {
        console.log(`\n🚀 Personal Budget API with MySQL on Digital Ocean is running!`);
        console.log(`📍 Server: http://localhost:${port}`);
        console.log(`🗄️  Database: MySQL on 143.198.136.197`);
        console.log(`� All data stored in MySQL: Budget entries + User accounts`);
        console.log(`\n📋 Available endpoints:`);
        console.log(`  GET  http://localhost:${port}/budget - Fetch budget data (MySQL)`);
        console.log(`  POST http://localhost:${port}/budget - Add budget entry (MySQL)`);
        console.log(`  POST http://localhost:${port}/signup - User signup (MySQL)`);
        console.log(`  GET  http://localhost:${port}/users - Get all users (MySQL)`);
        console.log(`  GET  http://localhost:${port}/api/info - API information`);
        console.log(`\n🔧 Remember to update the MySQL credentials in the code!`);
        console.log(`💡 Both budget data and user accounts stored in MySQL on Digital Ocean`);
    });
});
