// Budget API with MongoDB

const express = require('express');
const cors = require('cors');
const Budget = require('./models/Budget');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

// GET /budget - Fetch all budget data from MongoDB
app.get('/budget', async (req, res) => {
    try {
        const budgetItems = await Budget.find({});
        
        // Format the response to match the original JSON structure
        const budgetData = {
            myBudget: budgetItems
        };
        
        res.json(budgetData);
    } catch (error) {
        console.error('Error fetching budget data:', error);
        res.status(500).json({ 
            error: 'Failed to fetch budget data',
            message: error.message 
        });
    }
});

// POST /budget - Add new budget entry to MongoDB
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

        // Check if title already exists
        const existingEntry = await Budget.findOne({ title: title.trim() });
        if (existingEntry) {
            return res.status(409).json({ 
                error: 'Budget entry already exists',
                message: `A budget entry with title "${title}" already exists`
            });
        }

        // Create new budget entry
        const newBudgetItem = new Budget({ 
            title: title.trim(), 
            budget: budget,
            color: color.toUpperCase()
        });
        
        const savedItem = await newBudgetItem.save();
        
        res.status(201).json({
            message: 'Budget entry created successfully',
            data: savedItem
        });
        
    } catch (error) {
        console.error('Error creating budget entry:', error);
        res.status(500).json({ 
            error: 'Failed to create budget entry',
            message: error.message 
        });
    }
});

// GET /api/info - Information about available endpoints
app.get('/api/info', (req, res) => {
    res.json({
        message: 'Personal Budget API with MongoDB',
        endpoints: {
            'GET /budget': 'Fetch all budget data from database',
            'POST /budget': 'Add new budget entry to database',
            'GET /api/info': 'Get API information'
        },
        schema: {
            title: 'string (required) - Budget category name',
            budget: 'number (required, positive) - Budget amount',
            color: 'string (required) - Hexadecimal color code with at least 6 digits'
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
            }
        }
    });
});

app.listen(port, () => {
    console.log(`API served at http://localhost:${port}`);
    console.log(`Available endpoints:`);
    console.log(`  GET  http://localhost:${port}/budget - Fetch budget data`);
    console.log(`  POST http://localhost:${port}/budget - Add new budget entry`);
    console.log(`  GET  http://localhost:${port}/api/info - API information`);
});